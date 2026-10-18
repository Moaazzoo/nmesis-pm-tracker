import type { Person, Role } from "./types";

const ROLES: Role[] = ["production", "supervisor", "artist", "viewer"];

/** Where a role lands after login or a lens switch. */
export function landingFor(role: Role): string {
  switch (role) {
    case "artist": return "/me";
    case "supervisor": return "/review";
    default: return "/";
  }
}

/** A person seen through a lens: the lens role, with admin rights switched off so the screens behave as that role's would. */
export function applyLens(person: Person, lens: string | undefined): Person {
  const role = effectiveRole(person, lens);
  if (role === person.role) return person;
  return { ...person, role, is_admin: false };
}

/** Who may get in: profile must exist and be active; a person row may be missing (viewer) or inactive (viewer). */
export function resolveAccess(profile: { active: boolean } | null, person: { active: boolean; role: Role } | null): "no-access" | "viewer" | "ok" {
  if (!profile || !profile.active) return "no-access";
  if (!person || !person.active) return "viewer";
  return "ok";
}

/** Admins may view the app as another role through the `tk_lens` cookie; everyone else keeps their own role. */
export function effectiveRole(person: Person, lens: string | undefined): Role {
  if (person.is_admin && lens && (ROLES as string[]).includes(lens)) return lens as Role;
  return person.role;
}
