"use client";
import { setStatus } from "@/lib/actions/tasks";
import { Kanban } from "./kanban";
import type { TaskRow } from "@/lib/queries/board-shape";
import type { StatusKey } from "@/lib/types";

export function KanbanLive({ tasks, unitNames, legal, projectId }: { tasks: TaskRow[]; unitNames: Record<string, string>; legal: Record<string, StatusKey[]>; projectId: string }) {
  return <Kanban tasks={tasks} unitNames={unitNames} legal={legal} onMove={(i) => setStatus(i)} openBase={`/p/${projectId}/board?task=`} />;
}
