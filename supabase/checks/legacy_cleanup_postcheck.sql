-- Post-checks after applying:
-- 1) 20260414123000_remove_legacy_floorplan_intake.sql
-- 2) 20260414130000_remove_project_versions_floor_plan.sql

-- 1) Legacy objects must be absent
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
    ))
) as snapshot(name, kind, exists_flag)
order by kind, name;

-- 2) claim_jobs default must be ASSET_GENERATION
select
  p.proname,
  pg_get_functiondef(p.oid) as function_ddl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'claim_jobs';

-- 3) RLS policy check for jobs visibility
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'jobs'
order by policyname;
