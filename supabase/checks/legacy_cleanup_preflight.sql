-- Preflight checks for legacy floorplan/intake cleanup migrations.
-- Target migrations:
-- 1) 20260414123000_remove_legacy_floorplan_intake.sql
-- 2) 20260414130000_remove_project_versions_floor_plan.sql

-- 1) Object existence snapshot (safe even when objects do not exist)
select
  now() as checked_at,
  name as object_name,
  kind as object_type,
  exists_flag
from (
  values
    ('public.floorplans', 'table', to_regclass('public.floorplans') is not null),
    ('public.floorplan_results', 'table', to_regclass('public.floorplan_results') is not null),
    ('public.floorplan_match_events', 'table', to_regclass('public.floorplan_match_events') is not null),
    ('public.intake_sessions', 'table', to_regclass('public.intake_sessions') is not null),
    ('public.jobs.floorplan_id', 'column', exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'jobs'
        and column_name = 'floorplan_id'
    )),
    ('public.project_versions.floor_plan', 'column', exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'project_versions'
        and column_name = 'floor_plan'
    )),
    ('public.projects.created_from_intake_session_id', 'column', exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'projects'
        and column_name = 'created_from_intake_session_id'
    )),
    ('public.projects.source_layout_revision_id', 'column', exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'projects'
        and column_name = 'source_layout_revision_id'
    ))
) as snapshot(name, kind, exists_flag)
order by kind, name;

-- 2) Estimated row counts of legacy tables (from planner statistics)
select
  relname as table_name,
  reltuples::bigint as estimated_rows
from pg_class
where oid in (
  to_regclass('public.floorplans'),
  to_regclass('public.floorplan_results'),
  to_regclass('public.floorplan_match_events'),
  to_regclass('public.intake_sessions')
)
order by relname;

-- 3) Exact impact counts (dynamic to avoid errors if column/table absent)
do $$
declare
  v_count bigint;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'floorplan_id'
  ) then
    execute 'select count(*) from public.jobs where floorplan_id is not null' into v_count;
    raise notice '[preflight] jobs.floorplan_id not null rows = %', v_count;
  else
    raise notice '[preflight] jobs.floorplan_id column already absent';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_versions'
      and column_name = 'floor_plan'
  ) then
    execute 'select count(*) from public.project_versions where floor_plan is not null and floor_plan <> ''{}''::jsonb' into v_count;
    raise notice '[preflight] non-empty project_versions.floor_plan rows = %', v_count;
  else
    raise notice '[preflight] project_versions.floor_plan column already absent';
  end if;
end
$$;

-- 4) Optional safety backup (run manually before migration if needed)
-- create table if not exists public.backup_project_versions_floor_plan_20260414 as
-- select
--   id,
--   project_id,
--   version,
--   floor_plan,
--   now() as backed_up_at
-- from public.project_versions
-- where floor_plan is not null
--   and floor_plan <> '{}'::jsonb;
