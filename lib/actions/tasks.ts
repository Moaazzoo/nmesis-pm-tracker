"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentPerson } from "@/lib/auth";
import { NOTE_CATEGORIES } from "@/lib/notes";
import { supabaseRepo } from "./repo";
import { applyAssign, applyCritical, applyDue, applyStatus, type ActionResult } from "./tasks-core";
import type { StatusKey } from "@/lib/types";

const STATUS_KEYS = ["waiting", "ready", "in_progress", "pending_review", "comments", "completed", "on_hold", "cancelled"] as const;

async function actor() {
  const p = await getCurrentPerson();
  if (!p) return null;
  return p;
}
function fail(error: string): ActionResult<never> { return { ok: false, error }; }
function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return fn().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Something went wrong. Nothing was changed." }));
}

const StatusInput = z.object({ taskId: z.string().uuid(), to: z.enum(STATUS_KEYS), note: z.object({ category: z.enum(NOTE_CATEGORIES), body: z.string().max(4000) }).optional() });
export async function setStatus(raw: z.input<typeof StatusInput>): Promise<ActionResult<{ status_key: StatusKey }>> {
  const parsed = StatusInput.safeParse(raw);
  if (!parsed.success) return fail("Invalid request.");
  const p = await actor(); if (!p) return fail("Please sign in again.");
  return guard(async () => { const r = await applyStatus(supabaseRepo(), p, parsed.data); if (r.ok) revalidatePath("/", "layout"); return r; });
}

const AssignInput = z.object({ taskId: z.string().uuid(), personIds: z.array(z.string().uuid()).max(10) });
export async function assign(raw: z.input<typeof AssignInput>): Promise<ActionResult> {
  const parsed = AssignInput.safeParse(raw);
  if (!parsed.success) return fail("Invalid request.");
  const p = await actor(); if (!p) return fail("Please sign in again.");
  return guard(async () => { const r = await applyAssign(supabaseRepo(), p, parsed.data); if (r.ok) revalidatePath("/", "layout"); return r; });
}

const DueInput = z.object({ taskId: z.string().uuid(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() });
export async function setDue(raw: z.input<typeof DueInput>): Promise<ActionResult> {
  const parsed = DueInput.safeParse(raw);
  if (!parsed.success) return fail("Invalid date.");
  const p = await actor(); if (!p) return fail("Please sign in again.");
  return guard(async () => { const r = await applyDue(supabaseRepo(), p, parsed.data); if (r.ok) revalidatePath("/", "layout"); return r; });
}

const CriticalInput = z.object({ taskId: z.string().uuid(), critical: z.boolean() });
export async function setCritical(raw: z.input<typeof CriticalInput>): Promise<ActionResult> {
  const parsed = CriticalInput.safeParse(raw);
  if (!parsed.success) return fail("Invalid request.");
  const p = await actor(); if (!p) return fail("Please sign in again.");
  return guard(async () => { const r = await applyCritical(supabaseRepo(), p, parsed.data); if (r.ok) revalidatePath("/", "layout"); return r; });
}
