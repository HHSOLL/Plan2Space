# Week 4 Cleanup Report (Dashboard + Legacy 정리)

## 목표
- 사용자 진입 흐름(대시보드/프로젝트 생성) 완성
- 레거시(구 Three 엔진/스튜디오) 코드를 안전하게 격리하여 빌드/타입 오류 제거

## 사용자 흐름(Features)
- Dashboard(SSR): `apps/web/app/dashboard/page.tsx`
- Project Create(클라이언트): `apps/web/app/projects/create/page.tsx`
- Global Error UI: `apps/web/app/error.tsx`
- 404(Not Found): `apps/web/app/not-found.tsx`

## 레거시 코드 정리(삭제 대신 격리)
안전성을 위해 **삭제하지 않고** `apps/web/_deprecated/`로 이동했습니다. (타입체크/빌드에서 제외)

### 이동된 파일
- `apps/web/_deprecated/lib/three/Navigation.ts`
- `apps/web/_deprecated/lib/three/Resources.ts`
- `apps/web/_deprecated/lib/three/assets.ts`
- `apps/web/_deprecated/lib/three/Camera.ts`
- `apps/web/_deprecated/lib/three/Experience.ts`
- `apps/web/_deprecated/lib/three/Renderer.ts`
- `apps/web/_deprecated/lib/three/World.ts`
- `apps/web/_deprecated/lib/three/themes.ts`
- `apps/web/_deprecated/components/simulation-studio.tsx`
- `apps/web/_deprecated/components/blueprint-import-wizard.tsx`
- `apps/web/_deprecated/components/plan-3d-viewer.tsx`
- `apps/web/_deprecated/components/plan-2d-viewer.tsx`
- `apps/web/_deprecated/lib/plan-from-image.ts`
- `apps/web/_deprecated/lib/design-templates.ts`
- `apps/web/_deprecated/lib/qto.ts`
- `apps/web/_deprecated/lib/room-presets.ts`
- `apps/web/_deprecated/lib/materials.ts`
- `apps/web/_deprecated/lib/supabase/projects.ts`

### 타입체크 제외
- `apps/web/tsconfig.json`에 `_deprecated` exclude 추가

## 라우팅 정리
- `GET /projects` → `/dashboard`로 redirect
- `GET /simulation` → `/projects/create`로 redirect

## 문서/설정 업데이트
- `README.md`: 현재 라우트/실행 방법/스택(R3F + Supabase) 중심으로 정리
- `docs/supabase-setup.md`: `schema.sql` + Storage 버킷(`floor-plans`, `assets-glb`, `project-thumbnails`) 기준으로 업데이트
- `apps/web/next.config.js`: Supabase Storage URL을 `next/image`에서 허용하도록 `images.remotePatterns` 추가

## 타입 일원화
- `_deprecated` 외부에서 남아있던 `any` 사용을 `unknown`/명시적 가드로 교체
- `types/database.ts`: `ProjectMeta.thumbnailBucket?: string` 추가 (Dashboard 썸네일 버킷 식별용)

