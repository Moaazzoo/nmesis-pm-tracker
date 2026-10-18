import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { summarizeProject, type ProjectSummary, type SummaryMilestone, type SummaryTask } from "./project-summary";
import type { State } from "@/lib/types";
import { must } from "./db";

export type ProjectCardData = {
  id: string; code: string; name: string; client: string | null; start_date: string | null; end_date: string | null;
  summary: ProjectSummary;
};

export async function stateByStatusKey(): Promise<Record<string, State>> {
  const data = must(await adminClient().from("tk_statuses").select("key, state"), "statuses");
  return Object.fromEntries(data.map((s) => [s.key, s.state as State]));
}

export async function listProjectsWithSummary(now = new Date()): Promise<ProjectCardData[]> {
  const db = adminClient();
  const projects = must(await db.from("tk_projects").select("id, code, name, client, start_date, end_date").eq("status", "active").order("name"), "projects");
  const states = await stateByStatusKey();
  // One read per project keeps each result far below PostgREST's 1000-row page, so counts cannot truncate silently as projects are added.
  return Promise.all(projects.map(async (p) => {
    const [tasks, milestones] = await Promise.all([
      db.from("tk_tasks").select("status_key, due_date, status_since").eq("project_id", p.id).eq("archived", false).range(0, 4999).then((r) => must(r, `tasks of ${p.code}`)),
      db.from("tk_milestones").select("name, kind, due_date, done").eq("project_id", p.id).eq("archived", false).then((r) => must(r, `milestones of ${p.code}`)),
    ]);
    const t: SummaryTask[] = tasks.map((x) => ({ state: states[x.status_key] ?? "not_started", due_date: x.due_date, status_since: x.status_since }));
    const m: SummaryMilestone[] = milestones.map((x) => ({ name: x.name, kind: x.kind, due_date: x.due_date, done: x.done }));
    return { ...p, summary: summarizeProject(t, m, now) };
  }));
}
