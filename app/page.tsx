import { TopBar } from "@/components/ui/topbar";
import { Page } from "@/components/ui/panel";
import { Empty } from "@/components/ui/empty";
import { Legend } from "@/components/ui/legend";
import { UserMenu } from "@/components/ui/user-menu";
import { ProjectCard } from "@/components/project/project-card";
import { requirePerson } from "@/lib/auth";
import { listProjectsWithSummary } from "@/lib/queries/projects";
import { createProject } from "@/lib/actions/setup";
import { can } from "@/lib/permissions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const person = await requirePerson();
  const { error } = await searchParams;
  const projects = await listProjectsWithSummary();
  return (
    <>
      <TopBar crumb={[{ label: "Projects" }]} right={<UserMenu person={person} />} />
      <Page className="py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-label text-[11px] font-bold tracking-[.22em] text-green">Active projects</p>
            <h1 className="mt-1 font-display text-[34px] font-light tracking-[-.02em]">Where every project stands</h1>
          </div>
          <Legend items={[
            { tone: "green", label: "ring", meaning: "share of tasks completed" },
            { tone: "amber", label: "in review", meaning: "waiting for a supervisor" },
            { tone: "red", label: "overdue", meaning: "past due, not completed" },
            { tone: "amber", label: "at risk", meaning: "due soon, not started / stuck in review" },
          ]} />
        </div>
        {error && <p role="alert" className="mb-4 text-[13px] text-red">{decodeURIComponent(error)}</p>}
        {projects.length === 0
          ? <Empty title="No active projects" hint="Production creates projects below, or imports them from ftrack." />
          : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>}
        {can(person, "edit_structure") && (
          <form action={createProject} className="mt-8 flex flex-wrap items-center gap-2 rounded-[16px] border border-dashed border-line-strong p-4 text-[12px]">
            <span className="font-label text-[10px] font-bold text-faint">New project</span>
            <input name="name" placeholder="Name (e.g. Lexus 2027)" required className="rounded-[8px] border border-line-strong bg-bg px-2 py-1 text-ink" />
            <input name="code" placeholder="code (e.g. lexus_2027)" required className="rounded-[8px] border border-line-strong bg-bg px-2 py-1 text-ink" />
            <input name="client" placeholder="Client" className="rounded-[8px] border border-line-strong bg-bg px-2 py-1 text-ink" />
            <input type="date" name="start_date" className="rounded-[8px] border border-line-strong bg-bg px-2 py-1 text-ink" aria-label="Start date" />
            <input type="date" name="end_date" className="rounded-[8px] border border-line-strong bg-bg px-2 py-1 text-ink" aria-label="End date" />
            <button className="rounded-full bg-green px-3 py-1 font-label text-[9px] font-bold text-[#0a0c0a]">Create</button>
            <Link href="/people" className="ml-auto text-faint hover:text-ink">People &amp; roles</Link>
          </form>
        )}
      </Page>
    </>
  );
}
