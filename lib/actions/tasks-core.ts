import { canTransition } from "@/lib/transitions";
import { can } from "@/lib/permissions";
import { noteCategoriesFor, type NoteCategory } from "@/lib/notes";
import type { Person, StatusKey } from "@/lib/types";

export type TaskRecord = { id: string; project_id: string; status_key: string; assignees: string[] };
export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Everything the mutation logic needs from storage. Server actions bind this to Supabase; tests pass a fake. */
export interface TaskRepo {
  getTask(id: string): Promise<TaskRecord | null>;
  updateStatus(id: string, to: StatusKey, at: Date): Promise<void>;
  insertStatusLog(r: { taskId: string; from: string; to: StatusKey; by: string; at: Date }): Promise<void>;
  insertNote(n: { taskId: string; authorId: string; category: NoteCategory; body: string }): Promise<string>;
  insertActivity(a: { projectId: string; taskId: string; actorId: string; action: string; payload: Record<string, unknown>; notify: string[] }): Promise<void>;
  listSupervisors(): Promise<string[]>;
}

export async function applyStatus(repo: TaskRepo, actor: Person, input: { taskId: string; to: StatusKey; note?: { category: NoteCategory; body: string } }): Promise<ActionResult<{ status_key: StatusKey }>> {
  const task = await repo.getTask(input.taskId);
  if (!task) return { ok: false, error: "Task not found." };
  const isAssignee = task.assignees.includes(actor.id);
  const check = canTransition(task.status_key as StatusKey, input.to, actor, { isAssignee });
  if (!check.ok) return { ok: false, error: check.reason };
  const body = input.note?.body?.trim();
  if (check.needsNote && !body) return { ok: false, error: "A feedback note is required." };
  if (body) {
    const category = input.note!.category;
    if (!noteCategoriesFor(actor).includes(category)) return { ok: false, error: `You cannot post a ${category}.` };
  }
  const at = new Date();
  await repo.updateStatus(task.id, input.to, at);
  await repo.insertStatusLog({ taskId: task.id, from: task.status_key, to: input.to, by: actor.id, at });
  if (body) await repo.insertNote({ taskId: task.id, authorId: actor.id, category: input.note!.category, body });
  const notify = input.to === "pending_review" ? await repo.listSupervisors() : input.to === "comments" || input.to === "ready" ? task.assignees : [];
  await repo.insertActivity({ projectId: task.project_id, taskId: task.id, actorId: actor.id, action: "status", payload: { from: task.status_key, to: input.to }, notify: notify.filter((p) => p !== actor.id) });
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
