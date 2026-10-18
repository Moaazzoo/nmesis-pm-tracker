import Link from "next/link";
import { Drawer } from "@/components/ui/drawer";
import { Chip } from "@/components/ui/chip";
import { Avatar } from "@/components/ui/avatar";
import { TaskStatus, TaskDue, TaskCritical } from "./task-controls";
import { NotesTab } from "./notes-tab";
import { VersionsTab } from "./versions-tab";
import { HistoryTab } from "./history-tab";
import { loadTask } from "@/lib/queries/task";
import { rightsFor } from "@/lib/rights";
import { can } from "@/lib/permissions";
import type { Person } from "@/lib/types";

const TABS = ["notes", "versions", "history"] as const;
type Tab = (typeof TABS)[number];

/** Server component: the task's header + one of three tabs. `base` is the page URL the drawer sits on. */
export async function TaskDrawer({ taskId, person, base, tab = "notes" }: { taskId: string; person: Person; base: string; tab?: string }) {
  const d = await loadTask(taskId);
  const active: Tab = (TABS as readonly string[]).includes(tab) ? (tab as Tab) : "notes";
  if (!d) return <Drawer closeHref={base} title={<p className="text-ink">Task not found</p>}><p className="text-muted">It may have been archived.</p></Drawer>;
  const t = d.task;
  const rights = rightsFor(person, t);
  const isAssignee = t.assignees.some((a) => a.id === person.id);
  const canSubmit = can(person, "submit_version", { isAssignee });
  const tabHref = (x: Tab) => `${base}${base.includes("?") ? "&" : "?"}task=${taskId}&tab=${x}`;
  return (
    <Drawer closeHref={base} title={
      <div>
        <p className="truncate text-[11px] text-faint">{[...t.path, t.unit_name].join(" / ")}</p>
        <h2 className="mt-0.5 flex items-center gap-2 font-display text-[24px] font-light">
          {t.critical && <span className="h-2.5 w-2.5 rounded-full bg-red" data-tip="Marked critical by production" />}{t.name}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
          <span className="text-muted">{t.type_name ?? "No type"}</span>
          <TaskStatus t={t} rights={rights} />
          <span className="flex items-center gap-1.5">{t.assignees.length === 0 ? <span className="text-faint">Unassigned</span> : t.assignees.map((a) => <span key={a.id} className="flex items-center gap-1"><Avatar name={a.full_name} size={20} />{a.full_name}</span>)}</span>
          <span className="flex items-center gap-1"><span className="text-faint">Due</span><TaskDue t={t} rights={rights} /></span>
          <TaskCritical t={t} rights={rights} />
        </div>
        {t.description && <p className="mt-2 text-[12px] text-muted">{t.description}</p>}
      </div>
    }>
      <nav className="mb-4 flex gap-1 border-b border-line" aria-label="Task sections">
        {TABS.map((x) => (
          <Link key={x} href={tabHref(x)} className={`-mb-px border-b-2 px-3 py-2 font-label text-[10px] font-bold ${active === x ? "border-green text-green" : "border-transparent text-muted hover:text-ink"}`}>
            {x === "notes" ? `Notes (${d.notes.length})` : x === "versions" ? `Versions (${d.versions.length})` : "History"}
          </Link>
        ))}
      </nav>
      {active === "notes" && <NotesTab taskId={taskId} notes={d.notes} categories={rights.noteCategories} />}
      {active === "versions" && <VersionsTab taskId={taskId} versions={d.versions} canSubmit={canSubmit} submitHint={person.role === "artist" ? "Only the assigned artist can submit a version for this task." : "Versions are submitted by the assigned artist."} />}
      {active === "history" && <HistoryTab history={d.history} />}
      {!canSubmit && active === "versions" && null}
      <p className="mt-6 text-[11px] text-faint"><Chip tone="muted" label="Legend" /> Submitted = waiting for a decision · Approved = supervisor passed it · Client approved = signed off by the client · Needs changes = sent back.</p>
    </Drawer>
  );
}
