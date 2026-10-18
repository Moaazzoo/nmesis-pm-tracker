import { legalNext, canTransition } from "./transitions";
import { can } from "./permissions";
import { noteCategoriesFor } from "./notes";
import type { Person, StatusKey } from "./types";
import type { EditRights } from "@/components/tasks/task-controls";

/** What this person may do to one task, computed on the server and handed to the row's controls. */
export function rightsFor(person: Person, task: { status_key: string; assignees: { id: string }[] }): EditRights {
  const isAssignee = task.assignees.some((a) => a.id === person.id);
  const statusOptions = legalNext(task.status_key as StatusKey, person, { isAssignee });
  const needsNote = statusOptions.filter((to) => { const c = canTransition(task.status_key as StatusKey, to, person, { isAssignee }); return c.ok && c.needsNote; });
  return { statusOptions, needsNote, noteCategories: noteCategoriesFor(person), canAssign: can(person, "assign"), canEditDates: can(person, "edit_structure") };
}
