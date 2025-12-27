# Supabase 설정 — plan2space

문서 목적: Auth/DB/Storage 초기 설정과 RLS 정책을 정의한다. (Week 1~3 기준)

---

## 1) 테이블

Supabase SQL Editor에서 루트의 `schema.sql`을 실행한다.

- 포함: `public.users`, `public.projects`, `public.project_versions`, `public.assets`
- 포함: `updated_at` 트리거 함수, RLS 정책 예시, RPC `create_project_version`

## 2) updated_at 트리거

`schema.sql`에 포함되어 있다.

## 3) RLS 정책

`schema.sql`에 포함되어 있다. 기본 원칙:

- `projects`: `owner_id = auth.uid()`인 사용자만 CRUD
- `project_versions`: 부모 `projects.owner_id = auth.uid()`인 경우만 CRUD (RPC를 통한 저장 권장)
- `assets`: `is_public = true` 또는 `owner_id = auth.uid()`인 경우 조회 가능

## 4) Storage 버킷 (썸네일)

Supabase Storage에서 아래 버킷을 만든다. (MVP는 public 권장, 이후 private + signed URL로 전환 가능)

1) `floor-plans`
- 프로젝트 생성 시 업로드되는 도면 이미지 (Dashboard 카드 썸네일로도 사용 가능)

2) `project-thumbnails`
- 에디터 스냅샷/썸네일 (후속 구현)

3) `assets-glb`
- 가구/오브젝트 GLB 파일 (R3F에서 public URL로 로드)

RLS 정책(선택)은 `docs/rbac-acl.md`와 `schema.sql`의 예시를 참고해 추가한다.

## 5) 환경 변수

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 6) Next.js SSR 세션(중요)

쿠키 기반 세션 동기화를 위해 `apps/web/middleware.ts`가 필요하다. (세션 만료 시 자동 갱신 및 쿠키 유지)
