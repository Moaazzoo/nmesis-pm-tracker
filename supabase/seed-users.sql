-- ============================================================================
-- NMESIS Production Tracker — create the four logins + link the roster, in one run.
-- Supabase → SQL Editor. BEFORE RUNNING: replace the four CHANGE_ME passwords.
-- Re-runnable: existing users are skipped, roster rows are updated.
-- ============================================================================

-- 1. Auth users (email + password, already confirmed) ---------------------------
do $$
declare
  v record;
  uid uuid;
begin
  for v in
    select * from (values
      ('moaaz.hashem@nmesis.io',    'CHANGE_ME_moaaz'),
      ('teodora.khalifa@nmesis.io', 'CHANGE_ME_teodora'),
      ('kareem@nmesis.io',          'CHANGE_ME_kareem'),
      ('hesham@nmesis.io',          'CHANGE_ME_hesham')
    ) as t(email, password)
  loop
    if v.password like 'CHANGE_ME%' then
      raise exception 'Replace the CHANGE_ME password for % before running', v.email;
    end if;
    if exists (select 1 from auth.users where email = v.email) then
      continue;  -- already created (from the dashboard or an earlier run)
    end if;
    uid := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token,
      is_sso_user
    ) values (
      uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email,
      extensions.crypt(v.password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', '', '', '', '',
      false
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, 'email',
            jsonb_build_object('sub', uid::text, 'email', v.email, 'email_verified', true, 'phone_verified', false),
            now(), now(), now());
  end loop;
end $$;

-- 2. Profiles (one per login) --------------------------------------------------
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

-- 3. Managers on the roster, linked to their logins ---------------------------
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

-- 4. Check: should list 4 rows with a login ------------------------------------
select p.full_name, p.role, p.discipline, p.is_admin, pr.username
from tk_people p join profiles pr on pr.id = p.profile_id
order by p.full_name;
