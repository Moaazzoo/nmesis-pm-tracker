"use client";
import { setStatus, assign, setDue } from "@/lib/actions/tasks";
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
export function TaskDue({ t, rights }: { t: TaskRow; rights: EditRights }) {
  return <DuePicker taskId={t.id} due={t.due_date} risk={t.risk} canEdit={rights.canEditDates} onChange={setDue} />;
}
