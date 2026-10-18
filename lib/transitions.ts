import type { Person, Role, StatusKey } from "./types";

type Ctx = { isAssignee: boolean };

/** Legal next statuses per current status and role. Artists additionally need to be the assignee. */
const TABLE: Record<StatusKey, Partial<Record<Role, StatusKey[]>>> = {
  waiting: { production: ["ready", "on_hold", "cancelled"] },
  ready: { production: ["in_progress", "on_hold", "cancelled"], artist: ["in_progress"] },
  in_progress: { production: ["pending_review", "on_hold", "cancelled"] },  // artists reach Pending Review by submitting a version
  pending_review: { production: ["completed", "comments"], supervisor: ["completed", "comments"] },
  comments: { production: ["in_progress", "on_hold", "cancelled"], artist: ["in_progress"] },
  completed: { production: ["comments", "in_progress"] },
  on_hold: { production: ["ready", "in_progress", "cancelled"] },
  cancelled: { production: ["waiting"] },
};

/** Moves that must carry a note: send-back with feedback, and any reopen of a closed task. */
const NEEDS_NOTE: { from: StatusKey; to: StatusKey }[] = [
  { from: "pending_review", to: "comments" },
  { from: "completed", to: "comments" },
  { from: "completed", to: "in_progress" },
  { from: "cancelled", to: "waiting" },
];

function roleFor(actor: Person): Role {
  // Admins act with production rights on top of their own role.
  return actor.is_admin ? "production" : actor.role;
}

export function legalNext(from: StatusKey, actor: Person, ctx: Ctx): StatusKey[] {
  const role = roleFor(actor);
  if (role === "viewer") return [];
  if (role === "artist" && !ctx.isAssignee) return [];
  return TABLE[from][role] ?? [];
}

export function canTransition(
  from: StatusKey,
  to: StatusKey,
  actor: Person,
  ctx: Ctx
): { ok: true; needsNote?: boolean } | { ok: false; reason: string } {
  const allowed = legalNext(from, actor, ctx);
  if (!allowed.includes(to)) {
    const role = roleFor(actor);
    const reason =
      role === "artist" && !ctx.isAssignee
        ? "Only the assigned artist can move this task."
        : `A ${role} cannot move a task from ${from.replace("_", " ")} to ${to.replace("_", " ")}.`;
    return { ok: false, reason };
  }
  const needsNote = NEEDS_NOTE.some((n) => n.from === from && n.to === to);
  return needsNote ? { ok: true, needsNote: true } : { ok: true };
}
