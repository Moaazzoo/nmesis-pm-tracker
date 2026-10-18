import { describe, it, expect } from "vitest";
import { groupQueue, type QueueTask } from "@/lib/queries/queue-shape";

const base = { type_name: "Lighting", status_since: "2026-10-10T00:00:00Z", critical: false, note_count: 0, latest_version: null, assignees: [], risk: "none" as const, latest_feedback: null, path: [] as string[], unit_name: "S07" };
const tasks: QueueTask[] = [
  { ...base, id: "a", node_id: "u", name: "Lighting-2P", status_key: "ready", state: "ready", due_date: "2026-10-25", project_name: "Lexus 2026", project_id: "p2" },
  { ...base, id: "b", node_id: "u", name: "Lighting-1P", status_key: "ready", state: "ready", due_date: "2026-10-20", project_name: "SOUEAST_Q3", project_id: "p1" },
  { ...base, id: "c", node_id: "u", name: "Comp-1P", status_key: "in_progress", state: "active", due_date: null, project_name: "SOUEAST_Q3", project_id: "p1" },
  { ...base, id: "d", node_id: "u", name: "Comp-2P", status_key: "comments", state: "changes", due_date: "2026-10-19", project_name: "SOUEAST_Q3", project_id: "p1" },
  { ...base, id: "e", node_id: "u", name: "Anim-1P", status_key: "pending_review", state: "review", due_date: null, project_name: "Lexus 2026", project_id: "p2" },
  { ...base, id: "f", node_id: "u", name: "Done-1P", status_key: "completed", state: "done", due_date: "2026-10-01", project_name: "SOUEAST_Q3", project_id: "p1" },
  { ...base, id: "g", node_id: "u", name: "Hold-1P", status_key: "waiting", state: "not_started", due_date: null, project_name: "SOUEAST_Q3", project_id: "p1" },
];

describe("groupQueue", () => {
  const g = groupQueue(tasks);
  it("uses the four spec groups with their exact titles, in order", () => {
    expect(g.map((x) => x.title)).toEqual(["Ready to start", "In progress", "Comments to address", "In review"]);
  });
  it("sorts by due date with nulls last, then project name", () => {
    expect(g[0].tasks.map((t) => t.id)).toEqual(["b", "a"]);
  });
  it("a reopened task (Comments) lands in 'Comments to address'", () => {
    expect(g[2].tasks.map((t) => t.id)).toEqual(["d"]);
  });
  it("completed and waiting tasks are not in the queue", () => {
    const ids = g.flatMap((x) => x.tasks.map((t) => t.id));
    expect(ids).not.toContain("f");
    expect(ids).not.toContain("g");
  });
});
