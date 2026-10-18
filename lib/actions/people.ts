"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** Admins only. Sets role / discipline / admin flag, and links a login (profile) by username. */
export async function savePerson(form: FormData) {
  const me = await getCurrentPerson();
  if (!me?.is_admin) redirect("/people?error=admin");
  const id = clean(form.get("id")); const role = clean(form.get("role")); const discipline = clean(form.get("discipline")) || null;
  if (!id || !["production", "supervisor", "artist", "viewer"].includes(role)) redirect("/people?error=role");
  const db = adminClient();
  const patch: Record<string, unknown> = { role, discipline: role === "supervisor" ? discipline : null, is_admin: form.get("is_admin") === "on", active: form.get("active") === "on", full_name: clean(form.get("full_name")) || undefined };
  const username = clean(form.get("username")).toLowerCase();
  if (username) {
    const { data: prof } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
    if (!prof) redirect(`/people?error=${encodeURIComponent(`No login named "${username}" exists yet — create it in Supabase first.`)}`);
    patch.profile_id = prof.id;
  }
  const { error } = await db.from("tk_people").update(patch).eq("id", id);
  if (error) redirect(`/people?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout"); redirect("/people");
}

export async function addPerson(form: FormData) {
  const me = await getCurrentPerson();
  if (!me?.is_admin) redirect("/people?error=admin");
  const full_name = clean(form.get("full_name")); if (!full_name) redirect("/people?error=name");
  const { error } = await adminClient().from("tk_people").insert({ full_name, role: "artist" });
  if (error) redirect(`/people?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout"); redirect("/people");
}
