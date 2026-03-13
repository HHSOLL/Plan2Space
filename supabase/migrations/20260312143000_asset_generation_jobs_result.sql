alter table public.jobs
  add column if not exists result jsonb;
