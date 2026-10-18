"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseRepo } from "./repo";
import { applyArchive, applyCreateTasks, descendantIds, TEMPLATES, type SetupRepo } from "./setup-core";
import type { ActionResult } from "./tasks-core";

function setupRepo(): SetupRepo {
  const db = adminClient(); const base = supabaseRepo();
  return {
    async getUnit(id) { const { data } = await db.from("tk_nodes").select("id, project_id").eq("id", id).eq("kind", "unit").maybeSingle(); return data; },
    async typeIdByName(name) { const { data } = await db.from("tk_task_types").select("id").eq("name", name).maybeSingle(); return data?.id ?? null; },
    async insertTasks(rows) { const { data, error } = await db.from("tk_tasks").insert(rows).select("id"); if (error) throw new Error(error.message); return (data ?? []).map((r) => r.id); },
    async archive(kind, id) {
      if (kind === "node") {
        const { data: node } = await db.from("tk_nodes").select("project_id").eq("id", id).maybeSingle();
        const { data: all } = await db.from("tk_nodes").select("id, parent_id").eq("project_id", node?.project_id ?? "");
        const ids = descendantIds(all ?? [], id);
        const t = await db.from("tk_tasks").update({ archived: true }).in("node_id", ids); if (t.error) throw new Error(t.error.message);
        const n = await db.from("tk_nodes").update({ archived: true }).in("id", ids); if (n.error) throw new Error(n.error.message);
        return;
      }
      const table = { task: "tk_tasks", node: "tk_nodes", milestone: "tk_milestones", project: "tk_projects" }[kind];
      const { error } = kind === "project" ? await db.from(table).update({ status: "archived" }).eq("id", id) : await db.from(table).update({ archived: true }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    insertActivity: (a) => base.insertActivity({ ...a, taskId: a.taskId as string }),
  };
}
async function who() { const p = await getCurrentPerson(); if (!p) throw new Error("Please sign in again."); if (!can(p, "edit_structure")) throw new Error("Only production can change project setup."); return p; }
function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> { return fn().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Something went wrong." })); }

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim();

export async function createProject(form: FormData) {
  const p = await who();
  const code = clean(form.get("code")).toLowerCase().replace(/[^a-z0-9_-]+/g, "-"); const name = clean(form.get("name"));
  if (!code || !name) redirect("/?error=project");
  const db = adminClient();
  const { data, error } = await db.from("tk_projects").insert({ code, name, client: clean(form.get("client")) || null, start_date: clean(form.get("start_date")) || null, end_date: clean(form.get("end_date")) || null }).select("id").single();
  if (error) redirect(`/?error=${encodeURIComponent(error.message)}`);
  await supabaseRepo().insertActivity({ projectId: (data as { id: string }).id, taskId: null as unknown as string, actorId: p.id, action: "create_project", payload: { name }, notify: [] });
  revalidatePath("/", "layout"); redirect(`/p/${(data as { id: string }).id}/setup`);
}

export async function createNode(form: FormData) {
  await who();
  const project_id = clean(form.get("project_id")); const kind = clean(form.get("kind")) === "unit" ? "unit" : "group"; const name = clean(form.get("name"));
  if (!project_id || !name) redirect(`/p/${project_id}/setup?error=name`);
  const unit_kind = kind === "unit" ? (["scene", "shot", "asset"].includes(clean(form.get("unit_kind"))) ? clean(form.get("unit_kind")) : "scene") : null;
  const db = adminClient();
  const { count } = await db.from("tk_nodes").select("*", { count: "exact" }).eq("project_id", project_id).limit(0);
  const { error } = await db.from("tk_nodes").insert({ project_id, parent_id: clean(form.get("parent_id")) || null, kind, unit_kind, name, sort: (count ?? 0) + 1 });
  if (error) redirect(`/p/${project_id}/setup?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout"); redirect(`/p/${project_id}/setup`);
}

export async function upsertMilestone(form: FormData) {
  await who();
  const project_id = clean(form.get("project_id")); const name = clean(form.get("name")); const kind = clean(form.get("kind"));
  if (!project_id || !name) redirect(`/p/${project_id}/setup?error=milestone`);
  const row = { project_id, name, kind: ["client_review", "delivery", "internal"].includes(kind) ? kind : "internal", due_date: clean(form.get("due_date")) || null, done: form.get("done") === "on" };
  const id = clean(form.get("id")); const db = adminClient();
  const { error } = id ? await db.from("tk_milestones").update(row).eq("id", id) : await db.from("tk_milestones").insert(row);
  if (error) redirect(`/p/${project_id}/setup?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout"); redirect(`/p/${project_id}/setup`);
}

const TasksInput = z.object({ unitId: z.string().uuid(), template: z.union([z.enum(Object.keys(TEMPLATES) as [string, ...string[]]), z.array(z.object({ type: z.string().min(1), passes: z.number().int().min(1).max(9) })).min(1)]) });
export async function createTasks(raw: z.input<typeof TasksInput>): Promise<ActionResult<{ ids: string[] }>> {
  const parsed = TasksInput.safeParse(raw); if (!parsed.success) return { ok: false, error: "Invalid request." };
  const p = await getCurrentPerson(); if (!p) return { ok: false, error: "Please sign in again." };
  return guard(async () => { const r = await applyCreateTasks(setupRepo(), p, parsed.data); if (r.ok) revalidatePath("/", "layout"); return r; });
}

const ArchiveInput = z.object({ kind: z.enum(["task", "node", "milestone", "project"]), id: z.string().uuid() });
export async function archive(raw: z.input<typeof ArchiveInput>): Promise<ActionResult> {
  const parsed = ArchiveInput.safeParse(raw); if (!parsed.success) return { ok: false, error: "Invalid request." };
  const p = await getCurrentPerson(); if (!p) return { ok: false, error: "Please sign in again." };
  return guard(async () => { const r = await applyArchive(setupRepo(), p, parsed.data); if (r.ok) revalidatePath("/", "layout"); return r; });
}
