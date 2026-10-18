"use client";
import { useState, useTransition } from "react";
import { createTasks, archive } from "@/lib/actions/setup";
import { TEMPLATES } from "@/lib/actions/setup-core";

const TYPES = ["Layout", "Modeling", "Shading", "Animation", "FX", "Lighting", "Compositing", "Editing"];

export function TasksFromTemplate({ unitId }: { unitId: string }) {
  const [mode, setMode] = useState<"template" | "custom">("template"); const [template, setTemplate] = useState("Basic_Shot");
  const [type, setType] = useState("Lighting"); const [passes, setPasses] = useState(2);
  const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap items-center gap-2 text-[12px]" onSubmit={(e) => { e.preventDefault(); setError(null); setMsg(null); start(async () => { const r = await createTasks({ unitId, template: mode === "template" ? template : [{ type, passes }] }); if (!r.ok) setError(r.error); else setMsg(`${r.data?.ids.length ?? 0} task(s) added, all Waiting and unassigned.`); }); }}>
      <select value={mode} onChange={(e) => setMode(e.target.value as "template" | "custom")} className="rounded-full border border-line-strong bg-bg px-2 py-1"><option value="template">From template</option><option value="custom">Custom</option></select>
      {mode === "template"
        ? <select value={template} onChange={(e) => setTemplate(e.target.value)} className="rounded-full border border-line-strong bg-bg px-2 py-1">{Object.keys(TEMPLATES).map((k) => <option key={k} value={k}>{k} — {TEMPLATES[k].map((s) => s.type).join(", ")}</option>)}</select>
        : <><select value={type} onChange={(e) => setType(e.target.value)} className="rounded-full border border-line-strong bg-bg px-2 py-1">{TYPES.map((t) => <option key={t}>{t}</option>)}</select><label className="flex items-center gap-1 text-muted">passes <input type="number" min={1} max={9} value={passes} onChange={(e) => setPasses(Number(e.target.value))} onWheel={(e) => (e.target as HTMLInputElement).blur()} className="w-12 rounded-full border border-line-strong bg-bg px-2 py-1" /></label></>}
      <button type="submit" disabled={pending} className="rounded-full bg-green px-3 py-1 font-label text-[9px] font-bold text-[#0a0c0a] disabled:opacity-50">Add tasks</button>
      {msg && <span className="text-green">{msg}</span>}{error && <span role="alert" className="text-red">{error}</span>}
    </form>
  );
}

export function ArchiveButton({ kind, id, label }: { kind: "task" | "node" | "milestone"; id: string; label: string }) {
  const [gone, setGone] = useState(false); const [error, setError] = useState<string | null>(null); const [pending, start] = useTransition();
  if (gone) return <span className="text-[11px] text-faint">archived</span>;
  return <span className="flex items-center gap-2"><button type="button" disabled={pending} onClick={() => { if (!confirm(`Archive ${label}? It disappears from boards but is kept.`)) return; start(async () => { const r = await archive({ kind, id }); if (r.ok) setGone(true); else setError(r.error); }); }} className="text-[11px] text-faint hover:text-red" data-tip="Hides it from boards; nothing is deleted">archive</button>{error && <span role="alert" className="text-[11px] text-red">{error}</span>}</span>;
}
