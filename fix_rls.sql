-- Plan2Space — RLS Fix (수정버전)
-- storage.objects 테이블의 권한 설정을 건드리지 않고 정책만 추가합니다.

-- -----------------------------------------------------------------------------
-- 1) Storage RLS: floor-plans bucket
--    alter table 명령어를 제거했습니다. (이미 켜져 있음)
-- -----------------------------------------------------------------------------

-- 기존 정책이 있다면 삭제 (에러 방지)
drop policy if exists "Floor plans: authenticated can read own files" on storage.objects;
drop policy if exists "Floor plans: authenticated can upload own files" on storage.objects;
drop policy if exists "Floor plans: authenticated can update own files" on storage.objects;
drop policy if exists "Floor plans: authenticated can delete own files" on storage.objects;

-- 정책 재생성
create policy "Floor plans: authenticated can read own files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'floor-plans'
  and name like auth.uid()::text || '/%'
);

create policy "Floor plans: authenticated can upload own files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'floor-plans'
  and name like auth.uid()::text || '/%'
);

create policy "Floor plans: authenticated can update own files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'floor-plans'
  and name like auth.uid()::text || '/%'
)
with check (
  bucket_id = 'floor-plans'
  and name like auth.uid()::text || '/%'
);

create policy "Floor plans: authenticated can delete own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'floor-plans'
  and name like auth.uid()::text || '/%'
);

-- -----------------------------------------------------------------------------
-- 2) DB RLS: public.projects INSERT
--    여기는 사용자 테이블이므로 alter table을 유지해도 됩니다.
-- -----------------------------------------------------------------------------

alter table public.projects enable row level security;

drop policy if exists "Projects are insertable by owner" on public.projects;

create policy "Projects are insertable by owner"
on public.projects for insert
to authenticated
with check (owner_id = auth.uid());