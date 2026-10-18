import type { ChipTone, Discipline, State, StatusKey } from "./types";

/** The whole status ladder. Every status carries a state; progress, boards and queues derive from state only. */
export const STATUSES: { key: StatusKey; name: string; state: State; sort: number; tone: ChipTone }[] = [
  { key: "waiting", name: "Waiting for another progress", state: "not_started", sort: 1, tone: "muted" },
  { key: "ready", name: "Ready to start", state: "ready", sort: 2, tone: "neutral" },
  { key: "in_progress", name: "In Progress", state: "active", sort: 3, tone: "neutral" },
  { key: "pending_review", name: "Pending Review", state: "review", sort: 4, tone: "amber" },
  { key: "comments", name: "Comments", state: "changes", sort: 5, tone: "red" },
  { key: "completed", name: "Completed", state: "done", sort: 6, tone: "green" },
  { key: "on_hold", name: "On Hold", state: "blocked", sort: 7, tone: "muted" },
  { key: "cancelled", name: "Cancelled", state: "cancelled", sort: 8, tone: "muted" },
];

export const STATUS_BY_KEY: Record<StatusKey, (typeof STATUSES)[number]> = Object.fromEntries(
  STATUSES.map((s) => [s.key, s])
) as Record<StatusKey, (typeof STATUSES)[number]>;

export function stateOf(key: StatusKey): State {
  return STATUS_BY_KEY[key].state;
}

/** Task types in use (99 % of real tasks); the rest stay importable but inactive. */
export const TASK_TYPES: { name: string; sort: number; active: boolean; discipline: Discipline }[] = [
  { name: "Layout", sort: 1, active: true, discipline: "CG" },
  { name: "Modeling", sort: 2, active: true, discipline: "CG" },
  { name: "Shading", sort: 3, active: true, discipline: "CG" },
  { name: "Animation", sort: 4, active: true, discipline: "CG" },
  { name: "FX", sort: 5, active: true, discipline: "VFX" },
  { name: "Lighting", sort: 6, active: true, discipline: "CG" },
  { name: "Compositing", sort: 7, active: true, discipline: "VFX" },
  { name: "Editing", sort: 8, active: true, discipline: "VFX" },
  { name: "Storyboard", sort: 9, active: false, discipline: "CG" },
  { name: "Matchmove", sort: 10, active: false, discipline: "VFX" },
  { name: "Art Direction", sort: 11, active: false, discipline: "CG" },
];

export function disciplineOfType(typeName: string): Discipline | null {
  return TASK_TYPES.find((t) => t.name === typeName)?.discipline ?? null;
}
