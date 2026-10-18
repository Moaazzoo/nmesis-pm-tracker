import { TopBar } from "@/components/ui/topbar";
import { Page } from "@/components/ui/panel";
import { Empty } from "@/components/ui/empty";
import { Legend } from "@/components/ui/legend";
import { UserMenu } from "@/components/ui/user-menu";
import { QueueList } from "@/components/queue/queue-list";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { requirePerson } from "@/lib/auth";
import { loadQueue } from "@/lib/queries/queue";

export const dynamic = "force-dynamic";

export default async function MyQueue({ searchParams }: { searchParams: Promise<{ task?: string; tab?: string }> }) {
  const person = await requirePerson();
  const sp = await searchParams;
  const { groups, total } = await loadQueue(person.id);
  return (
    <>
      <TopBar crumb={[{ label: "My Queue" }]} right={<UserMenu person={person} />} />
      <Page className="py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-label text-[11px] font-bold tracking-[.22em] text-green">{person.full_name}</p>
            <h1 className="mt-1 font-display text-[30px] font-light tracking-[-.02em]">{total === 0 ? "Nothing on your plate" : `${total} task${total === 1 ? "" : "s"} on your plate`}</h1>
          </div>
          <Legend items={[
            { tone: "green", label: "Start", meaning: "moves a task to In Progress" },
            { tone: "amber", label: "date", meaning: "due soon" },
            { tone: "red", label: "date", meaning: "overdue" },
          ]} />
        </div>
        {total === 0
          ? <Empty title="Nothing assigned to you yet" hint="Production assigns tasks from the project board; they show up here grouped by what to do next." />
          : <QueueList groups={groups} />}
      </Page>
      {sp.task && <TaskDrawer taskId={sp.task} person={person} base="/me" tab={sp.tab} />}
    </>
  );
}
