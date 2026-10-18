import { STATUS_BY_KEY } from "@/lib/statuses";
import type { StatusKey } from "@/lib/types";

export type ActivityRow = { id: string; at: string; action: string; payload: Record<string, unknown>; unread_by: string[]; actor: string; task_name: string; project_name: string; task_id: string | null; project_id: string | null };

export function unreadFor(rows: ActivityRow[], personId: string): ActivityRow[] {
  return rows.filter((r) => r.unread_by.includes(personId)).sort((a, b) => b.at.localeCompare(a.at));
}

export function withoutReader(unread: string[], personId: string): string[] {
  return unread.filter((p) => p !== personId);
}

const name = (k: unknown) => (typeof k === "string" && STATUS_BY_KEY[k as StatusKey]?.name) || String(k ?? "");

/** "Who did what on which task", in plain words. */
export function describeActivity(r: ActivityRow): string {
  const p = r.payload;
  switch (r.action) {
    case "status": return `${r.actor} moved ${r.task_name} from ${name(p.from)} to ${name(p.to)}`;
    case "version": return `${r.actor} submitted version ${String(p.number ?? "")} of ${r.task_name}`.replace("  ", " ");
    case "note": return `${r.actor} added a ${String(p.category ?? "note")} on ${r.task_name}`;
    case "assign": return `${r.actor} assigned you to ${r.task_name}`;
    case "due": return p.due_date ? `${r.actor} set the due date of ${r.task_name} to ${String(p.due_date)}` : `${r.actor} cleared the due date of ${r.task_name}`;
    case "critical": return p.critical ? `${r.actor} marked ${r.task_name} critical` : `${r.actor} removed the critical mark on ${r.task_name}`;
    default: return `${r.actor} updated ${r.task_name}`;
  }
}
