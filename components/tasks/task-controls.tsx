"use client";
import { setStatus, assign, setDue, setCritical } from "@/lib/actions/tasks";
import { useEffect, useState, useTransition } from "react";
import { StatusControl } from "./status-control";
import { AssigneePicker } from "./assignee-picker";
import { DuePicker } from "./due-picker";
import type { TaskRow } from "@/lib/queries/board-shape";
import type { NoteCategory } from "@/lib/notes";
import type { StatusKey } from "@/lib/types";

export type EditRights = { statusOptions: StatusKey[]; needsNote: StatusKey[]; noteCategories: NoteCategory[]; canAssign: boolean; canEditDates: boolean };

/** Client glue: binds the three inline controls of a task row to the server actions. */
export function TaskStatus({ t, rights }: { t: TaskRow; rights: EditRights }) {
  return <StatusControl taskId={t.id} current={t.status_key as StatusKey} options={rights.statusOptions} needsNote={rights.needsNote} noteCategories={rights.noteCategories} onChange={setStatus} />;
}
export function TaskAssignees({ t, people, rights }: { t: TaskRow; people: { id: string; full_name: string }[]; rights: EditRights }) {
  return <AssigneePicker taskId={t.id} assignees={t.assignees} people={people} canEdit={rights.canAssign} onChange={assign} />;
}
/** Critical marker: production toggles it; everyone else sees it. */
export function TaskCritical({ t, rights }: { t: TaskRow; rights: EditRights }) {
  const [on, setOn] = useState(t.critical); const [error, setError] = useState<string | null>(null); const [pending, start] = useTransition();
  useEffect(() => { setOn(t.critical); }, [t.critical]);
  if (!rights.canEditDates) return on ? <span className="font-label text-[9px] font-bold text-red" data-tip="Marked critical by production">Critical</span> : null;
  return (
    <span className="flex items-center gap-1">
      <button type="button" disabled={pending} onClick={() => { const before = on; setOn(!on); setError(null); start(async () => { try { const r = await setCritical({ taskId: t.id, critical: !before }); if (!r.ok) { setOn(before); setError(r.error); } } catch { setOn(before); setError("Could not reach the server."); } }); }}
        className={`rounded-full border px-2 py-0.5 font-label text-[9px] font-bold ${on ? "border-[rgba(255,90,95,.55)] text-red" : "border-line-strong text-faint hover:text-ink"}`} data-tip={on ? "Critical — click to clear" : "Mark this task critical"}>{on ? "Critical" : "Mark critical"}</button>
      {error && <span role="alert" className="text-[11px] text-red">{error}</span>}
    </span>
  );
}
export function TaskDue({ t, rights }: { t: TaskRow; rights: EditRights }) {
  return <DuePicker taskId={t.id} due={t.due_date} risk={t.risk} canEdit={rights.canEditDates} onChange={setDue} />;
}
