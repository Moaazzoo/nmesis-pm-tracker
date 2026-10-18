// Creates the manager logins through Supabase's admin API (the same path the dashboard uses, so the
// e-mail identity is always right), then writes profiles and links the roster. Re-runnable.
//   npx tsx scripts/create-users.mts --password 'YourPassword'
// Needs .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY) next to package.json.
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;
const pwIdx = process.argv.indexOf("--password");
const PASSWORD = pwIdx > -1 ? process.argv[pwIdx + 1] : process.env.TRACKER_PASSWORD;
if (!URL || !KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY in .env.local"); process.exit(1); }
if (!PASSWORD) { console.error("Give the password: npx tsx scripts/create-users.mts --password '…'"); process.exit(1); }

const MANAGERS = [
  { email: "moaaz.hashem@nmesis.io",    full_name: "Moaaz Hashem",      role: "production", discipline: null,  is_admin: true,  ftrack_username: null },
  { email: "teodora.khalifa@nmesis.io", full_name: "Teodora Khalifa",   role: "production", discipline: null,  is_admin: false, ftrack_username: null },
  { email: "kareem@nmesis.io",          full_name: "Kareem Abd Elazim", role: "supervisor", discipline: "CG",  is_admin: true,  ftrack_username: "Kareem@nmesis.io" },
  { email: "hesham@nmesis.io",          full_name: "Hesham Mahmoud",    role: "supervisor", discipline: "VFX", is_admin: false, ftrack_username: null },
];

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${URL}${path}`, { ...init, headers: { ...H, Prefer: "return=representation,resolution=merge-duplicates", ...(init.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
};

// 1. users
const existing = (await rest("/auth/v1/admin/users?per_page=100")).users as { id: string; email: string; identities?: unknown[] }[];
const userId = new Map<string, string>();
for (const m of MANAGERS) {
  const found = existing.find((u) => u.email === m.email);
  if (found && (found.identities?.length ?? 0) > 0) {
    // keep the user, just (re)set the password so everyone is on the same one
    await rest(`/auth/v1/admin/users/${found.id}`, { method: "PUT", body: JSON.stringify({ password: PASSWORD, email_confirm: true }) });
    userId.set(m.email, found.id); console.log(`kept    ${m.email} (password reset)`); continue;
  }
  if (found) { await rest(`/auth/v1/admin/users/${found.id}`, { method: "DELETE" }); console.log(`removed ${m.email} (had no identity)`); }
  const created = await rest("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: m.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: m.full_name } }) });
  userId.set(m.email, created.id); console.log(`created ${m.email}`);
}

// 2. profiles
await rest("/rest/v1/profiles?on_conflict=id", { method: "POST", body: JSON.stringify(MANAGERS.map((m) => ({ id: userId.get(m.email), username: m.email.split("@")[0], full_name: m.full_name, active: true }))) });

// 3. roster links (update an existing person by ftrack username or profile, else insert)
const people = (await rest("/rest/v1/tk_people?select=id,ftrack_username,profile_id")) as { id: string; ftrack_username: string | null; profile_id: string | null }[];
for (const m of MANAGERS) {
  const pid = userId.get(m.email)!;
  const row = { full_name: m.full_name, role: m.role, discipline: m.discipline, is_admin: m.is_admin, active: true, profile_id: pid, ftrack_username: m.ftrack_username };
  const hit = people.find((p) => p.profile_id === pid) ?? (m.ftrack_username ? people.find((p) => p.ftrack_username === m.ftrack_username) : undefined);
  if (hit) await rest(`/rest/v1/tk_people?id=eq.${hit.id}`, { method: "PATCH", body: JSON.stringify(row) });
  else await rest("/rest/v1/tk_people", { method: "POST", body: JSON.stringify(row) });
}

// 4. check
const check = (await rest("/rest/v1/tk_people?select=full_name,role,discipline,is_admin,profile:profiles(username)&profile_id=not.is.null&order=full_name")) as { full_name: string; role: string; discipline: string | null; is_admin: boolean; profile: { username: string } | null }[];
console.table(check.map((c) => ({ name: c.full_name, role: c.role, discipline: c.discipline, admin: c.is_admin, login: c.profile?.username })));
const users = (await rest("/auth/v1/admin/users?per_page=100")).users as { email: string; identities?: unknown[] }[];
console.log(users.filter((u) => MANAGERS.some((m) => m.email === u.email)).map((u) => `${u.email}: ${u.identities?.length ?? 0} identity`).join("\n"));
console.log("Done. Sign in with the username (part before @) and the password you gave.");
