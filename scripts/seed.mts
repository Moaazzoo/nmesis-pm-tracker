// Upserts an importer JSON file into Supabase (service role). Idempotent on ftrack_id.
// Run: npx tsx scripts/seed.mts data/seed/<code>.json [--versions-only]
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { planUpserts, type SeedFile } from "./seed-plan";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
const file = process.argv[2];
const versionsOnly = process.argv.includes("--versions-only");
if (!file) { console.error("usage: npx tsx scripts/seed.mts data/seed/<code>.json [--versions-only]"); process.exit(1); }
const seed = JSON.parse(readFileSync(file, "utf8")) as SeedFile;

function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): NonNullable<T> {
  if (r.error || r.data == null) { console.error(`${what}: ${r.error?.message ?? "no data"}`); process.exit(1); }
  return r.data as NonNullable<T>;
}
async function chunked<T>(rows: T[], fn: (c: T[]) => Promise<void>, n = 500) {
  for (let i = 0; i < rows.length; i += n) await fn(rows.slice(i, i + n));
}

// existing lookups
const people = must(await db.from("tk_people").select("id, ftrack_username"), "people");
const statuses = must(await db.from("tk_statuses").select("key"), "statuses");
const types = must(await db.from("tk_task_types").select("id, name"), "types");
const existing = {
  peopleByUsername: new Map(people.filter((p) => p.ftrack_username).map((p) => [p.ftrack_username as string, p.id as string])),
  statusKeys: new Set(statuses.map((s) => s.key as string)),
  typeIdsByName: new Map(types.map((t) => [t.name as string, t.id as string])),
};
const plan = planUpserts(seed, existing, { versionsOnly });
plan.warnings.forEach((w) => console.warn("warn:", w));

// people + types that are missing
if (plan.people.length) {
  const ins = must(await db.from("tk_people").upsert(plan.people, { onConflict: "ftrack_username" }).select("id, ftrack_username"), "insert people");
  ins.forEach((p) => existing.peopleByUsername.set(p.ftrack_username as string, p.id as string));
  console.log(`people created (no login yet): ${plan.people.map((p) => p.ftrack_username).join(", ")}`);
}
if (plan.types.length) {
  const ins = must(await db.from("tk_task_types").upsert(plan.types.map((t, i) => ({ ...t, sort: 100 + i })), { onConflict: "name" }).select("id, name"), "insert types");
  ins.forEach((t) => existing.typeIdsByName.set(t.name as string, t.id as string));
}
const pid = (u: string | null | undefined) => (u ? existing.peopleByUsername.get(u) ?? null : null);

// project
const proj = must(await db.from("tk_projects").upsert({ ftrack_id: plan.project.ftrack_id, code: plan.project.code, name: plan.project.name ?? plan.project.code,
  client: plan.project.client ?? null, start_date: plan.project.start_date ?? null, end_date: plan.project.end_date ?? null, color: plan.project.color ?? null },
  { onConflict: "ftrack_id" }).select("id").single() as unknown as { data: { id: string } | null; error: { message: string } | null }, "project");
const projectId = proj.id;

const nodeId = new Map<string, string>();
const taskId = new Map<string, string>();
const versionId = new Map<string, string>();

if (!versionsOnly) {
  for (const n of plan.nodes) {
    const row = must(await db.from("tk_nodes").upsert({ project_id: projectId, parent_id: n.parent_ftrack_id ? nodeId.get(n.parent_ftrack_id) ?? null : null,
      ftrack_id: n.ftrack_id, kind: n.kind, unit_kind: n.unit_kind, name: n.name, sort: n.sort, is_deliverable: n.is_deliverable,
      content_type: n.content_type, delivered_date: n.delivered_date }, { onConflict: "ftrack_id" }).select("id").single() as unknown as { data: { id: string } | null; error: { message: string } | null }, `node ${n.name}`);
    nodeId.set(n.ftrack_id, row.id);
  }
  await chunked(plan.tasks, async (c) => {
    const rows = must(await db.from("tk_tasks").upsert(c.map((t) => ({ project_id: projectId, node_id: nodeId.get(t.node_ftrack_id), ftrack_id: t.ftrack_id,
      name: t.name, pass_no: t.pass_no, type_id: t.type_id ?? (t.type_name ? existing.typeIdsByName.get(t.type_name) ?? null : null),
      status_key: t.status_key, start_date: t.start_date, due_date: t.due_date, critical: t.critical, description: t.description })),
      { onConflict: "ftrack_id" }).select("id, ftrack_id"), "tasks");
    rows.forEach((r) => taskId.set(r.ftrack_id as string, r.id as string));
  });
  await chunked(plan.assignments, async (c) => {
    must(await db.from("tk_assignments").upsert(c.map((a) => ({ task_id: taskId.get(a.task_ftrack_id), person_id: pid(a.person_ftrack_username) }))
      .filter((a) => a.task_id && a.person_id), { onConflict: "task_id,person_id", ignoreDuplicates: true }), "assignments");
  });
  await chunked(plan.milestones, async (c) => {
    must(await db.from("tk_milestones").upsert(c.map((m) => ({ project_id: projectId, ftrack_id: m.ftrack_id, name: m.name, kind: m.kind, due_date: m.due_date, done: m.done })),
      { onConflict: "ftrack_id" }), "milestones");
  });
} else {
  const rows = must(await db.from("tk_tasks").select("id, ftrack_id").eq("project_id", projectId), "tasks lookup");
  rows.forEach((r) => taskId.set(r.ftrack_id as string, r.id as string));
}

await chunked(plan.versions, async (c) => {
  const rows = must(await db.from("tk_versions").upsert(c.filter((v) => taskId.has(v.task_ftrack_id)).map((v) => ({ task_id: taskId.get(v.task_ftrack_id), ftrack_id: v.ftrack_id,
    number: v.number, asset_name: v.asset_name ?? null, submitted_by: pid(v.submitted_by_username), submitted_at: v.submitted_at ?? new Date().toISOString(), link: v.link, status: v.status, note: v.note, source: "ftrack" })),
    { onConflict: "ftrack_id" }).select("id, ftrack_id"), "versions");
  rows.forEach((r) => versionId.set(r.ftrack_id as string, r.id as string));
});

if (!versionsOnly) {
  await chunked(plan.status_log, async (c) => {
    must(await db.from("tk_status_log").upsert(c.filter((s) => taskId.has(s.task_ftrack_id)).map((s) => ({ task_id: taskId.get(s.task_ftrack_id), ftrack_id: s.ftrack_id,
      from_status_key: s.from_status_key, to_status_key: s.to_status_key, by_person_id: pid(s.by_username), at: s.at ?? new Date().toISOString() })),
      { onConflict: "ftrack_id" }), "status_log");
  });
  // notes: two passes so replies can reference their parent
  const noteId = new Map<string, string>();
  const noteRow = (n: (typeof plan.notes)[number]) => ({ task_id: taskId.get(n.task_ftrack_id), version_id: n.version_ftrack_id ? versionId.get(n.version_ftrack_id) ?? null : null,
    ftrack_id: n.ftrack_id, author_id: pid(n.author_username), category: n.category, source_label: n.source_label, body: n.body || "(empty note)",
    reply_to_id: n.reply_to_ftrack_id ? noteId.get(n.reply_to_ftrack_id) ?? null : null, created_at: n.at ?? new Date().toISOString() });
  const valid = plan.notes.filter((n) => taskId.has(n.task_ftrack_id));
  await chunked(valid, async (c) => {
    const rows = must(await db.from("tk_notes").upsert(c.map(noteRow), { onConflict: "ftrack_id" }).select("id, ftrack_id"), "notes");
    rows.forEach((r) => noteId.set(r.ftrack_id as string, r.id as string));
  });
  const replies = valid.filter((n) => n.reply_to_ftrack_id && noteId.has(n.reply_to_ftrack_id));
  await chunked(replies, async (c) => { must(await db.from("tk_notes").upsert(c.map(noteRow), { onConflict: "ftrack_id" }), "note replies"); });
  // task.status_since from the latest status change
  const latest = new Map<string, string>();
  for (const s of plan.status_log) if (s.at && (!latest.has(s.task_ftrack_id) || s.at > latest.get(s.task_ftrack_id)!)) latest.set(s.task_ftrack_id, s.at);
  for (const [fid, at] of latest) { const id = taskId.get(fid); if (id) await db.from("tk_tasks").update({ status_since: at }).eq("id", id); }
}

console.log(`seeded ${plan.project.code}: nodes ${plan.nodes.length}, tasks ${plan.tasks.length}, assignments ${plan.assignments.length}, versions ${plan.versions.length}, notes ${plan.notes.length}, status_log ${plan.status_log.length}, milestones ${plan.milestones.length}`);
