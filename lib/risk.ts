import type { State } from "./types";

export const AT_RISK_DAYS = 3;          // due within N days while not yet started
export const REVIEW_STALE_DAYS = 2;     // waiting in review longer than N days
const TZ = "Africa/Cairo";

/** Calendar day (YYYY-MM-DD) in Cairo for a given instant. */
export function todayInCairo(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function dayDiff(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(toDay + "T00:00:00Z") - Date.parse(fromDay + "T00:00:00Z")) / 86_400_000);
}

export function risk(
  task: { due_date: string | null; state: State; in_review_since?: string | null },
  now: Date
): "overdue" | "at_risk" | "none" {
  if (task.state === "done" || task.state === "cancelled") return "none";
  const today = todayInCairo(now);
  if (task.due_date) {
    const d = dayDiff(today, task.due_date.slice(0, 10));
    if (d < 0) return "overdue";
    if (d <= AT_RISK_DAYS && (task.state === "not_started" || task.state === "ready")) return "at_risk";
  }
  if (task.state === "review" && task.in_review_since) {
    const since = todayInCairo(new Date(task.in_review_since));
    if (dayDiff(since, today) > REVIEW_STALE_DAYS) return "at_risk";
  }
  return "none";
}
