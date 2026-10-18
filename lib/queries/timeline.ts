import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { stateByStatusKey } from "./projects";
import { layoutTimeline, type Layout, type TLMilestone, type TLUnit } from "./timeline-layout";
import { todayInCairo } from "@/lib/risk";

/** Units span min task start → max task due; progress = done ÷ non-cancelled tasks. */
export async function loadTimeline(projectId: string, now = new Date(), weeks = 8): Promise<Layout & { milestonesAll: TLMilestone[] }> {
  const db = adminClient();
  const [{ data: nodes }, { data: tasks }, { data: ms }, states] = await Promise.all([
    db.from("tk_nodes").select("id, parent_id, name, kind").eq("project_id", projectId).eq("archived", false),
    db.from("tk_tasks").select("node_id, start_date, due_date, status_key").eq("project_id", projectId).eq("archived", false),
    db.from("tk_milestones").select("id, name, kind, due_date, done").eq("project_id", projectId).eq("archived", false).order("due_date"),
    stateByStatusKey(),
  ]);
  const byId = new Map((nodes ?? []).map((n) => [n.id, n]));
  const units: TLUnit[] = (nodes ?? []).filter((n) => n.kind === "unit").map((n) => {
    const mine = (tasks ?? []).filter((t) => t.node_id === n.id && states[t.status_key] !== "cancelled");
    const starts = mine.map((t) => t.start_date).filter((x): x is string => !!x).sort();
    const ends = mine.map((t) => t.due_date).filter((x): x is string => !!x).sort();
    const done = mine.filter((t) => states[t.status_key] === "done").length;
    let label = n.name; const parent = n.parent_id ? byId.get(n.parent_id) : undefined; if (parent) label = `${parent.name} / ${n.name}`;
    return { id: n.id, name: label, start: starts[0] ?? null, end: ends[ends.length - 1] ?? null, progressPct: mine.length ? Math.round((done / mine.length) * 100) : 0 };
  }).filter((u) => u.start || u.end);
  const milestonesAll: TLMilestone[] = (ms ?? []).map((m) => ({ id: m.id, name: m.name, kind: m.kind, due_date: m.due_date, done: m.done }));
  return { ...layoutTimeline({ units: units.map((u) => ({ ...u, start: u.start ?? u.end, end: u.end ?? u.start })), milestones: milestonesAll, today: todayInCairo(now), weeks }), milestonesAll };
}
