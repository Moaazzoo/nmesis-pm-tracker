export type TLUnit = { id: string; name: string; start: string | null; end: string | null; progressPct: number };
export type TLMilestone = { id: string; name: string; kind: "client_review" | "delivery" | "internal"; due_date: string | null; done: boolean };
export type Week = { start: string; label: string };
export type Bar = { unit_id: string; name: string; startPct: number; widthPct: number; progressPct: number; clippedStart: boolean; clippedEnd: boolean; start: string; end: string };
export type Diamond = { id: string; name: string; kind: TLMilestone["kind"]; x: number; label_row: 0 | 1 | 2; done: boolean; due_date: string };
export type Layout = { columns: Week[]; bars: Bar[]; diamonds: Diamond[]; clustered: boolean; windowStart: string; windowEnd: string; todayPct: number; unscheduled: TLUnit[] };

const DAY = 86_400_000;
const dayN = (d: string) => Math.floor(Date.parse(d + "T00:00:00Z") / DAY);
const dayS = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

/** Sunday-start week containing `today`, `weeks` columns; bars and diamonds as percentages of the window. */
export function layoutTimeline({ units, milestones, today, weeks = 8 }: { units: TLUnit[]; milestones: TLMilestone[]; today: string; weeks?: number }): Layout {
  const t = dayN(today);
  const dow = (t + 4) % 7; // 1970-01-01 was a Thursday → +4 makes 0 = Sunday
  const start = t - dow;
  const total = weeks * 7;
  const end = start + total; // exclusive
  const pct = (n: number) => Math.round(((n - start) / total) * 10000) / 100;
  const columns: Week[] = Array.from({ length: weeks }, (_, i) => { const s = start + i * 7; const d = new Date(s * DAY); return { start: dayS(s), label: `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}` }; });

  const bars: Bar[] = []; const unscheduled: TLUnit[] = [];
  for (const u of units) {
    if (!u.start || !u.end) { unscheduled.push(u); continue; }
    const s = dayN(u.start), e = dayN(u.end) + 1; // end inclusive
    if (e <= start || s >= end) continue;
    const cs = Math.max(s, start), ce = Math.min(e, end);
    bars.push({ unit_id: u.id, name: u.name, startPct: pct(cs), widthPct: Math.round(((ce - cs) / total) * 10000) / 100, progressPct: u.progressPct, clippedStart: s < start, clippedEnd: e > end, start: u.start, end: u.end });
  }

  const inWin = milestones.filter((m): m is TLMilestone & { due_date: string } => !!m.due_date && dayN(m.due_date) >= start && dayN(m.due_date) < end).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const rowLast: number[] = [-Infinity, -Infinity, -Infinity];
  const diamonds: Diamond[] = inWin.map((m) => {
    const n = dayN(m.due_date);
    let row = rowLast.findIndex((last) => n - last > 3) as 0 | 1 | 2 | -1;
    if (row === -1) row = 0;
    rowLast[row] = n;
    return { id: m.id, name: m.name, kind: m.kind, x: pct(n + 0.5), label_row: row, done: m.done, due_date: m.due_date };
  });
  const perDay = new Map<string, number>(); inWin.forEach((m) => perDay.set(m.due_date, (perDay.get(m.due_date) ?? 0) + 1));
  const clustered = [...perDay.values()].some((c) => c >= 4);
  return { columns, bars, diamonds, clustered, windowStart: dayS(start), windowEnd: dayS(end - 1), todayPct: pct(t + 0.5), unscheduled };
}
