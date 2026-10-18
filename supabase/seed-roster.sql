-- ============================================================================
-- NMESIS Production Tracker — roster seed. Run AFTER 0001_tracker.sql and after
-- creating the four Auth users (Authentication → Users → Add user, with password):
--   moaaz.hashem@nmesis.io · teodora.khalifa@nmesis.io · kareem@nmesis.io · hesham@nmesis.io
-- Re-runnable.
-- ============================================================================

insert into profiles (id, username, full_name)
select u.id, split_part(u.email, '@', 1), v.full_name
from auth.users u
join (values
  ('moaaz.hashem@nmesis.io',   'Moaaz Hashem'),
  ('teodora.khalifa@nmesis.io','Teodora Khalifa'),
  ('kareem@nmesis.io',         'Kareem Abd Elazim'),
  ('hesham@nmesis.io',         'Hesham Mahmoud')
) as v(email, full_name) on v.email = u.email
on conflict (id) do update set full_name = excluded.full_name, active = true;

-- Managers: linked to their logins. Updates rows that already exist (by login or by ftrack username), inserts the rest.
with v(full_name, ftrack_username, username, role, discipline, is_admin) as (values
  ('Moaaz Hashem',      null::text,         'moaaz.hashem',    'production', null::text, true),
  ('Teodora Khalifa',   null::text,         'teodora.khalifa', 'production', null::text, false),
  ('Kareem Abd Elazim', 'Kareem@nmesis.io', 'kareem',          'supervisor', 'CG',       true),
  ('Hesham Mahmoud',    null::text,         'hesham',          'supervisor', 'VFX',      false)
), j as (
  select v.*, p.id as pid from v join profiles p on p.username = v.username
), upd as (
  update tk_people t set profile_id = j.pid, full_name = j.full_name, role = j.role, discipline = j.discipline, is_admin = j.is_admin, active = true
  from j where t.profile_id = j.pid or (j.ftrack_username is not null and t.ftrack_username = j.ftrack_username)
  returning t.id, j.pid
)
insert into tk_people (full_name, ftrack_username, profile_id, role, discipline, is_admin)
select j.full_name, j.ftrack_username, j.pid, j.role, j.discipline, j.is_admin from j
where not exists (select 1 from upd where upd.pid = j.pid);

-- Artists and the shared ftrack login: people without logins yet (profile_id stays null).
insert into tk_people (full_name, ftrack_username, role)
values
  ('Ziad Yasser',       'ziad@nmesis.io',             'artist'),
  ('Moustafa Tork',     'M.elturkman@nmesis.io',      'artist'),
  ('Mohamed Sherif',    'mohamed.sherif@nmesis.io',   'artist'),
  ('Mohamed AbdelAziz', 'mohamed.abdelaziz@nmesis.io','artist'),
  ('Ahmed Magdy',       'ahmed.magdy@nmesis.io',      'artist'),
  ('Ahmed Ashour',      'ahmed.ashour@nmesis.io',     'artist'),
  ('Mohamed Kotb',      'mohamed.kotb@nmesis.io',     'artist'),
  ('Moamen Yehia',      'moamen@nmesis.io',           'artist'),
  ('Ammar Yasser',      'ammar@nmesis.io',            'artist'),
  ('Youssef Kamal',     'youssef.kamal@nmesis.io',    'artist'),
  ('Production Team',   'moaaz.hashem@nmesis.io',     'viewer')
on conflict (ftrack_username) do update set full_name = excluded.full_name;
