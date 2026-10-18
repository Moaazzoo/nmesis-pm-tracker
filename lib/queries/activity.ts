import "server-only";
import { must } from "./db";
import { adminClient } from "@/lib/supabase/admin";
import { unreadFor, type ActivityRow } from "./activity-shape";

export async function loadUnread(personId: string, limit = 30): Promise<ActivityRow[]> {
  const db = adminClient();
  const { data } = await db.from("tk_activity").select("id, at, action, payload, unread_by, task_id, project_id, actor:tk_people(full_name), task:tk_tasks(name), project:tk_projects(name)")
    .contains("unread_by", [personId]).order("at", { ascending: false }).limit(limit);
  const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);
  const rows: ActivityRow[] = (data ?? []).map((r) => ({ id: r.id, at: r.at, action: r.action, payload: (r.payload ?? {}) as Record<string, unknown>, unread_by: r.unread_by ?? [], task_id: r.task_id, project_id: r.project_id,
    actor: one(r.actor as unknown as { full_name: string } | null)?.full_name ?? "Someone", task_name: one(r.task as unknown as { name: string } | null)?.name ?? "a task", project_name: one(r.project as unknown as { name: string } | null)?.name ?? "" }));
  return unreadFor(rows, personId);
}
