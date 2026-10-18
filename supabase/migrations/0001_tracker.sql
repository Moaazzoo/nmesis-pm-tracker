-- ============================================================================
-- NMESIS Production Tracker — 0001: schema, RLS, lookup rows
-- Run once in Supabase → SQL Editor on the tracker project. Additive only.
-- Reads: every active logged-in user. Writes: server actions via service role.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Login roster (one row per Supabase Auth user) ---------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create or replace function public.tk_is_active() returns boolean
  language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and active);
$$;

-- 2. People (may exist before they have a login) ----------------------------
create table if not exists tk_people (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null,
  ftrack_username  text unique,
  profile_id       uuid unique references profiles(id) on delete set null,
  role             text not null default 'artist' check (role in ('production','supervisor','artist','viewer')),
  discipline       text check (discipline in ('CG','VFX')),
  is_admin         boolean not null default false,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- 3. Lookups -----------------------------------------------------------------
create table if not exists tk_statuses (
  key    text primary key,
  name   text not null,
  state  text not null check (state in ('not_started','ready','active','review','changes','blocked','done','cancelled')),
  sort   int  not null,
  tone   text not null
);
insert into tk_statuses (key, name, state, sort, tone) values
  ('waiting','Waiting for another progress','not_started',1,'muted'),
  ('ready','Ready to start','ready',2,'neutral'),
  ('in_progress','In Progress','active',3,'neutral'),
  ('pending_review','Pending Review','review',4,'amber'),
  ('comments','Comments','changes',5,'red'),
  ('completed','Completed','done',6,'green'),
  ('on_hold','On Hold','blocked',7,'muted'),
  ('cancelled','Cancelled','cancelled',8,'muted')
on conflict (key) do update set name = excluded.name, state = excluded.state, sort = excluded.sort, tone = excluded.tone;

create table if not exists tk_task_types (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  sort        int not null,
  active      boolean not null default true,
  discipline  text check (discipline in ('CG','VFX'))
);
insert into tk_task_types (name, sort, active, discipline) values
  ('Layout',1,true,'CG'), ('Modeling',2,true,'CG'), ('Shading',3,true,'CG'), ('Animation',4,true,'CG'),
  ('FX',5,true,'VFX'), ('Lighting',6,true,'CG'), ('Compositing',7,true,'VFX'), ('Editing',8,true,'VFX'),
  ('Storyboard',9,false,'CG'), ('Matchmove',10,false,'VFX'), ('Art Direction',11,false,'CG')
on conflict (name) do nothing;

-- 4. Projects → nodes (group | unit) → tasks -----------------------------------
create table if not exists tk_projects (
  id          uuid primary key default gen_random_uuid(),
  ftrack_id   text unique,
  code        text unique not null,
  name        text not null,
  client      text,
  start_date  date,
  end_date    date,
  status      text not null default 'active' check (status in ('active','archived')),
  color       text,
  created_at  timestamptz not null default now()
);

create table if not exists tk_nodes (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references tk_projects(id) on delete cascade,
  parent_id       uuid references tk_nodes(id) on delete cascade,
  ftrack_id       text unique,
  kind            text not null check (kind in ('group','unit')),
  unit_kind       text check (unit_kind in ('scene','shot','asset')),
  name            text not null,
  sort            int not null default 0,
  is_deliverable  boolean not null default false,
  content_type    text,
  delivered_date  date,
  archived        boolean not null default false
);
create index if not exists tk_nodes_project_idx on tk_nodes (project_id, parent_id);

create table if not exists tk_tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references tk_projects(id) on delete cascade,
  node_id      uuid not null references tk_nodes(id) on delete cascade,
  ftrack_id    text unique,
  name         text not null,
  pass_no      int,
  type_id      uuid references tk_task_types(id),
  status_key   text not null default 'waiting' references tk_statuses(key),
  start_date   date,
  due_date     date,
  critical     boolean not null default false,
  description  text,
  archived     boolean not null default false,
  status_since timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists tk_tasks_project_idx on tk_tasks (project_id, node_id, status_key);

create table if not exists tk_assignments (
  task_id    uuid not null references tk_tasks(id) on delete cascade,
  person_id  uuid not null references tk_people(id) on delete cascade,
  primary key (task_id, person_id)
);
create index if not exists tk_assignments_person_idx on tk_assignments (person_id);

-- 5. Versions, notes, milestones ---------------------------------------------
create table if not exists tk_versions (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references tk_tasks(id) on delete cascade,
  ftrack_id      text unique,
  number         int not null,
  submitted_by   uuid references tk_people(id),
  submitted_at   timestamptz not null default now(),
  link           text,
  thumbnail_url  text,
  status         text not null default 'submitted' check (status in ('submitted','approved','client_approved','needs_changes')),
  note           text,
  source         text not null default 'app' check (source in ('app','ftrack')),
  unique (task_id, number)
);

create table if not exists tk_notes (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references tk_tasks(id) on delete cascade,
  version_id    uuid references tk_versions(id) on delete set null,
  ftrack_id     text unique,
  author_id     uuid references tk_people(id),
  category      text not null check (category in ('Task Definition','Artist Note','Supervisor Feedback','Client Feedback','Production Note')),
  source_label  text,
  body          text not null,
  reply_to_id   uuid references tk_notes(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists tk_notes_task_idx on tk_notes (task_id, created_at);

create table if not exists tk_milestones (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references tk_projects(id) on delete cascade,
  ftrack_id   text unique,
  name        text not null,
  kind        text not null default 'internal' check (kind in ('client_review','delivery','internal')),
  due_date    date,
  done        boolean not null default false,
  archived    boolean not null default false
);

-- 6. History -----------------------------------------------------------------
create table if not exists tk_status_log (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references tk_tasks(id) on delete cascade,
  ftrack_id        text unique,
  from_status_key  text references tk_statuses(key),
  to_status_key    text not null references tk_statuses(key),
  by_person_id     uuid references tk_people(id),
  at               timestamptz not null default now()
);
create index if not exists tk_status_log_task_idx on tk_status_log (task_id, at);

create table if not exists tk_activity (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references tk_projects(id) on delete cascade,
  task_id     uuid references tk_tasks(id) on delete cascade,
  actor_id    uuid references tk_people(id),
  action      text not null,
  payload     jsonb not null default '{}'::jsonb,
  unread_by   uuid[] not null default '{}',
  at          timestamptz not null default now()
);
create index if not exists tk_activity_project_idx on tk_activity (project_id, at desc);
create index if not exists tk_activity_unread_idx on tk_activity using gin (unread_by);

-- 7. RLS: read for active users; no write policies (service role only) -------
do $$
declare t text;
begin
  foreach t in array array['profiles','tk_people','tk_statuses','tk_task_types','tk_projects','tk_nodes','tk_tasks',
                           'tk_assignments','tk_versions','tk_notes','tk_milestones','tk_status_log','tk_activity'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format('create policy %I_read on %I for select using (public.tk_is_active())', t, t);
  end loop;
end $$;

-- Done. Next: create the four Auth users, then run supabase/seed-roster.sql.
