import type { Summary } from "@/lib/queries/board-shape";

function Stat({ n, label, tone = "ink", tip }: { n: number | string; label: string; tone?: "ink" | "green" | "amber" | "red"; tip: string }) {
  const color = { ink: "text-ink", green: "text-green", amber: "text-amber", red: "text-red" }[tone];
  return (
    <div className="flex items-baseline gap-2 rounded-full border border-line bg-panel px-4 py-1.5" data-tip={tip}>
      <span className={`font-display text-[18px] font-light tnum ${color}`}>{n}</span>
      <span className="font-label text-[9px] text-muted">{label}</span>
    </div>
  );
}

export function SummaryStrip({ s }: { s: Summary }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Stat n={s.total} label="tasks" tip="Tasks shown with the current filters (cancelled excluded from done %)" />
      <Stat n={`${s.donePct}%`} label="done" tone="green" tip={`${s.done} of ${s.total} tasks completed`} />
      <Stat n={s.inReview} label="in review" tone="amber" tip="Waiting for a supervisor's decision" />
      <Stat n={s.overdue} label="overdue" tone={s.overdue ? "red" : "ink"} tip="Due date passed, not completed" />
      <Stat n={s.atRisk} label="at risk" tone={s.atRisk ? "amber" : "ink"} tip="Due within 3 days and not started, or stuck in review over 2 days" />
    </div>
  );
}
