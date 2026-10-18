import type { Layout, TLMilestone } from "@/lib/queries/timeline-layout";

const KIND_LABEL = { client_review: "Client review", delivery: "Delivery", internal: "Internal milestone" } as const;
function fmt(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); }

function DiamondShape({ kind, done }: { kind: TLMilestone["kind"]; done: boolean }) {
  const fill = kind === "delivery" ? "var(--green)" : kind === "client_review" ? "var(--bg)" : "var(--muted)";
  const stroke = kind === "internal" ? "var(--muted)" : "var(--green)";
  const size = kind === "internal" ? 5 : 7;
  return <polygon points={`0,-${size} ${size},0 0,${size} -${size},0`} fill={fill} stroke={stroke} strokeWidth={1.5} opacity={done ? 0.45 : 1} />;
}

/** Weeks on the x-axis from this week; unit bars (filled by progress) and milestone diamonds on three label rows. */
export function TimelineLane({ l }: { l: Layout }) {
  const rowH = 26, top = 70, labelRows = 3 * 16 + 8;
  const height = top + labelRows + l.bars.length * rowH + 20;
  const W = 1000;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Project timeline" className="tk-timeline block">
      {l.columns.map((c, i) => { const x = (i / l.columns.length) * W; return (
        <g key={c.start}>
          <line x1={x} x2={x} y1={0} y2={height} stroke="var(--line)" />
          <text x={x + 6} y={16} fill="var(--muted)" fontSize={11} className="tnum">Week of {c.label}</text>
        </g>); })}
      <line x1={(l.todayPct / 100) * W} x2={(l.todayPct / 100) * W} y1={0} y2={height} stroke="var(--green)" strokeDasharray="3 3" />
      <text x={(l.todayPct / 100) * W + 5} y={30} fill="var(--green)" fontSize={10} fontWeight={700} letterSpacing=".12em">TODAY</text>
      {l.diamonds.map((d) => { const x = (d.x / 100) * W; const y = top - 20 + d.label_row * 16; return (
        <g key={d.id} transform={`translate(${x},${y})`}>
          <line x1={0} x2={0} y1={0} y2={labelRows + l.bars.length * rowH - d.label_row * 16} stroke="var(--line-strong)" />
          <DiamondShape kind={d.kind} done={d.done} />
          <text x={10} y={4} fill={d.done ? "var(--faint)" : "var(--ink)"} fontSize={11}>{d.name}{d.done ? " ✓" : ""}</text>
        </g>); })}
      {l.bars.map((b, i) => { const y = top + labelRows + i * rowH; const x = (b.startPct / 100) * W; const w = Math.max(4, (b.widthPct / 100) * W); return (
        <g key={b.unit_id}>
          <rect x={x} y={y} width={w} height={14} rx={7} fill="var(--track)" />
          <rect x={x} y={y} width={Math.max(0, (w * b.progressPct) / 100)} height={14} rx={7} fill="var(--green)" opacity={0.85} />
          {b.clippedStart && <text x={x - 4} y={y + 11} fill="var(--faint)" fontSize={10} textAnchor="end">◀</text>}
          {b.clippedEnd && <text x={x + w + 4} y={y + 11} fill="var(--faint)" fontSize={10}>▶</text>}
          <text x={x + w + (b.clippedEnd ? 16 : 6)} y={y + 11} fill="var(--ink)" fontSize={11}>{b.name} · {b.progressPct}%</text>
        </g>); })}
    </svg>
  );
}

/** Fallback when many dates land on the same day: one row per event, grouped by day — what production reads natively. */
export function TimelineAgenda({ milestones, bars }: { milestones: TLMilestone[]; bars: Layout["bars"] }) {
  const byDay = new Map<string, { kind: string; text: string; done: boolean }[]>();
  for (const m of milestones) if (m.due_date) byDay.set(m.due_date, [...(byDay.get(m.due_date) ?? []), { kind: KIND_LABEL[m.kind], text: m.name, done: m.done }]);
  for (const b of bars) byDay.set(b.end, [...(byDay.get(b.end) ?? []), { kind: "Unit ends", text: `${b.name} · ${b.progressPct}%`, done: b.progressPct === 100 }]);
  const days = [...byDay.keys()].sort();
  return (
    <ol className="divide-y divide-line">
      {days.map((d) => (
        <li key={d} className="grid grid-cols-[140px_1fr] gap-4 py-2">
          <span className="tnum text-[12px] text-muted">{fmt(d)}</span>
          <ul className="space-y-1">{byDay.get(d)!.map((e, i) => <li key={i} className={`text-[13px] ${e.done ? "text-faint" : "text-ink"}`}><span className="font-label mr-2 text-[9px] text-faint">{e.kind}</span>{e.text}{e.done ? " ✓" : ""}</li>)}</ul>
        </li>
      ))}
    </ol>
  );
}
