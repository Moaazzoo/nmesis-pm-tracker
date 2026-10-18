-- 0002: a task can carry several ftrack assets, each with its own version numbers.
alter table tk_versions drop constraint if exists tk_versions_task_id_number_key;
alter table tk_versions add column if not exists asset_name text;
create index if not exists tk_versions_task_idx on tk_versions (task_id, submitted_at desc);
