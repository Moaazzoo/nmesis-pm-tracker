import Link from "next/link";
import { Ring } from "@/components/ui/ring";
import { Chip } from "@/components/ui/chip";
import { PANEL } from "@/components/ui/panel";
import type { ProjectCardData } from "@/lib/queries/projects";

const KIND_LABEL = { client_review: "Client review", delivery: "Delivery", internal: "Internal milestone" } as const;

function fmt(d: string | null) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
}

export function ProjectCard({ p }: { p: ProjectCardData }) {
  const s = p.summary;
  return (
    <Link href={`/p/${p.id}`} className={`${PANEL} tk-card block p-5 transition-colors hover:border-[rgba(169,227,75,.35)]`}>
      <div className="flex items-start gap-4">
        <Ring pct={s.progressPct} label={`${s.done} of ${s.total} tasks completed (cancelled tasks not counted)`} />
        <div className="min-w-0 flex-1">
          <p className="font-label text-[10px] text-faint">{p.client ?? p.code}</p>
          <h2 className="truncate font-display text-[22px] font-light leading-tight">{p.name}</h2>
          <p className="mt-1 text-[12px] text-muted">{fmt(p.start_date)} → {fmt(p.end_date)} · {s.total} tasks</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip tone="neutral" label={`${s.inReview} in review`} tip="Tasks waiting for a supervisor's decision" />
        <Chip tone={s.overdue ? "red" : "muted"} label={`${s.overdue} overdue`} tip="Due date has passed and the task is not completed" pulse={s.overdue > 0} />
        <Chip tone={s.atRisk ? "amber" : "muted"} label={`${s.atRisk} at risk`} tip="Due within 3 days and not started, or waiting in review for more than 2 days" />
      </div>
      <p className="mt-4 text-[12px] text-muted">
        {s.nextMilestone
          ? <><span className="text-faint">Next:</span> <span className="text-ink">{s.nextMilestone.name}</span> · {KIND_LABEL[s.nextMilestone.kind]} · {fmt(s.nextMilestone.due_date)}</>
          : <span className="text-faint">No upcoming milestone — production adds them in Setup.</span>}
      </p>
    </Link>
  );
}
