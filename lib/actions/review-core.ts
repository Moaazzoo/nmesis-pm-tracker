import { can } from "@/lib/permissions";
import { canTransition } from "@/lib/transitions";
import { nextPass } from "@/lib/passes";
import { disciplineOfType } from "@/lib/statuses";
import type { Discipline, Person, StatusKey } from "@/lib/types";
import type { ActionResult, TaskRecord } from "./tasks-core";

export type SiblingTask = { id: string; name: string; type_id: string | null; node_id: string; status_key: string };

export interface ReviewRepo {
  getTask(id: string): Promise<TaskRecord | null>;
  siblingTasks(taskId: string): Promise<SiblingTask[]>;
  updateStatus(id: string, to: StatusKey, at: Date, from?: string): Promise<boolean>;
  setLatestVersionStatus(taskId: string, status: "approved" | "needs_changes"): Promise<void>;
  insertStatusLog(r: { taskId: string; from: string; to: StatusKey; by: string; at: Date }): Promise<void>;
  insertNote(n: { taskId: string; authorId: string; category: "Supervisor Feedback"; body: string }): Promise<string>;
  insertActivity(a: { projectId: string; taskId: string; actorId: string; action: string; payload: Record<string, unknown>; notify: string[] }): Promise<void>;
  listSupervisors(discipline: Discipline | null): Promise<string[]>;
}

const CAS_ERROR = "This task was changed by someone else a moment ago — refresh and look again.";
async function move(repo: ReviewRepo, actor: Person, task: TaskRecord, to: StatusKey, notify: string[], extra: Record<string, unknown> = {}): Promise<boolean> {
  const at = new Date();
  const applied = await repo.updateStatus(task.id, to, at, task.status_key);
  if (!applied) return false;
  await repo.insertStatusLog({ taskId: task.id, from: task.status_key, to, by: actor.id, at });
  await repo.insertActivity({ projectId: task.project_id, taskId: task.id, actorId: actor.id, action: "status", payload: { from: task.status_key, to, ...extra }, notify: notify.filter((p) => p !== actor.id) });
  return true;
}

/** Approve: Pending Review → Completed; optionally the next pass (same type, same unit) Waiting → Ready to start. */
export async function applyApprove(repo: ReviewRepo, actor: Person, input: { taskId: string; markNextPassReady: boolean }): Promise<ActionResult<{ nextPassId: string | null }>> {
  if (!can(actor, "approve")) return { ok: false, error: "Only supervisors and production can approve." };
  const task = await repo.getTask(input.taskId);
  if (!task) return { ok: false, error: "Task not found." };
  const check = canTransition(task.status_key as StatusKey, "completed", actor, { isAssignee: false });
  if (!check.ok) return { ok: false, error: check.reason };
  if (!(await move(repo, actor, task, "completed", task.assignees))) return { ok: false, error: CAS_ERROR };
  await repo.setLatestVersionStatus(task.id, "approved");
  let nextPassId: string | null = null;
  if (input.markNextPassReady) {
    const sibs = await repo.siblingTasks(task.id);
    const me = sibs.find((s) => s.id === task.id);
    const next = me ? nextPass(sibs.map((s) => ({ ...s, type_id: s.type_id ?? "" })), { ...me, type_id: me.type_id ?? "" }) : null;
    if (next && next.status_key === "waiting") {
      const nt = await repo.getTask(next.id);
      if (nt) { await move(repo, actor, nt, "ready", nt.assignees); nextPassId = nt.id; }
    }
  }
  return { ok: true, data: { nextPassId } };
}

/** Send back: Pending Review → Comments, with a mandatory Supervisor Feedback note; the artist is notified. */
export async function applySendBack(repo: ReviewRepo, actor: Person, input: { taskId: string; body: string }): Promise<ActionResult> {
  if (!can(actor, "send_back")) return { ok: false, error: "Only supervisors and production can send work back." };
  const body = input.body.trim();
  if (!body) return { ok: false, error: "A feedback note is required." };
  const task = await repo.getTask(input.taskId);
  if (!task) return { ok: false, error: "Task not found." };
  const check = canTransition(task.status_key as StatusKey, "comments", actor, { isAssignee: false });
  if (!check.ok) return { ok: false, error: check.reason };
  if (!(await move(repo, actor, task, "comments", task.assignees, { note: body }))) return { ok: false, error: CAS_ERROR };
  await repo.setLatestVersionStatus(task.id, "needs_changes");
  const noteId = await repo.insertNote({ taskId: task.id, authorId: actor.id, category: "Supervisor Feedback", body });
  await repo.insertActivity({ projectId: task.project_id, taskId: task.id, actorId: actor.id, action: "note", payload: { category: "Supervisor Feedback", noteId }, notify: [] });
  return { ok: true };
}

/** Discipline filter for the review queue: a supervisor's own discipline plus untyped tasks; "all" shows everything. */
export function filterByDiscipline<T extends { type_name: string | null }>(items: T[], discipline: Discipline | "all"): T[] {
  if (discipline === "all") return items;
  return items.filter((i) => !i.type_name || disciplineOfType(i.type_name) === discipline || disciplineOfType(i.type_name) === null);
}
