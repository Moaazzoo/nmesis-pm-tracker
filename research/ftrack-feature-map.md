# ftrack feature map — NMESIS instance

Study of how ftrack works on `https://nmesismotionlab.ftrackapp.com` (ftrack Studio server
24.6.19, web client "ftrack-spark" 16.8.2 + legacy app), done 2026-10-18 as Phase 1 of the
NMESIS production-tracker project. Behaviour and data model only; no ftrack code, CSS, icons or
copy were taken, and nothing in ftrack was created, edited or deleted.

Evidence lives next to this file:

- `research/screenshots/*.png` — one per view, captured by REA during the walkthrough.
- `research/payloads/*.json` — decoded request/response bodies and API dumps (ids are real).
- REA evidence IDs are quoted per section (session bundles stayed in the scratch dir; they are
  25–40 MB each and reproducible).

How the evidence was gathered: a dedicated Chrome profile with a DevTools port, REA
`inspect_web_page` for passive page structure, REA `capture_browser_scenario` (connect mode) for
declared read-only navigation with network bodies recorded, plus the ftrack REST API
(`/api`, header pair `ftrack-user` + `ftrack-api-key`) for schema (`query_schemas`, 136 entity
types) and studio-wide counts.

---

## 1. Architecture in one page

**Two front-ends share one session.**

| Front-end | Where you see it | How it talks to the server |
|---|---|---|
| **New React app ("spark overview")** | Overview (`#itemId=overview`), My Tasks (`#itemId=home`) — rendered in an iframe `ftrack-spark-overview/v16.8.2-studio.9/app/overview/index.html?theme=dark` | Batched JSON to `POST /api` — the same public API we already use from Python (`query`, `query_schemas`, `query_server_information`, `_authorize_operation`). Live updates over `socket.io`. |
| **Legacy Ext JS app (`ftrack.js`, 3.9 MB)** | Everything inside a project: Tasks spreadsheet, Versions, Team planner, Dashboards, Task board, slide-in panels | Form-encoded POSTs to private endpoints: `/track/getEntityTree`, `/track/getGanttColumns`, `/track/getGanttTasks`, `/track/getLazyGanttData`, `/track/getColumns`, `/track/getData`, `/read/headerStats`, `/main/verifyModuleConfig`, `/main/getProjectid`, `/settings/saveSetting`; and Ext.Direct RPC to `/direct/api` (`Permission.isPermitted`, `TaskTemplate.getTemplates`, `TeamCalendar.getCalendar`, `Kanban.*`, `Note.get`) and `/direct/widget` (`InsightsWidget`, `TasksStatusWidget`, `MileStoneWidget`, `AssetsWidget`, `TaskBoardWidget`, `ComponentsWidget`). |

Routing is entirely in the URL hash. Observed patterns:

- `#itemId=overview` / `#itemId=home` (My Tasks) / `#itemId=reports`
- Project page: `#itemId=projects&entityId=<project id>&entityType=show&view=<view>`
  with `view=tasks` (spreadsheet), `versions_v1`, `teamplanner_v1` (calendar),
  `people_view_v1` (team board), `taskboard`, or a dashboard id.
- Slide-in detail panel: add `slideEntityId=<id>&slideEntityType=task|assetversion`.
- The last-used project view is persisted server-side (`settings/saveSetting`
  `projects_view`), as is the recent-projects list.

Per-project permissions are fetched once per page (`getGanttColumns.permissions`:
create/update/delete/move/linkObject; `verifyModuleConfig.permissions`: READ_BID) and per entity
in slide-ins (`__permissions.status_id`, `__permissions.end_date` on the `/api` query).

Evidence: `ev_667dd9ca…` (passive home page), `ev_5dcf86f6…` (scenario 1),
`ev_624f6b21…` (scenario 2), `ev_8adf97bc…` (3), `ev_bd2a8f2f…` (5), `ev_21636082…` (7).

---

## 2. Data model (what the UI is actually made of)

From `query_schemas` (136 types; core subset in `payloads/schema_core.json`) cross-checked with
what the views request.

### 2.1 Hierarchy = one tree of "contexts"

Everything under a project is a `TypedContext` row with an `object_type_id`; the "type" names are
just object types. Our instance (`payloads/meta.json`):

| Object type | leaf | schedulable | statusable | taskable | Count studio-wide |
|---|---|---|---|---|---|
| Folder | no | no | no | yes | 683 |
| Sequence | no | no | no | yes | 850 |
| Scene | no | no | yes | yes | 356 |
| Shot | no | no | yes | yes | 999 |
| Asset Build | no | no | yes | yes | 1,500 |
| Task | yes | yes | yes | — | 11,194 |
| Milestone | yes | yes | yes | — | 630 |
| Episode / Image / Information | defined in schemas, unused | | | | 0 |

Every row carries `parent_id`, `project_id`, `name`, `sort`, `status_id`, `type_id`,
`priority_id`, `start_date`, `end_date`, `bid`, `time_logged`, `description`, `thumbnail_id`,
custom attributes, `link` (the breadcrumb path as an array of `{id,name,type}`), plus relations:
`assignments` (→ `Appointment` rows, `type="assignment"`, `resource_id` = user),
`notes`, `assets`, `split_parts`, `incoming_links`/`outgoing_links` (dependencies),
`status_changes`, `timelogs`, `lists`, `scopes`, `metadata`.

Our real tree (SOUEAST_Q3, 217 tasks): Project → category folders (`Assets`, `Backplates`,
`Config`, `Infographics`, `KVs`, `Milestones`, `SPVs`) → Sequence (`INT Downtown`, `INT PNGs`,
`SPV04`…) → Scene (`S07`, `S09 Premium`…) / Shot (`Shot_01`…) / Asset Build (`Environment`) →
Tasks named by discipline + pass (`Lighting-1P`, `Lighting-2P`, `Comp-1P`, `Comp-2P`,
`Animation-2P`, `Modeling-1P`). Evidence: `payloads/body_track_getGanttTasks.json`,
`body_track_getEntityTree.json`.

### 2.2 Workflow: Status → State, scoped by schema

- `State` is fixed (4): Not Started, In Progress, Done, Blocked. It is what drives
  "done %", kanban columns and the My-Tasks counters.
- `Status` is configurable (29 defined on our server, `color`, `sort`, `is_active`,
  `state`). Which statuses a task may take comes from the project's `ProjectSchema` →
  `WorkflowSchema` (and `StatusRuleGroup`/`StatusRule` for role-based transition rules —
  none configured here beyond defaults).
- Our active projects all use project schema **VFX** (task workflow "VFX Task Workflow",
  version workflow "VFX Version Workflow"). The default task workflow ("Workflow Name") is
  literally our lifecycle: *Waiting for another progress → Ready to start → In Progress →
  Pending Review → Comments → Completed (+ Client Approved)*.
- Statuses in actual use (all 11,194 tasks): Completed 8,097 · Cancelled 1,293 · Waiting
  for another progress 1,077 · Awaiting 1st Pass 320 · On Hold 198 · Ready to start 101 ·
  Pending Review 40 · Awaiting another task 25 · In Progress 21 · Pending Department Sup
  Feedback 9 · Comments 5 · Pending Client Feedback 4 · others ≤ 2. Twenty-nine defined, nine
  matter.
- Important quirk: most of our statuses have **no State mapped** (`state` null) — only
  Reference, Client Approved, Awaiting another task, Rendering carry one. So anything in
  ftrack that is state-driven (done %, kanban buckets, "show done and blocked") works off
  explicit status-id lists hard-wired into the views, not off states. Our tracker should map
  every status to a state explicitly.
- Version statuses (separate workflow): Approved 2,750 · Seen 2,421 · VFX Sup Approved 1,108 ·
  WIP 559 · CG Sup Approved 516 · Client Approved 210 · Not Ready For Review 85 ·
  Reference 66 · Dept Approved 38 · In Progress 37 · Pending Review 2.

### 2.3 Task types, priorities, templates

- `Type` (23 defined). Used: Lighting 4,040 · Compositing 3,531 · Modeling 1,338 · Shading 915 ·
  Animation 491 · Layout 243 · FX 213 · Editing 80 · Storyboard 77 · Matchmove 52 · the rest < 50.
- `Priority`: 99 % "Normal" (11,090 of 11,194). Effectively unused.
- `TaskTemplate` (what "Create → from template" offers): 3D, Assets, Basic_Shot
  (Animation + Compositing + Lighting), FX_Shot, Roto & Comp, Furniture…

### 2.4 Assignments = Appointment rows

`Appointment{ type:"assignment", context_id:<task>, resource_id:<user> }` (9,463 rows, all of
type assignment; 9,275 tasks have ≥ 1). The "Assignee" column, the team board, My Tasks and the
calendar all derive from this one table. `Scope` and `Group` exist (7 groups: Supervisors,
Production, Animation Team, Artists, Assets Team, FX Team, Lighting & Shading Team) but nothing
is assigned to groups.

### 2.5 Versions, assets, components

`AssetVersion{ asset_id, task_id, version:int, status_id, comment, date, user_id,
is_published, is_latest_version, thumbnail_id }` — 7,792 rows, 99 % linked to a task, all
published. `Asset{ name, type (AssetType: Animation, Lighting, Upload…), context_id }` groups
versions. `Component` rows (30,047: .jpg/.png stills, .mp4/.mov movies, a few .exr/.pdf/.xls)
hang off a version and resolve to a `Location` — our central storage is a Windows share
(`\\192.168.1.178\Store\Submissions\Ftrack`) plus ftrack's own cloud for the review encodes
(`ftrackreview-mp4`, `ftrackreview-mp4-1080`, `thumbnail`). Review playback uses the cloud
encode with `frameIn/frameOut/frameRate` metadata. Evidence: `body_track_getData_versions.json`,
`api_calls_panels_and_overview.json` (ComponentsWidget).

### 2.6 Notes

`Note{ content, author (user_id), date, parent_id + parent_type (TypedContext | AssetVersion |
ReviewSessionObject | Project), category_id (a NoteLabel), in_reply_to_id, is_todo,
completed_at/by, frame_number, recipients[], note_components[] (attachments),
note_label_links[], thread_activity }`. 16,476 notes: 12,954 on tasks/contexts, 3,398 on
versions, 1,047 are replies. Categories in use: Task Definition 5,958 · Artist Note 5,830 ·
VFX Sup Feedback 1,109 · Production Note 1,020 · CG Sup Feedback 676 · Client Feedback 669 ·
Department Sup Feedback 430 · Production Feedback 244 · Round Note 181 · Missing Assets 129.
The legacy `Note.get` RPC returns the same thing plus `unread`, `starred`, `labels[]`,
`attachments{files,images}`, `frame{number,time}` and the parent breadcrumb.
Evidence: `body_direct_Note_get.json`.

### 2.7 History: status changes and the event log

- `TypedContextStatusChange{ parent_id, date, from_status_id, status_id, user_id }` and
  `AssetVersionStatusChange` — a clean per-entity status history with who/when. Example
  (task `a4cf8e03…`): In Progress → Pending Review (artist, 14 Oct 18:16) → Comments
  (Production Team, 15 Oct 12:09).
- `Event` (the activity feed; integer ids, 300k+): `action` such as `change.status.task`,
  `db.all.task` (field edits, e.g. `enddate old/new`), `data` JSON diff, `user_id`,
  `created_at`, `project_id`. Readable via API; this is the raw material for
  velocity/turnaround metrics.

### 2.8 Scheduling objects

- Task `start_date`/`end_date` (9,082 of 11,194 tasks dated), `bid` (0 everywhere),
  `time_logged`/`Timelog` (2 rows ever), `SplitTaskPart` (0).
- `Milestone` (630; naming "PROD:/Review:/CR:/Client Review:/Delivery:"), statuses: 487 "Milestone",
  119 Completed, 24 Final.
- `CalendarEvent` (2,108): leave/public holidays (`leave`, `everyone`) and project blocks
  (`estimate`, `effort`, `forecast`, resources). Working week comes from `Setting` group
  TIME: workday 28,800 s, workweek `[1,2,3,4,0]` (Sun–Thu), week starts Sunday.

### 2.9 Custom attributes

`CustomAttributeConfiguration` (32, per object type). Ours that matter: `is_deliverable`
(bool, on Scene and on Asset Build — two configs, same key), `content_type` (enumerator, two
configs), `delivered_date` (date, two configs), `milestone_type` (Milestone), `account`,
`po_reference`, `contracted_qty` (on Project), shot tech fields (fstart/fend/handles/FPS/
Resolution/Ratio/shot_duration), and an older "round" set (round_notes/round_active/
round_threshold/round_state/pass/pass_notes/sub_date/critical/version_today/slot/subscribed).
API quirk (known): read values through `CustomAttributeValue where configuration.key is …`;
the `custom_attributes[key]` projection errors on this server.

### 2.10 People and access

14 active users (12 humans + `__support_service__` + `__automation_service__`), the shared
"Production Team" login (`moaaz.hashem@`), security roles Administrator / Project Manager /
User / Artist (ASSIGNED scope) / Client / API / Webhook Service, 7 groups. `UserSecurityRoleProject`
scopes a role to projects; the Artist role only sees what is assigned.

### 2.11 Everything else in the schema

ReviewSession / ReviewSessionObject / Invitee / ObjectStatus / Annotation (client review),
List / ListCategory (ad-hoc lists), Dashboard / DashboardWidget / DashboardResource
(saved dashboards, 21 exist), UserView (saved spreadsheet views), Job (background jobs —
8,008, exports/encodes), Automation / Trigger / WebhookAction (0 configured), Feed,
Metadata, Timer, Disk/Location/Component storage, Scope, Information/Image object types.

---

## 3. Feature by feature

Each entry: what it does · how it works (page + calls + data) · evidence · how much we use it.

### 3.1 Overview → Projects (cards / list / timeline)

- **What:** the landing dashboard: every active project as a card (thumbnail, name, code,
  workflow schema, status, start/end) with a card/list/timeline toggle, filters, settings, a
  "+" create button, and a left rail of saved dashboards (Projects, Users, Tasks, Versions,
  Projects and Users, plus our custom ones: Active Projects, In-House Production, Project: BYD,
  Queue-Automotive, Queue-Boats, Queue-Motion Gems, Users View 1st Pass, Versions).
- **How:** React app; `/api` batch: `Dashboard where created_by… or is_shared_with_everyone or
  dashboard_resources any(...)`, `Setting`, `ObjectType`, `CustomAttributeConfiguration`,
  `Project where status is "active" order by full_name`, then for the timeline view one batch
  with `Project`, `CalendarEvent`, `Task` (with `assignments.resource.*`, `status`, `type`,
  `priority`, `parent.*`) and `Milestone` for the selected projects, plus leave days.
  Timeline rows = projects, lanes = tasks grouped by parent, milestones drawn as diamonds
  ("Client Review:…", "Delivery:…"), week grid, today marker.
- **Evidence:** screenshots 01, 11; `api_calls_panels_and_overview.json` (step 7).
- **Our usage:** heavy — this is what coordinators open first. The custom dashboards exist but
  are simple project filters.

### 3.2 Projects menu

- **What:** the top-nav dropdown: Recent / My projects / Active projects columns, a filter box,
  "View hidden projects", "Create new project".
- **How:** recent list is a user setting (`recent-projects`); "my projects" = projects where
  the user has a role/assignment (empty for the shared login); active = `Project.status is
  "active"`. 133 of 137 projects are hidden; hidden projects are still queryable.
- **Evidence:** screenshot 02. **Usage:** daily; the hidden list is the archive.

### 3.3 Project → Tasks spreadsheet (the core)

- **What:** a tree-grid of the whole project (project → folders → sequences → scenes/shots/
  asset builds → tasks) with columns Name, Type, Status (chip), Assignee, Start, Due, Bid days,
  Worked days, +/- days, notes indicator, thumbnail; a summary strip (Count, Done %, Min start,
  Max due, Sum bid/worked); inline editing of every cell; filters; group-by; saved views
  ("Default"); export/import; Create (task, from template, milestone…); undo/redo; the left
  rail with the folder tree and per-folder progress bars (green = done share), plus Team,
  Client reviews, Lists entries.
- **How:** legacy app. On open: `verifyModuleConfig` (resolves the entity and permissions),
  `track/getEntityTree` (left tree, each node with `progress:[{count,statusid}]`),
  `track/getGanttColumns` (84 column definitions incl. one "Notes (category)" column per note
  label and one column per custom attribute, each with its editor type — status field, type
  field, priority field, resource editor, date-time field, number field, markdown textarea,
  enumerator, checkbox — and `defaultStatusIds`/`defaultTypeIds` per object type,
  `taskTypes`, `filterOptions`, `validObjectTypeIds`), `track/getGanttTasks` (the nested
  rows with `typeid,statusid,userids,StartDate,EndDate,bid,worked,pm,split_parts,link,notes`,
  grouped by `link`, sorted by name), `track/getLazyGanttData` (thumbnails and dependencies
  for the visible rows, in batches), `read/headerStats` (summary strip; `summaryFn` Count /
  Done % / Min / Max / Sum). Per-folder progress = count of tasks by status under that node.
  Done % = tasks whose status is in the "done" id set ÷ count.
- **Write path (not executed):** inline editors post field changes; the public equivalent is
  `/api` `update` on the entity (`status_id`, `end_date`, …) and `create`/`delete` on
  `Appointment` for assignment. Status choices offered = statuses of the project schema's
  workflow; `__permissions` flags on the entity say whether the current user may change
  `status_id` / dates.
- **Evidence:** screenshots 03, 09; `body_track_*.json`, `body_read_headerStats.json`,
  `body_main_verifyModuleConfig.json`, `body_direct_api_TaskTemplate_getTemplates.json`.
- **Our usage:** the primary tool. Of the 84 columns we actually populate: name, type, status,
  assignee, start/due, notes. Bid/worked/+/- are all 0.0 (never used). Custom attribute
  columns `is_deliverable`, `content_type`, `delivered_date` are the ones we created for the
  dashboard convention.

### 3.4 Project → Versions

- **What:** a paged grid (50 per page, 234 in SOUEAST_Q3) of asset versions: thumbnail,
  "Version Link" (breadcrumb + asset name + vN), version number, status chip (Seen / Approved /
  VFX Sup Approved …), asset type (Animation, Lighting, Upload), published by, published
  ("3 days ago"), description, note count; list/thumbnail toggle, filter, saved views; a
  Filters drawer.
- **How:** `track/getColumns` (90 columns: version fields + the parent shot's fields prefixed
  `shot__` + the task's fields prefixed `task__` + all custom attributes + a "Notes (category)"
  column per label) and `track/getData` (`sourceType=asset`, page/limit/sort by `datetime`
  desc, returns `data[]` + `total`). Each row carries `link`, `shot__link`, `task__link`,
  `statusid`, `assettypename`, `thumbid.thumbUrl` (thumbor CDN), `comment`, `notes` count.
- **Evidence:** screenshot 04; `body_track_getData_versions.json`.
- **Our usage:** heavy for supervisors (approval statuses) — 7,792 versions, 3,398 notes on
  versions.

### 3.5 Task slide-in panel

- **What:** opens from any task link (or `slideEntityId=`): breadcrumb, thumbnail, name,
  three chips (type, status, due date) that are dropdown editors, action icons (play latest
  version, publish via Connect, actions menu), and a tab strip: Notes (default), versions,
  links/dependencies, lists, activity/history, info. Notes tab: composer, filter by label /
  last 30 days / "Any note", thread list with category banner, author, age, text, linked
  version thumbnail + path, reply box.
- **How:** `/api` query `TypedContext where id is …` projecting `__permissions.status_id`,
  `__permissions.end_date`, `object_type.is_*`, `project.project_schema_id`, `status`,
  `type`, dates, `split_parts`, `thumbnail_url`; then `ProjectSchema` (allowed types/statuses),
  `Type`, `Status` lists for the chip editors; `direct/api Note.get` (`entityId`, `entityType`,
  `metafilters`, `pageSize` 5) for the notes.
- **Evidence:** screenshot 09; `api_calls_panels_and_overview.json` (steps 2–3),
  `body_direct_Note_get.json`.
- **Our usage:** this is where artists and the coordinator actually change status and read
  feedback; 12,954 notes live here.

### 3.6 Version slide-in panel and review playback

- **What:** header with version name (`Soueast_S08_RCW - v6`), chips (Asset version, status
  dropdown "Seen", task "Animation-2P"), Components tab: Play button (choose format), list of
  components with location (ftrack.server vs `Nmesis.central-storage-location` path), download,
  metadata; plus notes / links / history / info tabs.
- **How:** `/api` query `AssetVersion where id is …` with `__permissions.status_id`,
  `asset.name`, `task.name`, `version`, `thumbnail_url`; `direct/widget
  ComponentsWidget.getData` returning `reviewable.formats[]` (signed mp4 URL, frameIn/Out,
  frameRate) and `data[]` components with metadata (`ftr_meta` width/height/frames,
  `source_component_id`).
- **Evidence:** screenshot 10. **Usage:** supervisors review in-browser; the player +
  frame-accurate notes are the part ftrack does that a plain tracker does not.

### 3.7 Team planner → Team calendar

- **What:** per-project resource Gantt: rows = people (then a second block by task type), bars
  = tasks (also showing other-project tasks hatched), week/day header, project start/end,
  today line, drag-to-reschedule, Filters, save/undo.
- **How:** `main/getProjectid` (project dates) then `direct/api TeamCalendar.getCalendar`
  with `startdate/enddate`, `settings{includeAllUserTasks, excludeEntityTasks}`; response
  `metaData.scheduledResources` (UserResource tree), `unAssignedResources` (TaskTypeResource
  list), `allEvents[]` (`taskid, startdate, enddate, bid, worked, statusid, typeid, userids,
  ResourceId, link, type:"otherproject"|…`). 269 events in the window.
- **Evidence:** screenshot 05; `body_direct_TeamCalendar_getCalendar.json`.
- **Our usage:** low. Dates exist on most tasks but the calendar is not how we plan; people
  appear with 1–17 assignments each and no bids, so capacity is not measured here.

### 3.8 Team planner → Team board

- **What:** two columns: "Tasks not assigned" (cards with type, name, path, due, priority;
  filter by type/status; sort) and "Resources" (one lane per user with workload count and
  cards, filter by user/group). Drag a card onto a person to assign.
- **How:** `direct/api Kanban.notAssigned` (paged 20) + `Kanban.resources` (`kanban_head`
  rows with `workload` per user, then `kanban_task` cards: `entityId, link, owner{link}, user,
  dueDate, isDueDatePassed, status{id,name,color}, priority, noteCount, isScheduled,
  splitPartsCount, draggable`).
- **Evidence:** screenshot 06; `body_direct_api_Kanban_notAssigned_resources.json`.
- **Our usage:** assignment is done, but mostly from the spreadsheet's Assignee cell.

### 3.9 Project dashboards (Custom, [ANIMATION] Progress, [VFX] Progress, Task board)

- **What:** widget pages. [VFX] Progress: top insights (Shots, Shots in progress, Shots done,
  Bid total, Worked total), a stacked bar chart "Tasks statuses (bid days)" by task type with a
  status legend, "Tasks by state", per-discipline insight rows (Tracking/Layout/Rotoscoping/
  Lighting/Compositing: total / in progress / done / bid / worked), Upcoming dates (next
  milestones with day badges, red when imminent), Latest versions (thumbnail grid).
- **How:** `direct/widget` batch: `InsightsWidget_TOP.getInsights`, `TasksStatusWidget.getData`
  (rows per task type with a value per status id, `metaData.seriesFields`),
  `TasksByStateWidget.getData` (empty — because our statuses carry no State),
  `MileStoneWidget.getInternalData` (next 5: `month, day, name, highlight, progress, link`),
  `InsightsWidget.getInsights` × 5, `AssetsWidget.getChanges` (latest 20 versions).
  Dashboards are `Dashboard` rows with `widgets.config`, sharable (`is_shared_with_everyone`,
  `dashboard_resources`).
- **Evidence:** screenshot 07; `body_direct_widget_dashboard_vfx_progress.json`.
- **Our usage:** the two "Progress" dashboards are referenced but the charts read 0 because
  bid days are 0 — the chart is "bid days per status", which is meaningless for us. The
  counts and Upcoming dates are the parts that carry information.

### 3.10 Task board (kanban)

- **What:** four columns Not Started / In Progress / On Hold / Done, each a status-id bucket;
  cards (thumbnail, type, parent, path, due in red when overdue, priority, note count badge,
  coloured status bar); per-column sort (due date) and type filter; drag between columns to
  change status; list/card toggle.
- **How:** `direct/widget TaskBoardWidget.getColumns` → 4 `FT.scrum.StateColumn` definitions
  with explicit status id lists (`Not Started` = Waiting + Ready to start; `In Progress` = In
  Progress, Pending Review, Comments, Rendering, Awaiting Export, Awaiting 1st Pass, Pending
  *Sup* Feedback…; `On Hold` = On Hold + Awaiting another task; `Done` = Completed +
  Cancelled), then `getWithStatus` per column (paged 20, `metasorters`, `metafilters`).
- **Evidence:** screenshot 08; `body_direct_widget_TaskBoard_*.json`.
- **Our usage:** available on every project; coordinators sometimes use it to see what is
  stuck. Note "Cancelled" lands in Done, and "Awaiting 1st Pass" counts as In Progress.

### 3.11 My Tasks

- **What:** the user's own queue with three modes — Task board (kanban by state), Task list,
  Schedule (weekly grid with a "Show done and blocked tasks" toggle, week picker) — and a
  status summary (Not started / In progress counts).
- **How:** React app; `/api` batch: tasks `from TypedContext where assignments.resource_id is
  <me> and project.status is "active"` with status/state/type/project colour/split parts;
  `count(id) from Task … group by status_id` excluding tasks under On-Hold/Blocked ancestors;
  `CalendarEvent` for the user (leave + project events); `Project` list for colouring;
  `Status`/`Setting` lookups.
- **Evidence:** screenshot 02; `api_calls_my_tasks.json`. (The shared Production-Team login
  has no assignments, so the grid was empty; Kareem's user resolves to 8 assigned tasks on
  active projects.)
- **Our usage:** artists' entry point; the shared login hides it from production.

### 3.12 Status changes

- **What:** the status chip (spreadsheet cell, task panel, kanban drag, version panel)
  offers the workflow's statuses; changing it writes `status_id`, appends a
  `TypedContextStatusChange`, emits an `Event change.status.task` with `{old,new}`, and
  notifies recipients/subscribers.
- **How:** see 2.2 and 2.7; the public API path is `update` on the entity. Transition rules
  would be `StatusRuleGroup` — none configured, so any user with update permission can pick
  any status.
- **Our usage:** the heart of the process. Status history is complete and timestamped for
  every task (`change.status.task` events since the account started), which is what the
  capacity/cost tracker and any turnaround metric should read.

### 3.13 Assignments

- Appointment rows (2.4). UI entry points: spreadsheet Assignee editor (multi-select users),
  task panel, team board drag, bulk assign via selection. 9,275 tasks assigned; assignment is
  per task, never per group.

### 3.14 Milestones

- Milestone object type (leaf, schedulable, statusable), named with a prefix convention
  ("Client Review:", "Delivery:", "Review:", "PROD:", "CR:"), usually with only `end_date`,
  living under a `Milestones` folder per project. Surfaces: spreadsheet rows, timeline diamonds
  (Overview), "Upcoming dates" widget (next 5, highlighted when within days), Milestone
  Type custom attribute. 630 total; status is rarely updated (487 still "Milestone").

### 3.15 Notes & feedback loop

- See 2.6. UI: notes tab on task/version panels (category label banner, replies, recipients,
  attachments with annotation support in the player, frame-stamped notes, "to-do" flag),
  "Notes (category)" columns in grids showing the latest note per category, note-count badges
  on cards. Our convention: artist posts "Artist Note" with the file path; coordinator posts
  "Task Definition" with source paths; supervisors/clients post feedback categories; the
  status flips to Comments.

### 3.16 Client reviews (Review Sessions)

- `ReviewSession` + objects + invitees + per-invitee statuses + annotations; shareable URL /
  passphrase; "Client reviews" entry in the project sidebar. **2 sessions ever (2023, 2025),
  7 items** — we do not use ftrack for client review; client feedback is typed in as notes.

### 3.17 Lists

- Ad-hoc task/version lists with a category (we have one category "Delivery"). 3 lists ever,
  all on Damas projects. Unused.

### 3.18 Reports, Bookmarks, search, notifications

- Reports: top-nav module (`#itemId=reports`); not captured (the hash change did not re-route
  the iframe during the scenario) — treat as unverified; no server-side artefact suggests use.
- Bookmarks: saved links per user. Global search (magnifier) queries entities by name.
- Notifications/inbox (bell + inbox icons) are fed by `Feed`/`Event` and socket.io pushes;
  notes with recipients create inbox items.

### 3.19 Time tracking, bids, dependencies, split tasks, automations

- `bid` on 0 tasks, `Timelog` 2 rows, `SplitTaskPart` 0, `TypedContextLink` (dependencies)
  21, `Automation`/`Trigger`/`WebhookAction` 0. Unused.

---

## 4. Usage scorecard

| Feature | Evidence of use | Verdict for our tracker |
|---|---|---|
| Project tree + task spreadsheet | 11,194 tasks, 16,212 contexts, 9,082 dated | core |
| Status lifecycle + history | ~9 statuses in real use; full change log | core |
| Assignments | 9,275 tasks assigned | core |
| Notes with categories | 16,476 notes, 10 live categories | core |
| Versions + approval statuses | 7,792 versions, 11 statuses | core (data), player optional |
| Milestones | 630, naming convention, rarely status-updated | core (dates only) |
| Overview timeline / project cards | daily entry point | core |
| My Tasks | artists' queue | core |
| Task board (kanban) | available; status buckets hard-wired | useful |
| Team board (assign by drag) | used via spreadsheet instead | optional |
| Team calendar (resource Gantt) | dates exist, no bids | optional |
| Project dashboards (widgets) | charts empty because bid = 0 | replace with our own KPIs |
| Custom attributes (`is_deliverable`, `content_type`, `delivered_date`) | our own convention | core (dashboard contract) |
| Client review sessions | 2 ever | drop |
| Lists | 3 ever | drop |
| Bids / timelogs / split tasks / dependencies | ~0 | drop |
| Priorities | 99 % Normal | drop (or keep a single "critical" flag) |
| Automations / webhooks | 0 | n/a (opportunity for the tracker) |
| 29 statuses / 23 task types | 9 / 8 in real use | prune |

---

## 5. Observations that matter for the design

1. ftrack is two apps stitched together; the valuable behaviour is simple: one tree, one
   status field with history, one assignment table, notes with categories, versions with
   their own status. Everything else is presentation over those six tables.
2. Our workflow is already encoded as the default task workflow, but statuses are not mapped
   to states, which is why ftrack's own "done %", "by state" charts and kanban columns rely on
   hard-coded id lists. A tracker that assigns every status a state (Not started / Active /
   Review / Blocked / Done / Cancelled) fixes most reporting for free.
3. The spreadsheet's power features we use are: tree with per-folder progress, inline status
   and assignee edits, filters, the summary strip, and the notes indicator. We do not use
   grouping, bids, saved views, export/import, dependencies.
4. The public `/api` gives everything the legacy endpoints give, with the quirks already
   documented in memory (`ftrack-user` + `ftrack-api-key` headers; nested projections
   `parent.name` return null — walk `parent_id` locally; custom attributes via
   `CustomAttributeValue`).
5. Write-back through `/api` (`update`, `create`, `delete`) is the obvious integration path if
   the tracker sits on top of ftrack; permissions are per role/project and the API user is the
   shared Production Team account (Administrator).
6. Real-time: ftrack pushes changes over socket.io to open clients; a tracker on top would
   either poll the `Event` table (integer ids make incremental polling trivial) or subscribe to
   the event hub.

## 6. Limits of this study

- Captured on the shared "Production Team" login; artist-role views (what an Artist sees in
  My Tasks and whether they may edit status/dates) were inferred from roles, not observed.
- Reports module not observed (hash routing did not switch the iframe in the scenario).
- Write operations were deliberately not exercised; the write path is documented from the
  schema, the column editor definitions and the status-change history.
- Response bodies were captured through Playwright, which may re-fetch bodies; counts and
  shapes are reliable, byte-exactness is not claimed.
