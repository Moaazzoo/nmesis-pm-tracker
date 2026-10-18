"use client";
import { useState, useTransition } from "react";
import { submitVersion } from "@/lib/actions/drawer";
import { Chip } from "@/components/ui/chip";
import type { Version } from "@/lib/queries/task";

const V_TONE: Record<string, "green" | "amber" | "red" | "neutral" | "muted"> = { submitted: "amber", approved: "green", client_approved: "green", needs_changes: "red" };
const V_LABEL: Record<string, string> = { submitted: "Submitted", approved: "Approved", client_approved: "Client approved", needs_changes: "Needs changes" };
function fmt(ts: string) { return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }

export function VersionsTab({ taskId, versions, canSubmit, submitHint }: { taskId: string; versions: Version[]; canSubmit: boolean; submitHint: string }) {
  const [link, setLink] = useState(""); const [note, setNote] = useState(""); const [error, setError] = useState<string | null>(null); const [pending, start] = useTransition();
  return (
    <div>
      {canSubmit ? (
        <form className="rounded-[12px] border border-[rgba(169,227,75,.28)] bg-[rgba(169,227,75,.04)] p-3" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await submitVersion({ taskId, link, note: note || null }); if (!r.ok) setError(r.error); else { setLink(""); setNote(""); } }); }}>
          <p className="font-label text-[10px] font-bold text-green">Submit a version</p>
          <p className="mt-1 text-[12px] text-muted">Paste the file path or review link. The task moves to Pending Review and the supervisors are notified.</p>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Z:\\…\\S07_comp_v003.mov or https://…" className="mt-2 w-full rounded-[10px] border border-line-strong bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-green" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed in this version (optional)" className="mt-2 w-full rounded-[10px] border border-line-strong bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-green" />
          <div className="mt-2 flex items-center justify-end gap-3">
            {error && <span role="alert" className="text-[11px] text-red">{error}</span>}
            <button type="submit" disabled={pending || !link.trim()} className="rounded-full bg-green px-4 py-1.5 font-label text-[9px] font-bold text-[#0a0c0a] disabled:opacity-40">Submit version</button>
          </div>
        </form>
      ) : <p className="text-[12px] text-faint">{submitHint}</p>}
      {versions.length === 0 ? <p className="mt-4 text-[13px] text-faint">No versions yet. The assigned artist submits the first one from here.</p> : (
        <ul className="mt-4 space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="rounded-[12px] border border-line bg-panel p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-[16px] font-light">v{v.number}</span>
                {v.asset_name && <span className="text-[12px] text-muted" data-tip="Asset name in ftrack">{v.asset_name}</span>}
                <Chip tone={V_TONE[v.status] ?? "neutral"} label={V_LABEL[v.status] ?? v.status} tip="Version status" />
                {v.source === "ftrack" && <Chip tone="muted" label="from ftrack" tip="Imported; the file lives on the ftrack/central storage" />}
                <span className="ml-auto text-[11px] text-faint">{v.submitted_by} · {fmt(v.submitted_at)}</span>
              </div>
              {v.link && (v.link.startsWith("http") ? <a href={v.link} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[12px] text-green underline-offset-2 hover:underline">{v.link}</a> : <p className="mt-1 truncate font-mono text-[11px] text-muted" data-tip="File / component name">{v.link}</p>)}
              {v.note && <p className="mt-1 text-[12px] text-ink">{v.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
