import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/ui/topbar";
import { Page } from "@/components/ui/panel";
import { Empty } from "@/components/ui/empty";
import { UserMenu } from "@/components/ui/user-menu";
import { TimelineLane, TimelineAgenda } from "@/components/timeline/timeline";
import { requirePerson } from "@/lib/auth";
import { loadProject } from "@/lib/queries/project-board";
import { loadTimeline } from "@/lib/queries/timeline";

export const dynamic = "force-dynamic";

export default async function Timeline({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const person = await requirePerson();
  const { id } = await params; const { view } = await searchParams;
  const project = await loadProject(id);
  if (!project) notFound();
  const l = await loadTimeline(id);
  const agenda = view === "list" || (l.clustered && view !== "lane");
  const upcoming = l.milestonesAll.filter((m) => m.due_date && m.due_date >= l.windowStart);
  const nothing = l.bars.length === 0 && l.diamonds.length === 0;
  return (
    <>
      <TopBar crumb={[{ label: "Projects", href: "/" }, { label: project.name, href: `/p/${id}` }, { label: "Timeline" }]} right={<UserMenu person={person} />} />
      <Page className="py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-label text-[11px] font-bold tracking-[.22em] text-green">Next 8 weeks · from this week</p>
            <h1 className="mt-1 font-display text-[30px] font-light tracking-[-.02em]">{project.name}</h1>
          </div>
          <nav className="flex items-center gap-1 rounded-full border border-line p-1 text-[12px]">
            <Link href={`/p/${id}/timeline?view=lane`} className={`rounded-full px-3 py-1 ${!agenda ? "bg-[rgba(169,227,75,.12)] text-green" : "text-muted hover:text-ink"}`}>Lane</Link>
            <Link href={`/p/${id}/timeline?view=list`} className={`rounded-full px-3 py-1 ${agenda ? "bg-[rgba(169,227,75,.12)] text-green" : "text-muted hover:text-ink"}`}>Day list</Link>
          </nav>
        </div>
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted" aria-label="Legend">
          <li><span className="mr-1 inline-block h-2.5 w-2.5 rotate-45 border border-green bg-green" /> Delivery</li>
          <li><span className="mr-1 inline-block h-2.5 w-2.5 rotate-45 border border-green bg-bg" /> Client review</li>
          <li><span className="mr-1 inline-block h-2 w-2 rotate-45 border border-muted bg-muted" /> Internal milestone</li>
          <li><span className="mr-1 inline-block h-2 w-8 rounded-full bg-green opacity-85 align-middle" /> Unit bar, filled by share of tasks done · ◀ ▶ = continues outside the window</li>
          <li><span className="text-green">┊</span> Today</li>
        </ul>
        {l.clustered && !agenda && <p className="mb-3 text-[12px] text-amber">Several dates fall on the same day; the day list is easier to read for this project.</p>}
        {nothing
          ? <Empty title="Nothing scheduled in the next 8 weeks" hint="Units need task start/due dates and milestones need dates — production sets them on the board and in Setup." />
          : <div className="rounded-[16px] border border-line bg-[linear-gradient(180deg,var(--panel),var(--bg2))] p-4">{agenda ? <TimelineAgenda milestones={upcoming} bars={l.bars} /> : <TimelineLane l={l} />}</div>}
        {l.unscheduled.length > 0 && <p className="mt-3 text-[12px] text-faint">{l.unscheduled.length} unit{l.unscheduled.length === 1 ? " has" : "s have"} no dated tasks and {l.unscheduled.length === 1 ? "is" : "are"} not drawn: {l.unscheduled.slice(0, 6).map((u) => u.name).join(", ")}{l.unscheduled.length > 6 ? "…" : ""}.</p>}
      </Page>
    </>
  );
}
