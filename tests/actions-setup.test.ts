import { describe, it, expect, vi } from "vitest";
import { applyCreateTasks, applyArchive, TEMPLATES, type SetupRepo } from "@/lib/actions/setup-core";
import type { Person } from "@/lib/types";

const person = (role: Person["role"], extra: Partial<Person> = {}): Person => ({ id: `p-${role}`, full_name: role, role, discipline: null, is_admin: false, profile_id: null, ...extra });

function fakeRepo(): SetupRepo & { created: { name: string; pass_no: number | null; type: string; status_key: string }[]; archived: string[] } {
  const created: { name: string; pass_no: number | null; type: string; status_key: string }[] = [];
  const archived: string[] = [];
  return {
    created, archived,
    getUnit: vi.fn(async (id) => (id === "u1" ? { id: "u1", project_id: "pr" } : null)),
    typeIdByName: vi.fn(async (name) => `ty-${name.toLowerCase()}`),
    insertTasks: vi.fn(async (rows: Parameters<SetupRepo["insertTasks"]>[0]) => { rows.forEach((r) => created.push({ name: r.name, pass_no: r.pass_no, type: r.type_id, status_key: r.status_key })); return rows.map((_, i) => `t${i}`); }),
    archive: vi.fn(async (kind, id) => { archived.push(`${kind}:${id}`); }),
    insertActivity: vi.fn(async () => {}),
  };
}

describe("applyCreateTasks", () => {
  it("Basic_Shot creates Animation, Lighting, Compositing as 1P, Waiting and unassigned", async () => {
    const repo = fakeRepo();
    const r = await applyCreateTasks(repo, person("production"), { unitId: "u1", template: "Basic_Shot" });
    expect(r.ok).toBe(true);
    expect(repo.created).toEqual([
      { name: "Animation-1P", pass_no: 1, type: "ty-animation", status_key: "waiting" },
      { name: "Lighting-1P", pass_no: 1, type: "ty-lighting", status_key: "waiting" },
      { name: "Compositing-1P", pass_no: 1, type: "ty-compositing", status_key: "waiting" },
    ]);
  });
  it("a custom spec with two passes names them -1P and -2P", async () => {
    const repo = fakeRepo();
    await applyCreateTasks(repo, person("production"), { unitId: "u1", template: [{ type: "Lighting", passes: 2 }] });
    expect(repo.created.map((c) => c.name)).toEqual(["Lighting-1P", "Lighting-2P"]);
  });
  it("refuses a non-production actor", async () => {
    const repo = fakeRepo();
    const r = await applyCreateTasks(repo, person("artist"), { unitId: "u1", template: "3D" });
    expect(r.ok).toBe(false);
    expect(repo.created).toEqual([]);
  });
  it("exposes the three templates", () => {
    expect(Object.keys(TEMPLATES)).toEqual(["Basic_Shot", "3D", "Assets"]);
  });
});

describe("applyArchive", () => {
  it("soft-archives for production and refuses artists", async () => {
    const repo = fakeRepo();
    expect((await applyArchive(repo, person("production"), { kind: "task", id: "t9" })).ok).toBe(true);
    expect(repo.archived).toEqual(["task:t9"]);
    expect((await applyArchive(repo, person("artist"), { kind: "task", id: "t9" })).ok).toBe(false);
  });
});
