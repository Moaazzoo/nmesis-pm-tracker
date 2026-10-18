import { can } from "@/lib/permissions";
import { noteCategoriesFor, type NoteCategory } from "@/lib/notes";
import { STATUS_BY_KEY } from "@/lib/statuses";
import type { Discipline, Person, StatusKey } from "@/lib/types";
import type { ActionResult, TaskRecord } from "./tasks-core";

export interface DrawerRepo {
  getTask(id: string): Promise<TaskRecord | null>;
  insertNote(n: { taskId: string; versionId?: string | null; authorId: string; category: NoteCategory; body: string; replyTo?: string | null }): Promise<string>;
  maxVersionNumber(taskId: string): Promise<number>;
  insertVersion(v: { taskId: string; number: number; submittedBy: string; link: string; note: string | null }): Promise<string>;
  updateStatus(id: string, to: StatusKey, at: Date): Promise<void>;
  insertStatusLog(r: { taskId: string; from: string; to: StatusKey; by: string; at: Date }): Promise<void>;
  insertActivity(a: { projectId: string; taskId: string; actorId: string; action: string; payload: Record<string, unknown>; notify: string[] }): Promise<void>;
  listSupervisors(discipline: Discipline | null): Promise<string[]>;
  taskDiscipline(taskId: string): Promise<Discipline | null>;
}

export async function applyAddNote(repo: DrawerRepo, actor: Person, input: { taskId: string; category: NoteCategory; body: string; versionId?: string | null; replyTo?: string | null }): Promise<ActionResult<{ id: string }>> {
  if (!noteCategoriesFor(actor).includes(input.category)) return { ok: false, error: `You cannot post a ${input.category}.` };
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Write something first." };
  const task = await repo.getTask(input.taskId);
  if (!task) return { ok: false, error: "Task not found." };
  const id = await repo.insertNote({ taskId: task.id, versionId: input.versionId ?? null, authorId: actor.id, category: input.category, body, replyTo: input.replyTo ?? null });
  await repo.insertActivity({ projectId: task.project_id, taskId: task.id, actorId: actor.id, action: "note", payload: { category: input.category, noteId: id }, notify: task.assignees.filter((p) => p !== actor.id) });
  return { ok: true, data: { id } };
}

/** New version = max+1; a task In Progress or in Comments moves to Pending Review and the supervisors are notified. */
export async function applySubmitVersion(repo: DrawerRepo, actor: Person, input: { taskId: string; link: string; note?: string | null }): Promise<ActionResult<{ id: string; number: number; status_key: StatusKey }>> {
  const task = await repo.getTask(input.taskId);
  if (!task) return { ok: false, error: "Task not found." };
  const isAssignee = task.assignees.includes(actor.id);
  if (!can(actor, "submit_version", { isAssignee })) return { ok: false, error: isAssignee ? "Your role cannot submit versions." : "Only the assigned artist can submit a version." };
  const link = input.link.trim();
  if (!link) return { ok: false, error: "Add the file path or link of the version." };
  if (!["in_progress", "comments", "pending_review"].includes(task.status_key)) return { ok: false, error: "Start the task first." };
  const number = (await repo.maxVersionNumber(task.id)) + 1;
  const id = await repo.insertVersion({ taskId: task.id, number, submittedBy: actor.id, link, note: input.note?.trim() || null });
  const at = new Date();
  let status_key = task.status_key as StatusKey;
  if (task.status_key !== "pending_review") {
    status_key = "pending_review";
    await repo.updateStatus(task.id, status_key, at);
    await repo.insertStatusLog({ taskId: task.id, from: task.status_key, to: status_key, by: actor.id, at });
  }
  const discipline = await repo.taskDiscipline(task.id);
  let sups = await repo.listSupervisors(discipline);
  if (sups.length === 0) sups = await repo.listSupervisors(null);
  await repo.insertActivity({ projectId: task.project_id, taskId: task.id, actorId: actor.id, action: "version", payload: { number, versionId: id }, notify: sups.filter((p) => p !== actor.id) });
  return { ok: true, data: { id, number, status_key } };
}

export type HistoryItem = { id: string; at: string; who: string; text: string; kind: "status" | "activity" };
const ACTION_TEXT: Record<string, (p: Record<string, unknown>) => string> = {
  note: (p) => `added a ${String(p.category ?? "note")}`,
  version: (p) => `submitted version ${String(p.number ?? "")}`.trim(),
  assign: () => "changed the assignees",
  due: (p) => (p.due_date ? `set the due date to ${String(p.due_date)}` : "cleared the due date"),
  critical: (p) => (p.critical ? "marked the task critical" : "removed the critical mark"),
  status: () => "changed the status",
};

/** Status log + activity as one list, newest first. Status changes read as "In Progress → Pending Review". */
export function mergeHistory(
  statusLog: { id: string; at: string; from_status_key: string | null; to_status_key: string; by: string | null }[],
  activity: { id: string; at: string; action: string; actor: string | null; payload: Record<string, unknown> }[],
): HistoryItem[] {
  const name = (k: string | null) => (k && STATUS_BY_KEY[k as StatusKey]?.name) || (k ?? "—");
  const a: HistoryItem[] = statusLog.map((s) => ({ id: s.id, at: s.at, who: s.by ?? "Someone", text: `${name(s.from_status_key)} → ${name(s.to_status_key)}`, kind: "status" }));
  const b: HistoryItem[] = activity.filter((x) => x.action !== "status").map((x) => ({ id: x.id, at: x.at, who: x.actor ?? "Someone", text: (ACTION_TEXT[x.action] ?? (() => x.action))(x.payload), kind: "activity" }));
  return [...a, ...b].sort((x, y) => y.at.localeCompare(x.at));
}
