import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { shapeBoard, type Board, type BoardFilters, type BoardRows } from "./board-shape";
import { stateByStatusKey } from "./projects";
import type { State } from "@/lib/types";

export type ProjectHeader = { id: string; code: string; name: string; client: string | null; start_date: string | null; end_date: string | null };

export async function loadProject(projectId: string): Promise<ProjectHeader | null> {
  const { data } = await adminClient().from("tk_projects").select("id, code, name, client, start_date, end_date").eq("id", projectId).maybeSingle();
  return data;
}

/** One select per table, joined in memory; projects have ≤ 300 tasks. */
export async function loadBoardRows(projectId: string): Promise<BoardRows & { people: { id: string; full_name: string }[]; types: string[] }> {
  const db = adminClient();
  const [{ data: nodes }, { data: tasks }, { data: assignments }, { data: notes }, { data: versions }, { data: types }, states] = await Promise.all([
    db.from("tk_nodes").select("id, parent_id, kind, unit_kind, name, sort").eq("project_id", projectId).eq("archived", false),
    db.from("tk_tasks").select("id, node_id, name, type_id, status_key, due_date, status_since, critical").eq("project_id", projectId).eq("archived", false),
    db.from("tk_assignments").select("task_id, person:tk_people(id, full_name), task:tk_tasks!inner(project_id)").eq("task.project_id", projectId),
    db.from("tk_notes").select("task_id, task:tk_tasks!inner(project_id)").eq("task.project_id", projectId),
    db.from("tk_versions").select("task_id, number, task:tk_tasks!inner(project_id)").eq("task.project_id", projectId),
    db.from("tk_task_types").select("id, name"),
    stateByStatusKey(),
  ]);
  const typeName = new Map((types ?? []).map((t) => [t.id, t.name as string]));
  const byTask = new Map<string, { id: string; full_name: string }[]>();
  for (const a of assignments ?? []) {
    const p = a.person as unknown as { id: string; full_name: string } | null;
    if (p) byTask.set(a.task_id, [...(byTask.get(a.task_id) ?? []), p]);
  }
  const noteCount = new Map<string, number>();
  for (const n of notes ?? []) noteCount.set(n.task_id, (noteCount.get(n.task_id) ?? 0) + 1);
  const latest = new Map<string, number>();
  for (const v of versions ?? []) latest.set(v.task_id, Math.max(latest.get(v.task_id) ?? 0, v.number));
  const peopleSeen = new Map<string, { id: string; full_name: string }>();
  byTask.forEach((ps) => ps.forEach((p) => peopleSeen.set(p.id, p)));
  return {
    nodes: (nodes ?? []) as BoardRows["nodes"],
    tasks: (tasks ?? []).map((t) => ({
      id: t.id, node_id: t.node_id, name: t.name, type_name: t.type_id ? typeName.get(t.type_id) ?? null : null, status_key: t.status_key,
      state: (states[t.status_key] ?? "not_started") as State, due_date: t.due_date, status_since: t.status_since, critical: t.critical,
      note_count: noteCount.get(t.id) ?? 0, latest_version: latest.get(t.id) ?? null, assignees: byTask.get(t.id) ?? [],
    })),
    people: [...peopleSeen.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    types: [...new Set((tasks ?? []).map((t) => (t.type_id ? typeName.get(t.type_id) : null)).filter((x): x is string => !!x))].sort(),
  };
}

export async function loadBoard(projectId: string, filters: BoardFilters, now = new Date()): Promise<Board & { people: { id: string; full_name: string }[]; types: string[] }> {
  const rows = await loadBoardRows(projectId);
  return { ...shapeBoard(rows, filters, now), people: rows.people, types: rows.types };
}
