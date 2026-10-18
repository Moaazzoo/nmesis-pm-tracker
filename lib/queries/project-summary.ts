import { risk, todayInCairo } from "@/lib/risk";
import type { State } from "@/lib/types";

export type SummaryTask = { state: State; due_date: string | null; status_since: string | null };
export type SummaryMilestone = { name: string; kind: "client_review" | "delivery" | "internal"; due_date: string | null; done: boolean };

export type ProjectSummary = {
  total: number; done: number; progressPct: number;
  inReview: number; overdue: number; atRisk: number;
  nextMilestone: SummaryMilestone | null;
};

/** Pure roll-up used by the Projects page. total excludes cancelled; progress = done ÷ total. */
export function summarizeProject(tasks: SummaryTask[], milestones: SummaryMilestone[], now: Date): ProjectSummary {
  const live = tasks.filter((t) => t.state !== "cancelled");
  const done = live.filter((t) => t.state === "done").length;
  let inReview = 0, overdue = 0, atRisk = 0;
  for (const t of live) {
    if (t.state === "review") inReview++;
    const r = risk({ due_date: t.due_date, state: t.state, in_review_since: t.state === "review" ? t.status_since : null }, now);
    if (r === "overdue") overdue++;
    else if (r === "at_risk") atRisk++;
  }
  const today = todayInCairo(now);
  const nextMilestone = milestones
    .filter((m) => !m.done && m.due_date && m.due_date >= today)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0] ?? null;
  return { total: live.length, done, progressPct: live.length ? Math.round((done / live.length) * 100) : 0, inReview, overdue, atRisk, nextMilestone };
}
