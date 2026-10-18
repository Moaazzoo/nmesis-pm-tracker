"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { fmtDay } from "@/components/tasks/task-row";
import { STATUS_BY_KEY } from "@/lib/statuses";
import type { TaskRow } from "@/lib/queries/board-shape";
import type { State, StatusKey } from "@/lib/types";

export const COLUMNS: { key: StatusKey; title: string; state: State }[] = [
  { key: "waiting", title: "Not started", state: "not_started" },
  { key: "ready", title: "Ready", state: "ready" },
  { key: "in_progress", title: "In progress", state: "active" },
  { key: "pending_review", title: "In review", state: "review" },
  { key: "comments", title: "Comments", state: "changes" },
  { key: "completed", title: "Done", state: "done" },
];

export function columnsFor(tasks: TaskRow[]): { columns: { key: StatusKey; title: string; tasks: TaskRow[] }[]; rail: TaskRow[] } {
  return {
    columns: COLUMNS.map((c) => ({ key: c.key, title: c.title, tasks: tasks.filter((t) => t.state === c.state) })),
    rail: tasks.filter((t) => t.state === "blocked" || t.state === "cancelled"),
  };
}

export type MoveFn = (input: { taskId: string; to: StatusKey }) => Promise<{ ok: true } | { ok: false; error: string }>;

function Card({ t, unit, openHref, draggable }: { t: TaskRow; unit: string; openHref: string; draggable: boolean }) {
  const due = fmtDay(t.due_date);
  const dueCls = t.risk === "overdue" ? "text-red" : t.risk === "at_risk" ? "text-amber" : "text-muted";
  return (
    <div draggable={draggable} data-task={t.id} className={`tk-card mb-2 rounded-[12px] border border-line bg-panel p-3 text-[12px] ${draggable ? "cursor-grab" : ""}`}>
      <div className="flex items-start gap-2">
        {t.critical && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red" data-tip="Critical" />}
        <Link href={openHref} className="min-w-0 flex-1 truncate text-[13px] text-ink hover:text-green">{t.name}</Link>
        {t.latest_version && <span className="tnum text-faint">v{t.latest_version}</span>}
      </div>
      <p className="mt-0.5 truncate text-faint">{unit} · {t.type_name ?? "No type"}</p>
      <div className="mt-2 flex items-center gap-2">
        {t.assignees.slice(0, 2).map((a) => <Avatar key={a.id} name={a.full_name} size={18} />)}
        {t.assignees.length === 0 && <span className="text-faint">Unassigned</span>}
        <span className={`ml-auto tnum ${dueCls}`}>{due ?? ""}</span>
      </div>
    </div>
  );
}

/** Six state columns plus a collapsed rail for On hold / Cancelled. Drop legality comes from `legal[taskId]`. */
export function Kanban({ tasks, unitNames, legal, onMove, openBase = "?task=" }: {
  tasks: TaskRow[]; unitNames: Record<string, string>; legal: Record<string, StatusKey[]>; onMove: MoveFn; openBase?: string;
}) {
  const [list, setList] = useState(tasks);
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const { columns, rail } = columnsFor(list);
  const drop = (to: StatusKey) => {
    const id = dragging; setDragging(null); if (!id) return;
    const task = list.find((t) => t.id === id); if (!task) return;
    if (!(legal[id] ?? []).includes(to)) { setError(`${task.name}: you cannot move it to ${STATUS_BY_KEY[to].name} from ${STATUS_BY_KEY[task.status_key as StatusKey]?.name ?? task.status_key}.`); return; }
    const before = list;
    setList(list.map((t) => (t.id === id ? { ...t, status_key: to, state: COLUMNS.find((c) => c.key === to)!.state } : t))); setError(null);
    start(async () => { const r = await onMove({ taskId: id, to }); if (!r.ok) { setList(before); setError(r.error); } });
  };
  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-[10px] border border-[rgba(255,90,95,.45)] px-3 py-2 text-[12px] text-red">{error}</p>}
      <div className="grid grid-cols-6 gap-3">
        {columns.map((c) => (
          <section key={c.key} data-testid={`col-${c.key === "completed" ? "done" : c.key}`} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(c.key)}
            className={`min-h-[240px] rounded-[16px] border p-2 ${dragging && (legal[dragging] ?? []).includes(c.key) ? "border-[rgba(169,227,75,.5)] bg-[rgba(169,227,75,.04)]" : "border-line"}`}>
            <h3 className="mb-2 flex items-baseline justify-between px-1 font-label text-[10px] font-bold text-muted">{c.title}<span className="tnum text-faint">{c.tasks.length}</span></h3>
            {c.tasks.length === 0 && <p className="px-1 text-[11px] text-faint">None</p>}
            {c.tasks.map((t) => (
              <div key={t.id} onDragStart={() => setDragging(t.id)} onDragEnd={() => setDragging(null)}>
                <Card t={t} unit={unitNames[t.node_id] ?? ""} openHref={`${openBase}${t.id}`} draggable={(legal[t.id] ?? []).length > 0} />
              </div>
            ))}
          </section>
        ))}
      </div>
      {rail.length > 0 && (
        <details className="mt-4 rounded-[16px] border border-line p-3">
          <summary className="cursor-pointer font-label text-[10px] font-bold text-muted">On hold / Cancelled · {rail.length} (production moves these back from the board)</summary>
          <div className="mt-2 grid grid-cols-4 gap-2">{rail.map((t) => <Card key={t.id} t={t} unit={unitNames[t.node_id] ?? ""} openHref={`${openBase}${t.id}`} draggable={false} />)}</div>
        </details>
      )}
    </div>
  );
}
