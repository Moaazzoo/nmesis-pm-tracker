import type { State } from "@/lib/types";

const STATE_OPTIONS: { value: State; label: string }[] = [
  { value: "not_started", label: "Waiting" }, { value: "ready", label: "Ready to start" }, { value: "active", label: "In progress" },
  { value: "review", label: "In review" }, { value: "changes", label: "Comments" }, { value: "blocked", label: "On hold" },
  { value: "done", label: "Completed" }, { value: "cancelled", label: "Cancelled" },
];
const SEL = "rounded-full border border-line-strong bg-bg px-3 py-1.5 text-[12px] text-ink";

/** GET form; the page reads the query string. Works without JavaScript. */
export function Filters({ current, people, types }: {
  current: { state?: string; type?: string; person?: string; q?: string };
  people: { id: string; full_name: string }[]; types: string[];
}) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-2">
      <input name="q" defaultValue={current.q ?? ""} placeholder="Find a task or unit…" className={`${SEL} w-[200px]`} aria-label="Search" />
      <select name="state" defaultValue={current.state ?? ""} className={SEL} aria-label="Status">
        <option value="">Any status</option>
        {STATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select name="type" defaultValue={current.type ?? ""} className={SEL} aria-label="Task type">
        <option value="">Any type</option>
        {types.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select name="person" defaultValue={current.person ?? ""} className={SEL} aria-label="Assignee">
        <option value="">Anyone</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
      </select>
      <button type="submit" className="rounded-full border border-line-strong px-3 py-1.5 text-[12px] text-muted hover:text-ink">Apply</button>
      {(current.q || current.state || current.type || current.person) && <a href="?" className="text-[12px] text-faint hover:text-ink">Clear</a>}
    </form>
  );
}
