import type { Person } from "./types";
import { noteCategoriesFor, type NoteCategory } from "./notes";

export type Action =
  | "edit_structure" | "assign" | "set_ready" | "hold" | "cancel"
  | "start" | "submit_version" | "approve" | "send_back"
  | `note:${NoteCategory}` | "import" | "manage_people" | "lens";

type Ctx = { isAssignee?: boolean };

const ROLE_ACTIONS: Record<Person["role"], Action[]> = {
  production: ["edit_structure", "assign", "set_ready", "hold", "cancel", "start", "submit_version", "approve", "send_back", "import"],
  supervisor: ["approve", "send_back"],
  artist: ["start", "submit_version"],
  viewer: [],
};

/** Single permission matrix; server actions and UI both ask this. */
export function can(actor: Person, action: Action, ctx: Ctx = {}): boolean {
  if (action === "lens" || action === "manage_people") return actor.is_admin;
  if (action.startsWith("note:")) {
    return noteCategoriesFor(actor).includes(action.slice(5) as NoteCategory);
  }
  const role = actor.is_admin ? "production" : actor.role;
  if (!ROLE_ACTIONS[role].includes(action)) return false;
  if (role === "artist" && (action === "start" || action === "submit_version")) return ctx.isAssignee === true;
  return true;
}
