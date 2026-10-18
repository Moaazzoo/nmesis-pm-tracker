"use client";
import { useState, useTransition } from "react";
import { addNote } from "@/lib/actions/drawer";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import type { Note } from "@/lib/queries/task";
import type { NoteCategory } from "@/lib/notes";

const CAT_TONE: Record<string, "green" | "amber" | "red" | "neutral" | "muted"> = { "Task Definition": "neutral", "Artist Note": "muted", "Supervisor Feedback": "amber", "Client Feedback": "red", "Production Note": "neutral" };

function fmt(ts: string) { return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }

function Composer({ taskId, categories, replyTo, onDone, placeholder }: { taskId: string; categories: NoteCategory[]; replyTo?: string; onDone?: () => void; placeholder: string }) {
  const [body, setBody] = useState(""); const [category, setCategory] = useState<NoteCategory>(categories[0]);
  const [error, setError] = useState<string | null>(null); const [pending, start] = useTransition();
  if (categories.length === 0) return null;
  return (
    <form className="tk-composer" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await addNote({ taskId, category, body, replyTo: replyTo ?? null }); if (!r.ok) setError(r.error); else { setBody(""); onDone?.(); } }); }}>
      <div className="flex gap-2">
        {categories.length > 1 && <select value={category} onChange={(e) => setCategory(e.target.value as NoteCategory)} className="rounded-[8px] border border-line-strong bg-bg px-2 py-1 text-[12px]">{categories.map((c) => <option key={c}>{c}</option>)}</select>}
        {categories.length === 1 && <Chip tone={CAT_TONE[categories[0]]} label={categories[0]} tip="The category your role posts" />}
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={replyTo ? 2 : 3} placeholder={placeholder} className="mt-2 w-full rounded-[10px] border border-line-strong bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-green" />
      <div className="mt-2 flex items-center justify-end gap-3">
        {error && <span role="alert" className="text-[11px] text-red">{error}</span>}
        {replyTo && <button type="button" onClick={onDone} className="text-[12px] text-muted">Cancel</button>}
        <button type="submit" disabled={pending || !body.trim()} className="rounded-full bg-green px-4 py-1.5 font-label text-[9px] font-bold text-[#0a0c0a] disabled:opacity-40">{replyTo ? "Reply" : "Post note"}</button>
      </div>
    </form>
  );
}

function NoteCard({ n, taskId, categories, depth = 0 }: { n: Note; taskId: string; categories: NoteCategory[]; depth?: number }) {
  const [replying, setReplying] = useState(false);
  return (
    <article className={`rounded-[12px] border border-line bg-panel p-3 ${depth ? "ml-6 mt-2" : "mt-3"}`}>
      <header className="flex flex-wrap items-center gap-2">
        <Avatar name={n.author} size={22} /><span className="text-[13px] text-ink">{n.author}</span>
        <Chip tone={CAT_TONE[n.category] ?? "neutral"} label={n.category} tip={n.source_label && n.source_label !== n.category ? `Imported from ftrack as "${n.source_label}"` : "Note category"} />
        {n.version_number && <span className="text-[11px] text-muted" data-tip="This note is about that version">on v{n.version_number}</span>}
        <span className="ml-auto text-[11px] text-faint">{fmt(n.created_at)}</span>
      </header>
      <p className="mt-2 whitespace-pre-wrap break-words text-[13px] text-ink">{n.body}</p>
      {categories.length > 0 && !replying && <button type="button" onClick={() => setReplying(true)} className="mt-2 text-[12px] text-muted hover:text-ink">Reply</button>}
      {replying && <div className="mt-2"><Composer taskId={taskId} categories={categories} replyTo={n.id} onDone={() => setReplying(false)} placeholder="Reply…" /></div>}
      {n.replies.map((r) => <NoteCard key={r.id} n={r} taskId={taskId} categories={categories} depth={depth + 1} />)}
    </article>
  );
}

export function NotesTab({ taskId, notes, categories }: { taskId: string; notes: Note[]; categories: NoteCategory[] }) {
  return (
    <div>
      <Composer taskId={taskId} categories={categories} placeholder="Write a note for this task…" />
      {categories.length === 0 && <p className="text-[12px] text-faint">Your role can read notes here but not post them.</p>}
      {notes.length === 0 ? <p className="mt-4 text-[13px] text-faint">No notes yet. Production usually starts with a Task Definition.</p> : notes.map((n) => <NoteCard key={n.id} n={n} taskId={taskId} categories={categories} />)}
    </div>
  );
}
