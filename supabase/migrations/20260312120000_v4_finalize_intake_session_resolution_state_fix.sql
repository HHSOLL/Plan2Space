create or replace function public.finalize_intake_session(
  p_intake_session_id uuid,
  p_owner_id uuid,
  p_name text,
  p_description text default null
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  source_layout_revision_id uuid,
  resolution_state text,
  created_from_intake_session_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.intake_sessions%rowtype;
  v_existing public.projects%rowtype;
  v_created public.projects%rowtype;
  v_resolution_state text;
begin
  select *
    into v_session
    from public.intake_sessions
   where public.intake_sessions.id = p_intake_session_id
   for update;

  if not found then
    raise exception 'Intake session not found';
  end if;

  if v_session.owner_id <> p_owner_id then
    raise exception 'Unauthorized';
  end if;

  if v_session.status not in ('resolved_reuse', 'resolved_generated', 'finalizing') then
    raise exception 'Intake session is not ready to finalize';
  end if;

  if v_session.selected_layout_revision_id is null then
    raise exception 'Selected layout revision is required';
  end if;

  v_resolution_state := case
    when v_session.status = 'resolved_reuse' then 'reused'
    when v_session.status = 'resolved_generated' then 'generated'
    when coalesce(v_session.resolution_payload->>'resolution', '') = 'reused' then 'reused'
    else 'generated'
  end;

  select p.*
    into v_existing
    from public.projects as p
   where p.created_from_intake_session_id = p_intake_session_id
   limit 1;

  if found then
    return query
    select
      v_existing.id,
      v_existing.owner_id,
      v_existing.name,
      v_existing.description,
      v_existing.source_layout_revision_id,
      v_existing.resolution_state,
      v_existing.created_from_intake_session_id,
      v_existing.created_at,
      v_existing.updated_at;
    return;
  end if;

  insert into public.projects (
    owner_id,
    name,
    description,
    source_layout_revision_id,
    resolution_state,
    created_from_intake_session_id
  )
  values (
    p_owner_id,
    p_name,
    p_description,
    v_session.selected_layout_revision_id,
    v_resolution_state,
    p_intake_session_id
  )
  returning * into v_created;

  if v_session.generated_floorplan_id is not null then
    update public.floorplans
       set project_id = v_created.id,
           updated_at = now()
     where public.floorplans.id = v_session.generated_floorplan_id
       and public.floorplans.project_id is null;
  end if;

  update public.intake_sessions
     set finalized_project_id = v_created.id,
         updated_at = now()
   where public.intake_sessions.id = p_intake_session_id;

  return query
  select
    v_created.id,
    v_created.owner_id,
    v_created.name,
    v_created.description,
    v_created.source_layout_revision_id,
    v_created.resolution_state,
    v_created.created_from_intake_session_id,
    v_created.created_at,
    v_created.updated_at;
end;
$$;

revoke all on function public.finalize_intake_session(uuid, uuid, text, text) from public;
grant execute on function public.finalize_intake_session(uuid, uuid, text, text) to service_role;
