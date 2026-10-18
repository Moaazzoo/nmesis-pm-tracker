"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setStatus } from "@/lib/actions/tasks";
import { Chip } from "@/components/ui/chip";
import { fmtDay } from "@/components/tasks/task-row";
import type { QueueGroup, QueueTask } from "@/lib/queries/queue-shape";

function StartButton({ t }: { t: QueueTask }) {
  const [done, setDone] = useState(false); const [error, setError] = useState<string | null>(null); const [pending, start] = useTransition();
  if (done) return <Chip tone="neutral" label="In Progress" tip="Started" />;
  return (
    <span className="flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await setStatus({ taskId: t.id, to: "in_progress" }); if (r.ok) setDone(true); else setError(r.error); })}
        className="rounded-full bg-green px-3 py-1 font-label text-[9px] font-bold text-[#0a0c0a] disabled:opacity-50" data-tip="Moves the task to In Progress">Start</button>
      {error && <span role="alert" className="text-[11px] text-red">{error}</span>}
    </span>
  );
}

function Row({ t, mode }: { t: QueueTask; mode: QueueGroup["key"] }) {
  const due = fmtDay(t.due_date);
  const dueCls = t.risk === "overdue" ? "text-red" : t.risk === "at_risk" ? "text-amber" : "text-muted";
  const open = `/me?task=${t.id}`;
  return (
    <li className="grid grid-cols-[minmax(240px,2fr)_minmax(200px,2fr)_110px_minmax(160px,1fr)] items-center gap-3 border-t border-line py-2.5 text-[13px]">
      <div className="min-w-0">
        <Link href={open} className="flex items-center gap-2 text-ink hover:text-green">{t.critical && <span className="h-2 w-2 rounded-full bg-red" data-tip="Critical" />}<span className="truncate">{t.name}</span><span className="text-[11px] text-faint">{t.type_name}</span></Link>
        <p className="truncate text-[11px] text-faint">{t.project_name} / {[...t.path, t.unit_name].join(" / ")}</p>
      </div>
      <div className="min-w-0 text-[12px] text-muted">
        {t.latest_feedback ? <span className="block truncate" data-tip={`${t.latest_feedback.category} from ${t.latest_feedback.author}`}><span className="text-faint">{t.latest_feedback.category}: </span>{t.latest_feedback.body}</span> : <span className="text-faint">No feedback yet</span>}
      </div>
      <span className={`tnum text-[12px] ${dueCls}`} data-tip={t.risk === "overdue" ? "Past due" : t.risk === "at_risk" ? "Due soon" : "Due date"}>{due ?? <span className="text-faint">No due date</span>}</span>
      <div className="flex items-center justify-end gap-2">
        {mode === "ready" && <StartButton t={t} />}
        {(mode === "active" || mode === "changes") && <Link href={`${open}&tab=versions`} className="rounded-full border border-[rgba(169,227,75,.5)] px-3 py-1 font-label text-[9px] font-bold text-green hover:bg-[rgba(169,227,75,.08)]" data-tip="Opens the task on its Versions tab">Submit version</Link>}
        {mode === "review" && <span className="text-[11px] text-faint" data-tip="A supervisor decides next">Waiting for review{t.latest_version ? ` · v${t.latest_version}` : ""}</span>}
      </div>
    </li>
  );
}

export function QueueList({ groups }: { groups: QueueGroup[] }) {
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} className="rounded-[16px] border border-line bg-[linear-gradient(180deg,var(--panel),var(--bg2))] px-4 pb-1 pt-3">
          <h2 className="flex items-baseline gap-2 font-display text-[18px] font-light">{g.title}<span className="tnum text-[12px] text-muted">{g.tasks.length}</span></h2>
          {g.tasks.length === 0 ? <p className="py-3 text-[12px] text-faint">{EMPTY[g.key]}</p> : <ul>{g.tasks.map((t) => <Row key={t.id} t={t} mode={g.key} />)}</ul>}
        </section>
      ))}
    </div>
  );
}
const EMPTY: Record<QueueGroup["key"], string> = {
  ready: "Nothing ready to start — production marks tasks Ready to start when their prerequisites are met.",
  active: "Nothing in progress.",
  changes: "No comments to address.",
  review: "Nothing waiting for review.",
};
