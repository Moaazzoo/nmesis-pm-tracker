import { risk } from "@/lib/risk";
import type { State, StatusKey } from "@/lib/types";

export type PersonLite = { id: string; full_name: string };
export type TaskRow = {
  id: string; node_id: string; name: string; type_name: string | null; status_key: StatusKey | string; state: State;
  due_date: string | null; status_since: string | null; critical: boolean; note_count: number; latest_version: number | null;
  assignees: PersonLite[];
  risk: "overdue" | "at_risk" | "none";
};
export type NodeRow = { id: string; parent_id: string | null; kind: "group" | "unit"; unit_kind: "scene" | "shot" | "asset" | null; name: string; sort: number };
export type BoardRows = { nodes: NodeRow[]; tasks: Omit<TaskRow, "risk">[] };
export type BoardFilters = { states?: State[]; type?: string; person?: string; q?: string };
export type Counts = { total: number; done: number };
export type Group = NodeRow & { children: Group[]; counts: Counts; progressPct: number };
export type UnitWithTasks = NodeRow & { path: string[]; tasks: TaskRow[] };
export type Summary = { total: number; done: number; donePct: number; inReview: number; overdue: number; atRisk: number };
export type Board = { groups: Group[]; units: UnitWithTasks[]; summary: Summary };

/** Pure: nests groups, attaches filtered tasks to units, rolls progress up, summarises. */
export function shapeBoard(rows: BoardRows, f: BoardFilters, now: Date): Board {
  const q = f.q?.trim().toLowerCase();
  const byId = new Map(rows.nodes.map((n) => [n.id, n]));
  const pathOf = (n: NodeRow): string[] => {
    const out: string[] = []; let cur = n.parent_id ? byId.get(n.parent_id) : undefined;
    while (cur) { out.unshift(cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
    return out;
  };
  const tasks: TaskRow[] = rows.tasks.map((t) => ({ ...t, risk: risk({ due_date: t.due_date, state: t.state, in_review_since: t.state === "review" ? t.status_since : null }, now) }));

  // units with their (filtered) tasks
  const units: UnitWithTasks[] = [];
  for (const n of rows.nodes.filter((n) => n.kind === "unit").sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))) {
    const unitMatchesQ = q ? n.name.toLowerCase().includes(q) : false;
    const mine = tasks.filter((t) => t.node_id === n.id).filter((t) => {
      if (f.states && !f.states.includes(t.state)) return false;
      if (f.type && t.type_name !== f.type) return false;
      if (f.person && !t.assignees.some((a) => a.id === f.person)) return false;
      if (q && !unitMatchesQ && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if (mine.length === 0) continue;
    units.push({ ...n, path: pathOf(n), tasks: mine.sort((a, b) => a.name.localeCompare(b.name)) });
  }

  // groups: counts roll up from units' filtered tasks
  const unitCounts = new Map<string, Counts>();
  for (const u of units) unitCounts.set(u.id, { total: u.tasks.length, done: u.tasks.filter((t) => t.state === "done").length });
  const children = new Map<string | null, NodeRow[]>();
  for (const n of rows.nodes) children.set(n.parent_id, [...(children.get(n.parent_id) ?? []), n]);
  const build = (parent: string | null): Group[] =>
    (children.get(parent) ?? []).filter((n) => n.kind === "group").sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)).map((n) => {
      const kids = build(n.id);
      const own = (children.get(n.id) ?? []).filter((c) => c.kind === "unit").map((c) => unitCounts.get(c.id) ?? { total: 0, done: 0 });
      const counts = [...kids.map((k) => k.counts), ...own].reduce((a, c) => ({ total: a.total + c.total, done: a.done + c.done }), { total: 0, done: 0 });
      return { ...n, children: kids, counts, progressPct: counts.total ? Math.round((counts.done / counts.total) * 100) : 0 };
    });
  const groups = build(null);

  const all = units.flatMap((u) => u.tasks);
  const done = all.filter((t) => t.state === "done").length;
  const summary: Summary = {
    total: all.length, done, donePct: all.length ? Math.round((done / all.length) * 100) : 0,
    inReview: all.filter((t) => t.state === "review").length,
    overdue: all.filter((t) => t.risk === "overdue").length,
    atRisk: all.filter((t) => t.risk === "at_risk").length,
  };
  return { groups, units, summary };
}
