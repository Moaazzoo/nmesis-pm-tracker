import { canTransition } from "@/lib/transitions";
import { can } from "@/lib/permissions";
import { noteCategoriesFor, type NoteCategory } from "@/lib/notes";
import type { Discipline, Person, StatusKey } from "@/lib/types";

export type TaskRecord = { id: string; project_id: string; status_key: string; assignees: string[] };
export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Everything the mutation logic needs from storage. Server actions bind this to Supabase; tests pass a fake. */
export interface TaskRepo {
  getTask(id: string): Promise<TaskRecord | null>;
  /** Compare-and-set: applies only if the task is still at `from`; returns false otherwise. */
  updateStatus(id: string, to: StatusKey, at: Date, from?: string): Promise<boolean>;
  insertStatusLog(r: { taskId: string; from: string; to: StatusKey; by: string; at: Date }): Promise<void>;
  insertNote(n: { taskId: string; authorId: string; category: NoteCategory; body: string }): Promise<string>;
  insertActivity(a: { projectId: string; taskId: string; actorId: string; action: string; payload: Record<string, unknown>; notify: string[] }): Promise<void>;
  listSupervisors(discipline?: Discipline | null): Promise<string[]>;
  taskDiscipline(taskId: string): Promise<Discipline | null>;
}

export const CAS_ERROR = "This task was changed by someone else a moment ago — refresh and look again.";
const REOPEN = new Set(["completed->comments", "completed->in_progress", "cancelled->waiting"]);

/** The category a move's note is filed under: reopens are always Production Note; send-backs are feedback. */
export function noteCategoryForMove(from: string, to: StatusKey, actor: Person, chosen: NoteCategory | undefined): NoteCategory {
  if (REOPEN.has(`${from}->${to}`)) return "Production Note";
  if (to === "comments") {
    if (chosen === "Production Note" || chosen === "Client Feedback" || chosen === "Supervisor Feedback") return chosen;
    return actor.role === "supervisor" && !actor.is_admin ? "Supervisor Feedback" : "Client Feedback";
  }
  return chosen ?? "Production Note";
}

/** Supervisors of the task's discipline first; everyone if none. */
export async function supervisorsFor(repo: Pick<TaskRepo, "listSupervisors" | "taskDiscipline">, taskId: string): Promise<string[]> {
  const d = await repo.taskDiscipline(taskId);
  const sups = d ? await repo.listSupervisors(d) : [];
  return sups.length ? sups : repo.listSupervisors(null);
}

export async function applyStatus(repo: TaskRepo, actor: Person, input: { taskId: string; to: StatusKey; note?: { category: NoteCategory; body: string } }): Promise<ActionResult<{ status_key: StatusKey }>> {
  const task = await repo.getTask(input.taskId);
  if (!task) return { ok: false, error: "Task not found." };
  const isAssignee = task.assignees.includes(actor.id);
  const check = canTransition(task.status_key as StatusKey, input.to, actor, { isAssignee });
  if (!check.ok) return { ok: false, error: check.reason };
  const body = input.note?.body?.trim();
  if (check.needsNote && !body) return { ok: false, error: "A feedback note is required." };
  let category: NoteCategory | undefined;
  if (body) {
    category = noteCategoryForMove(task.status_key, input.to, actor, input.note?.category);
    if (!noteCategoriesFor(actor).includes(category)) return { ok: false, error: `You cannot post a ${category}.` };
  }
  const at = new Date();
  const applied = await repo.updateStatus(task.id, input.to, at, task.status_key);
  if (!applied) return { ok: false, error: CAS_ERROR };
  await repo.insertStatusLog({ taskId: task.id, from: task.status_key, to: input.to, by: actor.id, at });
  const noteId = body && category ? await repo.insertNote({ taskId: task.id, authorId: actor.id, category, body }) : null;
  const notify = input.to === "pending_review" ? await supervisorsFor(repo, task.id) : input.to === "comments" || input.to === "ready" ? task.assignees : [];
  await repo.insertActivity({ projectId: task.project_id, taskId: task.id, actorId: actor.id, action: "status", payload: { from: task.status_key, to: input.to, ...(body ? { note: body, noteId } : {}) }, notify: notify.filter((p) => p !== actor.id) });
  if (body && category) await repo.insertActivity({ projectId: task.project_id, taskId: task.id, actorId: actor.id, action: "note", payload: { category, noteId }, notify: [] });
  return { ok: true, data: { status_key: input.to } };
}

export interface FieldRepo {
  getTask(id: string): Promise<TaskRecord | null>;
  setAssignees(taskId: string, personIds: string[]): Promise<void>;
  setDue(taskId: string, due: string | null): Promise<void>;
  setCritical(taskId: string, critical: boolean): Promise<void>;
  insertActivity: TaskRepo["insertActivity"];
}

export async function applyAssign(repo: FieldRepo, actor: Person, input: { taskId: string; personIds: string[] }): Promise<ActionResult> {
  if (!can(actor, "assign")) return { ok: false, error: "Only production can assign tasks." };
  const task = await repo.getTask(input.taskId);
  if (!task) return { ok: false, error: "Task not found." };
  const ids = [...new Set(input.personIds)];
  await repo.setAssignees(task.id, ids);
  const added = ids.filter((p) => !task.assignees.includes(p));
  await repo.insertActivity({ projectId: task.project_id, taskId: task.id, actorId: actor.id, action: "assign", payload: { personIds: ids }, notify: added.filter((p) => p !== actor.id) });
  return { ok: true };
}

export async function applyDue(repo: FieldRepo, actor: Person, input: { taskId: string; due_date: string | null }): Promise<ActionResult> {
  if (!can(actor, "edit_structure")) return { ok: false, error: "Only production can change due dates." };
  const task = await repo.getTask(input.taskId);
  if (!task) return { ok: false, error: "Task not found." };
  await repo.setDue(task.id, input.due_date);
  await repo.insertActivity({ projectId: task.project_id, taskId: task.id, actorId: actor.id, action: "due", payload: { due_date: input.due_date }, notify: task.assignees.filter((p) => p !== actor.id) });
  return { ok: true };
}

export async function applyCritical(repo: FieldRepo, actor: Person, input: { taskId: string; critical: boolean }): Promise<ActionResult> {
  if (!can(actor, "edit_structure")) return { ok: false, error: "Only production can mark a task critical." };
  const task = await repo.getTask(input.taskId);
  if (!task) return { ok: false, error: "Task not found." };
  await repo.setCritical(task.id, input.critical);
  await repo.insertActivity({ projectId: task.project_id, taskId: task.id, actorId: actor.id, action: "critical", payload: { critical: input.critical }, notify: [] });
  return { ok: true };
}
