-- Remove legacy floor_plan snapshot column and align create_project_version RPC
-- to customization(sceneDocument)-only persistence.

drop index if exists project_versions_floor_plan_gin_idx;

alter table public.project_versions
  drop column if exists floor_plan;

drop function if exists public.create_project_version(uuid, text, jsonb, jsonb, text);

create or replace function public.create_project_version(
  p_project_id uuid,
  p_message text default null,
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
    customization,
    snapshot_path
  )
  values (
    p_project_id,
    v_next_version,
    auth.uid(),
    p_message,
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

revoke all on function public.create_project_version(uuid, text, jsonb, text) from public;
grant execute on function public.create_project_version(uuid, text, jsonb, text) to authenticated;
