import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { risk } from "@/lib/risk";
import { stateByStatusKey } from "./projects";
import { groupQueue, type QueueGroup, type QueueTask } from "./queue-shape";
import type { State } from "@/lib/types";

/** Everything assigned to one person on active projects, grouped for their queue. */
export async function loadQueue(personId: string, now = new Date()): Promise<{ groups: QueueGroup[]; total: number }> {
  const db = adminClient();
  const { data: rows } = await db.from("tk_assignments")
    .select("task:tk_tasks!inner(id, project_id, node_id, name, status_key, due_date, status_since, critical, archived, type:tk_task_types(name), project:tk_projects!inner(id, name, status))")
    .eq("person_id", personId).eq("task.archived", false).eq("task.project.status", "active");
  const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);
  const tasks = (rows ?? []).map((r) => one(r.task as unknown as Record<string, unknown> | Record<string, unknown>[])).filter((t): t is Record<string, unknown> => !!t);
  if (tasks.length === 0) return { groups: groupQueue([]), total: 0 };
  const ids = tasks.map((t) => t.id as string);
  const projectIds = [...new Set(tasks.map((t) => t.project_id as string))];
  const [{ data: nodes }, { data: notes }, { data: versions }, { data: assigns }, states] = await Promise.all([
    db.from("tk_nodes").select("id, parent_id, name, project_id").in("project_id", projectIds),
    db.from("tk_notes").select("task_id, category, body, created_at, author:tk_people(full_name)").in("task_id", ids).in("category", ["Supervisor Feedback", "Client Feedback", "Production Note"]).order("created_at", { ascending: false }),
    db.from("tk_versions").select("task_id, number").in("task_id", ids),
    db.from("tk_assignments").select("task_id, person:tk_people(id, full_name)").in("task_id", ids),
    stateByStatusKey(),
  ]);
  const byId = new Map((nodes ?? []).map((n) => [n.id, n]));
  const pathOf = (nodeId: string) => { const out: string[] = []; let cur = byId.get(nodeId); const unit = cur?.name ?? ""; cur = cur?.parent_id ? byId.get(cur.parent_id) : undefined; while (cur) { out.unshift(cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; } return { path: out, unit }; };
  const feedback = new Map<string, QueueTask["latest_feedback"]>();
  const noteCount = new Map<string, number>();
  for (const n of notes ?? []) { noteCount.set(n.task_id, (noteCount.get(n.task_id) ?? 0) + 1); if (!feedback.has(n.task_id)) feedback.set(n.task_id, { category: n.category, body: n.body, author: one(n.author as unknown as { full_name: string } | null)?.full_name ?? "", created_at: n.created_at }); }
  const latest = new Map<string, number>(); for (const v of versions ?? []) latest.set(v.task_id, Math.max(latest.get(v.task_id) ?? 0, v.number));
  const people = new Map<string, { id: string; full_name: string }[]>(); for (const a of assigns ?? []) { const p = one(a.person as unknown as { id: string; full_name: string } | null); if (p) people.set(a.task_id, [...(people.get(a.task_id) ?? []), p]); }
  const list: QueueTask[] = tasks.map((t) => {
    const state = (states[t.status_key as string] ?? "not_started") as State;
    const { path, unit } = pathOf(t.node_id as string);
    const project = one(t.project as { id: string; name: string } | { id: string; name: string }[]);
    return {
      id: t.id as string, node_id: t.node_id as string, name: t.name as string, type_name: one(t.type as { name: string } | { name: string }[] | null)?.name ?? null, status_key: t.status_key as string, state,
      due_date: (t.due_date as string | null), status_since: t.status_since as string, critical: t.critical as boolean, note_count: noteCount.get(t.id as string) ?? 0,
      latest_version: latest.get(t.id as string) ?? null, assignees: people.get(t.id as string) ?? [],
      risk: risk({ due_date: t.due_date as string | null, state, in_review_since: state === "review" ? (t.status_since as string) : null }, now),
      project_id: project?.id ?? "", project_name: project?.name ?? "", path, unit_name: unit, latest_feedback: feedback.get(t.id as string) ?? null,
    };
  });
  const groups = groupQueue(list);
  return { groups, total: groups.reduce((n, g) => n + g.tasks.length, 0) };
}
