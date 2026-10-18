"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { safeRedirect, withoutReader } from "@/lib/queries/activity-shape";

/** Marks one item (or all) read for the current person, then goes to the task if there is one. */
export async function markRead(form: FormData) {
  const me = await getCurrentPerson(); if (!me) redirect("/login");
  const id = String(form.get("id") ?? ""); const to = String(form.get("to") ?? "");
  const db = adminClient();
  const q = id ? db.from("tk_activity").select("id, unread_by").eq("id", id) : db.from("tk_activity").select("id, unread_by").contains("unread_by", [me.id]);
  const { data } = await q;
  for (const r of data ?? []) await db.from("tk_activity").update({ unread_by: withoutReader(r.unread_by ?? [], me.id) }).eq("id", r.id);
  revalidatePath("/", "layout");
  redirect(safeRedirect(to));
}
