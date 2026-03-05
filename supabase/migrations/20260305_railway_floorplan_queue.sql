-- Railway API/Worker floorplan pipeline tables

create table if not exists public.floorplans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  object_path text not null,
  original_file_name text,
  mime_type text,
  width int,
  height int,

  status text not null default 'queued' check (status in ('queued', 'running', 'retrying', 'succeeded', 'failed')),
  error_code text,
  error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists floorplans_project_id_idx on public.floorplans(project_id);
create index if not exists floorplans_status_idx on public.floorplans(status);
create index if not exists floorplans_created_at_idx on public.floorplans(created_at desc);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  floorplan_id uuid references public.floorplans(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,

  status text not null default 'queued' check (status in ('queued', 'running', 'retrying', 'succeeded', 'failed', 'dead_letter')),
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  attempts int not null default 0,
  max_attempts int not null default 3,

  run_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,

  recoverable boolean,
  provider_status jsonb,
  provider_errors jsonb,
  details text,
  error_code text,
  error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_queue_idx on public.jobs(status, run_at, created_at);
create index if not exists jobs_floorplan_id_idx on public.jobs(floorplan_id);
create index if not exists jobs_type_idx on public.jobs(type);

create table if not exists public.floorplan_results (
  id uuid primary key default gen_random_uuid(),
  floorplan_id uuid not null unique references public.floorplans(id) on delete cascade,

  wall_coordinates jsonb not null default '[]'::jsonb,
  room_polygons jsonb not null default '[]'::jsonb,
  scale double precision not null,
  scene_json jsonb not null default '{}'::jsonb,
  diagnostics jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists floorplan_results_floorplan_id_idx on public.floorplan_results(floorplan_id);

-- updated_at triggers
drop trigger if exists set_floorplans_updated_at on public.floorplans;
create trigger set_floorplans_updated_at
before update on public.floorplans
for each row execute procedure public.set_updated_at();

drop trigger if exists set_jobs_updated_at on public.jobs;
create trigger set_jobs_updated_at
before update on public.jobs
for each row execute procedure public.set_updated_at();

drop trigger if exists set_floorplan_results_updated_at on public.floorplan_results;
create trigger set_floorplan_results_updated_at
before update on public.floorplan_results
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.floorplans enable row level security;
alter table public.jobs enable row level security;
alter table public.floorplan_results enable row level security;

drop policy if exists "Floorplans are viewable by project owner" on public.floorplans;
create policy "Floorplans are viewable by project owner"
on public.floorplans for select
using (
  exists (
    select 1 from public.projects p
    where p.id = floorplans.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "Floorplans are insertable by project owner" on public.floorplans;
create policy "Floorplans are insertable by project owner"
on public.floorplans for insert
with check (
  exists (
    select 1 from public.projects p
    where p.id = floorplans.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "Floorplans are updatable by project owner" on public.floorplans;
create policy "Floorplans are updatable by project owner"
on public.floorplans for update
using (
  exists (
    select 1 from public.projects p
    where p.id = floorplans.project_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = floorplans.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "Jobs are viewable by project owner" on public.jobs;
create policy "Jobs are viewable by project owner"
on public.jobs for select
using (
  exists (
    select 1
    from public.floorplans f
    join public.projects p on p.id = f.project_id
    where f.id = jobs.floorplan_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "Floorplan results are viewable by project owner" on public.floorplan_results;
create policy "Floorplan results are viewable by project owner"
on public.floorplan_results for select
using (
  exists (
    select 1
    from public.floorplans f
    join public.projects p on p.id = f.project_id
    where f.id = floorplan_results.floorplan_id
      and p.owner_id = auth.uid()
  )
);

-- Worker claim function (transactional + SKIP LOCKED)
create or replace function public.claim_jobs(
  p_worker_id text,
  p_limit int default 1,
  p_type text default 'FLOORPLAN_PIPELINE'
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
