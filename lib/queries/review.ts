import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { risk } from "@/lib/risk";
import { nextPass } from "@/lib/passes";
import { filterByDiscipline } from "@/lib/actions/review-core";
import type { PersonLite, TaskRow } from "./board-shape";
import type { Discipline } from "@/lib/types";

export type ReviewItem = TaskRow & { project_id: string; project_name: string; path: string[]; unit_name: string; version: { id: string; number: number; link: string | null; note: string | null; submitted_at: string; submitted_by: string } | null; artist_note: { body: string; author: string; created_at: string } | null; in_review_since: string; next_pass_name: string | null };

/** Every task in review state on an active project, newest version first. */
export async function loadReview(discipline: Discipline | "all", now = new Date()): Promise<ReviewItem[]> {
  const db = adminClient();
  const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);
  const { data: tasks } = await db.from("tk_tasks")
    .select("id, project_id, node_id, name, type_id, status_key, due_date, status_since, critical, type:tk_task_types(name), project:tk_projects!inner(id, name, status)")
    .eq("status_key", "pending_review").eq("archived", false).eq("project.status", "active");
  if (!tasks || tasks.length === 0) return [];
  const ids = tasks.map((t) => t.id);
  const nodeIds = [...new Set(tasks.map((t) => t.node_id))];
  const projectIds = [...new Set(tasks.map((t) => t.project_id))];
  const [{ data: nodes }, { data: versions }, { data: notes }, { data: assigns }, { data: siblings }] = await Promise.all([
    db.from("tk_nodes").select("id, parent_id, name, project_id").in("project_id", projectIds),
    db.from("tk_versions").select("id, task_id, number, link, note, submitted_at, by:tk_people(full_name)").in("task_id", ids).order("submitted_at", { ascending: false }),
    db.from("tk_notes").select("task_id, body, created_at, author:tk_people(full_name)").in("task_id", ids).eq("category", "Artist Note").order("created_at", { ascending: false }),
    db.from("tk_assignments").select("task_id, person:tk_people(id, full_name)").in("task_id", ids),
    db.from("tk_tasks").select("id, name, type_id, node_id, status_key").in("node_id", nodeIds).eq("archived", false),
  ]);
  const byId = new Map((nodes ?? []).map((n) => [n.id, n]));
  const pathOf = (nodeId: string) => { const out: string[] = []; let cur = byId.get(nodeId); const unit = cur?.name ?? ""; cur = cur?.parent_id ? byId.get(cur.parent_id) : undefined; while (cur) { out.unshift(cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; } return { path: out, unit }; };
  const ver = new Map<string, ReviewItem["version"]>(); const vcount = new Map<string, number>();
  for (const v of versions ?? []) { vcount.set(v.task_id, (vcount.get(v.task_id) ?? 0) + 1); if (!ver.has(v.task_id)) ver.set(v.task_id, { id: v.id, number: v.number, link: v.link, note: v.note, submitted_at: v.submitted_at, submitted_by: one(v.by as unknown as { full_name: string } | null)?.full_name ?? "" }); }
  const note = new Map<string, ReviewItem["artist_note"]>(); const ncount = new Map<string, number>();
  for (const n of notes ?? []) { ncount.set(n.task_id, (ncount.get(n.task_id) ?? 0) + 1); if (!note.has(n.task_id)) note.set(n.task_id, { body: n.body, created_at: n.created_at, author: one(n.author as unknown as { full_name: string } | null)?.full_name ?? "" }); }
  const people = new Map<string, PersonLite[]>(); for (const a of assigns ?? []) { const p = one(a.person as unknown as PersonLite | null); if (p) people.set(a.task_id, [...(people.get(a.task_id) ?? []), p]); }
  const sibs = (siblings ?? []).map((s) => ({ ...s, type_id: s.type_id ?? "" }));
  const items: ReviewItem[] = tasks.map((t) => {
    const { path, unit } = pathOf(t.node_id);
    const project = one(t.project as unknown as { id: string; name: string } | null);
    const me = { id: t.id, name: t.name, type_id: t.type_id ?? "", node_id: t.node_id, status_key: t.status_key };
    const np = nextPass(sibs, me);
    return {
      id: t.id, node_id: t.node_id, name: t.name, type_name: one(t.type as unknown as { name: string } | null)?.name ?? null, status_key: t.status_key, state: "review",
      due_date: t.due_date, status_since: t.status_since, critical: t.critical, note_count: ncount.get(t.id) ?? 0, latest_version: ver.get(t.id)?.number ?? null, assignees: people.get(t.id) ?? [],
      risk: risk({ due_date: t.due_date, state: "review", in_review_since: t.status_since }, now),
      project_id: project?.id ?? "", project_name: project?.name ?? "", path, unit_name: unit, version: ver.get(t.id) ?? null, artist_note: note.get(t.id) ?? null, in_review_since: t.status_since,
      next_pass_name: np && np.status_key === "waiting" ? np.name : null,
    };
  });
  return filterByDiscipline(items, discipline).sort((a, b) => (b.version?.submitted_at ?? b.in_review_since).localeCompare(a.version?.submitted_at ?? a.in_review_since));
}
