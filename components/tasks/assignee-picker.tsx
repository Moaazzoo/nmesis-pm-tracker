"use client";
import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";

type P = { id: string; full_name: string };
export type AssignChange = (input: { taskId: string; personIds: string[] }) => Promise<{ ok: true } | { ok: false; error: string }>;

/** Assignee cell: shows avatars; production can open a checklist of people. */
export function AssigneePicker({ taskId, assignees, people, canEdit, onChange }: { taskId: string; assignees: P[]; people: P[]; canEdit: boolean; onChange: AssignChange }) {
  const [shown, setShown] = useState<P[]>(assignees);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { setShown(assignees); }, [assignees]);
  const toggle = (p: P) => {
    const before = shown;
    const next = shown.some((a) => a.id === p.id) ? shown.filter((a) => a.id !== p.id) : [...shown, p];
    setShown(next); setError(null);
    start(async () => { try { const r = await onChange({ taskId, personIds: next.map((a) => a.id) }); if (!r.ok) { setShown(before); setError(r.error); } } catch { setShown(before); setError("Could not reach the server — nothing was changed."); } });
  };
  const list = shown.length === 0 ? <span className="text-[12px] text-faint">Unassigned</span>
    : shown.map((a) => <span key={a.id} className="flex items-center gap-1.5"><Avatar name={a.full_name} size={20} /><span className="truncate text-[12px]">{a.full_name}</span></span>);
  if (!canEdit) return <div className="flex min-w-0 items-center gap-1.5">{list}</div>;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={pending} className={`flex min-w-0 items-center gap-1.5 rounded-full px-1 py-0.5 hover:bg-[rgba(255,255,255,.04)] ${pending ? "opacity-60" : ""}`} data-tip="Change who works on this">{list}</button>
      {open && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-[280px] w-[220px] overflow-auto rounded-[12px] border border-line-strong bg-panel2 p-1 shadow-xl">
          {people.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12px] hover:bg-[rgba(169,227,75,.08)]">
                <input type="checkbox" checked={shown.some((a) => a.id === p.id)} onChange={() => toggle(p)} /> {p.full_name}
              </label>
            </li>
          ))}
          <li><button type="button" onClick={() => setOpen(false)} className="w-full px-2 py-1.5 text-left text-[11px] text-muted">Done</button></li>
        </ul>
      )}
      {error && <span role="alert" className="mt-1 block text-[11px] text-red">{error}</span>}
    </div>
  );
}
