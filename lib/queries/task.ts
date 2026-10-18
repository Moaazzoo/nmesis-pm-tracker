import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { mergeHistory, type HistoryItem } from "@/lib/actions/drawer-core";
import { stateByStatusKey } from "./projects";
import { risk } from "@/lib/risk";
import type { PersonLite, TaskRow } from "./board-shape";
import type { State } from "@/lib/types";

export type Note = { id: string; category: string; source_label: string | null; body: string; author: string; created_at: string; version_number: number | null; reply_to_id: string | null; replies: Note[] };
export type Version = { id: string; number: number; asset_name: string | null; link: string | null; status: string; note: string | null; submitted_by: string; submitted_at: string; source: string };
export type TaskDetail = { task: TaskRow & { project_id: string; path: string[]; description: string | null; unit_name: string }; notes: Note[]; versions: Version[]; history: HistoryItem[] };

export async function loadTask(taskId: string, now = new Date()): Promise<TaskDetail | null> {
  const db = adminClient();
  const { data: t } = await db.from("tk_tasks").select("id, project_id, node_id, name, status_key, due_date, status_since, critical, description, type:tk_task_types(name), assignees:tk_assignments(person:tk_people(id, full_name))").eq("id", taskId).maybeSingle();
  if (!t) return null;
  const [{ data: nodes }, { data: notes }, { data: versions }, { data: log }, { data: activity }, states] = await Promise.all([
    db.from("tk_nodes").select("id, parent_id, name").eq("project_id", t.project_id),
    db.from("tk_notes").select("id, category, source_label, body, created_at, reply_to_id, author:tk_people(full_name), version:tk_versions(number)").eq("task_id", taskId).order("created_at"),
    db.from("tk_versions").select("id, number, asset_name, link, status, note, submitted_at, source, by:tk_people(full_name)").eq("task_id", taskId).order("submitted_at", { ascending: false }),
    db.from("tk_status_log").select("id, at, from_status_key, to_status_key, by:tk_people(full_name)").eq("task_id", taskId),
    db.from("tk_activity").select("id, at, action, payload, actor:tk_people(full_name)").eq("task_id", taskId),
    stateByStatusKey(),
  ]);
  const byId = new Map((nodes ?? []).map((n) => [n.id, n]));
  const path: string[] = []; let cur = byId.get(t.node_id);
  const unit_name = cur?.name ?? "";
  cur = cur?.parent_id ? byId.get(cur.parent_id) : undefined;
  while (cur) { path.unshift(cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
  const one = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const state = (states[t.status_key] ?? "not_started") as State;
  const assignees: PersonLite[] = ((t.assignees as unknown as { person: PersonLite | PersonLite[] | null }[]) ?? []).map((a) => one(a.person)).filter((p): p is PersonLite => !!p);
  const flat: Note[] = (notes ?? []).map((n) => ({ id: n.id, category: n.category, source_label: n.source_label, body: n.body, author: one(n.author as unknown as { full_name: string } | null)?.full_name ?? "Unknown", created_at: n.created_at, version_number: one(n.version as unknown as { number: number } | null)?.number ?? null, reply_to_id: n.reply_to_id, replies: [] }));
  const noteMap = new Map(flat.map((n) => [n.id, n]));
  const roots: Note[] = [];
  for (const n of flat) { const parent = n.reply_to_id ? noteMap.get(n.reply_to_id) : null; if (parent) parent.replies.push(n); else roots.push(n); }
  roots.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    task: {
      id: t.id, project_id: t.project_id, node_id: t.node_id, name: t.name, type_name: one(t.type as unknown as { name: string } | null)?.name ?? null, status_key: t.status_key, state,
      due_date: t.due_date, status_since: t.status_since, critical: t.critical, note_count: flat.length, latest_version: versions?.[0]?.number ?? null, assignees,
      risk: risk({ due_date: t.due_date, state, in_review_since: state === "review" ? t.status_since : null }, now), path, description: t.description, unit_name,
    },
    notes: roots,
    versions: (versions ?? []).map((v) => ({ id: v.id, number: v.number, asset_name: v.asset_name, link: v.link, status: v.status, note: v.note, submitted_at: v.submitted_at, source: v.source, submitted_by: one(v.by as unknown as { full_name: string } | null)?.full_name ?? "Unknown" })),
    history: mergeHistory(
      (log ?? []).map((s) => ({ id: s.id, at: s.at, from_status_key: s.from_status_key, to_status_key: s.to_status_key, by: one(s.by as unknown as { full_name: string } | null)?.full_name ?? null })),
      (activity ?? []).map((a) => ({ id: a.id, at: a.at, action: a.action, actor: one(a.actor as unknown as { full_name: string } | null)?.full_name ?? null, payload: (a.payload ?? {}) as Record<string, unknown> })),
    ),
  };
}
