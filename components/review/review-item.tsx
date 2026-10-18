"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { approve, sendBack } from "@/lib/actions/review";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import type { ReviewItem as Item } from "@/lib/queries/review";

function fmt(ts: string) { return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
function daysAgo(ts: string, now: number) { return Math.max(0, Math.floor((now - Date.parse(ts)) / 86_400_000)); }

export function ReviewItemCard({ item, now, canDecide = true }: { item: Item; now: number; canDecide?: boolean }) {
  const [mode, setMode] = useState<"idle" | "approve" | "sendback" | "done">("idle");
  const [nextReady, setNextReady] = useState(true); const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [pending, start] = useTransition();
  const waited = daysAgo(item.in_review_since, now);
  if (mode === "done") return <article className="rounded-[16px] border border-line bg-panel p-4 text-[13px] text-muted"><span className="text-green">✓</span> {result}</article>;
  return (
    <article className={`rounded-[16px] border ${item.risk === "at_risk" ? "border-[rgba(230,173,0,.45)]" : "border-line"} bg-[linear-gradient(180deg,var(--panel),var(--bg2))] p-4`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-faint">{item.project_name} / {[...item.path, item.unit_name].join(" / ")}</p>
          <h3 className="flex items-center gap-2 font-display text-[19px] font-light">
            {item.critical && <span className="h-2 w-2 rounded-full bg-red" data-tip="Critical" />}
            <Link href={`/review?task=${item.id}`} className="hover:text-green">{item.name}</Link>
            <span className="text-[12px] text-muted">{item.type_name ?? "No type"}</span>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
            {item.assignees.map((a) => <span key={a.id} className="flex items-center gap-1"><Avatar name={a.full_name} size={18} />{a.full_name}</span>)}
            <Chip tone={waited > 2 ? "amber" : "neutral"} label={waited === 0 ? "today" : `${waited} day${waited === 1 ? "" : "s"} waiting`} tip="Time since the task entered Pending Review" />
          </div>
        </div>
        <div className="text-right text-[12px]">
          {item.version ? (
            <>
              <p className="font-display text-[16px] font-light">v{item.version.number}</p>
              {item.version.link && (item.version.link.startsWith("http") ? <a href={item.version.link} target="_blank" rel="noreferrer" className="block max-w-[260px] truncate text-green hover:underline">{item.version.link}</a> : <p className="max-w-[260px] truncate font-mono text-[11px] text-muted" data-tip="File / component name">{item.version.link}</p>)}
              <p className="text-faint">{item.version.submitted_by} · {fmt(item.version.submitted_at)}</p>
            </>
          ) : <p className="text-faint" data-tip="The status was set without a version record">No version attached</p>}
        </div>
      </div>
      {(item.artist_note || item.version?.note) && (
        <p className="mt-3 rounded-[10px] bg-[rgba(255,255,255,.03)] px-3 py-2 text-[12px] text-ink"><span className="text-faint">Artist: </span>{item.version?.note ?? item.artist_note?.body}</p>
      )}
      {mode === "idle" && !canDecide && <div className="mt-3 text-right"><Link href={`/review?task=${item.id}&tab=notes`} className="text-[12px] text-muted hover:text-ink">Open task</Link></div>}
      {mode === "idle" && canDecide && (
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => setMode("approve")} className="rounded-full bg-green px-4 py-1.5 font-label text-[9px] font-bold text-[#0a0c0a]">Approve</button>
          <button type="button" onClick={() => setMode("sendback")} className="rounded-full border border-[rgba(255,90,95,.55)] px-4 py-1.5 font-label text-[9px] font-bold text-red hover:bg-[rgba(255,90,95,.08)]">Send back with comments</button>
          <Link href={`/review?task=${item.id}&tab=notes`} className="ml-auto text-[12px] text-muted hover:text-ink">Open task</Link>
        </div>
      )}
      {mode === "approve" && (
        <form className="mt-3 rounded-[12px] border border-[rgba(169,227,75,.3)] p-3" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await approve({ taskId: item.id, markNextPassReady: nextReady && !!item.next_pass_name }); if (!r.ok) setError(r.error); else { setResult(`${item.name} approved${r.data?.nextPassId ? ` · ${item.next_pass_name} marked Ready to start` : ""}.`); setMode("done"); } }); }}>
          <p className="text-[13px] text-ink">Approve <strong>{item.name}</strong> → Completed.</p>
          {item.next_pass_name && <label className="mt-2 flex items-center gap-2 text-[12px] text-muted"><input type="checkbox" checked={nextReady} onChange={(e) => setNextReady(e.target.checked)} /> Also mark <span className="text-ink">{item.next_pass_name}</span> Ready to start</label>}
          <div className="mt-2 flex items-center gap-3">
            <button type="submit" disabled={pending} className="rounded-full bg-green px-4 py-1.5 font-label text-[9px] font-bold text-[#0a0c0a] disabled:opacity-50">Confirm</button>
            <button type="button" onClick={() => setMode("idle")} className="text-[12px] text-muted">Cancel</button>
            {error && <span role="alert" className="text-[11px] text-red">{error}</span>}
          </div>
        </form>
      )}
      {mode === "sendback" && (
        <form className="mt-3 rounded-[12px] border border-[rgba(255,90,95,.35)] p-3" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await sendBack({ taskId: item.id, body }); if (!r.ok) setError(r.error); else { setResult(`${item.name} sent back with comments.`); setMode("done"); } }); }}>
          <p className="text-[13px] text-ink">Send <strong>{item.name}</strong> back → Comments. Your note is posted as Supervisor Feedback.</p>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} autoFocus placeholder="What needs to change?" className="mt-2 w-full rounded-[10px] border border-line-strong bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-red" />
          <div className="mt-2 flex items-center gap-3">
            <button type="submit" disabled={pending || !body.trim()} className="rounded-full border border-[rgba(255,90,95,.55)] px-4 py-1.5 font-label text-[9px] font-bold text-red disabled:opacity-40">Send back</button>
            <button type="button" onClick={() => setMode("idle")} className="text-[12px] text-muted">Cancel</button>
            {error && <span role="alert" className="text-[11px] text-red">{error}</span>}
          </div>
        </form>
      )}
    </article>
  );
}
