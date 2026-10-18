import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/ui/topbar";
import { Page, Panel } from "@/components/ui/panel";
import { Chip } from "@/components/ui/chip";
import { UserMenu } from "@/components/ui/user-menu";
import { TasksFromTemplate, ArchiveButton } from "@/components/setup/tasks-from-template";
import { requirePerson } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { loadProject } from "@/lib/queries/project-board";
import { loadSetup } from "@/lib/queries/setup";
import { createNode, upsertMilestone } from "@/lib/actions/setup";
import { STATUS_BY_KEY } from "@/lib/statuses";
import type { StatusKey } from "@/lib/types";

export const dynamic = "force-dynamic";
const IN = "rounded-[8px] border border-line-strong bg-bg px-2 py-1 text-[12px] text-ink";
const BTN = "rounded-full bg-green px-3 py-1 font-label text-[9px] font-bold text-[#0a0c0a]";
const KIND = { client_review: "Client review", delivery: "Delivery", internal: "Internal" } as const;

export default async function Setup({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const person = await requirePerson();
  const { id } = await params; const { error } = await searchParams;
  const project = await loadProject(id); if (!project) notFound();
  const { nodes, milestones, tasks } = await loadSetup(id);
  const editor = can(person, "edit_structure");
  const groups = nodes.filter((n) => n.kind === "group"); const units = nodes.filter((n) => n.kind === "unit");
  const nameOf = (nid: string | null) => nodes.find((n) => n.id === nid)?.name ?? "";
  return (
    <>
      <TopBar crumb={[{ label: "Projects", href: "/" }, { label: project.name, href: `/p/${id}` }, { label: "Setup" }]} right={<UserMenu person={person} />} />
      <Page className="py-6">
        <p className="font-label text-[11px] font-bold tracking-[.22em] text-green">Project setup</p>
        <h1 className="mt-1 font-display text-[30px] font-light tracking-[-.02em]">{project.name}</h1>
        <p className="mt-1 text-[13px] text-muted">Groups hold units; units (scenes, shots, asset builds) hold tasks. Milestones are the dates the client sees.</p>
        {error && <p role="alert" className="mt-3 text-[13px] text-red">{decodeURIComponent(error)}</p>}
        {!editor && <p className="mt-3 text-[12px] text-faint">Your role can view the setup; production edits it.</p>}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel label="Groups and units">
            {editor && (
              <form action={createNode} className="mb-4 flex flex-wrap items-center gap-2">
                <input type="hidden" name="project_id" value={id} />
                <select name="kind" className={IN}><option value="group">Group</option><option value="unit">Unit</option></select>
                <input name="name" placeholder="Name (e.g. SPVs, S07, Environment)" required className={`${IN} w-[220px]`} />
                <select name="parent_id" className={IN}><option value="">At top level</option>{groups.map((g) => <option key={g.id} value={g.id}>in {g.name}</option>)}</select>
                <select name="unit_kind" className={IN}><option value="scene">Scene</option><option value="shot">Shot</option><option value="asset">Asset build</option></select>
                <button className={BTN}>Add</button>
              </form>
            )}
            {nodes.length === 0 && <p className="text-[12px] text-faint">No groups or units yet.</p>}
            <ul className="space-y-3">
              {units.map((u) => (
                <li key={u.id} className="rounded-[12px] border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-faint">{nameOf(u.parent_id)}</span><span className="text-[14px] text-ink">{u.name}</span><Chip tone="muted" label={u.unit_kind === "asset" ? "Asset build" : u.unit_kind === "shot" ? "Shot" : "Scene"} />
                    {editor && <span className="ml-auto"><ArchiveButton kind="node" id={u.id} label={u.name} /></span>}
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {tasks.filter((t) => t.node_id === u.id).map((t) => <li key={t.id} className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px]"><span>{t.name}</span><span className="text-faint">· {STATUS_BY_KEY[t.status_key as StatusKey]?.name ?? t.status_key}</span>{editor && <ArchiveButton kind="task" id={t.id} label={t.name} />}</li>)}
                    {tasks.filter((t) => t.node_id === u.id).length === 0 && <li className="text-[11px] text-faint">No tasks yet</li>}
                  </ul>
                  {editor && <div className="mt-2"><TasksFromTemplate unitId={u.id} /></div>}
                </li>
              ))}
              {groups.filter((g) => !units.some((u) => u.parent_id === g.id) && !groups.some((x) => x.parent_id === g.id)).map((g) => (
                <li key={g.id} className="flex items-center gap-2 rounded-[12px] border border-dashed border-line p-3 text-[12px]"><span className="text-ink">{g.name}</span><span className="text-faint">empty group — add a unit into it above</span>{editor && <span className="ml-auto"><ArchiveButton kind="node" id={g.id} label={g.name} /></span>}</li>
              ))}
            </ul>
          </Panel>
          <Panel label="Milestones">
            {editor && (
              <form action={upsertMilestone} className="mb-4 flex flex-wrap items-center gap-2">
                <input type="hidden" name="project_id" value={id} />
                <input name="name" placeholder="Client Review: Mid-res reel" required className={`${IN} w-[240px]`} />
                <select name="kind" className={IN}><option value="client_review">Client review</option><option value="delivery">Delivery</option><option value="internal">Internal</option></select>
                <input type="date" name="due_date" className={IN} />
                <button className={BTN}>Add</button>
              </form>
            )}
            {milestones.length === 0 && <p className="text-[12px] text-faint">No milestones yet.</p>}
            <ul className="divide-y divide-line">
              {milestones.map((m) => (
                <li key={m.id} className="py-2">
                  {editor ? (
                    <form action={upsertMilestone} className="flex flex-wrap items-center gap-2 text-[12px]">
                      <input type="hidden" name="project_id" value={id} /><input type="hidden" name="id" value={m.id} />
                      <input name="name" defaultValue={m.name} className={`${IN} w-[240px]`} />
                      <select name="kind" defaultValue={m.kind} className={IN}><option value="client_review">Client review</option><option value="delivery">Delivery</option><option value="internal">Internal</option></select>
                      <input type="date" name="due_date" defaultValue={m.due_date ?? ""} className={IN} />
                      <label className="flex items-center gap-1 text-muted"><input type="checkbox" name="done" defaultChecked={m.done} /> done</label>
                      <button className="rounded-full border border-line-strong px-3 py-1 text-[11px] text-muted hover:text-ink">Save</button>
                      <ArchiveButton kind="milestone" id={m.id} label={m.name} />
                    </form>
                  ) : <span className="text-[13px]"><span className="text-faint">{KIND[m.kind as keyof typeof KIND]} · {m.due_date ?? "no date"}</span> {m.name}{m.done ? " ✓" : ""}</span>}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <p className="mt-6 text-[12px] text-faint">Need people? <Link href="/people" className="text-green">Manage roles and logins</Link> (admins).</p>
      </Page>
    </>
  );
}
