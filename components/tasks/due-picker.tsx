"use client";
import { useState, useTransition } from "react";
import { fmtDay } from "./task-row";

export type DueChange = (input: { taskId: string; due_date: string | null }) => Promise<{ ok: true } | { ok: false; error: string }>;

export function DuePicker({ taskId, due, risk, canEdit, onChange }: { taskId: string; due: string | null; risk: "overdue" | "at_risk" | "none"; canEdit: boolean; onChange: DueChange }) {
  const [shown, setShown] = useState(due);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cls = risk === "overdue" ? "text-red" : risk === "at_risk" ? "text-amber" : "text-muted";
  const tip = risk === "overdue" ? "Past due and not completed" : risk === "at_risk" ? "Due soon and not started, or stuck in review" : shown ? "Due date" : "No due date set";
  if (!canEdit) return <span className={`tnum text-[12px] ${cls}`} data-tip={tip}>{fmtDay(shown) ?? <span className="text-faint">No due date</span>}</span>;
  return (
    <span className="relative" data-tip={tip}>
      <input type="date" value={shown ?? ""} disabled={pending}
        onChange={(e) => { const before = shown; const v = e.target.value || null; setShown(v); setError(null); start(async () => { const r = await onChange({ taskId, due_date: v }); if (!r.ok) { setShown(before); setError(r.error); } }); }}
        className={`tnum w-[118px] rounded-[8px] border border-transparent bg-transparent px-1 py-0.5 text-[12px] hover:border-line-strong ${cls}`} aria-label="Due date" />
      {error && <span role="alert" className="mt-1 block text-[11px] text-red">{error}</span>}
    </span>
  );
}
