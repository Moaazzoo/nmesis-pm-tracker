import type { HistoryItem } from "@/lib/actions/drawer-core";

function fmt(ts: string) { return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

export function HistoryTab({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) return <p className="text-[13px] text-faint">Nothing has happened to this task yet.</p>;
  return (
    <ol className="space-y-1">
      {history.map((h) => (
        <li key={h.id} className="grid grid-cols-[150px_1fr] gap-3 border-t border-line py-2 text-[12px]">
          <span className="tnum text-faint">{fmt(h.at)}</span>
          <span className="text-ink"><span className="text-muted">{h.who}</span> {h.kind === "status" ? <span className="text-ink">moved it {h.text}</span> : h.text}</span>
        </li>
      ))}
    </ol>
  );
}
