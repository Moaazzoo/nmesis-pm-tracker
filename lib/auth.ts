import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverClient } from "./supabase/server";
import { adminClient } from "./supabase/admin";
import { effectiveRole } from "./auth-rules";
import type { Person, Role } from "./types";

export type CurrentPerson = Person & { username: string; lens: Role | null; own_role: Role };

/** The logged-in person, or null. Admins may be viewing through a lens (role swapped, is_admin kept). */
export async function getCurrentPerson(): Promise<CurrentPerson | null> {
  const supabase = await serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = adminClient();
  const { data: profile } = await db.from("profiles").select("id, username, full_name, active").eq("id", user.id).maybeSingle();
  if (!profile || !profile.active) return null;
  const { data: person } = await db.from("tk_people").select("id, full_name, role, discipline, is_admin, profile_id").eq("profile_id", user.id).maybeSingle();
  const base: Person = person
    ? { id: person.id, full_name: person.full_name, role: person.role, discipline: person.discipline, is_admin: person.is_admin, profile_id: person.profile_id }
    : { id: `viewer:${profile.id}`, full_name: profile.full_name, role: "viewer", discipline: null, is_admin: false, profile_id: profile.id };
  const lens = (await cookies()).get("tk_lens")?.value;
  const role = effectiveRole(base, lens);
  return { ...base, role, own_role: base.role, lens: role !== base.role ? role : null, username: profile.username };
}

export async function requirePerson(): Promise<CurrentPerson> {
  const p = await getCurrentPerson();
  if (!p) redirect("/login");
  return p;
}
