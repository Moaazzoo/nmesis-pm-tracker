import "server-only";
import { must } from "./db";
import { adminClient } from "@/lib/supabase/admin";

export async function loadSetup(projectId: string) {
  const db = adminClient();
  const [nodes, milestones, tasks] = await Promise.all([
    db.from("tk_nodes").select("id, parent_id, kind, unit_kind, name, sort").eq("project_id", projectId).eq("archived", false).order("sort").then((r) => must(r, "setup.nodes")),
    db.from("tk_milestones").select("id, name, kind, due_date, done").eq("project_id", projectId).eq("archived", false).order("due_date").then((r) => must(r, "setup.milestones")),
    db.from("tk_tasks").select("id, node_id, name, status_key").eq("project_id", projectId).eq("archived", false).order("name").then((r) => must(r, "setup.tasks")),
  ]);
  return { nodes: nodes ?? [], milestones: milestones ?? [], tasks: tasks ?? [] };
}

export async function listPeople() {
  const { data } = await adminClient().from("tk_people").select("id, full_name, ftrack_username, role, discipline, is_admin, active, profile:profiles(username)").order("full_name");
  return (data ?? []).map((p) => ({ ...p, username: (Array.isArray(p.profile) ? p.profile[0] : p.profile)?.username ?? null }));
}
