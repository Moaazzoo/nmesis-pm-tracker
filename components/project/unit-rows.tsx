import type { UnitWithTasks } from "@/lib/queries/board-shape";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskAssignees, TaskDue, TaskStatus } from "@/components/tasks/task-controls";
import { rightsFor } from "@/lib/rights";
import type { Person } from "@/lib/types";

const KIND = { scene: "Scene", shot: "Shot", asset: "Asset build" } as const;

export function UnitRows({ units, projectId, person, people }: { units: UnitWithTasks[]; projectId: string; person: Person; people: { id: string; full_name: string }[] }) {
  return (
    <div className="tk-units">
      <div className="grid grid-cols-[minmax(220px,2fr)_120px_minmax(150px,1.4fr)_minmax(170px,1.3fr)_110px_60px_60px] gap-3 px-3 pb-2 font-label text-[9px] text-faint">
        <span>Task</span><span>Type</span><span>Status</span><span>Assignee</span><span>Due</span><span>Notes</span><span>Version</span>
      </div>
      {units.map((u) => (
        <section key={u.id} className="mb-3 rounded-[16px] border border-line bg-[linear-gradient(180deg,var(--panel),var(--bg2))] px-3 pb-1 pt-3">
          <header className="flex flex-wrap items-baseline gap-x-3 pb-1">
            <h3 className="font-display text-[17px] font-light">{u.name}</h3>
            <span className="font-label text-[9px] text-faint">{u.unit_kind ? KIND[u.unit_kind] : "Unit"}</span>
            <span className="truncate text-[11px] text-faint">{u.path.join(" / ")}</span>
            <span className="ml-auto tnum text-[11px] text-muted">{u.tasks.filter((t) => t.state === "done").length}/{u.tasks.length} done</span>
          </header>
          {u.tasks.map((t) => { const rights = rightsFor(person, t); return (
            <TaskRow key={t.id} t={t} href={`/p/${projectId}?task=${t.id}`}
              controls={<TaskStatus t={t} rights={rights} />}
              assigneeCell={<TaskAssignees t={t} people={people} rights={rights} />}
              dueCell={<TaskDue t={t} rights={rights} />} />); })}
        </section>
      ))}
    </div>
  );
}
