import { describe, it, expect, vi } from "vitest";
import { applyApprove, applySendBack, filterByDiscipline, type ReviewRepo } from "@/lib/actions/review-core";
import type { Discipline, Person } from "@/lib/types";

const person = (role: Person["role"], extra: Partial<Person> = {}): Person => ({ id: `p-${role}`, full_name: role, role, discipline: null, is_admin: false, profile_id: null, ...extra });

function fakeRepo(tasks: { id: string; project_id: string; status_key: string; assignees: string[]; name: string; type_id: string; node_id: string }[]): ReviewRepo & { status: string[]; notes: string[]; activity: string[] } {
  const status: string[] = []; const notes: string[] = []; const activity: string[] = [];
  return {
    status, notes, activity,
    getTask: vi.fn(async (id) => { const t = tasks.find((x) => x.id === id); return t ? { id: t.id, project_id: t.project_id, status_key: t.status_key, assignees: t.assignees } : null; }),
    siblingTasks: vi.fn(async (id) => { const t = tasks.find((x) => x.id === id)!; return tasks.filter((x) => x.node_id === t.node_id).map((x) => ({ id: x.id, name: x.name, type_id: x.type_id, node_id: x.node_id, status_key: x.status_key })); }),
    updateStatus: vi.fn(async (id, to) => { tasks.find((x) => x.id === id)!.status_key = to; return true; }),
    setLatestVersionStatus: vi.fn(async () => {}),
    insertStatusLog: vi.fn(async (r) => { status.push(`${r.taskId}:${r.from}->${r.to}`); }),
    insertNote: vi.fn(async (n) => { notes.push(`${n.category}:${n.body}`); return "n1"; }),
    insertActivity: vi.fn(async (a) => { activity.push(`${a.taskId}:${a.action}:${a.notify.sort().join(",")}`); }),
    listSupervisors: vi.fn(async () => []),
  };
}
const base = (over: Partial<{ id: string; status_key: string; name: string; node_id: string }>) => ({ id: "t1", project_id: "pr", status_key: "pending_review", assignees: ["p-artist"], name: "Lighting-1P", type_id: "lgt", node_id: "u1", ...over });

describe("applyApprove", () => {
  it("completes the task and, when asked, marks the next pass Ready to start, logging both", async () => {
    const repo = fakeRepo([base({}), base({ id: "t2", status_key: "waiting", name: "Lighting-2P" })]);
    const r = await applyApprove(repo, person("supervisor", { discipline: "CG" }), { taskId: "t1", markNextPassReady: true });
    expect(r.ok).toBe(true);
    expect(repo.status).toEqual(["t1:pending_review->completed", "t2:waiting->ready"]);
    expect(repo.activity).toEqual(["t1:status:p-artist", "t2:status:p-artist"]);
  });
  it("does not touch the next pass when not asked", async () => {
    const repo = fakeRepo([base({}), base({ id: "t2", status_key: "waiting", name: "Lighting-2P" })]);
    await applyApprove(repo, person("supervisor"), { taskId: "t1", markNextPassReady: false });
    expect(repo.status).toEqual(["t1:pending_review->completed"]);
  });
  it("an artist cannot approve", async () => {
    const repo = fakeRepo([base({})]);
    const r = await applyApprove(repo, person("artist"), { taskId: "t1", markNextPassReady: false });
    expect(r.ok).toBe(false);
  });
});

describe("applySendBack", () => {
  it("requires a body", async () => {
    const repo = fakeRepo([base({})]);
    expect(await applySendBack(repo, person("supervisor"), { taskId: "t1", body: "  " })).toEqual({ ok: false, error: "A feedback note is required." });
  });
  it("moves to Comments with a Supervisor Feedback note and notifies the artist", async () => {
    const repo = fakeRepo([base({})]);
    const r = await applySendBack(repo, person("supervisor"), { taskId: "t1", body: "Tighten the matte." });
    expect(r.ok).toBe(true);
    expect(repo.status).toEqual(["t1:pending_review->comments"]);
    expect(repo.notes).toEqual(["Supervisor Feedback:Tighten the matte."]);
    expect(repo.activity).toEqual(["t1:status:p-artist", "t1:note:"]);
  });
});

describe("filterByDiscipline", () => {
  const items = [{ id: "a", type_name: "Lighting" }, { id: "b", type_name: "Compositing" }, { id: "c", type_name: null }];
  it("CG keeps CG types plus untyped; VFX keeps VFX plus untyped; all keeps everything", () => {
    expect(filterByDiscipline(items, "CG" as Discipline).map((x) => x.id)).toEqual(["a", "c"]);
    expect(filterByDiscipline(items, "VFX" as Discipline).map((x) => x.id)).toEqual(["b", "c"]);
    expect(filterByDiscipline(items, "all").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});
