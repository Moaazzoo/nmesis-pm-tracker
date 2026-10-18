import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { planUpserts, type SeedFile } from "../scripts/seed-plan";

const seed = JSON.parse(readFileSync("data/seed/fixture.json", "utf8")) as SeedFile;
const existing = {
  peopleByUsername: new Map([["ziad@nmesis.io", "p-ziad"], ["Kareem@nmesis.io", "p-kareem"], ["moaaz.hashem@nmesis.io", "p-moaaz"]]),
  statusKeys: new Set(["waiting", "ready", "in_progress", "pending_review", "comments", "completed", "on_hold", "cancelled"]),
  typeIdsByName: new Map([["Lighting", "ty-lgt"], ["Compositing", "ty-cmp"]]),
};

describe("planUpserts", () => {
  const plan = planUpserts(seed, existing);

  it("orders nodes parents-first", () => {
    const idx = new Map(plan.nodes.map((n, i) => [n.ftrack_id, i]));
    expect(idx.get("fx-g1")!).toBeLessThan(idx.get("fx-u1")!);
    expect(idx.get("fx-g2")!).toBeLessThan(idx.get("fx-u2")!);
  });

  it("task rows carry status_key and resolved type ids", () => {
    const t = plan.tasks.find((t) => t.ftrack_id === "fx-t3")!;
    expect(t.status_key).toBe("pending_review");
    expect(t.type_id).toBe("ty-cmp");
    expect(t.pass_no).toBe(1);
  });

  it("creates a person row for an unknown username and uses it for assignments", () => {
    const created = plan.people.find((p) => p.ftrack_username === "M.elturkman@nmesis.io");
    expect(created).toBeTruthy();
    expect(created!.role).toBe("artist");
    const a = plan.assignments.filter((a) => a.task_ftrack_id === "fx-t3");
    expect(a).toHaveLength(1);
    expect(a[0].person_ftrack_username).toBe("M.elturkman@nmesis.io");
  });

  it("does not re-create people that already exist", () => {
    expect(plan.people.find((p) => p.ftrack_username === "ziad@nmesis.io")).toBeUndefined();
  });

  it("versions-only plan contains only version rows", () => {
    const vp = planUpserts(seed, existing, { versionsOnly: true });
    expect(vp.versions).toHaveLength(2);
    expect(vp.tasks).toHaveLength(0);
    expect(vp.nodes).toHaveLength(0);
    expect(vp.notes).toHaveLength(0);
  });

  it("notes keep their version link and reply reference", () => {
    const n = plan.notes.find((n) => n.ftrack_id === "fx-n2")!;
    expect(n.version_ftrack_id).toBe("fx-v2");
    expect(n.category).toBe("Artist Note");
  });
});
