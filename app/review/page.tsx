import Link from "next/link";
import { TopBar } from "@/components/ui/topbar";
import { Page } from "@/components/ui/panel";
import { Empty } from "@/components/ui/empty";
import { Legend } from "@/components/ui/legend";
import { UserMenu } from "@/components/ui/user-menu";
import { ReviewItemCard } from "@/components/review/review-item";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { requirePerson } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { loadReview } from "@/lib/queries/review";
import type { Discipline } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReviewQueue({ searchParams }: { searchParams: Promise<{ d?: string; task?: string; tab?: string }> }) {
  const person = await requirePerson();
  const sp = await searchParams;
  const chosen: Discipline | "all" = sp.d === "CG" || sp.d === "VFX" ? sp.d : sp.d === "all" ? "all" : person.discipline ?? "all";
  const items = await loadReview(chosen);
  const canDecide = can(person, "approve");
  const base = `/review${sp.d ? `?d=${sp.d}` : ""}`;
  return (
    <>
      <TopBar crumb={[{ label: "Review queue" }]} right={<UserMenu person={person} />} />
      <Page className="py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-label text-[11px] font-bold tracking-[.22em] text-green">Pending review</p>
            <h1 className="mt-1 font-display text-[30px] font-light tracking-[-.02em]">{items.length === 0 ? "Nothing waiting for a decision" : `${items.length} task${items.length === 1 ? "" : "s"} waiting for a decision`}</h1>
          </div>
          <nav className="flex items-center gap-1 rounded-full border border-line p-1 text-[12px]" aria-label="Discipline">
            {(["CG", "VFX", "all"] as const).map((d) => <Link key={d} href={`/review?d=${d}`} className={`rounded-full px-3 py-1 ${chosen === d ? "bg-[rgba(169,227,75,.12)] text-green" : "text-muted hover:text-ink"}`}>{d === "all" ? "All disciplines" : `${d} tasks`}</Link>)}
          </nav>
        </div>
        <div className="mb-4"><Legend items={[
          { tone: "green", label: "Approve", meaning: "task → Completed; can also ready the next pass" },
          { tone: "red", label: "Send back", meaning: "task → Comments with your feedback note" },
          { tone: "amber", label: "N days waiting", meaning: "over 2 days counts as at risk" },
        ]} /><p className="mt-1 text-[11px] text-faint">CG = Layout, Modeling, Shading, Animation, Lighting, Art Direction · VFX = Compositing, FX, Editing, Matchmove · untyped tasks appear in both.</p></div>
        {!canDecide && <p className="mb-4 text-[12px] text-faint">Your role can see the queue but not decide; supervisors and production approve or send back.</p>}
        {items.length === 0
          ? <Empty title="Nothing waiting for review" hint="Tasks appear here the moment an artist submits a version (status Pending Review)." />
          : <div className="grid gap-3">{items.map((it) => <ReviewItemCard key={it.id} item={it} now={Date.now()} canDecide={canDecide} />)}</div>}
      </Page>
      {sp.task && <TaskDrawer taskId={sp.task} person={person} base={base} tab={sp.tab} />}
    </>
  );
}
