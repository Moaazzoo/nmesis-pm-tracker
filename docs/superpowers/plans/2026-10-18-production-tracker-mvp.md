# NMESIS Production Tracker MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone Next.js app, on its own Supabase project, where NMESIS production, supervisors and artists run the task lifecycle (Waiting → Ready to start → In Progress → Pending Review → Comments → Completed) with notes, versions, milestones and history, seeded from the four active ftrack projects.

**Architecture:** Next.js 16 App Router with server components for reads and server actions for every mutation; one Postgres (Supabase) schema of `tk_` tables read through RLS and written only by server actions that check a single permission matrix; a Python importer turns ftrack into JSON seed files that a TypeScript seeder upserts idempotently.

**Tech Stack:** Next.js 16.2 · React 19 · TypeScript 5 · Tailwind v4 · `@supabase/ssr` + `@supabase/supabase-js` · Zod · Vitest · Python 3 (stdlib only) for the importer.

**Spec:** `/Volumes/Extreme SSD/nmesis-tracker/docs/superpowers/specs/2026-10-18-production-tracker-design.md`

## Global Constraints

- Repo root `/Volumes/Extreme SSD/nmesis-tracker/` (git, branch `main`); Node via `source ~/.nvm/nvm.sh` (node 24.18, npm 11.16).
- Next.js 16 conventions differ from training data: before writing any route, middleware/proxy, font or config code, read the matching guide in `node_modules/next/dist/docs/` (the platform's `AGENTS.md` rule applies here too).
- Design tokens copied verbatim from `nmesis-platform/app/globals.css`: `--bg #060706`, `--bg2 #0b0d0a`, `--panel #101310`, `--panel2 #151813`, `--ink #f3f6f7`, `--muted #9aa5ad`, `--faint #616b73`, `--green #a9e34b`, `--red #ff5a5f`, `--radius 16px`; amber `#e6ad00` only for at-risk; no orange, no decorative blue, no glow.
- Fonts: Cera Pro Light (300) + Regular (400) and Arquitecta Office, copied from `nmesis-platform/app/fonts/*.woff2`; `font-synthesis: weight`; uppercase labels use Arquitecta with `letter-spacing .12em`.
- All page-local CSS classes are prefixed `tk-`.
- Every screen: full names (never codes), a legend wherever chips/markers appear, labelled empty states that say what would appear and who can add it.
- ftrack is read only; the importer uses headers `ftrack-user` + `ftrack-api-key` from `/Volumes/Extreme SSD/NMESIS-Production-Dashboard/sync/.ftrack-credentials`; nested projections are not used (flat fetch + local parent walk).
- Nothing is deployed; the Supabase migration is applied only to the new tracker project Kareem creates.
- No third-party UI/component libraries; each route's client JS ≤ 300 KB gzipped (`next build` output).
- Dates: due-date comparisons at day granularity in `Africa/Cairo`; the working week is Sun–Thu.
- Commit after every task with a conventional-commit message; attribution lines per the session's rules.

## Review Focus

1. Task with no due date — must never count as overdue or at-risk; row shows "No due date" in muted text (Task 2 `risk.test.ts`, Task 8).
2. A ftrack status, type or note label missing from the mapping tables — importer must list every unmapped value and exit non-zero; never silently map to Waiting (Task 4 `test_import_mapping.py`).
3. Odd task names (`"Matte Painting - 1P"`, `"Lighting - 1P"`, `"Rigging "`, no pass suffix) — pass parsing must not crash or mis-chain; names are trimmed (Task 2 `passes.test.ts`, Task 4).
4. Mutation fails (network/RLS) after an optimistic update — the row reverts and shows an inline red error chip with the server message; no silent success (Task 9 `status-control.test.tsx`).
5. A reopened task (Completed → Comments by production) — must appear in the artist's queue under "Comments to address" and in history with the reason note (Task 9 `transitions.test.ts`, Task 11).

---

## File structure

```
nmesis-tracker/
  package.json · next.config.ts · tsconfig.json · postcss.config.mjs · eslint.config.mjs · vitest.config.ts
  .env.local (gitignored) · .env.example
  app/layout.tsx · app/globals.css · app/fonts.ts · app/fonts/*.woff2
  app/login/page.tsx · app/login/actions.ts
  app/page.tsx                      Projects
  app/me/page.tsx                   My Queue
  app/review/page.tsx               Review queue
  app/people/page.tsx               People & roles (admin)
  app/p/[id]/page.tsx               Project board
  app/p/[id]/timeline/page.tsx
  app/p/[id]/board/page.tsx         Kanban
  app/p/[id]/setup/page.tsx
  app/error.tsx · app/not-found.tsx
  components/ui/topbar.tsx · panel.tsx · chip.tsx · avatar.tsx · legend.tsx · empty.tsx · drawer.tsx · bell.tsx · lens-switch.tsx
  components/project/group-tree.tsx · summary-strip.tsx · filters.tsx · unit-rows.tsx
  components/tasks/task-row.tsx · status-control.tsx · assignee-picker.tsx · due-picker.tsx
  components/tasks/task-drawer.tsx · notes-tab.tsx · versions-tab.tsx · history-tab.tsx
  components/queue/queue-list.tsx · components/review/review-item.tsx
  components/timeline/timeline.tsx · components/board/kanban.tsx · components/setup/*.tsx
  lib/supabase/server.ts · client.ts · admin.ts · proxy.ts
  lib/auth.ts · lib/types.ts
  lib/statuses.ts · lib/transitions.ts · lib/permissions.ts · lib/risk.ts · lib/passes.ts · lib/notes.ts
  lib/queries/projects.ts · project-board.ts · task.ts · queue.ts · review.ts · timeline.ts · people.ts · activity.ts
  lib/actions/tasks.ts · notes.ts · versions.ts · setup.ts · people.ts · activity.ts
  supabase/migrations/0001_tracker.sql · supabase/seed-roster.sql
  scripts/import_ftrack.py · scripts/test_import_mapping.py · scripts/seed.ts · scripts/check-db.ts
  data/seed/<project_code>.json (gitignored except a tiny fixture: data/seed/fixture.json)
  tests/*.test.ts(x)
```

---

### Task 1: Scaffold the app with the NMESIS kit

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `README.md`
- Create: `app/layout.tsx`, `app/globals.css`, `app/fonts.ts`, `app/fonts/{cera-pro-light,cera-pro-regular,arquitecta-office}.woff2` (copied from the platform), `app/page.tsx` (placeholder), `app/error.tsx`, `app/not-found.tsx`
- Create: `components/ui/topbar.tsx`, `panel.tsx`, `chip.tsx`, `legend.tsx`, `empty.tsx`, `avatar.tsx`
- Test: `tests/ui.test.tsx`

**Interfaces:**
- Produces: `TopBar({ crumb?: {label, href?}[] , right?: ReactNode })`; `Panel({ label?, children, accent? })`; `Chip({ tone: "green"|"amber"|"red"|"neutral"|"muted", label, tip? })`; `Legend({ items: {tone, label, meaning}[] })`; `Empty({ title, hint })`; `Avatar({ name, size? })` (initials from `full_name`).
- CSS token names and the `font-label` / `tnum` utility classes exactly as in the platform's `globals.css`.

- [ ] **Step 1:** `git init` in the repo root; `npx create-next-app@16.2.10 . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*"` (answer "no" to Turbopack-specific prompts only if asked); add `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `zod`, `@supabase/ssr`, `@supabase/supabase-js`.
- [ ] **Step 2:** Copy the three woff2 files and the `app/fonts.ts` pattern (next/font/local, variables `--font-cera`, `--font-arquitecta`) from `nmesis-platform`; port `globals.css` tokens + `@theme inline` block + `.font-label` + `.tnum`; drop the platform's grain/vignette layers (keep matte black only).
- [ ] **Step 3:** Write `tests/ui.test.tsx`: `Chip` renders label and `data-tip`; `Avatar` renders "ZY" for "Ziad Yasser"; `Empty` renders title and hint; `Legend` renders one row per item.
- [ ] **Step 4:** Run `npx vitest run tests/ui.test.tsx` → FAIL (components missing).
- [ ] **Step 5:** Implement the six primitives (Tailwind utilities on the tokens; chip tones: green = `text-green border-[rgba(169,227,75,.4)]`, amber = `text-[#e6ad00]`, red = `text-red`, neutral = `text-ink border-line-strong`, muted = `text-muted border-dashed`).
- [ ] **Step 6:** Run tests → PASS. `npm run build` → succeeds. `npm run dev` and screenshot `/` in the browser (black ground, Cera type, top bar with wordmark text "NMESIS Tracker").
- [ ] **Step 7:** Commit `feat: scaffold tracker app with NMESIS kit primitives`.

### Task 2: Domain rules (statuses, transitions, permissions, risk, passes, note categories)

**Files:**
- Create: `lib/types.ts`, `lib/statuses.ts`, `lib/transitions.ts`, `lib/permissions.ts`, `lib/risk.ts`, `lib/passes.ts`, `lib/notes.ts`
- Test: `tests/transitions.test.ts`, `tests/permissions.test.ts`, `tests/risk.test.ts`, `tests/passes.test.ts`

**Interfaces (produces):**
```ts
type State = "not_started"|"ready"|"active"|"review"|"changes"|"blocked"|"done"|"cancelled";
type Role = "production"|"supervisor"|"artist"|"viewer";
type Person = { id: string; full_name: string; role: Role; discipline: "CG"|"VFX"|null; is_admin: boolean; profile_id: string|null };
const STATUSES: { key: StatusKey; name: string; state: State; sort: number; tone: ChipTone }[]  // 8 rows, names exactly as the spec table
function legalNext(from: StatusKey, actor: Person, ctx: { isAssignee: boolean }): StatusKey[]
function canTransition(from, to, actor, ctx): { ok: true } | { ok: false; reason: string; needsNote?: boolean }
function can(actor: Person, action: Action, ctx?: { isAssignee?: boolean }): boolean   // Action = "edit_structure"|"assign"|"set_ready"|"hold"|"cancel"|"start"|"submit_version"|"approve"|"send_back"|"note:<category>"|"import"|"manage_people"|"lens"
function risk(task: { due_date: string|null; state: State; in_review_since?: string|null }, today: Date): "overdue"|"at_risk"|"none"
function parsePass(name: string): { base: string; pass_no: number|null }      // "Lighting-2P"→{base:"Lighting",pass_no:2}; "Matte Painting - 1P"→{base:"Matte Painting",pass_no:1}; "Rigging "→{base:"Rigging",pass_no:null}
function nextPass(tasks: {id;name;type_id;node_id}[], task): typeof task | null  // same node + type + pass_no+1
const NOTE_CATEGORIES = ["Task Definition","Artist Note","Supervisor Feedback","Client Feedback","Production Note"] as const
function noteCategoriesFor(actor: Person): NoteCategory[]
```

- [ ] **Step 1:** Write `tests/transitions.test.ts` from the spec's ladder + §6b.7: artist on own task In Progress → `legalNext` = [Pending Review]; artist not assignee → []; supervisor from Pending Review → [Completed, Comments] and `canTransition(…,"Comments")` returns `needsNote: true`; production from Completed → [Comments, In Progress] with `needsNote`; artist from Completed → []; production from Waiting → [Ready to start, On Hold, Cancelled]; viewer → [] everywhere.
- [ ] **Step 2:** Write `tests/permissions.test.ts`: production `can("assign")`; artist cannot `edit_structure`; supervisor cannot `assign`; artist `note:Artist Note` ok, `note:Client Feedback` not; admin `can("lens")`, others not; viewer can nothing.
- [ ] **Step 3:** Write `tests/risk.test.ts`: due null → "none"; due yesterday + active → "overdue"; due yesterday + done → "none"; due in 2 days + ready → "at_risk"; due in 2 days + active → "none"; review state with `in_review_since` 3 days ago → "at_risk"; today computed in Africa/Cairo at day granularity.
- [ ] **Step 4:** Write `tests/passes.test.ts` with the four `parsePass` examples above plus `nextPass` chaining two Lighting tasks under one node and ignoring a Comp task.
- [ ] **Step 5:** Run `npx vitest run` → all FAIL.
- [ ] **Step 6:** Implement the five modules; transitions as a static table `{ [from]: { [role]: StatusKey[] } }` plus the assignee rule for artists and `needsNote` for Comments and reopen moves.
- [ ] **Step 7:** Run `npx vitest run` → PASS. Commit `feat: domain rules for statuses, transitions, permissions, risk and passes`.

### Task 3: Database — new Supabase project, migration, roster

**Files:**
- Create: `supabase/migrations/0001_tracker.sql`, `supabase/seed-roster.sql`, `scripts/check-db.ts`, `lib/supabase/admin.ts`
- Human step (Kareem/admin, outside this repo): create a **new** Supabase project named `nmesis-tracker` in the NMESIS org; copy Project URL, anon key and service key into `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`); run the migration in SQL Editor; create four Auth users (`moaaz.hashem@nmesis.io`, `teodora.khalifa@nmesis.io`, `kareem@nmesis.io`, `hesham@nmesis.io`) with passwords; run `seed-roster.sql`.

**Interfaces (produces):** tables exactly as the spec §5.1 with these adjustments from §6b: `tk_people(id uuid pk, full_name, ftrack_username text unique null, profile_id uuid null references profiles(id), role text check in ('production','supervisor','artist','viewer'), discipline text null check in ('CG','VFX'), is_admin bool default false, active bool default true)`; every FK to a person references `tk_people`; `tk_tasks.pass_no int null`; `tk_notes.source_label text null`; `tk_versions.source text check in ('app','ftrack') default 'app'`; `tk_activity.unread_by uuid[] default '{}'`; `profiles(id references auth.users, username unique, full_name, active)`; helper `public.tk_is_active()` (SECURITY DEFINER). RLS: every `tk_` table `select` for `tk_is_active()`; **no insert/update/delete policies** (writes go through the service role in server actions). `lib/supabase/admin.ts` exports `adminClient()` (service key, server-only).

- [ ] **Step 1:** Write `0001_tracker.sql` (tables, indexes on `tk_tasks(project_id, node_id, status_id)`, `tk_assignments(person_id)`, `tk_notes(task_id)`, `tk_versions(task_id, number)`, `tk_activity(project_id, at desc)`; `tk_statuses` and `tk_task_types` inserted from `lib/statuses.ts` values; RLS as above).
- [ ] **Step 2:** Write `seed-roster.sql`: inserts `profiles` by looking up `auth.users` emails, then `tk_people` rows per the spec roster (Moaaz Hashem production+admin; Teodora production; Kareem supervisor/CG+admin; Hesham supervisor/VFX) linked by `profile_id`; the ten artists as `artist` with `ftrack_username` = their ftrack email, `profile_id` null; "Production Team" as `viewer`, `ftrack_username moaaz.hashem@nmesis.io`.
- [ ] **Step 3:** Hand the human step to Kareem; wait for "done".
- [ ] **Step 4:** Write `scripts/check-db.ts`: with the service key, selects `count(*)` from each `tk_` table and `profiles`, prints a table; exits non-zero if any table is missing. Run `npx tsx scripts/check-db.ts` → 14 tables, 15 people, 4 profiles.
- [ ] **Step 5:** Commit `feat: tracker schema, RLS and roster seed`.

### Task 4: ftrack importer (Python → JSON seed)

**Files:**
- Create: `scripts/import_ftrack.py`, `scripts/test_import_mapping.py`, `data/seed/fixture.json`, `data/seed/.gitignore`
- Reference: `research/payloads/meta.json` (status/type ids), `research/ftrack-feature-map.md` §5.1 mapping tables, `/Volumes/Extreme SSD/Cloude Code/client-timelines/ft.py` (header quirk + parent walk).

**Interfaces (produces):** CLI `python3 scripts/import_ftrack.py project <ftrack_project_id> [--out data/seed/<code>.json]` and `pull-versions <ftrack_project_id>`; JSON shape:
```json
{ "project": {ftrack_id, code, name, client, start_date, end_date},
  "nodes": [{ftrack_id, parent_ftrack_id, kind, unit_kind, name, sort, is_deliverable, content_type, delivered_date}],
  "tasks": [{ftrack_id, node_ftrack_id, name, pass_no, type, status_key, start_date, due_date, critical, description, assignees:[ftrack_username]}],
  "status_log": [{ftrack_id, task_ftrack_id, from_status_key, to_status_key, by_username, at}],
  "notes": [{ftrack_id, task_ftrack_id, version_ftrack_id, author_username, category, source_label, body, reply_to_ftrack_id, at}],
  "versions": [{ftrack_id, task_ftrack_id, number, submitted_by_username, submitted_at, link, status, note}],
  "milestones": [{ftrack_id, name, kind, due_date, done}],
  "unmapped": {"statuses":[], "types":[], "labels":[]} }
```
Pure functions in the module: `map_status(name)->status_key|None`, `map_version_status(name)`, `map_label(name)->(category, source_label)`, `map_type(name)->type|None`, `node_kind(object_type_name)->("group"|"unit", unit_kind)`, `milestone_kind(name)` ("Client Review:"/"CR:" → client_review; "Delivery:" → delivery; else internal), `parse_pass(name)` (same rules as `lib/passes.ts`).

- [ ] **Step 1:** Write `scripts/test_import_mapping.py` (unittest): the spec §5.1 status mapping (all 29 names from `meta.json` → a key; one made-up name → None); version mapping; label mapping for the ten live labels incl. `"Missing Assets "` (trailing space) → ("Production Note", "Missing Assets"); `node_kind("Asset Build")==("unit","asset")`, `("Folder")==("group",None)`; milestone kinds; `parse_pass` four cases.
- [ ] **Step 2:** Run `python3 -m unittest scripts/test_import_mapping.py` → FAIL (module missing).
- [ ] **Step 3:** Implement `import_ftrack.py`: credential loading as in `ft.py`; queries: `Project where id`, `TypedContext where project_id` (flat), `Task where project_id` with `assignments.resource.username`, `TypedContextStatusChange where parent.project_id` (or per-task batches of 200 ids if the server rejects it), `Note where project_id` with `author.username, category.name, in_reply_to_id, parent_id, parent_type`, `AssetVersion where project_id` with `task_id, version, user.username, date, status.name, comment, components.name, components.file_type`, `Milestone where project_id`; `CustomAttributeValue where configuration.key in ("is_deliverable","content_type","delivered_date")`; version `link` = first `.mov/.mp4` component name else first component name; `unmapped` collected; exit code 2 and a printed list when `unmapped` is non-empty unless `--allow-unmapped`.
- [ ] **Step 4:** Run tests → PASS. Run the importer for SOUEAST_Q3 (`7eab27bd-a645-41da-a66a-52ebb39264ff`) → prints counts (expect 217 tasks, ~60 nodes, 234 versions) and `unmapped` empty; then the other three active projects (`a8563e5f-c8be-493f-a826-45fb25d0fb32`, `2a7f877c-fe7a-4f80-8132-840efa1a655f`, `0e677797-6832-441a-a42d-c118c27f01e6`).
- [ ] **Step 5:** Write `data/seed/fixture.json` by hand: 1 project, 2 groups, 2 units, 4 tasks (Lighting-1P/2P, Comp-1P/2P), 2 people, 3 notes, 2 versions, 2 milestones, 2 status-log rows — used by UI tests.
- [ ] **Step 6:** Commit `feat: ftrack importer with explicit mapping tables and unmapped guard`.

### Task 5: Seeder (JSON → Supabase, idempotent)

**Files:**
- Create: `scripts/seed.ts`
- Test: `tests/seed-plan.test.ts`

**Interfaces:** `npx tsx scripts/seed.ts data/seed/<code>.json [--versions-only]`; exported `planUpserts(seed: SeedFile, existing: { peopleByUsername: Map<string,string> }): { people: Row[]; nodes: Row[]; tasks: Row[]; … }` (pure, testable) and `main()` that runs upserts in FK order with `onConflict: "ftrack_id"` via `adminClient()`; unknown `*_username` → creates a `tk_people` row with role `artist`, `profile_id` null (reported in the summary).

- [ ] **Step 1:** Write `tests/seed-plan.test.ts` against `fixture.json`: nodes ordered parents-first; task rows carry `status_id` resolved from `status_key`; assignees resolve to person ids; a username not in `existing` yields a new person row; `--versions-only` plan contains only `versions` rows.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Seed all four projects; `npx tsx scripts/check-db.ts` shows tasks ≈ 217 + the other three; re-run the seed → identical counts (idempotent).
- [ ] **Step 4:** Commit `feat: idempotent seeder from ftrack JSON`.

### Task 6: Auth, session and role landing

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/proxy.ts` (or `middleware`, per the Next 16 docs), `lib/auth.ts`, `app/login/page.tsx`, `app/login/actions.ts`, `components/ui/lens-switch.tsx`
- Modify: `components/ui/topbar.tsx` (user name, role chip, lens switch for admins, sign-out)
- Test: `tests/auth.test.ts`

**Interfaces (produces):** `getCurrentPerson(): Promise<Person & { lens: Role|null }>` (reads session → `profiles` → `tk_people`; no `tk_people` row → `role: "viewer"`; admins may set a `tk_lens` cookie to view as another role, and `Person.role` returns the lens while `is_admin` stays true); `requirePerson()` redirects to `/login`; `landingFor(role)`: production/viewer → `/`, artist → `/me`, supervisor → `/review`.

- [ ] **Step 1:** Write `tests/auth.test.ts` for `landingFor` and for `effectiveRole(person, lensCookie)` (admin + cookie "artist" → artist; non-admin + cookie → own role).
- [ ] **Step 2:** Run → FAIL. Implement login (username field → `<username>@nmesis.io`, password; `signInWithPassword`), session refresh in proxy, `getCurrentPerson`, lens switch (admins only; cookie `tk_lens`), sign-out.
- [ ] **Step 3:** Run tests → PASS. Browser: log in as Kareem → lands on `/review`; switch lens to artist → `/me`; log out → `/login`. Screenshot the login page.
- [ ] **Step 4:** Commit `feat: username login, roles and admin lens`.

### Task 7: Projects page

**Files:**
- Create: `lib/queries/projects.ts`, `app/page.tsx` (replace placeholder), `components/project/project-card.tsx`
- Test: `tests/projects-summary.test.ts`

**Interfaces:** `summarizeProject(tasks: {state; due_date; in_review_since}[], milestones, today): { total; done; progressPct; inReview; overdue; atRisk; nextMilestone: {name, kind, due_date}|null }` (progress = done ÷ (total − cancelled), rounded; at-risk/overdue via `risk()`); `listProjectsWithSummary(person)`.

- [ ] **Step 1:** Test `summarizeProject` with the fixture: progressPct, inReview, overdue counts, nextMilestone is the earliest not-done milestone on/after today.
- [ ] **Step 2:** Run → FAIL. Implement query + page: one card per active project (name, client, dates, progress ring with the kit's ring pattern, counters as chips, next milestone), legend row, empty state "No active projects — production can create one in Setup".
- [ ] **Step 3:** Run tests → PASS; browser screenshot of `/` with the four seeded projects.
- [ ] **Step 4:** Commit `feat: projects overview`.

### Task 8: Project board (read)

**Files:**
- Create: `lib/queries/project-board.ts`, `app/p/[id]/page.tsx`, `components/project/group-tree.tsx`, `summary-strip.tsx`, `filters.tsx`, `unit-rows.tsx`, `components/tasks/task-row.tsx`
- Test: `tests/board-shape.test.ts`

**Interfaces:** `loadBoard(projectId, filters: { states?: State[]; type?: string; person?: string; q?: string }): { project; groups: Group[]; units: UnitWithTasks[]; summary }` where `Group = { id, name, parent_id, progressPct, counts }`, `UnitWithTasks = { id, name, unit_kind, group_id, tasks: TaskRow[] }`, `TaskRow = { id, name, type_name, status, state, assignees: Person[], due_date, risk, critical, note_count, latest_version: number|null }`.

- [ ] **Step 1:** Test `shapeBoard(rows)` (pure): groups nest by parent, group progress counts descendants' tasks, filter by state keeps the unit header when any task matches, text filter matches task or unit name.
- [ ] **Step 2:** Run → FAIL. Implement query (one select per table, joined in memory) + page: left group tree with progress bars; main unit rows with indented task rows (status chip tone by state; due date red when overdue, amber at-risk, muted "No due date"; critical marker; note count; `v3` latest version), summary strip (count, done %, in review, overdue), filters, legend, empty states per filter.
- [ ] **Step 3:** Run tests → PASS; browser screenshot of SOUEAST_Q3 board; check client JS size for the route in `next build` output ≤ 300 KB gz.
- [ ] **Step 4:** Commit `feat: project board (read)`.

### Task 9: Task mutations and inline controls

**Files:**
- Create: `lib/actions/tasks.ts`, `lib/actions/activity.ts`, `components/tasks/status-control.tsx`, `assignee-picker.tsx`, `due-picker.tsx`
- Modify: `components/tasks/task-row.tsx` (wire controls), `lib/queries/people.ts`
- Test: `tests/actions-tasks.test.ts`, `tests/status-control.test.tsx`

**Interfaces (produces):** server actions (all `"use server"`, Zod-validated, use `adminClient()` after `can()`/`canTransition()`): `setStatus({ taskId, to, note?: { category, body } })`, `assign({ taskId, personIds })`, `setDue({ taskId, due_date })`, `setCritical({ taskId, critical })`; each writes `tk_activity` (+ `tk_status_log` for status) and returns `{ ok: true, task: TaskRow } | { ok: false, error: string }`. `logActivity({ projectId, taskId, actorId, action, payload, notify: personIds })` sets `unread_by`.

- [ ] **Step 1:** Write `tests/actions-tasks.test.ts` with the Supabase client mocked: `setStatus` refuses an illegal move with the `canTransition` reason; a Comments move without a note returns `error` "A feedback note is required"; a legal move inserts one `tk_status_log` row and one `tk_activity` row and notifies assignees (on Comments) or supervisors (on Pending Review).
- [ ] **Step 2:** Write `tests/status-control.test.tsx`: renders only `legalNext` options; on a rejected action the chip shows the previous status and an error chip with the message.
- [ ] **Step 3:** Run → FAIL. Implement actions and controls (status control = popover with legal next statuses + inline note field when `needsNote`; optimistic update via `useOptimistic`, revert on `{ok:false}`).
- [ ] **Step 4:** Run → PASS. Browser: as production, move a seeded task Waiting → Ready to start; as artist lens, start it and confirm Pending Review requires a version (Task 10) — for now the move is offered only via "Submit version", so status control hides it for artists.
- [ ] **Step 5:** Commit `feat: task status, assignee, due and critical mutations with optimistic UI`.

### Task 10: Task drawer — notes, versions, history

**Files:**
- Create: `components/ui/drawer.tsx`, `components/tasks/task-drawer.tsx`, `notes-tab.tsx`, `versions-tab.tsx`, `history-tab.tsx`, `lib/queries/task.ts`, `lib/actions/notes.ts`, `lib/actions/versions.ts`
- Modify: `components/tasks/task-row.tsx` (click opens drawer via `?task=<id>` search param)
- Test: `tests/actions-notes-versions.test.ts`

**Interfaces:** `loadTask(taskId): { task: TaskRow & { path: string[]; description }; notes: NoteThread[]; versions: Version[]; history: HistoryItem[] }`; actions `addNote({ taskId, versionId?, category, body, replyTo? })` (category must be in `noteCategoriesFor(actor)`), `submitVersion({ taskId, link, note? })` → inserts `tk_versions` with `number = max+1`, `source "app"`, status `submitted`; then `setStatus(Pending Review)` when the task is In Progress or Comments; notifies supervisors (discipline-matched first, all if none).

- [ ] **Step 1:** Tests: `addNote` rejects a category outside the actor's set; `submitVersion` numbers 1 then 2, moves In Progress → Pending Review, does not move a Waiting task (returns error "Start the task first"); history merges status log + activity sorted desc.
- [ ] **Step 2:** Run → FAIL. Implement drawer (header: path, name, type, status control, assignees, due, critical; tabs; composer with category select limited per role; versions list with "Submit version" form; history list "who · what · when").
- [ ] **Step 3:** Run → PASS. Browser: open a seeded task with notes; add an Artist Note as artist lens; submit a version; screenshot.
- [ ] **Step 4:** Commit `feat: task drawer with notes, versions and history`.

### Task 11: My Queue

**Files:**
- Create: `lib/queries/queue.ts`, `app/me/page.tsx`, `components/queue/queue-list.tsx`
- Test: `tests/queue.test.ts`

**Interfaces:** `loadQueue(personId): { groups: { key: "ready"|"active"|"changes"|"review"; title; tasks: (TaskRow & { project_name; latest_feedback: Note|null })[] }[] }` — titles exactly "Ready to start", "In progress", "Comments to address", "In review"; within a group sorted by due date (nulls last), then project name.

- [ ] **Step 1:** Test grouping/sorting with the fixture incl. a reopened task (Comments) landing in "Comments to address" and a null due date last.
- [ ] **Step 2:** Run → FAIL. Implement page: one section per group with count, rows with project name, path, due, latest feedback excerpt, buttons "Start" (→ In Progress) and "Submit version" (opens drawer on Versions tab); empty state "Nothing assigned to you yet — production assigns tasks from the project board".
- [ ] **Step 3:** Run → PASS; browser screenshot as artist lens (Ziad Yasser via lens → pick person in lens switch for admins).
- [ ] **Step 4:** Commit `feat: my queue`.

### Task 12: Review queue

**Files:**
- Create: `lib/queries/review.ts`, `app/review/page.tsx`, `components/review/review-item.tsx`, `lib/actions/review.ts`
- Test: `tests/review.test.ts`

**Interfaces:** `loadReview({ discipline?: "CG"|"VFX"|"all" }): ReviewItem[]` (tasks in state `review` across active projects; `ReviewItem = TaskRow & { project_name; version: Version|null; artist_note: Note|null; in_review_since }`, newest version first); actions `approve({ taskId, markNextPassReady: boolean })` → Completed (+ `nextPass` → Ready to start when flagged) and `sendBack({ taskId, body })` → Comments with a Supervisor Feedback note; discipline default = the supervisor's own, with an "All" toggle; task-type → discipline map in `lib/statuses.ts` (`CG`: Layout, Modeling, Shading, Lighting, Animation, Art Direction; `VFX`: Compositing, FX, Editing, Matchmove) — Claude's guess, marked in the UI legend as editable later.

- [ ] **Step 1:** Tests: `approve` with `markNextPassReady` moves Lighting-2P from Waiting to Ready to start and logs both; `sendBack` without body errors; discipline filter.
- [ ] **Step 2:** Run → FAIL. Implement page + actions; approve dialog shows "Also mark Lighting-2P Ready to start" checkbox (default on) when `nextPass` exists.
- [ ] **Step 3:** Run → PASS; browser screenshot as Kareem (CG filter) with seeded Pending Review tasks.
- [ ] **Step 4:** Commit `feat: review queue with approve / send back`.

### Task 13: Timeline

**Files:**
- Create: `lib/queries/timeline.ts`, `app/p/[id]/timeline/page.tsx`, `components/timeline/timeline.tsx`
- Test: `tests/timeline-layout.test.ts`

**Interfaces:** `layoutTimeline({ units, milestones, today, weeks = 8 }): { columns: Week[]; bars: { unit_id; name; startPct; widthPct; progressPct }[]; diamonds: { id; name; kind; x: pct; label_row: 0|1|2 }[]; clustered: boolean }` — bars from min task start to max task due per unit; diamonds staggered over three label rows when within 3 days of each other; `clustered = true` when any day has ≥ 4 milestones, in which case the page renders the day-grouped list instead of the lane.

- [ ] **Step 1:** Tests: bar percentages for a unit spanning weeks 1–2 of 8; two milestones one day apart get different `label_row`; five milestones on one day set `clustered`.
- [ ] **Step 2:** Run → FAIL. Implement (SVG lane, week header, today line, diamond shapes: client review = outline, delivery = filled, internal = small; legend).
- [ ] **Step 3:** Run → PASS; browser screenshot of SOUEAST_Q3 timeline.
- [ ] **Step 4:** Commit `feat: project timeline`.

### Task 14: Kanban board

**Files:**
- Create: `app/p/[id]/board/page.tsx`, `components/board/kanban.tsx`
- Test: `tests/kanban.test.tsx`

**Interfaces:** columns in order Not started · Ready · In progress · In review · Comments · Done (states `not_started, ready, active, review, changes, done`; blocked/cancelled shown in a collapsed "On hold / Cancelled" rail); drop target legality from `legalNext` of the actor; drop calls `setStatus` (and opens the note field when `needsNote`).

- [ ] **Step 1:** Test: column assignment from state; a drop onto an illegal column is rejected with the reason shown.
- [ ] **Step 2:** Run → FAIL. Implement with native HTML drag-and-drop (no library); cards reuse `task-row` content in compact form.
- [ ] **Step 3:** Run → PASS; screenshot.
- [ ] **Step 4:** Commit `feat: kanban board`.

### Task 15: Setup and People pages

**Files:**
- Create: `app/p/[id]/setup/page.tsx`, `components/setup/groups.tsx`, `units.tsx`, `milestones.tsx`, `tasks-from-template.tsx`, `lib/actions/setup.ts`, `app/people/page.tsx`, `lib/actions/people.ts`
- Test: `tests/actions-setup.test.ts`

**Interfaces:** actions `createProject`, `createGroup`, `createUnit`, `createTasks({ unitId, template: TemplateKey | { type; passes: number }[] })` (templates: `Basic_Shot` = Animation, Lighting, Compositing × 1P; `3D` = Layout, Lighting, Compositing; `Assets` = Modeling, Shading; each new task Waiting, unassigned), `upsertMilestone`, `archive({ kind, id })` (soft), `setPersonRole({ personId, role, discipline, is_admin })`, `linkPersonProfile({ personId, username })`.

- [ ] **Step 1:** Tests: `createTasks` from `Basic_Shot` creates three Waiting tasks with `pass_no 1`; `archive` sets the flag and the board query excludes archived; non-production actor is refused.
- [ ] **Step 2:** Run → FAIL. Implement both pages (plain forms; People lists roles, discipline, login linked/not, lens shortcut for admins).
- [ ] **Step 3:** Run → PASS; screenshots.
- [ ] **Step 4:** Commit `feat: project setup and people admin`.

### Task 16: Notifications, error states, final verification

**Files:**
- Create: `components/ui/bell.tsx`, `lib/queries/activity.ts`, `lib/actions/activity.ts` (`markRead`)
- Modify: `app/error.tsx`, `app/not-found.tsx`, `README.md` (run, import, seed instructions), `components/ui/topbar.tsx`
- Test: `tests/activity.test.ts`

- [ ] **Step 1:** Test: unread items for a person = activity rows whose `unread_by` contains them, newest first; `markRead` removes the id.
- [ ] **Step 2:** Run → FAIL. Implement bell (count + list of "who did what on which task", click → opens the task drawer and marks read), error page copy ("Something went wrong loading this page — Retry"), 404 copy.
- [ ] **Step 3:** Run full suite `npx vitest run` → PASS; `npm run build` → every route ≤ 300 KB gz client JS (paste the table into the README).
- [ ] **Step 4:** Browser walkthrough with screenshots saved to `docs/screenshots/`: login → projects → board → drawer → my queue (artist lens) → review (Kareem) → timeline → kanban → setup → people. Confirm no unexplained empty areas and every chip has a legend.
- [ ] **Step 5:** Commit `feat: notifications and error states; MVP complete`.
