// Pure planner: turns an importer JSON file into rows to upsert, in FK order. No I/O.
export type SeedFile = {
  project: { ftrack_id: string; code: string; name?: string; client?: string | null; start_date?: string | null; end_date?: string | null; color?: string | null };
  nodes?: { ftrack_id: string; parent_ftrack_id: string | null; kind: "group" | "unit"; unit_kind: "scene" | "shot" | "asset" | null; name: string; sort: number; is_deliverable: boolean; content_type: string | null; delivered_date: string | null }[];
  tasks?: { ftrack_id: string; node_ftrack_id: string; name: string; pass_no: number | null; type: string | null; status_key: string; start_date: string | null; due_date: string | null; critical: boolean; description: string | null; assignees: string[] }[];
  status_log?: { ftrack_id: string; task_ftrack_id: string; from_status_key: string | null; to_status_key: string; by_username: string | null; at: string | null }[];
  notes?: { ftrack_id: string; task_ftrack_id: string; version_ftrack_id: string | null; author_username: string | null; category: string; source_label: string | null; body: string; reply_to_ftrack_id: string | null; at: string | null }[];
  versions: { ftrack_id: string; task_ftrack_id: string; number: number; asset_name?: string | null; submitted_by_username: string | null; submitted_at: string | null; link: string | null; status: string; note: string | null }[];
  milestones?: { ftrack_id: string; name: string; kind: string; due_date: string | null; done: boolean }[];
};

export type Existing = {
  peopleByUsername: Map<string, string>; // ftrack_username → tk_people.id
  statusKeys: Set<string>;
  typeIdsByName: Map<string, string>;     // type name → tk_task_types.id
};

export type Plan = {
  project: SeedFile["project"];
  people: { full_name: string; ftrack_username: string; role: "artist" }[];
  types: { name: string; active: boolean }[];               // types referenced but missing in the DB
  nodes: SeedFile["nodes"] extends (infer N)[] | undefined ? N[] : never;
  tasks: { ftrack_id: string; node_ftrack_id: string; name: string; pass_no: number | null; type_id: string | null; type_name: string | null; status_key: string; start_date: string | null; due_date: string | null; critical: boolean; description: string | null }[];
  assignments: { task_ftrack_id: string; person_ftrack_username: string }[];
  status_log: NonNullable<SeedFile["status_log"]>;
  notes: NonNullable<SeedFile["notes"]>;
  versions: SeedFile["versions"];
  milestones: NonNullable<SeedFile["milestones"]>;
  warnings: string[];
};

/** After the first import the tracker owns the rows: re-runs only add what is missing. */
export function upsertOptions(_mode: "full" | "versions"): { onConflict: "ftrack_id"; ignoreDuplicates: true } {
  return { onConflict: "ftrack_id", ignoreDuplicates: true };
}

const ACTIVE_TYPES = new Set(["Layout", "Modeling", "Shading", "Animation", "FX", "Lighting", "Compositing", "Editing"]);

/** A readable name from an e-mail-style ftrack username: "m.elturkman" → "M Elturkman". */
export function nameFromUsername(u: string): string {
  const local = u.split("@")[0];
  return local.split(/[._-]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

export function planUpserts(seed: SeedFile, existing: Existing, opts: { versionsOnly?: boolean } = {}): Plan {
  const warnings: string[] = [];
  const known = new Set(existing.peopleByUsername.keys());
  const people: Plan["people"] = [];
  const needPerson = (u: string | null | undefined) => {
    if (!u || known.has(u)) return;
    known.add(u);
    people.push({ full_name: nameFromUsername(u), ftrack_username: u, role: "artist" });
  };

  const versions = [...seed.versions].sort((a, b) => a.task_ftrack_id.localeCompare(b.task_ftrack_id) || a.number - b.number);
  versions.forEach((v) => needPerson(v.submitted_by_username));

  if (opts.versionsOnly) {
    return { project: seed.project, people, types: [], nodes: [], tasks: [], assignments: [], status_log: [], notes: [], versions, milestones: [], warnings };
  }

  // nodes parents-first (BFS from roots)
  const nodes = seed.nodes ?? [];
  const byParent = new Map<string | null, typeof nodes>();
  nodes.forEach((n) => byParent.set(n.parent_ftrack_id, [...(byParent.get(n.parent_ftrack_id) ?? []), n]));
  const ordered: typeof nodes = [];
  const queue: (string | null)[] = [null];
  const seen = new Set<string>();
  while (queue.length) {
    const p = queue.shift()!;
    for (const n of byParent.get(p) ?? []) {
      if (seen.has(n.ftrack_id)) continue;
      seen.add(n.ftrack_id); ordered.push(n); queue.push(n.ftrack_id);
    }
  }
  if (ordered.length !== nodes.length) warnings.push(`${nodes.length - ordered.length} node(s) unreachable from the project root were skipped`);

  const types: Plan["types"] = [];
  const typeSeen = new Set<string>();
  const tasks: Plan["tasks"] = [];
  const assignments: Plan["assignments"] = [];
  for (const t of seed.tasks ?? []) {
    if (!existing.statusKeys.has(t.status_key)) { warnings.push(`task ${t.ftrack_id}: unknown status ${t.status_key} → waiting`); }
    let type_id: string | null = null;
    if (t.type) {
      type_id = existing.typeIdsByName.get(t.type) ?? null;
      if (!type_id && !typeSeen.has(t.type)) { typeSeen.add(t.type); types.push({ name: t.type, active: ACTIVE_TYPES.has(t.type) }); }
    }
    tasks.push({ ftrack_id: t.ftrack_id, node_ftrack_id: t.node_ftrack_id, name: t.name, pass_no: t.pass_no, type_id, type_name: t.type,
      status_key: existing.statusKeys.has(t.status_key) ? t.status_key : "waiting", start_date: t.start_date, due_date: t.due_date,
      critical: t.critical, description: t.description });
    for (const u of new Set(t.assignees)) { needPerson(u); assignments.push({ task_ftrack_id: t.ftrack_id, person_ftrack_username: u }); }
  }
  const status_log = (seed.status_log ?? []).map((s) => { needPerson(s.by_username); return s; });
  const notes = (seed.notes ?? []).map((n) => { needPerson(n.author_username); return n; });

  return { project: seed.project, people, types, nodes: ordered, tasks, assignments, status_log, notes, versions, milestones: seed.milestones ?? [], warnings };
}
