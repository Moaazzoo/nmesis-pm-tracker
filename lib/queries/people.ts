import "server-only";
import { adminClient } from "@/lib/supabase/admin";

/** Everyone who can be assigned work: active artists, supervisors and production. */
export async function listArtists(): Promise<{ id: string; full_name: string }[]> {
  const { data } = await adminClient().from("tk_people").select("id, full_name").eq("active", true).eq("role", "artist").order("full_name");
  return data ?? [];
}

export async function listAssignablePeople(): Promise<{ id: string; full_name: string }[]> {
  const { data } = await adminClient().from("tk_people").select("id, full_name").eq("active", true).neq("role", "viewer").order("full_name");
  return data ?? [];
}
