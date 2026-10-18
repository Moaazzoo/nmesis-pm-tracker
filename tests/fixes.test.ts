import { describe, it, expect, vi } from "vitest";
import { parsePass, nextPass } from "@/lib/passes";
import { legalNext } from "@/lib/transitions";
import { applyStatus, type TaskRepo } from "@/lib/actions/tasks-core";
import { applyAddNote, type DrawerRepo } from "@/lib/actions/drawer-core";
import { applyApprove, applySendBack, type ReviewRepo } from "@/lib/actions/review-core";
import { applyLens, resolveAccess } from "@/lib/auth-rules";
import { safeRedirect } from "@/lib/queries/activity-shape";
import { must } from "@/lib/queries/db";
import { descendantIds } from "@/lib/actions/setup-core";
import { upsertOptions } from "../scripts/seed-plan";
import { STATUS_BY_KEY } from "@/lib/statuses";
import type { Discipline, Person } from "@/lib/types";

const person = (role: Person["role"], extra: Partial<Person> = {}): Person => ({ id: `p-${role}`, full_name: role, role, discipline: null, is_admin: false, profile_id: null, ...extra });

describe("#3 nextPass matches the base name too", () => {
  const tasks = [
    { id: "a", name: "Shading-1P", type_id: "shd", node_id: "u" },
    { id: "b", name: "Shading-UE-2P", type_id: "shd", node_id: "u" },
    { id: "c", name: "Comp-1P", type_id: "cmp", node_id: "u" },
    { id: "d", name: "Lighting-2P", type_id: "cmp", node_id: "u" },
    { id: "e", name: "Comp-2P", type_id: "cmp", node_id: "u" },
  ];
  it("does not chain Shading-1P to Shading-UE-2P", () => expect(nextPass(tasks, tasks[0])).toBeNull());
  it("chains Comp-1P to Comp-2P, not to Lighting-2P of the same type", () => expect(nextPass(tasks, tasks[2])?.id).toBe("e"));
  it("base comparison is case-insensitive and trimmed", () => expect(parsePass("comp -2P").base.toLowerCase()).toBe("comp"));
});

describe("#11 artists do not set Pending Review by hand", () => {
  it("artist from In Progress has no manual move; a version submission does it", () => {
    expect(legalNext("in_progress", person("artist"), { isAssignee: true })).toEqual([]);
  });
  it("production can still move to Pending Review", () => {
    expect(legalNext("in_progress", person("production"), { isAssignee: false })).toContain("pending_review");
  });
});

function taskRepo(task: { id: string; project_id: string; status_key: string; assignees: string[] }, opts: { casFails?: boolean } = {}): TaskRepo & { log: string[]; activity: { action: string; payload: Record<string, unknown>; notify: string[] }[]; notes: string[] } {
  const log: string[] = []; const activity: { action: string; payload: Record<string, unknown>; notify: string[] }[] = []; const notes: string[] = [];
  return {
    log, activity, notes,
    getTask: vi.fn(async () => ({ ...task })),
    updateStatus: vi.fn(async (_id, to) => { if (opts.casFails) return false; task.status_key = to; return true; }),
    insertStatusLog: vi.fn(async (r) => { log.push(`${r.from}->${r.to}`); }),
    insertNote: vi.fn(async (n) => { notes.push(`${n.category}:${n.body}`); return "n1"; }),
    insertActivity: vi.fn(async (a) => { activity.push({ action: a.action, payload: a.payload, notify: a.notify }); }),
    listSupervisors: vi.fn(async (d?: Discipline | null) => (d === "CG" ? ["sup-cg"] : ["sup-cg", "sup-vfx"])),
    taskDiscipline: vi.fn(async (): Promise<Discipline | null> => "CG"),
  };
}

describe("#1 #2 reopen and send-back notes", () => {
  it("a reopen note is always filed as Production Note, whatever was chosen", async () => {
    const repo = taskRepo({ id: "t", project_id: "pr", status_key: "completed", assignees: ["p-artist"] });
    const r = await applyStatus(repo, person("production"), { taskId: "t", to: "comments", note: { category: "Task Definition", body: "Client changed the plate." } });
    expect(r.ok).toBe(true);
    expect(repo.notes).toEqual(["Production Note:Client changed the plate."]);
  });
  it("a supervisor send-back is filed as Supervisor Feedback; production's as Client Feedback unless Production Note was chosen", async () => {
    const a = taskRepo({ id: "t", project_id: "pr", status_key: "pending_review", assignees: ["p-artist"] });
    await applyStatus(a, person("supervisor"), { taskId: "t", to: "comments", note: { category: "Task Definition", body: "x" } });
    expect(a.notes).toEqual(["Supervisor Feedback:x"]);
    const b = taskRepo({ id: "t", project_id: "pr", status_key: "pending_review", assignees: ["p-artist"] });
    await applyStatus(b, person("production"), { taskId: "t", to: "comments", note: { category: "Artist Note", body: "y" } });
    expect(b.notes).toEqual(["Client Feedback:y"]);
    const c = taskRepo({ id: "t", project_id: "pr", status_key: "pending_review", assignees: ["p-artist"] });
    await applyStatus(c, person("production"), { taskId: "t", to: "comments", note: { category: "Production Note", body: "z" } });
    expect(c.notes).toEqual(["Production Note:z"]);
  });
  it("the reason travels into history: the status activity carries the note body and a note activity is logged", async () => {
    const repo = taskRepo({ id: "t", project_id: "pr", status_key: "completed", assignees: ["p-artist"] });
    await applyStatus(repo, person("production"), { taskId: "t", to: "in_progress", note: { category: "Production Note", body: "Redo the hood." } });
    expect(repo.activity.map((a) => a.action)).toEqual(["status", "note"]);
    expect(repo.activity[0].payload.note).toBe("Redo the hood.");
  });
});

describe("#7 compare-and-set on the status write", () => {
  it("refuses when the status changed meanwhile and writes nothing else", async () => {
    const repo = taskRepo({ id: "t", project_id: "pr", status_key: "pending_review", assignees: ["p-artist"] }, { casFails: true });
    const r = await applyStatus(repo, person("supervisor"), { taskId: "t", to: "completed" });
    expect(r).toEqual({ ok: false, error: "This task was changed by someone else a moment ago — refresh and look again." });
    expect(repo.log).toEqual([]); expect(repo.activity).toEqual([]);
  });
  it("Pending Review set by production notifies the discipline's supervisors first", async () => {
    const repo = taskRepo({ id: "t", project_id: "pr", status_key: "in_progress", assignees: ["p-artist"] });
    await applyStatus(repo, person("production"), { taskId: "t", to: "pending_review" });
    expect(repo.activity[0].notify).toEqual(["sup-cg"]);
  });
});

function drawerRepo(task: { id: string; project_id: string; status_key: string; assignees: string[] }): DrawerRepo & { notes: string[] } {
  const notes: string[] = [];
  return {
    notes,
    getTask: vi.fn(async () => ({ ...task })),
    insertNote: vi.fn(async (n) => { notes.push(`${n.category}:${n.body}`); return "n1"; }),
    maxVersionNumber: vi.fn(async () => 0), insertVersion: vi.fn(async () => "v1"),
    updateStatus: vi.fn(async () => true), insertStatusLog: vi.fn(async () => {}), insertActivity: vi.fn(async () => {}),
    listSupervisors: vi.fn(async () => []), taskDiscipline: vi.fn(async (): Promise<Discipline | null> => null),
    versionTask: vi.fn(async (id) => (id === "v-ok" ? "t" : "other")),
    noteTask: vi.fn(async (id) => (id === "n-ok" ? "t" : "other")),
  };
}
describe("#12 artists note only their own tasks; references must belong to the task", () => {
  it("artist not assigned cannot post", async () => {
    const repo = drawerRepo({ id: "t", project_id: "pr", status_key: "in_progress", assignees: ["someone"] });
    const r = await applyAddNote(repo, person("artist"), { taskId: "t", category: "Artist Note", body: "hi" });
    expect(r.ok).toBe(false); expect(repo.notes).toEqual([]);
  });
  it("a version or reply from another task is refused", async () => {
    const repo = drawerRepo({ id: "t", project_id: "pr", status_key: "in_progress", assignees: ["p-artist"] });
    expect((await applyAddNote(repo, person("artist"), { taskId: "t", category: "Artist Note", body: "hi", versionId: "v-bad" })).ok).toBe(false);
    expect((await applyAddNote(repo, person("artist"), { taskId: "t", category: "Artist Note", body: "hi", replyTo: "n-bad" })).ok).toBe(false);
    expect((await applyAddNote(repo, person("artist"), { taskId: "t", category: "Artist Note", body: "hi", versionId: "v-ok", replyTo: "n-ok" })).ok).toBe(true);
  });
});

function reviewRepo(): ReviewRepo & { versionStatus: string[] } {
  const versionStatus: string[] = [];
  const task = { id: "t", project_id: "pr", status_key: "pending_review", assignees: ["p-artist"] };
  return {
    versionStatus,
    getTask: vi.fn(async () => ({ ...task })), siblingTasks: vi.fn(async () => []),
    updateStatus: vi.fn(async (_i, to) => { task.status_key = to; return true; }), insertStatusLog: vi.fn(async () => {}),
    insertNote: vi.fn(async () => "n"), insertActivity: vi.fn(async () => {}), listSupervisors: vi.fn(async () => []),
    setLatestVersionStatus: vi.fn(async (_t, s) => { versionStatus.push(s); }),
  };
}
describe("#13 version status follows the decision", () => {
  it("approve → latest version approved; send back → needs_changes", async () => {
    const a = reviewRepo(); await applyApprove(a, person("supervisor"), { taskId: "t", markNextPassReady: false }); expect(a.versionStatus).toEqual(["approved"]);
    const b = reviewRepo(); await applySendBack(b, person("supervisor"), { taskId: "t", body: "fix" }); expect(b.versionStatus).toEqual(["needs_changes"]);
  });
});

describe("#9 #10 #15 access and lens", () => {
  it("applyLens drops admin rights while viewing as another role", () => {
    const p = applyLens(person("supervisor", { is_admin: true, discipline: "CG" }), "artist");
    expect(p.role).toBe("artist"); expect(p.is_admin).toBe(false);
  });
  it("no lens keeps everything", () => {
    const p = applyLens(person("supervisor", { is_admin: true }), undefined);
    expect(p.is_admin).toBe(true); expect(p.role).toBe("supervisor");
  });
  it("resolveAccess: missing or inactive profile → no-access; inactive person → viewer; otherwise ok", () => {
    expect(resolveAccess(null, null)).toBe("no-access");
    expect(resolveAccess({ active: false }, { active: true, role: "artist" })).toBe("no-access");
    expect(resolveAccess({ active: true }, { active: false, role: "artist" })).toBe("viewer");
    expect(resolveAccess({ active: true }, { active: true, role: "artist" })).toBe("ok");
    expect(resolveAccess({ active: true }, null)).toBe("viewer");
  });
});

describe("misc fixes", () => {
  it("safeRedirect only allows same-site paths", () => {
    expect(safeRedirect("/p/1?task=2")).toBe("/p/1?task=2");
    expect(safeRedirect("https://evil.example/x")).toBe("/");
    expect(safeRedirect("//evil.example")).toBe("/");
    expect(safeRedirect("")).toBe("/");
  });
  it("must() throws on a query error instead of returning empty data", () => {
    expect(() => must({ data: null, error: { message: "boom" } }, "projects")).toThrow(/projects: boom/);
    expect(must({ data: [1], error: null }, "x")).toEqual([1]);
  });
  it("descendantIds returns the node and everything under it", () => {
    const nodes = [{ id: "g", parent_id: null }, { id: "u1", parent_id: "g" }, { id: "u2", parent_id: "g" }, { id: "x", parent_id: null }, { id: "u3", parent_id: "u2" }];
    expect(descendantIds(nodes, "g").sort()).toEqual(["g", "u1", "u2", "u3"]);
  });
  it("seeder never overwrites tracker-owned rows after the first import", () => {
    expect(upsertOptions("full")).toEqual({ onConflict: "ftrack_id", ignoreDuplicates: true });
    expect(upsertOptions("versions")).toEqual({ onConflict: "ftrack_id", ignoreDuplicates: true });
  });
  it("status chips use neutral tones; amber/red are reserved for risk", () => {
    expect(STATUS_BY_KEY.pending_review.tone).toBe("neutral");
    expect(STATUS_BY_KEY.comments.tone).toBe("neutral");
    expect(STATUS_BY_KEY.completed.tone).toBe("green");
  });
});
