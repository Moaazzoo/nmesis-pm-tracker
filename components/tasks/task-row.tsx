import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { Avatar } from "@/components/ui/avatar";
import { STATUS_BY_KEY } from "@/lib/statuses";
import type { TaskRow as TaskRowT } from "@/lib/queries/board-shape";
import type { StatusKey } from "@/lib/types";

export function fmtDay(d: string | null) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
}

const STATUS_TIP: Record<string, string> = {
  waiting: "Not started — waits for another task or a decision", ready: "Prerequisites met; the artist can start",
  in_progress: "Being worked on", pending_review: "A version is up; waiting for a supervisor", comments: "Sent back with feedback; back to the artist",
  completed: "Approved and done", on_hold: "Paused by production", cancelled: "Will not be done",
};

/** One task line inside a unit. `href` opens the task drawer (added in Task 10); controls arrive in Task 9. */
export function TaskRow({ t, href, controls }: { t: TaskRowT; href: string; controls?: React.ReactNode }) {
  const st = STATUS_BY_KEY[t.status_key as StatusKey];
  const due = fmtDay(t.due_date);
  const dueClass = t.risk === "overdue" ? "text-red" : t.risk === "at_risk" ? "text-amber" : "text-muted";
  return (
    <div className="tk-task grid grid-cols-[minmax(220px,2fr)_120px_minmax(150px,1.4fr)_minmax(170px,1.3fr)_110px_60px_60px] items-center gap-3 border-t border-line py-2 text-[13px]">
      <div className="flex min-w-0 items-center gap-2">
        {t.critical && <span className="h-2 w-2 shrink-0 rounded-full bg-red" data-tip="Marked critical by production" aria-label="Critical" />}
        <Link href={href} className="truncate text-ink hover:text-green">{t.name}</Link>
      </div>
      <span className="truncate text-[12px] text-muted">{t.type_name ?? <span className="text-faint">No type</span>}</span>
      <div>{controls ?? (st ? <Chip tone={st.tone} label={st.name} tip={STATUS_TIP[st.key]} /> : <Chip tone="muted" label={String(t.status_key)} />)}</div>
      <div className="flex min-w-0 items-center gap-1.5">
        {t.assignees.length === 0
          ? <span className="text-[12px] text-faint">Unassigned</span>
          : t.assignees.map((a) => <span key={a.id} className="flex items-center gap-1.5"><Avatar name={a.full_name} size={20} /><span className="truncate text-[12px]">{a.full_name}</span></span>)}
      </div>
      <span className={`tnum text-[12px] ${dueClass}`} data-tip={t.risk === "overdue" ? "Past due and not completed" : t.risk === "at_risk" ? "Due soon and not started, or stuck in review" : due ? "Due date" : "No due date set"}>
        {due ?? <span className="text-faint">No due date</span>}
      </span>
      <span className="tnum text-[12px] text-muted" data-tip={`${t.note_count} note${t.note_count === 1 ? "" : "s"}`}>{t.note_count > 0 ? `${t.note_count} ✎` : ""}</span>
      <span className="tnum text-[12px] text-muted" data-tip={t.latest_version ? `Latest version ${t.latest_version}` : "No version submitted yet"}>{t.latest_version ? `v${t.latest_version}` : "—"}</span>
    </div>
  );
}
