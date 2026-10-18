import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/ui/topbar";
import { Page } from "@/components/ui/panel";
import { Empty } from "@/components/ui/empty";
import { Legend } from "@/components/ui/legend";
import { UserMenu } from "@/components/ui/user-menu";
import { GroupTree } from "@/components/project/group-tree";
import { SummaryStrip } from "@/components/project/summary-strip";
import { Filters } from "@/components/project/filters";
import { UnitRows } from "@/components/project/unit-rows";
import { requirePerson } from "@/lib/auth";
import { loadBoard, loadProject } from "@/lib/queries/project-board";
import { listAssignablePeople } from "@/lib/queries/people";
import type { State } from "@/lib/types";
import { TaskDrawer } from "@/components/tasks/task-drawer";

export const dynamic = "force-dynamic";

type Search = { state?: string; type?: string; person?: string; q?: string; task?: string; tab?: string };

export default async function ProjectBoard({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const person = await requirePerson();
  const { id } = await params;
  const sp = await searchParams;
  const project = await loadProject(id);
  if (!project) notFound();
  const board = await loadBoard(id, { states: sp.state ? [sp.state as State] : undefined, type: sp.type || undefined, person: sp.person || undefined, q: sp.q || undefined });
  const filtered = !!(sp.state || sp.type || sp.person || sp.q);
  const allPeople = await listAssignablePeople();
  const qs = new URLSearchParams(Object.entries({ state: sp.state, type: sp.type, person: sp.person, q: sp.q }).filter((e): e is [string, string] => !!e[1]));
  const baseQuery = qs.toString() ? `?${qs}` : "";
  return (
    <>
      <TopBar crumb={[{ label: "Projects", href: "/" }, { label: project.name }]} right={<UserMenu person={person} />} />
      <Page className="py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-label text-[11px] font-bold tracking-[.22em] text-green">{project.client ?? project.code}</p>
            <h1 className="mt-1 font-display text-[30px] font-light tracking-[-.02em]">{project.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3"><SummaryStrip s={board.summary} /><nav className="flex items-center gap-1 rounded-full border border-line p-1 text-[12px]"><span className="rounded-full bg-[rgba(169,227,75,.12)] px-3 py-1 text-green">Board</span><Link href={`/p/${id}/timeline`} className="rounded-full px-3 py-1 text-muted hover:text-ink">Timeline</Link><Link href={`/p/${id}/board`} className="rounded-full px-3 py-1 text-muted hover:text-ink">Kanban</Link></nav></div>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Filters current={sp} people={board.people} types={board.types} />
          <Legend items={[
            { tone: "amber", label: "Pending Review", meaning: "waiting for a supervisor" },
            { tone: "red", label: "Comments", meaning: "sent back to the artist" },
            { tone: "green", label: "Completed", meaning: "approved and done" },
            { tone: "red", label: "date", meaning: "overdue" },
            { tone: "amber", label: "date", meaning: "due soon or stuck in review" },
          ]} />
        </div>
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-[16px] border border-line p-4">
            <p className="font-label mb-2 text-[10px] font-bold text-faint">Groups · completed / total</p>
            <GroupTree groups={board.groups} />
          </aside>
          <main>
            {board.units.length === 0
              ? <Empty title={filtered ? "No tasks match these filters" : "No tasks in this project yet"} hint={filtered ? "Clear the filters to see everything." : "Production adds units and tasks from Setup, or imports them from ftrack."} />
              : <UnitRows units={board.units} projectId={id} person={person} people={allPeople} />}
          </main>
        </div>
      </Page>
      {sp.task && <TaskDrawer taskId={sp.task} person={person} base={`/p/${id}${baseQuery}`} tab={sp.tab} />}
    </>
  );
}
