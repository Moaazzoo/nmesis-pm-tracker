import { describe, it, expect } from "vitest";
import { summarizeProject } from "@/lib/queries/project-summary";

const now = new Date("2026-10-18T20:30:00Z"); // 18 Oct, Cairo

describe("summarizeProject", () => {
  const tasks = [
    { state: "done" as const, due_date: "2026-10-05", status_since: "2026-10-05T09:00:00Z" },
    { state: "not_started" as const, due_date: "2026-10-20", status_since: "2026-10-01T00:00:00Z" }, // at risk (due in 2 days, not started)
    { state: "review" as const, due_date: "2026-10-15", status_since: "2026-10-14T18:00:00Z" },     // overdue + in review
    { state: "changes" as const, due_date: null, status_since: "2026-10-15T12:00:00Z" },
    { state: "cancelled" as const, due_date: "2026-09-01", status_since: "2026-09-01T00:00:00Z" },
  ];
  const milestones = [
    { name: "Review: Previz", kind: "internal" as const, due_date: "2026-10-10", done: true },
    { name: "Client Review: S07 reel", kind: "client_review" as const, due_date: "2026-10-22", done: false },
    { name: "Delivery: S07 reel", kind: "delivery" as const, due_date: "2026-10-29", done: false },
  ];
  const s = summarizeProject(tasks, milestones, now);

  it("counts total excluding cancelled and progress as done over that", () => {
    expect(s.total).toBe(4);
    expect(s.done).toBe(1);
    expect(s.progressPct).toBe(25);
  });
  it("counts tasks in review, overdue and at risk", () => {
    expect(s.inReview).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.atRisk).toBe(1);
  });
  it("next milestone is the earliest not-done one on or after today", () => {
    expect(s.nextMilestone?.name).toBe("Client Review: S07 reel");
  });
  it("an empty project reports zero progress and no milestone", () => {
    const e = summarizeProject([], [], now);
    expect(e.progressPct).toBe(0);
    expect(e.nextMilestone).toBeNull();
  });
});
