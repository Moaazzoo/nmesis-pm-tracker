"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentPerson } from "@/lib/auth";
import { NOTE_CATEGORIES } from "@/lib/notes";
import { supabaseRepo } from "./repo";
import { applyAddNote, applySubmitVersion } from "./drawer-core";
import type { ActionResult } from "./tasks-core";

function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return fn().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Something went wrong. Nothing was changed." }));
}

const NoteInput = z.object({ taskId: z.string().uuid(), category: z.enum(NOTE_CATEGORIES), body: z.string().max(8000), versionId: z.string().uuid().nullable().optional(), replyTo: z.string().uuid().nullable().optional() });
export async function addNote(raw: z.input<typeof NoteInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = NoteInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid note." };
  const p = await getCurrentPerson(); if (!p) return { ok: false, error: "Please sign in again." };
  return guard(async () => { const r = await applyAddNote(supabaseRepo(), p, parsed.data); if (r.ok) revalidatePath("/", "layout"); return r; });
}

const VersionInput = z.object({ taskId: z.string().uuid(), link: z.string().max(2000), note: z.string().max(4000).nullable().optional() });
export async function submitVersion(raw: z.input<typeof VersionInput>): Promise<ActionResult<{ id: string; number: number }>> {
  const parsed = VersionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid version." };
  const p = await getCurrentPerson(); if (!p) return { ok: false, error: "Please sign in again." };
  return guard(async () => { const r = await applySubmitVersion(supabaseRepo(), p, parsed.data); if (r.ok) revalidatePath("/", "layout"); return r; });
}
