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

-- Managers: linked to their logins.
insert into tk_people (full_name, ftrack_username, profile_id, role, discipline, is_admin)
select v.full_name, v.ftrack_username, p.id, v.role, v.discipline, v.is_admin
from (values
  ('Moaaz Hashem',      null::text,                    'moaaz.hashem',    'production', null::text, true),
  ('Teodora Khalifa',   null::text,                    'teodora.khalifa', 'production', null::text, false),
  ('Kareem Abd Elazim', 'Kareem@nmesis.io',            'kareem',          'supervisor', 'CG',       true),
  ('Hesham Mahmoud',    null::text,                    'hesham',          'supervisor', 'VFX',      false)
) as v(full_name, ftrack_username, username, role, discipline, is_admin)
join profiles p on p.username = v.username
on conflict (profile_id) do update set role = excluded.role, discipline = excluded.discipline, is_admin = excluded.is_admin, full_name = excluded.full_name;

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
