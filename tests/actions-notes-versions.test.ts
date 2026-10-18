import { describe, it, expect, vi } from "vitest";
import { applyAddNote, applySubmitVersion, mergeHistory, type DrawerRepo } from "@/lib/actions/drawer-core";
import type { Discipline, Person } from "@/lib/types";

const person = (role: Person["role"], extra: Partial<Person> = {}): Person => ({ id: `p-${role}`, full_name: role, role, discipline: null, is_admin: false, profile_id: null, ...extra });

function fakeRepo(task: { id: string; project_id: string; status_key: string; assignees: string[] }, versions: number[] = []): DrawerRepo & { notes: string[]; versions: number[]; status: string[]; activity: string[] } {
  const notes: string[] = []; const status: string[] = []; const activity: string[] = [];
  return {
    notes, versions, status, activity,
    getTask: vi.fn(async () => ({ ...task })),
    insertNote: vi.fn(async (n) => { notes.push(`${n.category}:${n.body}`); return `n${notes.length}`; }),
    maxVersionNumber: vi.fn(async () => (versions.length ? Math.max(...versions) : 0)),
    insertVersion: vi.fn(async (v) => { versions.push(v.number); return `v${v.number}`; }),
    updateStatus: vi.fn(async (_id, to) => { task.status_key = to; }),
    insertStatusLog: vi.fn(async (r) => { status.push(`${r.from}->${r.to}`); }),
    insertActivity: vi.fn(async (a) => { activity.push(`${a.action}:${a.notify.sort().join(",")}`); }),
    listSupervisors: vi.fn(async (discipline) => (discipline === "CG" ? ["sup-cg"] : ["sup-cg", "sup-vfx"])),
    taskDiscipline: vi.fn(async (): Promise<Discipline | null> => "CG"),
  };
}

describe("applyAddNote", () => {
  it("rejects a category outside the actor's set", async () => {
    const repo = fakeRepo({ id: "t1", project_id: "pr", status_key: "in_progress", assignees: ["p-artist"] });
    const r = await applyAddNote(repo, person("artist"), { taskId: "t1", category: "Client Feedback", body: "hi" });
    expect(r.ok).toBe(false);
    expect(repo.notes).toEqual([]);
  });
  it("stores an allowed note and notifies the task's people", async () => {
    const repo = fakeRepo({ id: "t1", project_id: "pr", status_key: "in_progress", assignees: ["p-artist"] });
    const r = await applyAddNote(repo, person("production"), { taskId: "t1", category: "Production Note", body: "Path updated." });
    expect(r.ok).toBe(true);
    expect(repo.notes).toEqual(["Production Note:Path updated."]);
    expect(repo.activity).toEqual(["note:p-artist"]);
  });
});

describe("applySubmitVersion", () => {
  it("numbers versions 1 then 2 and moves In Progress to Pending Review, notifying discipline supervisors", async () => {
    const repo = fakeRepo({ id: "t1", project_id: "pr", status_key: "in_progress", assignees: ["p-artist"] });
    const r1 = await applySubmitVersion(repo, person("artist"), { taskId: "t1", link: "S07_v001.mov" });
    expect(r1.ok && r1.data?.number).toBe(1);
    expect(repo.status).toEqual(["in_progress->pending_review"]);
    expect(repo.activity).toEqual(["version:sup-cg"]);
    const r2 = await applySubmitVersion(repo, person("artist"), { taskId: "t1", link: "S07_v002.mov" });
    expect(r2.ok && r2.data?.number).toBe(2);
  });
  it("refuses when the task has not been started", async () => {
    const repo = fakeRepo({ id: "t1", project_id: "pr", status_key: "waiting", assignees: ["p-artist"] });
    const r = await applySubmitVersion(repo, person("artist"), { taskId: "t1", link: "x.mov" });
    expect(r).toEqual({ ok: false, error: "Start the task first." });
    expect(repo.versions).toEqual([]);
  });
  it("artist not assigned is refused", async () => {
    const repo = fakeRepo({ id: "t1", project_id: "pr", status_key: "in_progress", assignees: ["other"] });
    const r = await applySubmitVersion(repo, person("artist"), { taskId: "t1", link: "x.mov" });
    expect(r.ok).toBe(false);
  });
});

describe("mergeHistory", () => {
  it("merges status log and activity, newest first", () => {
    const h = mergeHistory(
      [{ id: "s1", at: "2026-10-14T18:16:00Z", from_status_key: "in_progress", to_status_key: "pending_review", by: "Ziad Yasser" }],
      [{ id: "a1", at: "2026-10-15T12:09:00Z", action: "note", actor: "Production Team", payload: { category: "Client Feedback" } }],
    );
    expect(h.map((x) => x.id)).toEqual(["a1", "s1"]);
    expect(h[1].text).toContain("In Progress");
    expect(h[1].text).toContain("Pending Review");
  });
});
