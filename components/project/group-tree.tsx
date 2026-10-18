import type { Group } from "@/lib/queries/board-shape";

function Row({ g, depth }: { g: Group; depth: number }) {
  return (
    <li>
      <div className="flex items-center gap-3 py-1.5" style={{ paddingLeft: depth * 14 }}>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{g.name}</span>
        <span className="tnum text-[11px] text-muted" data-tip={`${g.counts.done} of ${g.counts.total} tasks completed`}>{g.counts.done}/{g.counts.total}</span>
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--track)]" aria-hidden><span className="block h-full rounded-full bg-green" style={{ width: `${g.progressPct}%` }} /></span>
      </div>
      {g.children.length > 0 && <ul>{g.children.map((c) => <Row key={c.id} g={c} depth={depth + 1} />)}</ul>}
    </li>
  );
}

/** Left rail: the project's groups with completed/total and a progress bar each. */
export function GroupTree({ groups }: { groups: Group[] }) {
  if (groups.length === 0) return <p className="text-[12px] text-faint">No groups yet — production adds them in Setup.</p>;
  return <ul className="tk-tree">{groups.map((g) => <Row key={g.id} g={g} depth={0} />)}</ul>;
}
