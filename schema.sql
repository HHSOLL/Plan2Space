-- plan2space — core schema (Supabase Postgres)
-- Focus: users, projects, project_versions (history), assets (GLB library)

-- Extensions
create extension if not exists "pgcrypto";

-- Common triggers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'Trigger helper to keep updated_at in sync.';

-- -----------------------------------------------------------------------------
-- users (public profile; linked to Supabase Auth)
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  -- Same UUID as auth.users.id
  id uuid primary key references auth.users(id) on delete cascade,

  display_name text,
  avatar_url text,
  locale text,
  preferences jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is 'Public profile table linked 1:1 with auth.users.';
comment on column public.users.id is 'Primary key; references auth.users(id).';
comment on column public.users.display_name is 'User-facing display name.';
comment on column public.users.avatar_url is 'Avatar image URL (optional).';
comment on column public.users.locale is 'BCP-47 locale tag (e.g., ko-KR).';
comment on column public.users.preferences is 'User preferences (JSONB, flexible).';
comment on column public.users.created_at is 'Row creation timestamp (UTC).';
comment on column public.users.updated_at is 'Row update timestamp (UTC).';

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- projects (owner-owned container; lightweight metadata + current pointer)
-- -----------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  description text,
  thumbnail_path text,

  -- Pointer to the currently selected version (nullable until first save)
  current_version_id uuid,

  -- Extra metadata (e.g., client info, import settings, tags)
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is 'Project metadata owned by a single user (RLS via owner_id).';
comment on column public.projects.id is 'Primary key.';
comment on column public.projects.owner_id is 'Project owner (auth.users.id) for RLS.';
comment on column public.projects.name is 'Project name/title.';
comment on column public.projects.description is 'Optional description.';
comment on column public.projects.thumbnail_path is 'Supabase Storage path for project thumbnail (optional).';
comment on column public.projects.current_version_id is 'Current project_versions.id pointer (optional).';
comment on column public.projects.meta is 'Project metadata (JSONB, flexible).';
comment on column public.projects.created_at is 'Row creation timestamp (UTC).';
comment on column public.projects.updated_at is 'Row update timestamp (UTC).';

create index if not exists projects_owner_id_idx on public.projects(owner_id);
create index if not exists projects_updated_at_idx on public.projects(updated_at desc);

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- project_versions (history snapshots; floorPlan + customization are JSONB)
-- -----------------------------------------------------------------------------
create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  -- Monotonic per-project version number: 1,2,3...
  version int not null check (version > 0),

  created_by uuid references auth.users(id) on delete set null,
  message text,

  -- Blueprint analysis / Plan2D IR (stored in meters; see docs/simulation-spec.md)
  floor_plan jsonb not null default '{}'::jsonb,

  -- User customization state (furniture transforms, materials, etc.)
  customization jsonb not null default '{}'::jsonb,

  snapshot_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_versions_project_id_version_key unique (project_id, version)
);

comment on table public.project_versions is 'Append-only history snapshots for a project.';
comment on column public.project_versions.id is 'Primary key.';
comment on column public.project_versions.project_id is 'Parent project.';
comment on column public.project_versions.version is 'Per-project increasing version number (1..n).';
comment on column public.project_versions.created_by is 'Creator (auth.users.id), nullable if user deleted.';
comment on column public.project_versions.message is 'Optional version message (e.g., "Added sofa").';
comment on column public.project_versions.floor_plan is 'Plan2D/floor plan data (JSONB). Coordinate unit: meters.';
comment on column public.project_versions.customization is 'Customization data (JSONB): furniture transforms, surface materials, etc.';
comment on column public.project_versions.snapshot_path is 'Supabase Storage path for version snapshot (optional).';
comment on column public.project_versions.created_at is 'Row creation timestamp (UTC).';
comment on column public.project_versions.updated_at is 'Row update timestamp (UTC).';

create index if not exists project_versions_project_id_idx on public.project_versions(project_id);
create index if not exists project_versions_project_id_version_idx on public.project_versions(project_id, version desc);
create index if not exists project_versions_created_at_idx on public.project_versions(created_at desc);
create index if not exists project_versions_floor_plan_gin_idx on public.project_versions using gin (floor_plan jsonb_path_ops);
create index if not exists project_versions_customization_gin_idx on public.project_versions using gin (customization jsonb_path_ops);

drop trigger if exists set_project_versions_updated_at on public.project_versions;
create trigger set_project_versions_updated_at
before update on public.project_versions
for each row execute procedure public.set_updated_at();

-- Add FK after project_versions exists
alter table public.projects
  drop constraint if exists projects_current_version_id_fkey;

alter table public.projects
  add constraint projects_current_version_id_fkey
  foreign key (current_version_id) references public.project_versions(id) on delete set null;

-- -----------------------------------------------------------------------------
-- assets (GLB furniture library)
-- -----------------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,

  name text not null,
  description text,
  category text not null default 'uncategorized',
  tags text[] not null default '{}'::text[],

  -- Supabase Storage paths (recommended buckets: assets-glb, assets-thumbnails)
  glb_path text not null,
  thumbnail_path text,
  preview_path text,

  -- Flexible metadata: boundingBox, pivot, defaultScale, polycount, materials, etc.
  meta jsonb not null default '{}'::jsonb,

  is_public boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assets is '3D asset catalog (GLB) with optional public visibility.';
comment on column public.assets.id is 'Primary key.';
comment on column public.assets.owner_id is 'Uploader/owner (auth.users.id). Null for system-provided assets.';
comment on column public.assets.name is 'Asset name.';
comment on column public.assets.description is 'Optional asset description.';
comment on column public.assets.category is 'Asset category (e.g., sofa, chair, table).';
comment on column public.assets.tags is 'Search tags.';
comment on column public.assets.glb_path is 'Supabase Storage path to GLB file.';
comment on column public.assets.thumbnail_path is 'Supabase Storage path to thumbnail image.';
comment on column public.assets.preview_path is 'Supabase Storage path to preview image/video (optional).';
comment on column public.assets.meta is 'Asset metadata (JSONB, flexible).';
comment on column public.assets.is_public is 'If true, selectable by anyone (RLS policy).';
comment on column public.assets.created_at is 'Row creation timestamp (UTC).';
comment on column public.assets.updated_at is 'Row update timestamp (UTC).';

create index if not exists assets_owner_id_idx on public.assets(owner_id);
create index if not exists assets_category_idx on public.assets(category);
create index if not exists assets_is_public_idx on public.assets(is_public);
create index if not exists assets_tags_gin_idx on public.assets using gin (tags);
create index if not exists assets_meta_gin_idx on public.assets using gin (meta jsonb_path_ops);

drop trigger if exists set_assets_updated_at on public.assets;
create trigger set_assets_updated_at
before update on public.assets
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS (minimal examples)
-- -----------------------------------------------------------------------------

-- users: profiles are viewable by authenticated users; editable by self
alter table public.users enable row level security;

drop policy if exists "Users are viewable by authenticated" on public.users;
create policy "Users are viewable by authenticated"
on public.users for select
using (auth.role() = 'authenticated');

drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile"
on public.users for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
on public.users for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can delete own profile" on public.users;
create policy "Users can delete own profile"
on public.users for delete
using (auth.uid() = id);

-- projects: owner-only access
alter table public.projects enable row level security;

drop policy if exists "Projects are viewable by owner" on public.projects;
create policy "Projects are viewable by owner"
on public.projects for select
using (auth.uid() = owner_id);

drop policy if exists "Projects are insertable by owner" on public.projects;
create policy "Projects are insertable by owner"
on public.projects for insert
with check (auth.uid() = owner_id);

drop policy if exists "Projects are updatable by owner" on public.projects;
create policy "Projects are updatable by owner"
on public.projects for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Projects are deletable by owner" on public.projects;
create policy "Projects are deletable by owner"
on public.projects for delete
using (auth.uid() = owner_id);

-- project_versions: owner-only via parent project
alter table public.project_versions enable row level security;

drop policy if exists "Project versions are viewable by project owner" on public.project_versions;
create policy "Project versions are viewable by project owner"
on public.project_versions for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_versions.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "Project versions are insertable by project owner" on public.project_versions;
create policy "Project versions are insertable by project owner"
on public.project_versions for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.projects p
    where p.id = project_versions.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "Project versions are updatable by project owner" on public.project_versions;
create policy "Project versions are updatable by project owner"
on public.project_versions for update
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_versions.project_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_versions.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "Project versions are deletable by project owner" on public.project_versions;
create policy "Project versions are deletable by project owner"
on public.project_versions for delete
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_versions.project_id
      and p.owner_id = auth.uid()
  )
);

-- assets: public assets are selectable by anyone; private assets only by owner
alter table public.assets enable row level security;

drop policy if exists "Assets are viewable if public or owner" on public.assets;
create policy "Assets are viewable if public or owner"
on public.assets for select
using (is_public = true or owner_id = auth.uid());

drop policy if exists "Assets are insertable by owner" on public.assets;
create policy "Assets are insertable by owner"
on public.assets for insert
with check (owner_id = auth.uid());

drop policy if exists "Assets are updatable by owner" on public.assets;
create policy "Assets are updatable by owner"
on public.assets for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Assets are deletable by owner" on public.assets;
create policy "Assets are deletable by owner"
on public.assets for delete
using (owner_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Optional: atomic version creation helper (recommended for "Save" button)
-- -----------------------------------------------------------------------------
create or replace function public.create_project_version(
  p_project_id uuid,
  p_message text default null,
  p_floor_plan jsonb default '{}'::jsonb,
  p_customization jsonb default '{}'::jsonb,
  p_snapshot_path text default null
)
returns public.project_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_next_version int;
  v_row public.project_versions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select owner_id
    into v_owner_id
  from public.projects
  where id = p_project_id
  for update;

  if v_owner_id is null then
    raise exception 'Project not found';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  select coalesce(max(version), 0) + 1
    into v_next_version
  from public.project_versions
  where project_id = p_project_id;

  insert into public.project_versions (
    project_id,
    version,
    created_by,
    message,
    floor_plan,
    customization,
    snapshot_path
  )
  values (
    p_project_id,
    v_next_version,
    auth.uid(),
    p_message,
    p_floor_plan,
    p_customization,
    p_snapshot_path
  )
  returning * into v_row;

  update public.projects
  set current_version_id = v_row.id
  where id = p_project_id;

  return v_row;
end;
$$;

comment on function public.create_project_version(uuid, text, jsonb, jsonb, text) is 'Atomically appends a new project version and updates projects.current_version_id.';

revoke all on function public.create_project_version(uuid, text, jsonb, jsonb, text) from public;
grant execute on function public.create_project_version(uuid, text, jsonb, jsonb, text) to authenticated;

