import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Timing probe: how long one database hop and one auth hop take from this server. No data is returned. */
export async function GET() {
  const db = adminClient();
  const t0 = performance.now();
  await db.from("tk_statuses").select("key").limit(1);
  const t1 = performance.now();
  await db.from("tk_statuses").select("key").limit(1);
  const t2 = performance.now();
  await db.auth.getUser("not-a-token").catch(() => null);
  const t3 = performance.now();
  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? "local",
    db_first_ms: Math.round(t1 - t0),
    db_warm_ms: Math.round(t2 - t1),
    auth_ms: Math.round(t3 - t2),
  });
}
