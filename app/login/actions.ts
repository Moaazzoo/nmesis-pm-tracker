"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { serverClient } from "@/lib/supabase/server";
import { landingFor, effectiveRole } from "@/lib/auth-rules";
import { getCurrentPerson } from "@/lib/auth";
import type { Role } from "@/lib/types";

export async function signIn(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) redirect("/login?error=missing");
  const email = username.includes("@") ? username : `${username}@nmesis.io`;
  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=invalid");
  const person = await getCurrentPerson();
  redirect(landingFor(person?.role ?? "viewer"));
}

export async function signOut() {
  const supabase = await serverClient();
  await supabase.auth.signOut();
  (await cookies()).delete("tk_lens");
  redirect("/login");
}

/** Admins only: view the app as another role. Empty value clears the lens. */
export async function setLens(formData: FormData) {
  const person = await getCurrentPerson();
  if (!person?.is_admin) redirect("/");
  const value = String(formData.get("lens") ?? "");
  const store = await cookies();
  if (!value) store.delete("tk_lens");
  else store.set("tk_lens", value, { path: "/", sameSite: "lax", httpOnly: true });
  const role = effectiveRole({ ...person, role: person.own_role }, value || undefined) as Role;
  redirect(landingFor(role));
}
