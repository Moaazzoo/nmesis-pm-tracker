# NMESIS Production Tracker — design (MVP)

Date: 2026-10-18 · Owner: Kareem Abd Elazim (Head of CGI) · Status: draft for approval

## 1. Intent and why

NMESIS runs production on ftrack. Kareem's verdict after two years: it is buggy and unstable
to track production from, and it is not easy to work with whether you are a coordinator, a
producer or an artist. The Phase-1 study (`research/ftrack-feature-map.md`) confirmed why: ftrack
is two apps stitched together (a React overview + a 4 MB legacy Ext JS project app with 84-column
spreadsheets), 29 statuses of which 9 are used, 23 task types of which 8 are used, charts that
read zero because they key on bid-days we never enter, and a server that returned 502s during
the study. Underneath, the studio's real workflow is small: one tree of work, one status ladder
with history, assignments, notes with categories, versions with their own status, milestones.

The tracker rebuilds exactly that — **every feature we use, in one simple scheme, stable** —
on NMESIS's own stack and UI kit, and becomes the system the team works in. ftrack is kept only
as a data source to import from (and, for a while, as the place versions are published through
Connect) until it can be switched off.

## 2. Goals, non-goals, anti-goals

**Goals**

1. Run day-to-day production for the active projects (SOUEAST_Q3, Mansour-BYD-Q3&4, Lexus 2026,
   Soueast Lineup Campaign) from day one, seeded with the real ftrack data.
2. Each role has one obvious home: coordinator → project board; artist → their queue;
   supervisor → the review queue; HOD → projects overview + timeline.
3. The status lifecycle is enforced, visible and logged: Waiting → Ready to start → In Progress →
   Pending Review → Comments → In Progress → … → Completed (plus On Hold, Cancelled).
4. Stable: own database, no runtime dependency on ftrack, optimistic UI with rollback, small
   bundles, no page that can fail silently.
5. Every element self-explanatory: full names, legends, labelled empty states; no codes, no
   dimmed mystery areas (team-wide visibility principle).

**Non-goals (MVP)**

- Video review player, frame annotations, client review sessions, shareable review links.
- Time tracking, bids/estimates, split tasks, dependencies, resource/capacity planning.
- Lists, saved-view builder, dashboard builder, custom spreadsheet columns.
- Client-facing portal, Slack push, e-mail.
- Writing anything back to ftrack.

**Anti-goals (would make it a failure even if it works)**

- Double entry: if people must keep ftrack *and* the tracker up to date, it failed.
- A screen that needs training: if a coordinator or artist cannot use it on first open, it failed.
- Visual drift from NMESIS: orange, blue decoration, codes instead of names, unexplained empties.

## 3. Constraints

- **UI kit:** NMESIS UI Kit, *app tier* as in `nmesis-platform` (tokens in its `app/globals.css`:
  `--bg #060706`, `--green #A9E34B`, `--red #FF5A5F`, ink/muted/faint, `--radius 16px`; Cera Pro
  Light/Regular + Arquitecta Office for uppercase labels; bold synthesised). Red only for alerts
  (overdue, blocked); amber `#e6ad00` only for at-risk; no orange, no decorative blue. Matte
  black, no ambient glow. Page-local CSS classes prefixed `tk-` to avoid kit collisions.
- **Auth and roster:** username + password against the provisioned roster in the shared Supabase
  project (`profiles` table, `is_active()` / `can_edit()` / `can_manage_users()` helpers).
  Accounts are provisioned by an admin, never by the app or by Claude.
- **ftrack:** read-only, import only, using the known header quirk (`ftrack-user` +
  `ftrack-api-key`), flat `TypedContext` fetch with local parent walk, custom attributes via
  `CustomAttributeValue`.
- **Delivery:** runs locally (`npm run dev`) and is verified in the browser with screenshots;
  nothing is deployed and no Supabase migration is applied to the shared project without
  Kareem's explicit approval.
- **Repo:** `/Volumes/Extreme SSD/nmesis-tracker/` (sibling of `nmesis-platform`), git, main
  branch; research and this spec live inside it.

## 4. Decisions already made (how it gets made)

| Decision | Choice | Why |
|---|---|---|
| Replace or overlay ftrack | **Replace.** Own database is the source of truth; ftrack imported, never written. | Instability is the complaint; an overlay inherits it. |
| Standalone or platform section | **Separate app (Kareem, 2026-10-18).** `nmesis-tracker` is its own Next.js app. `nmesis-platform` is untouched and stays the mirror; the future client portal is generated from the platform, which will read the tracker's data instead of ftrack. | `nmesis-platform/PRODUCT.md` defines the platform as a mirror, not a workplace; the tracker is the workplace. |
| Stack | Next.js 16 (App Router, server actions), React 19, Tailwind v4, `@supabase/ssr`, TypeScript — identical to the platform. | Same team, same kit port, same deployment story later. |
| Database | **A new, separate Supabase project for the tracker (Kareem, 2026-10-18)** — nothing shared with the production platform's project, to avoid any confusion. Same auth pattern as the platform (username → `<username>@nmesis.io`, password set by an admin, `profiles` roster + SECURITY DEFINER helpers), re-created in the new project. Tables prefixed `tk_`; every imported row keeps its `ftrack_id`. For local development before the hosted project exists: Supabase CLI (local Postgres + auth) with the same migration and a seeded roster. | Clean separation from the platform; the platform later reads the tracker through a read-only key or a published view. |
| Seed data | Python `scripts/import_ftrack.py` → `data/seed/*.json` → `scripts/seed.ts` upserts. Re-runnable; versions can be re-pulled on demand. | Real studio data from day one; idempotent. |
| Status model | A `tk_statuses` table where **every status has a state** (`not_started · ready · active · review · changes · blocked · done · cancelled`). Progress, boards and queues derive from state only. | Fixes ftrack's hard-wired status lists. |
| Hierarchy | `tk_nodes` (project → group → unit) + `tk_tasks` (leaf). Node kinds: `group` (folder/sequence), `unit` (scene / shot / asset build). Milestones are their own table. | One scheme for every project; matches our real tree. |
| Roles | Three roles on `tk_people.role` — `production` (runs the boards: Head of Production, Line Producer), `supervisor` (reviews; tagged with a discipline: CG or VFX), `artist` — plus an `is_admin` flag (manage people, import, view as any role). Day-one roster (Kareem, 2026-10-18): Moaaz Hashem = production + admin (Head of Production); Teodora Khalifa = production (Line Producer); Kareem Abd Elazim = supervisor/CG + admin; Hesham = supervisor/VFX; artists and business users added later. Logged-in users without a role are read-only viewers. | Matches how the studio actually runs; "coordinator" and "HOD" in earlier drafts map to production and admin. |
| Notes | Five categories: Task Definition, Artist Note, Supervisor Feedback, Client Feedback, Production Note. Threaded replies. Attachments = links (paths/URLs), no file upload in MVP. | Covers the ten ftrack labels actually used. |
| Versions | A version is a record: number (auto per task), submitted by/at, link or path, optional thumbnail URL, status (`submitted · approved · client_approved · needs_changes`). | Playback stays in ftrack / plain links until a player is justified. |
| Task types | Eight: Layout, Modeling, Shading, Animation, FX, Lighting, Compositing, Editing (plus Storyboard, Matchmove, Art Direction kept as inactive options for imported data). | 99 % of real tasks. |
| Priorities | Dropped; a single boolean `critical` flag with a red marker. | 99 % "Normal" in ftrack. |

## 5. The product

### 5.1 Objects (the whole data model)

```
tk_projects      id, ftrack_id, code, name, client, start_date, end_date, status(active|archived), color
tk_nodes         id, project_id, parent_id, ftrack_id, kind(group|unit), unit_kind(scene|shot|asset|null),
                 name, sort, is_deliverable, content_type, delivered_date
tk_tasks         id, project_id, node_id, ftrack_id, name, type_id, status_id, start_date, due_date,
                 critical, description, created_at, updated_at
tk_task_types    id, name, sort, active
tk_statuses      id, name, state, sort, color_role(neutral|green|amber|red|muted)
tk_assignments   task_id, profile_id            (many artists per task allowed; usually one)
tk_notes         id, task_id, version_id?, author_id, category, body, reply_to_id, created_at
tk_versions      id, task_id, number, submitted_by, submitted_at, link, thumbnail_url, status, note
tk_milestones    id, project_id, name, kind(client_review|delivery|internal), due_date, done, ftrack_id
tk_status_log    id, task_id, from_status_id, to_status_id, by_profile_id, at
tk_activity      id, project_id, task_id?, actor_id, action, payload(json), at
tk_members       profile_id, role(coordinator|artist|supervisor|hod), active
```

Status ladder (name → state):

| Status | State | Who sets it |
|---|---|---|
| Waiting for another progress | not_started | coordinator (default on create) |
| Ready to start | ready | coordinator |
| In Progress | active | artist (or coordinator) |
| Pending Review | review | artist, when a version is submitted |
| Comments | changes | supervisor / coordinator, with a feedback note |
| Completed | done | supervisor / coordinator |
| On Hold | blocked | coordinator |
| Cancelled | cancelled | coordinator |

Allowed transitions are a table in code (`lib/transitions.ts`), checked on the server; the UI only
offers legal next statuses per role. Every change writes `tk_status_log` and `tk_activity`.

Import mapping from ftrack (29 statuses): Waiting/Awaiting 1st Pass/Awaiting another task →
Waiting; Ready to start/Ready to Resume → Ready to start; In Progress/Rendering/Awaiting Export →
In Progress; Pending Review/Pending *Sup* Feedback/Pending Client Feedback → Pending Review;
Comments → Comments; Completed/Client Approved/Final/Approved → Completed; On Hold → On Hold;
Cancelled → Cancelled. Version statuses: Approved/VFX Sup Approved/CG Sup Approved/Dept Approved →
approved; Client Approved → client_approved; WIP/Seen/In Progress/Pending Review → submitted;
Not Ready/Reference → submitted.

### 5.2 Screens (seven, all under one top bar)

1. **Projects** (`/`) — one card per active project: name, client, dates, progress ring
   (done / total tasks by state), counts of *in review* and *overdue*, next milestone. HOD/
   coordinator landing page.
2. **Project board** (`/p/[id]`) — the coordinator's workplace. Left: group tree with a
   progress bar per group. Main: rows = units and their tasks (indented one level, not eight):
   task name (full discipline name + pass), status chip, assignee (name + initials avatar),
   due date (red when overdue), critical marker, note count, latest version number. Inline
   editing of status, assignee, due date. Toolbar: filter by status state / type / assignee /
   text; "Add unit", "Add task(s) from template"; summary strip (count, done %, in review,
   overdue). A legend row explains chips and markers.
3. **Task drawer** (opens over any screen from a task) — header (path, name, type, status
   control with only the legal next steps, assignee, due, critical), tabs **Notes** (composer
   with category, thread, replies), **Versions** (list + "Submit version" form: link/path,
   note → sets Pending Review), **History** (status log + activity, who/when).
4. **My Queue** (`/me`) — artist home: tasks assigned to me grouped by state (Ready to start /
   In progress / Comments to address / In review), each row with due date and the latest
   feedback note; one-click "Start" and "Submit version". Supervisors and HOD see their own
   assignments here too.
5. **Review queue** (`/review`) — supervisor home: every task in *review* state across active
   projects, newest version first, with the version link, the artist's note, and two actions:
   Approve (→ Completed, or → next pass if configured) / Send back with comments (→ Comments,
   requires a Supervisor Feedback note).
6. **Timeline** (`/p/[id]/timeline`) — weeks on the x-axis from today; milestones as diamonds
   (client review vs delivery distinguished by label and shape); units as bars spanning their
   tasks' dates; today line; clustered dates fall back to a day-grouped list.
7. **Board** (`/p/[id]/board`) — kanban by state (Not started · Ready · In progress · In
   review · Comments · Done) with drag to change status (same legality rules).

Plus: a **project setup** page (`/p/[id]/setup`: groups, units, milestones, members) and
`/import` (HOD/coordinator: "Import from ftrack" picks a project; "Pull versions").

### 5.3 Roles and permissions

| Capability | Coordinator | Artist | Supervisor | HOD |
|---|---|---|---|---|
| See all projects / boards / timeline | ✓ | own tasks only (+ read-only project board) | ✓ | ✓ |
| Create/edit projects, groups, units, tasks, milestones | ✓ | – | – | ✓ |
| Assign | ✓ | – | – | ✓ |
| Set Ready to start / On Hold / Cancelled | ✓ | – | – | ✓ |
| Start task (→ In Progress), submit version (→ Pending Review) | ✓ | own tasks | – | ✓ |
| Approve / send back (→ Completed / Comments) | ✓ | – | ✓ | ✓ |
| Notes | any category | Artist Note (+ reply) | Supervisor Feedback, reply | any |
| Import from ftrack | ✓ | – | – | ✓ |
| View as another role (lens) | – | – | – | ✓ |

Enforced in server actions and RLS (write policies check `tk_members.role`); the UI hides what
a role cannot do rather than greying it out.

### 5.4 Behaviour details that matter

- Overdue = due date before today and state not in (done, cancelled). Red date, red count.
- At-risk (amber) = due within 3 days and state in (not_started, ready) or in review for > 2
  days. The threshold lives in one config file.
- Progress % = tasks in state done ÷ tasks not cancelled.
- Submitting a version always moves the task to Pending Review and notifies the project's
  supervisors in-app (bell on the top bar, `tk_activity` with `unread_by`).
- "Send back" requires a note; the note's category is Supervisor Feedback (or Client Feedback
  when the coordinator relays a client).
- Deleting is soft (archived flag) everywhere except notes (never deleted).
- Empty states say what would appear and who can add it.

## 6. Stability and quality bar

- Server actions with Zod validation; every mutation returns the fresh row; optimistic UI
  reverts and shows an inline error chip on failure.
- Page error boundaries with a plain-language message and a retry.
- No client bundle over 300 KB gzipped on any route; no third-party UI libraries.
- Tests: transition rules, import mapping, permission matrix (unit); one smoke test per screen
  rendering the seed data.
- Verified in the built-in browser with screenshots before anything is shown as done.

## 6b. Calls made after the builder check (Claude's decisions, 2026-10-18)

1. **People vs logins.** All person references (`assignments`, note `author`, version
   `submitted_by`, status-log `by`) point at a `tk_people` table (`id, full_name,
   ftrack_username, profile_id nullable, active`). Imported artists exist as people from day one;
   when the admin provisions a login, `profile_id` is linked and nothing else changes. The shared
   ftrack login "Production Team" stays a person named *Production Team* (its notes are not
   re-attributed). `tk_members` becomes `tk_people.role`.
2. **Roles are global, not per project.** Every supervisor sees every project's review queue.
   A logged-in profile with no tracker role is a read-only *viewer* (sees everything, edits
   nothing). Default roster for seed (to be confirmed by Kareem): Kareem = hod, Hesham =
   supervisor, Teodora Khalifa and Moaaz Hashem = coordinator, Moaaz Yasser / Sam / Khattab =
   viewer, the ten ftrack artists = artist.
3. **Dual-running rules.** Import is one-shot per project and the tracker wins on every field
   afterwards; `pull_versions` is additive only (new ftrack versions are inserted with
   `status = submitted`, flagged `source = ftrack`, and do **not** trigger the Pending-Review
   rule or notifications). Imported version links are stored as the ftrack component path
   string; imported thumbnails are not stored (ftrack's are signed, expiring URLs).
4. **One import implementation.** Python only (`scripts/import_ftrack.py` with sub-commands
   `project <ftrack id>` and `pull-versions <project>`), run from the terminal by Claude/HOD.
   The `/import` page is removed from the MVP.
5. **Passes.** Task names ending `-1P`, `-2P`, `- 1P` … are parsed into `pass_no`; tasks of the
   same type under the same unit form a chain. Approving pass N does **not** auto-start N+1; the
   approve dialog offers a one-click "Mark Lighting-2P Ready to start" (default on) so the
   coordinator rule "Ready to start when prerequisites are met" stays a human decision.
6. **Import depth.** Tasks, assignments, current status, full status history → `tk_status_log`,
   all notes (threaded), all versions, milestones. ftrack's note labels collapse to the five
   categories: Task Definition → Task Definition; Artist Note → Artist Note; VFX Sup / CG Sup /
   Department Sup / Art Director Feedback → Supervisor Feedback; Client Feedback → Client
   Feedback; everything else (Production Note/Feedback, Round Note, Missing Assets, General,
   LGT/CMP/ANM/… notes) → Production Note, with the original label kept in `tk_notes.source_label`.
   `tk_notes`, `tk_versions`, `tk_status_log` carry `ftrack_id` so re-runs are idempotent.
7. **Overrides.** Coordinator and HOD may reopen: Completed → Comments or In Progress, and
   Cancelled → Waiting. Both require a reason note (Production Note) and are logged like any
   transition. Artists and supervisors cannot leave Completed/Cancelled.
8. **Database while building.** See open question 1 — the plan assumes the additive `tk_`
   migration is applied to the shared Supabase project at the start (prefixed tables, RLS
   gated by the existing helpers, nothing existing touched). If Kareem prefers not to, step 1
   becomes a local Supabase (CLI) with a copied `profiles` table and synthetic logins.

## 7. Left to the builder

Component structure and naming; exact Tailwind utilities; drawer/kanban implementation;
pagination/virtualisation (projects have ≤ 300 tasks, so start without); seed-script details;
notification read/unread mechanics; keyboard shortcuts; how the HOD lens is switched (header
control); fixture data for tests.

## 8. Open questions for Kareem

0. May the additive `tk_` migration be applied to the shared Supabase project now (so login and
   seed data are real from the first local run)? Nothing existing is altered; all new tables are
   prefixed and RLS-gated. Alternative: local Supabase with synthetic logins until approval.
1. ~~A or B~~ — answered: A, separate app with the shared login.
2. Artist accounts: the roster has only the seven managers. Artists (Ziad Yasser, Moustafa Tork,
   Mohamed Sherif, Mohamed AbdelAziz, Ahmed Magdy, Ahmed Ashour, Mohamed Kotb, Moamen Yehia,
   Ammar Yasser, Youssef Kamal) need logins — provisioned by you/Moaaz Hashem in Supabase when
   you are ready; until then the HOD lens shows their screens with seed data.
3. Supervisors = Hesham + you? (Drives who the Review queue notifies.)
4. Projects to import first: the four active ones, or SOUEAST_Q3 only for the pilot?
