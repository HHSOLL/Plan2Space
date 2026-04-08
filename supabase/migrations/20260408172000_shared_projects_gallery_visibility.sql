alter table public.shared_projects
  add column if not exists is_gallery_visible boolean not null default false,
  add column if not exists published_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_projects_gallery_visibility_guard'
  ) then
    alter table public.shared_projects
      add constraint shared_projects_gallery_visibility_guard
      check (not is_gallery_visible or (expires_at is null and permissions = 'view'));
  end if;
end $$;
