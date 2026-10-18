import { can } from "@/lib/permissions";
import type { Person } from "@/lib/types";
import type { ActionResult } from "./tasks-core";

export const TEMPLATES: Record<string, { type: string; passes: number }[]> = {
  Basic_Shot: [{ type: "Animation", passes: 1 }, { type: "Lighting", passes: 1 }, { type: "Compositing", passes: 1 }],
  "3D": [{ type: "Layout", passes: 1 }, { type: "Lighting", passes: 1 }, { type: "Compositing", passes: 1 }],
  Assets: [{ type: "Modeling", passes: 1 }, { type: "Shading", passes: 1 }],
};

export interface SetupRepo {
  getUnit(id: string): Promise<{ id: string; project_id: string } | null>;
  typeIdByName(name: string): Promise<string | null>;
  insertTasks(rows: { project_id: string; node_id: string; name: string; pass_no: number | null; type_id: string; status_key: "waiting" }[]): Promise<string[]>;
  archive(kind: "task" | "node" | "milestone" | "project", id: string): Promise<void>;
  insertActivity(a: { projectId: string; taskId: string | null; actorId: string; action: string; payload: Record<string, unknown>; notify: string[] }): Promise<void>;
}

/** Tasks from a named template or an explicit {type, passes} spec; all start Waiting and unassigned. */
export async function applyCreateTasks(repo: SetupRepo, actor: Person, input: { unitId: string; template: string | { type: string; passes: number }[] }): Promise<ActionResult<{ ids: string[] }>> {
  if (!can(actor, "edit_structure")) return { ok: false, error: "Only production can add tasks." };
  const spec = typeof input.template === "string" ? TEMPLATES[input.template] : input.template;
  if (!spec || spec.length === 0) return { ok: false, error: "Unknown template." };
  const unit = await repo.getUnit(input.unitId);
  if (!unit) return { ok: false, error: "Unit not found." };
  const rows: Parameters<SetupRepo["insertTasks"]>[0] = [];
  for (const s of spec) {
    const type_id = await repo.typeIdByName(s.type);
    if (!type_id) return { ok: false, error: `Unknown task type: ${s.type}` };
    const passes = Math.max(1, Math.min(9, Math.floor(s.passes)));
    for (let p = 1; p <= passes; p++) rows.push({ project_id: unit.project_id, node_id: unit.id, name: `${s.type}-${p}P`, pass_no: p, type_id, status_key: "waiting" });
  }
  const ids = await repo.insertTasks(rows);
  await repo.insertActivity({ projectId: unit.project_id, taskId: null, actorId: actor.id, action: "create_tasks", payload: { unitId: unit.id, names: rows.map((r) => r.name) }, notify: [] });
  return { ok: true, data: { ids } };
}

export async function applyArchive(repo: SetupRepo, actor: Person, input: { kind: "task" | "node" | "milestone" | "project"; id: string }): Promise<ActionResult> {
  if (!can(actor, "edit_structure")) return { ok: false, error: "Only production can archive." };
  await repo.archive(input.kind, input.id);
  return { ok: true };
}
