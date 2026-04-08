alter table public.shared_projects
  add column if not exists project_version_id uuid references public.project_versions(id) on delete set null,
  add column if not exists preview_meta jsonb;

create index if not exists shared_projects_project_version_id_idx
  on public.shared_projects(project_version_id);

with latest_versions as (
  select distinct on (project_id) project_id, id, version
  from public.project_versions
  order by project_id, version desc
)
update public.shared_projects sp
set
  project_version_id = coalesce(sp.project_version_id, lv.id),
  preview_meta = coalesce(
    sp.preview_meta,
    jsonb_strip_nulls(
      jsonb_build_object(
        'projectName', p.name,
        'projectDescription', p.description,
        'versionNumber', lv.version,
        'assetSummary', p.meta -> 'assetSummary'
      )
    )
  )
from public.projects p
left join latest_versions lv on lv.project_id = p.id
where sp.project_id = p.id;
