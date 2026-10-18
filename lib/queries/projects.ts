import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { summarizeProject, type ProjectSummary, type SummaryMilestone, type SummaryTask } from "./project-summary";
import type { State } from "@/lib/types";

export type ProjectCardData = {
  id: string; code: string; name: string; client: string | null; start_date: string | null; end_date: string | null;
  summary: ProjectSummary;
};

export async function stateByStatusKey(): Promise<Record<string, State>> {
  const { data } = await adminClient().from("tk_statuses").select("key, state");
  return Object.fromEntries((data ?? []).map((s) => [s.key, s.state as State]));
}

export async function listProjectsWithSummary(now = new Date()): Promise<ProjectCardData[]> {
  const db = adminClient();
  const [{ data: projects }, { data: tasks }, { data: milestones }, states] = await Promise.all([
    db.from("tk_projects").select("id, code, name, client, start_date, end_date").eq("status", "active").order("name"),
    db.from("tk_tasks").select("project_id, status_key, due_date, status_since").eq("archived", false),
    db.from("tk_milestones").select("project_id, name, kind, due_date, done").eq("archived", false),
    stateByStatusKey(),
  ]);
  return (projects ?? []).map((p) => {
    const t: SummaryTask[] = (tasks ?? []).filter((x) => x.project_id === p.id).map((x) => ({ state: states[x.status_key] ?? "not_started", due_date: x.due_date, status_since: x.status_since }));
    const m: SummaryMilestone[] = (milestones ?? []).filter((x) => x.project_id === p.id).map((x) => ({ name: x.name, kind: x.kind, due_date: x.due_date, done: x.done }));
    return { ...p, summary: summarizeProject(t, m, now) };
  });
}
