import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/ui/topbar";
import { Page } from "@/components/ui/panel";
import { Legend } from "@/components/ui/legend";
import { UserMenu } from "@/components/ui/user-menu";
import { KanbanLive } from "@/components/board/kanban-live";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { requirePerson } from "@/lib/auth";
import { loadBoardRows, loadProject } from "@/lib/queries/project-board";
import { risk } from "@/lib/risk";
import { legalNext, canTransition } from "@/lib/transitions";
import type { StatusKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KanbanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ task?: string; tab?: string }> }) {
  const person = await requirePerson();
  const { id } = await params; const sp = await searchParams;
  const project = await loadProject(id);
  if (!project) notFound();
  const rows = await loadBoardRows(id);
  const now = new Date();
  const tasks = rows.tasks.map((t) => ({ ...t, risk: risk({ due_date: t.due_date, state: t.state, in_review_since: t.state === "review" ? t.status_since : null }, now) }));
  const unitNames = Object.fromEntries(rows.nodes.map((n) => [n.id, n.name]));
  // Drag targets exclude moves that need a note (those are made from the task drawer, where the note can be written).
  const legal: Record<string, StatusKey[]> = Object.fromEntries(tasks.map((t) => {
    const isAssignee = t.assignees.some((a) => a.id === person.id);
    const opts = legalNext(t.status_key as StatusKey, person, { isAssignee }).filter((to) => { const c = canTransition(t.status_key as StatusKey, to, person, { isAssignee }); return c.ok && !c.needsNote; });
    return [t.id, opts];
  }));
  return (
    <>
      <TopBar crumb={[{ label: "Projects", href: "/" }, { label: project.name, href: `/p/${id}` }, { label: "Kanban" }]} right={<UserMenu person={person} />} />
      <Page className="py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-label text-[11px] font-bold tracking-[.22em] text-green">By status</p>
            <h1 className="mt-1 font-display text-[30px] font-light tracking-[-.02em]">{project.name}</h1>
          </div>
          <nav className="flex items-center gap-1 rounded-full border border-line p-1 text-[12px]"><Link href={`/p/${id}`} className="rounded-full px-3 py-1 text-muted hover:text-ink">Board</Link><Link href={`/p/${id}/timeline`} className="rounded-full px-3 py-1 text-muted hover:text-ink">Timeline</Link><span className="rounded-full bg-[rgba(169,227,75,.12)] px-3 py-1 text-green">Kanban</span></nav>
        </div>
        <div className="mb-4"><Legend items={[
          { tone: "green", label: "drag", meaning: "drop a card on a highlighted column to change its status" },
          { tone: "red", label: "Comments / reopen", meaning: "need a note — do those from the task" },
          { tone: "amber", label: "date", meaning: "due soon or stuck in review" },
        ]} /></div>
        <KanbanLive tasks={tasks} unitNames={unitNames} legal={legal} projectId={id} />
      </Page>
      {sp.task && <TaskDrawer taskId={sp.task} person={person} base={`/p/${id}/board`} tab={sp.tab} />}
    </>
  );
}
