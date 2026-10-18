import type { TaskRow } from "./board-shape";
import type { State } from "@/lib/types";

export type QueueTask = TaskRow & { project_id: string; project_name: string; path: string[]; unit_name: string; latest_feedback: { category: string; body: string; author: string; created_at: string } | null };
export type QueueGroup = { key: "ready" | "active" | "changes" | "review"; title: string; tasks: QueueTask[] };

const GROUPS: { key: QueueGroup["key"]; title: string; state: State }[] = [
  { key: "ready", title: "Ready to start", state: "ready" },
  { key: "active", title: "In progress", state: "active" },
  { key: "changes", title: "Comments to address", state: "changes" },
  { key: "review", title: "In review", state: "review" },
];

function byDueThenProject(a: QueueTask, b: QueueTask) {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
  if (!!a.due_date !== !!b.due_date) return a.due_date ? -1 : 1;
  return a.project_name.localeCompare(b.project_name) || a.name.localeCompare(b.name);
}

/** The four spec groups, in order; due date first (nulls last), then project. Done/waiting/held/cancelled tasks are not a queue. */
export function groupQueue(tasks: QueueTask[]): QueueGroup[] {
  return GROUPS.map((g) => ({ key: g.key, title: g.title, tasks: tasks.filter((t) => t.state === g.state).sort(byDueThenProject) }));
}
