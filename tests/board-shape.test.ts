import { describe, it, expect } from "vitest";
import { shapeBoard, type BoardRows } from "@/lib/queries/board-shape";

const now = new Date("2026-10-18T20:30:00Z");
const rows: BoardRows = {
  nodes: [
    { id: "g1", parent_id: null, kind: "group", unit_kind: null, name: "SPVs", sort: 1 },
    { id: "g1a", parent_id: "g1", kind: "group", unit_kind: null, name: "SPV04", sort: 1 },
    { id: "u1", parent_id: "g1a", kind: "unit", unit_kind: "scene", name: "S07", sort: 1 },
    { id: "g2", parent_id: null, kind: "group", unit_kind: null, name: "Backplates", sort: 2 },
    { id: "u2", parent_id: "g2", kind: "unit", unit_kind: "shot", name: "Shot_01", sort: 1 },
  ],
  tasks: [
    { id: "t1", node_id: "u1", name: "Lighting-1P", type_name: "Lighting", status_key: "completed", state: "done", due_date: "2026-10-05", status_since: "2026-10-05T09:00:00Z", critical: false, note_count: 1, latest_version: 2, assignees: [{ id: "p1", full_name: "Ziad Yasser" }] },
    { id: "t2", node_id: "u1", name: "Comp-1P", type_name: "Compositing", status_key: "pending_review", state: "review", due_date: "2026-10-15", status_since: "2026-10-14T18:00:00Z", critical: true, note_count: 3, latest_version: 2, assignees: [{ id: "p2", full_name: "Moustafa Tork" }] },
    { id: "t3", node_id: "u2", name: "Comp-2P", type_name: "Compositing", status_key: "waiting", state: "not_started", due_date: null, status_since: "2026-10-01T00:00:00Z", critical: false, note_count: 0, latest_version: null, assignees: [] },
  ],
};

describe("shapeBoard", () => {
  it("nests groups by parent and rolls task progress up to every ancestor", () => {
    const b = shapeBoard(rows, {}, now);
    const spvs = b.groups.find((g) => g.id === "g1")!;
    const spv04 = spvs.children.find((g) => g.id === "g1a")!;
    expect(spvs.counts.total).toBe(2);
    expect(spv04.counts.total).toBe(2);
    expect(spvs.progressPct).toBe(50);
    expect(b.groups.find((g) => g.id === "g2")!.progressPct).toBe(0);
  });
  it("computes risk and keeps a null due date as 'none'", () => {
    const b = shapeBoard(rows, {}, now);
    const t2 = b.units.find((u) => u.id === "u1")!.tasks.find((t) => t.id === "t2")!;
    const t3 = b.units.find((u) => u.id === "u2")!.tasks.find((t) => t.id === "t3")!;
    expect(t2.risk).toBe("overdue");
    expect(t3.risk).toBe("none");
  });
  it("state filter keeps the unit when any task matches and drops units with no match", () => {
    const b = shapeBoard(rows, { states: ["review"] }, now);
    expect(b.units.map((u) => u.id)).toEqual(["u1"]);
    expect(b.units[0].tasks.map((t) => t.id)).toEqual(["t2"]);
  });
  it("text filter matches task or unit names, case-insensitively", () => {
    expect(shapeBoard(rows, { q: "shot_01" }, now).units.map((u) => u.id)).toEqual(["u2"]);
    expect(shapeBoard(rows, { q: "lighting" }, now).units[0].tasks.map((t) => t.id)).toEqual(["t1"]);
  });
  it("person filter keeps only that person's tasks", () => {
    const b = shapeBoard(rows, { person: "p2" }, now);
    expect(b.units.flatMap((u) => u.tasks.map((t) => t.id))).toEqual(["t2"]);
  });
  it("summary counts the filtered set", () => {
    const b = shapeBoard(rows, {}, now);
    expect(b.summary).toEqual({ total: 3, done: 1, donePct: 33, inReview: 1, overdue: 1, atRisk: 0 });
  });
});
