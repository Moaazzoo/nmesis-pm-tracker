"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentPerson } from "@/lib/auth";
import { supabaseRepo } from "./repo";
import { applyApprove, applySendBack } from "./review-core";
import type { ActionResult } from "./tasks-core";

function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return fn().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Something went wrong. Nothing was changed." }));
}
const ApproveInput = z.object({ taskId: z.string().uuid(), markNextPassReady: z.boolean() });
export async function approve(raw: z.input<typeof ApproveInput>): Promise<ActionResult<{ nextPassId: string | null }>> {
  const parsed = ApproveInput.safeParse(raw); if (!parsed.success) return { ok: false, error: "Invalid request." };
  const p = await getCurrentPerson(); if (!p) return { ok: false, error: "Please sign in again." };
  return guard(async () => { const r = await applyApprove(supabaseRepo(), p, parsed.data); if (r.ok) revalidatePath("/", "layout"); return r; });
}
const SendBackInput = z.object({ taskId: z.string().uuid(), body: z.string().max(8000) });
export async function sendBack(raw: z.input<typeof SendBackInput>): Promise<ActionResult> {
  const parsed = SendBackInput.safeParse(raw); if (!parsed.success) return { ok: false, error: "Invalid request." };
  const p = await getCurrentPerson(); if (!p) return { ok: false, error: "Please sign in again." };
  return guard(async () => { const r = await applySendBack(supabaseRepo(), p, parsed.data); if (r.ok) revalidatePath("/", "layout"); return r; });
}
