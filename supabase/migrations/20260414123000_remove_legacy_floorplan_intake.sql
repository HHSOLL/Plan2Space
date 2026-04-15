-- Remove retired floorplan/intake pipeline artifacts after room-first deskterior pivot.

-- Legacy finalize function is no longer used.
drop function if exists public.finalize_intake_session(uuid, uuid, text, text);

-- Jobs are now asset-generation-only and should not reference floorplans.
alter table public.jobs
  drop constraint if exists jobs_floorplan_id_fkey;

drop index if exists jobs_floorplan_id_idx;

alter table public.jobs
  drop column if exists floorplan_id;

-- Remove legacy floorplan pipeline tables.
drop table if exists public.floorplan_results cascade;
drop table if exists public.floorplan_match_events cascade;
drop table if exists public.floorplans cascade;

-- Remove intake provenance columns if previous migrations introduced them.
alter table public.projects
  drop column if exists source_layout_revision_id,
  drop column if exists created_from_intake_session_id;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'layout_revisions'
  ) then
    execute 'alter table public.layout_revisions drop column if exists created_from_intake_session_id';
  end if;
end
$$;

drop table if exists public.intake_sessions cascade;

-- Replace legacy select policies with payload owner policy.
drop policy if exists "Jobs are viewable by project owner" on public.jobs;
drop policy if exists "Jobs are viewable by project or intake owner" on public.jobs;
drop policy if exists "Jobs are viewable by owner payload" on public.jobs;

create policy "Jobs are viewable by owner payload"
on public.jobs for select
using (
  auth.uid() is not null
  and payload ? 'owner_id'
  and payload->>'owner_id' = auth.uid()::text
);

-- Default queue type must align with worker claim type.
create or replace function public.claim_jobs(
  p_worker_id text,
  p_limit int default 1,
  p_type text default 'ASSET_GENERATION'
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_jobs as (
    select j.id
    from public.jobs j
    where j.status in ('queued', 'retrying')
      and j.run_at <= now()
      and j.type = p_type
    order by j.created_at asc
    limit greatest(p_limit, 1)
    for update skip locked
  )
  update public.jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         locked_by = p_worker_id,
         locked_at = now(),
         updated_at = now()
    from next_jobs nj
   where j.id = nj.id
  returning j.*;
end;
$$;

revoke all on function public.claim_jobs(text, int, text) from public;
grant execute on function public.claim_jobs(text, int, text) to service_role;
