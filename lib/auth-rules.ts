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

/** Admins may view the app as another role through the `tk_lens` cookie; everyone else keeps their own role. */
export function effectiveRole(person: Person, lens: string | undefined): Role {
  if (person.is_admin && lens && (ROLES as string[]).includes(lens)) return lens as Role;
  return person.role;
}
