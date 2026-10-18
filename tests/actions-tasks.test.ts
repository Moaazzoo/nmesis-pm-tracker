import { describe, it, expect, vi } from "vitest";
import { applyStatus, type TaskRepo } from "@/lib/actions/tasks-core";
import type { Person } from "@/lib/types";

const person = (role: Person["role"], extra: Partial<Person> = {}): Person => ({ id: `p-${role}`, full_name: role, role, discipline: null, is_admin: false, profile_id: null, ...extra });

function fakeRepo(task: { id: string; project_id: string; status_key: string; assignees: string[] }): TaskRepo & { log: string[]; activity: string[] } {
  const log: string[] = []; const activity: string[] = [];
  return {
    log, activity,
    getTask: vi.fn(async () => ({ ...task })),
    updateStatus: vi.fn(async (_id, to) => { task.status_key = to; }),
    insertStatusLog: vi.fn(async (r) => { log.push(`${r.from}->${r.to}`); }),
    insertNote: vi.fn(async () => "note-1"),
    insertActivity: vi.fn(async (a) => { activity.push(`${a.action}:${a.notify.sort().join(",")}`); }),
    listSupervisors: vi.fn(async () => ["sup-cg", "sup-vfx"]),
  };
}

describe("applyStatus", () => {
  it("refuses an illegal move with the transition reason", async () => {
    const repo = fakeRepo({ id: "t1", project_id: "pr", status_key: "waiting", assignees: ["p-artist"] });
    const r = await applyStatus(repo, person("artist"), { taskId: "t1", to: "completed" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cannot move/i);
    expect(repo.log).toEqual([]);
  });
  it("requires a note when sending back to Comments", async () => {
    const repo = fakeRepo({ id: "t1", project_id: "pr", status_key: "pending_review", assignees: ["p-artist"] });
    const r = await applyStatus(repo, person("supervisor"), { taskId: "t1", to: "comments" });
    expect(r).toEqual({ ok: false, error: "A feedback note is required." });
  });
  it("logs a legal move once and notifies the assignees on Comments", async () => {
    const repo = fakeRepo({ id: "t1", project_id: "pr", status_key: "pending_review", assignees: ["p-artist"] });
    const r = await applyStatus(repo, person("supervisor"), { taskId: "t1", to: "comments", note: { category: "Supervisor Feedback", body: "Tighten the matte." } });
    expect(r.ok).toBe(true);
    expect(repo.log).toEqual(["pending_review->comments"]);
    expect(repo.activity).toEqual(["status:p-artist"]);
    expect(repo.insertNote).toHaveBeenCalledTimes(1);
  });
  it("notifies supervisors when a task reaches Pending Review", async () => {
    const repo = fakeRepo({ id: "t1", project_id: "pr", status_key: "in_progress", assignees: ["p-artist"] });
    const r = await applyStatus(repo, person("artist"), { taskId: "t1", to: "pending_review" });
    expect(r.ok).toBe(true);
    expect(repo.activity).toEqual(["status:sup-cg,sup-vfx"]);
  });
  it("artist who is not assigned is refused", async () => {
    const repo = fakeRepo({ id: "t1", project_id: "pr", status_key: "in_progress", assignees: ["someone-else"] });
    const r = await applyStatus(repo, person("artist"), { taskId: "t1", to: "pending_review" });
    expect(r.ok).toBe(false);
  });
});
