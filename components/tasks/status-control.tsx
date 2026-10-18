"use client";
import { useState, useTransition } from "react";
import { STATUS_BY_KEY } from "@/lib/statuses";
import { NOTE_CATEGORIES, type NoteCategory } from "@/lib/notes";
import type { StatusKey } from "@/lib/types";

export type StatusChange = (input: { taskId: string; to: StatusKey; note?: { category: NoteCategory; body: string } }) => Promise<{ ok: true; data?: unknown } | { ok: false; error: string }>;

const TONE_CLS = { green: "text-green border-[rgba(169,227,75,.4)]", amber: "text-amber border-[rgba(230,173,0,.5)]", red: "text-red border-[rgba(255,90,95,.55)]", neutral: "text-ink border-line-strong", muted: "text-muted border-dashed border-line-strong" } as const;

/** Status chip that opens a menu of the actor's legal next statuses; moves needing a note show an inline note field. */
export function StatusControl({ taskId, current, options, needsNote = [], noteCategories = ["Production Note"], onChange }: {
  taskId: string; current: StatusKey; options: StatusKey[]; needsNote?: StatusKey[]; noteCategories?: NoteCategory[]; onChange: StatusChange;
}) {
  const [shown, setShown] = useState<StatusKey>(current);
  const [open, setOpen] = useState(false);
  const [noteFor, setNoteFor] = useState<StatusKey | null>(null);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<NoteCategory>(noteCategories[0] ?? "Production Note");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const st = STATUS_BY_KEY[shown];

  const commit = (to: StatusKey, note?: { category: NoteCategory; body: string }) => {
    const before = shown;
    setShown(to); setOpen(false); setNoteFor(null); setError(null);
    start(async () => {
      const r = await onChange({ taskId, to, note });
      if (!r.ok) { setShown(before); setError(r.error); }
      else setBody("");
    });
  };

  if (options.length === 0) {
    return <span className={`font-label inline-block whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[9px] font-bold ${TONE_CLS[st.tone]}`} data-tip="You cannot change this status">{st.name}</span>;
  }
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={pending} aria-haspopup="menu" aria-expanded={open}
        className={`font-label inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[9px] font-bold ${TONE_CLS[st.tone]} ${pending ? "opacity-60" : ""}`}>
        {st.name} <span aria-hidden>▾</span>
      </button>
      {open && (
        <ul role="menu" className="absolute left-0 top-full z-50 mt-1 min-w-[190px] rounded-[12px] border border-line-strong bg-panel2 p-1 shadow-xl">
          {options.map((o) => (
            <li key={o} role="none">
              <button role="menuitem" type="button" onClick={() => (needsNote.includes(o) ? (setNoteFor(o), setOpen(false)) : commit(o))}
                className="block w-full rounded-[8px] px-3 py-1.5 text-left text-[12px] text-ink hover:bg-[rgba(169,227,75,.08)]">{STATUS_BY_KEY[o].name}</button>
            </li>
          ))}
        </ul>
      )}
      {noteFor && (
        <form className="absolute left-0 top-full z-50 mt-1 w-[320px] rounded-[12px] border border-line-strong bg-panel2 p-3 shadow-xl" onSubmit={(e) => { e.preventDefault(); commit(noteFor, { category, body }); }}>
          <p className="font-label mb-2 text-[9px] text-faint">Note required to move to {STATUS_BY_KEY[noteFor].name}</p>
          {noteCategories.length > 1 && (
            <select value={category} onChange={(e) => setCategory(e.target.value as NoteCategory)} className="mb-2 w-full rounded-[8px] border border-line-strong bg-bg px-2 py-1 text-[12px]">
              {NOTE_CATEGORIES.filter((c) => noteCategories.includes(c)).map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} autoFocus placeholder="What should change?" className="w-full rounded-[8px] border border-line-strong bg-bg px-2 py-1 text-[12px] text-ink" />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setNoteFor(null)} className="text-[12px] text-muted">Cancel</button>
            <button type="submit" disabled={!body.trim()} className="rounded-full bg-green px-3 py-1 font-label text-[9px] font-bold text-[#0a0c0a] disabled:opacity-40">Send</button>
          </div>
        </form>
      )}
      {error && <span role="alert" className="mt-1 block max-w-[260px] text-[11px] text-red">{error}</span>}
    </div>
  );
}
