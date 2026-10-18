import { TopBar } from "@/components/ui/topbar";
import { Page } from "@/components/ui/panel";
import { Empty } from "@/components/ui/empty";
import { Legend } from "@/components/ui/legend";
import { UserMenu } from "@/components/ui/user-menu";
import { ProjectCard } from "@/components/project/project-card";
import { requirePerson } from "@/lib/auth";
import { listProjectsWithSummary } from "@/lib/queries/projects";

export const dynamic = "force-dynamic";

export default async function Home() {
  const person = await requirePerson();
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
        {projects.length === 0
          ? <Empty title="No active projects" hint="Production creates projects from Setup, or imports them from ftrack." />
          : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>}
      </Page>
    </>
  );
}
