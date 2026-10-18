import { describe, it, expect } from "vitest";
import { layoutTimeline } from "@/lib/queries/timeline-layout";

const today = "2026-10-18"; // Sunday — the Cairo week starts on Sunday

describe("layoutTimeline", () => {
  it("builds 8 week columns starting from the week containing today", () => {
    const l = layoutTimeline({ units: [], milestones: [], today, weeks: 8 });
    expect(l.columns).toHaveLength(8);
    expect(l.columns[0].start).toBe("2026-10-18");
    expect(l.columns[7].start).toBe("2026-12-06");
  });
  it("a unit spanning weeks 1–2 of 8 gets the right left/width percentages", () => {
    const l = layoutTimeline({ units: [{ id: "u1", name: "S07", start: "2026-10-18", end: "2026-10-31", progressPct: 50 }], milestones: [], today, weeks: 8 });
    expect(l.bars[0].startPct).toBe(0);
    expect(l.bars[0].widthPct).toBe(25);
  });
  it("bars starting before the window are clipped at today", () => {
    const l = layoutTimeline({ units: [{ id: "u1", name: "S07", start: "2026-10-01", end: "2026-10-24", progressPct: 10 }], milestones: [], today, weeks: 8 });
    expect(l.bars[0].startPct).toBe(0);
    expect(l.bars[0].clippedStart).toBe(true);
  });
  it("two milestones one day apart get different label rows", () => {
    const l = layoutTimeline({ units: [], milestones: [
      { id: "m1", name: "Client Review: A", kind: "client_review", due_date: "2026-10-22", done: false },
      { id: "m2", name: "Delivery: B", kind: "delivery", due_date: "2026-10-23", done: false },
    ], today, weeks: 8 });
    expect(l.diamonds[0].label_row).not.toBe(l.diamonds[1].label_row);
  });
  it("five milestones on one day flag the lane as clustered", () => {
    const ms = [1, 2, 3, 4, 5].map((i) => ({ id: `m${i}`, name: `Delivery: ${i}`, kind: "delivery" as const, due_date: "2026-10-29", done: false }));
    expect(layoutTimeline({ units: [], milestones: ms, today, weeks: 8 }).clustered).toBe(true);
  });
  it("milestones outside the window are dropped, done ones kept but marked", () => {
    const l = layoutTimeline({ units: [], milestones: [
      { id: "old", name: "Review: old", kind: "internal", due_date: "2026-10-01", done: true },
      { id: "in", name: "Delivery: in", kind: "delivery", due_date: "2026-11-05", done: true },
    ], today, weeks: 8 });
    expect(l.diamonds.map((d) => d.id)).toEqual(["in"]);
    expect(l.diamonds[0].done).toBe(true);
  });
});
