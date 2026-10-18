import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverClient } from "./supabase/server";
import { adminClient } from "./supabase/admin";
import { applyLens, resolveAccess } from "./auth-rules";
import type { Person, Role } from "./types";

export type CurrentPerson = Person & { username: string; lens: Role | null; own_role: Role; own_is_admin: boolean; lens_person_id: string | null };

/** The logged-in person, or null when there is no session. Throws `NO_ACCESS` (caught by requirePerson) when the login has no active profile. */
export const getCurrentPerson = cache(async (): Promise<CurrentPerson | null> => {
  const supabase = await serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = adminClient();
  const [{ data: profile }, { data: person }, store] = await Promise.all([
    db.from("profiles").select("id, username, full_name, active").eq("id", user.id).maybeSingle(),
    db.from("tk_people").select("id, full_name, role, discipline, is_admin, profile_id, active").eq("profile_id", user.id).maybeSingle(),
    cookies(),
  ]);
  const access = resolveAccess(profile, person);
  if (access === "no-access" || !profile) throw new Error("NO_ACCESS");
  const base: Person = access === "ok" && person
    ? { id: person.id, full_name: person.full_name, role: person.role, discipline: person.discipline, is_admin: person.is_admin, profile_id: person.profile_id }
    : { id: `viewer:${profile.id}`, full_name: person?.full_name ?? profile.full_name, role: "viewer", discipline: null, is_admin: false, profile_id: profile.id };
  const lens = store.get("tk_lens")?.value;
  const seen = applyLens(base, lens);
  const lens_person_id = seen.role === "artist" && seen.role !== base.role ? store.get("tk_lens_person")?.value ?? null : null;
  return { ...seen, own_role: base.role, own_is_admin: base.is_admin, lens: seen.role !== base.role ? seen.role : null, username: profile.username, lens_person_id };
});

export async function requirePerson(): Promise<CurrentPerson> {
  let p: CurrentPerson | null;
  try { p = await getCurrentPerson(); } catch (e) { if (e instanceof Error && e.message === "NO_ACCESS") redirect("/no-access"); throw e; }
  if (!p) redirect("/login");
  return p;
}

export function isViewerId(id: string): boolean { return id.startsWith("viewer:"); }
