import type { Person } from "./types";

export const NOTE_CATEGORIES = ["Task Definition", "Artist Note", "Supervisor Feedback", "Client Feedback", "Production Note"] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export function noteCategoriesFor(actor: Person): NoteCategory[] {
  if (actor.is_admin) return [...NOTE_CATEGORIES];
  switch (actor.role) {
    case "production": return [...NOTE_CATEGORIES];
    case "supervisor": return ["Supervisor Feedback"];
    case "artist": return ["Artist Note"];
    default: return [];
  }
}
