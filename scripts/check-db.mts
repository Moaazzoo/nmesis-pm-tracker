// Verifies the tracker schema exists and prints row counts. Run: npx tsx scripts/check-db.mts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const TABLES = ["profiles","tk_people","tk_statuses","tk_task_types","tk_projects","tk_nodes","tk_tasks",
  "tk_assignments","tk_versions","tk_notes","tk_milestones","tk_status_log","tk_activity"];

let missing = 0;
for (const t of TABLES) {
  const { count, error } = await db.from(t).select("*", { count: "exact" }).limit(0);
  if (error) { console.log(`${t.padEnd(16)} MISSING  (${error.message})`); missing++; }
  else console.log(`${t.padEnd(16)} ${String(count).padStart(6)} rows`);
}
if (missing) { console.error(`${missing} table(s) missing — run supabase/migrations/0001_tracker.sql`); process.exit(1); }
