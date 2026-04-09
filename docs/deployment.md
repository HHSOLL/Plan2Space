# Deployment Guide

이 문서는 `2026-04-09` 기준 Plan2Space의 실제 배포 구조와 운영 절차를 정리합니다.

## 1) 현재 운영 토폴로지

- Web: Vercel (`apps/web`)
- API: Railway (`apps/api`)
- Worker: Railway (`apps/worker`)
- DB/Auth/Storage: Supabase

현재 production은 `builder-first` 제품 표면을 기준으로 동작합니다.

- public web은 `projects`, `project_versions`, `shared_projects`, `showcase` 중심으로 동작합니다.
- `/gallery`, `/community`, `/shared/[token]`은 pinned snapshot을 기준으로 복원합니다.
- legacy intake/floorplan/revision 경로는 active web 기본 UX가 아니라 compatibility 또는 ops 경계입니다.
- 무거운 분석, 큐 polling, asset generation, floorplan processing은 Railway Worker에서만 수행합니다.

## 2) 서비스별 역할

### Vercel Web (`apps/web`)

- 사용자-facing Next.js 앱
- builder, editor, viewer, share, gallery, community 렌더링
- Supabase auth session 사용
- `NEXT_PUBLIC_RAILWAY_API_URL`을 통해 Railway API 호출

중요:
- provider 키는 Vercel에 두지 않습니다.
- `NEXT_PUBLIC_RAILWAY_API_URL`이 빠지면 `/gallery`, `/community`는 empty state가 아니라 unavailable state를 표시합니다.

### Railway API (`apps/api`)

- 인증된 CRUD, project/version 저장, share/showcase 조회
- signed upload URL 발급
- job enqueue / job status 조회
- compatibility/ops용 intake/floorplan/revision read path 유지

중요:
- 이 서비스는 heavy compute를 직접 하지 않습니다.
- request/response 중심 경계여야 하며, 오래 걸리는 처리는 worker로 넘깁니다.

### Railway Worker (`apps/worker`)

- queue polling
- floorplan analysis pipeline
- asset generation pipeline
- provider 호출 및 결과 저장

중요:
- 장시간 실행과 background polling은 worker만 담당합니다.
- AI/provider 키는 worker에만 둡니다.

## 3) 환경 변수 기준

### Vercel (`apps/web`)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_RAILWAY_API_URL=
NEXT_PUBLIC_APP_URL=
```

운영 규칙:
- Production `NEXT_PUBLIC_APP_URL=https://plan2space.vercel.app`
- Preview는 `NEXT_PUBLIC_APP_URL`을 비워 preview host 자체로 OAuth 시작
- Production/Preview/Development 모두 `NEXT_PUBLIC_RAILWAY_API_URL`은 동일한 Railway API URL로 맞춤

두지 말아야 하는 값:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `SNAPTRUDE_API_KEY`
- 기타 provider/worker 전용 키

### Railway API (`apps/api`)

```bash
API_PORT=4000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CORS_ORIGINS=http://localhost:3100,http://127.0.0.1:3100,https://plan2space.vercel.app,https://plan2-space-web-*.vercel.app,https://plan2space-*.vercel.app
FLOORPLAN_UPLOAD_BUCKET=floor-plans
ENABLE_LEGACY_API_ROUTES=false
```

운영 규칙:
- Railway 런타임에서는 `PORT`가 자동 주입되며 API는 이를 우선 사용
- `CORS_ORIGINS`는 exact origin과 `*` wildcard를 함께 지원
- Vercel preview 도메인 패턴을 반드시 포함
- `ENABLE_LEGACY_API_ROUTES`는 기본 `false`로 두고, intake/floorplan/jobs/revisions/scenes가 필요한 ops 기간에만 `true`로 연다

### Railway Worker (`apps/worker`)

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WORKER_CONCURRENCY=2
WORKER_POLL_INTERVAL_MS=1000
ASSET_STORAGE_BUCKET=assets-glb
ASSET_GENERATION_POLL_INTERVAL_MS=2000
ASSET_GENERATION_MAX_POLLS=45

FLOORPLAN_PROVIDER_ORDER=anthropic,openai,snaptrude
FLOORPLAN_PROVIDER_TIMEOUT_MS=45000
FLOORPLAN_PREPROCESS_PROFILES=balanced,lineart,filled_plan
FLOORPLAN_REVIEW_SCORE_THRESHOLD=72
FLOORPLAN_REVIEW_CONFLICT_THRESHOLD=0.3
FLOORPLAN_REVIEW_DIMENSION_CONFLICT_THRESHOLD=0.35
FLOORPLAN_REVIEW_SCALE_CONFLICT_THRESHOLD=0.35

ANTHROPIC_API_KEY=
OPENAI_API_KEY=
SNAPTRUDE_API_URL=
SNAPTRUDE_API_KEY=
ROBOFLOW_CUBICASA2_URL=
ROBOFLOW_CUBICASA3_URL=
ROBOFLOW_API_KEY=
PADDLEOCR_API_URL=
PADDLEOCR_API_TOKEN=
PADDLEOCR_DET_MODEL=PP-OCRv5_det
PADDLEOCR_REC_MODEL=korean_PP-OCRv5_mobile_rec
HF_FLOORPLAN_ENDPOINT_URL=
HF_FLOORPLAN_ENDPOINT_TOKEN=
TRIPOSR_API_URL=
TRIPOSR_API_KEY=
TRIPOSR_STATUS_URL=
MESHY_API_URL=
MESHY_API_KEY=
MESHY_STATUS_URL=
```

## 4) Supabase 준비

### 4.1 베이스 스키마

먼저 베이스 Supabase 스키마를 적용해야 합니다.

- README 기준으로는 Supabase SQL Editor에서 `schema.sql`을 먼저 실행합니다.
- 이 저장소의 `supabase/migrations/`에는 변경분만 들어 있습니다.
- 특히 `2026-04`의 `shared_projects` 관련 migration은 테이블 생성이 아니라 기존 `public.shared_projects`를 변경하는 migration입니다.

즉, 새 Supabase 프로젝트를 만드는 경우:
1. 베이스 스키마 적용
2. 아래 migration 순서대로 적용

### 4.2 필수 migration

순서대로 적용:

1. `supabase/migrations/20260305_railway_floorplan_queue.sql`
2. `supabase/migrations/20260311_v4_intake_revision_foundation.sql`
3. `supabase/migrations/20260312120000_v4_finalize_intake_session_resolution_state_fix.sql`
4. `supabase/migrations/20260312143000_asset_generation_jobs_result.sql`
5. `supabase/migrations/20260408153000_shared_projects_snapshot_pinning.sql`
6. `supabase/migrations/20260408172000_shared_projects_gallery_visibility.sql`

### 4.3 확인해야 할 데이터/스토리지

- bucket:
  - `floor-plans`
  - `assets-glb`
  - 필요 시 `floorplan-cache`
- function / RPC:
  - `claim_jobs`
  - `finalize_intake_session`
- 주요 테이블:
  - `projects`
  - `project_versions`
  - `shared_projects`
  - `floorplans`
  - `jobs`
  - `floorplan_results`
  - `intake_sessions`
  - `layout_revisions`
  - `revision_source_links`

## 5) 현재 배포 절차

### 5.1 Vercel (`apps/web`)

- Root Directory: `apps/web`
- Install Command: `npm install`
- Build Command: `npm run build`

배포 후 필수 확인:
- `NEXT_PUBLIC_RAILWAY_API_URL`이 production/preview env에 모두 들어갔는지 확인
- preview bundle이 Railway API를 가리키는지 smoke 검증
- public showcase read는 `apps/web` Route Handler(`/api/v1/showcase`)에서 `revalidate=60` 캐시를 사용한다.

예시:

```bash
npm --workspace apps/web run smoke:preview-runtime -- --url=<vercel-preview-url> --expected=https://api-production-473bd.up.railway.app
```

### 5.2 Railway API (`apps/api`)

- Start Command: `npm --workspace apps/api run start`
- Health: `GET /v1/health`

실제 운영 확인 포인트:
- `/v1/health`가 `200`
- `/v1/showcase?limit=3`가 `200`

### 5.3 Railway Worker (`apps/worker`)

- Start Command: `npm --workspace apps/worker run start`

운영 전 확인:

```bash
npm --workspace apps/worker run provider:floorplan:check
npm --workspace apps/worker run provider:floorplan:check -- --strictCommercialization=1
```

### 5.4 Railway 수동 배포 주의

이 저장소는 `apps/web/public` 자산이 커서, repo root 전체로 `railway up`을 실행하면 업로드 크기 한도로 실패할 수 있습니다.

권장 순서:
- Git 기반 Railway 배포를 사용
- 또는 API/Worker에 필요한 최소 파일만 모은 임시 deploy context로 `railway up --path-as-root` 실행

## 6) 배포 후 검증

### 6.1 API/Worker 기본 확인

1. `GET /v1/health`
2. `GET /v1/showcase?limit=3`
3. `https://plan2space.vercel.app/api/v1/showcase?limit=3`
4. (로그인 세션 기준) `GET /api/v1/projects/:projectId/versions/latest`
5. worker 로그에서 polling 시작 확인

### 6.2 Web 확인

1. `https://plan2space.vercel.app/gallery`
2. `https://plan2space.vercel.app/community`
3. `/gallery`, `/community`가 transport 실패 시 unavailable state를 보여주는지 확인
4. 정상일 때는 empty archive 또는 published snapshot 목록이 보이는지 확인

### 6.3 Share / Snapshot 확인

1. editor에서 share link 생성
2. link가 pinned snapshot으로 생성되는지 확인
3. `/shared/[token]`이 later save와 무관하게 같은 saved version을 여는지 확인
4. gallery publish를 켠 경우 `/gallery`와 `/community`에 반영되는지 확인

### 6.4 Legacy retirement 확인

1. Railway production API env에서 dry-run backfill 확인

```bash
railway run -- npm --workspace apps/api run backfill:legacy-project-versions -- --dry-run --limit 20
```

2. remaining candidate가 `0`인지 확인
3. `/project/[id]`가 `latest saved version -> empty builder launch` 순서로만 bootstrap 되는지 확인

## 7) CI / 품질 게이트

- `web`: `type-check`, `lint`, `build`
- `api`: `typecheck`
- `worker`: `typecheck`

기본 명령:

```bash
npm --workspace apps/web run type-check
npm --workspace apps/web run lint
npm --workspace apps/web run build
npm --workspace apps/api run typecheck
npm --workspace apps/worker run typecheck
```

## 8) 비용 절감용 대안 토폴로지

### 질문

API는 Vercel로 옮기고, worker만 Railway에 둘 수 있는가?

### 답

가능합니다. 다만 지금 production이 그렇게 되어 있는 것은 아닙니다.

### 가능한 이유

- 현재 API는 주로 인증, CRUD, signed upload URL 발급, queue enqueue, showcase 조회 같은 짧은 요청 처리입니다.
- heavy compute는 이미 worker가 담당합니다.
- 즉 구조상 long-running work를 Railway Worker에 남기고, request/response API만 다른 런타임으로 옮기는 것이 가능합니다.

### 실제로 옮겨야 하는 것

- `apps/api` Express 경계를 Vercel에서 처리 가능한 형태로 옮겨야 합니다.
- 선택지는 두 가지입니다.
  - `apps/web` 안의 Route Handler / server function으로 재구성
  - 별도 Vercel API 서비스로 Express app 배포

### 그대로 Railway에 남겨야 하는 것

- queue polling
- floorplan processing
- asset generation
- provider 호출
- background job orchestration

### 주의사항

- 이 작업은 단순 env 변경이 아니라 API 런타임 이식 작업입니다.
- 현재 web은 `NEXT_PUBLIC_RAILWAY_API_URL`을 기준으로 backend를 호출하므로, same-origin Vercel API로 옮기면 client fetch 경계도 같이 바꿔야 합니다.
- legacy intake/floorplan ops 경로를 모두 Vercel로 옮길지, worker와 가까운 Railway에 남길지도 결정해야 합니다.
- 비용만 보면 API를 Vercel로 옮겨 Railway 서비스를 `worker only`로 줄일 수 있지만, migration 공수가 있습니다.

### 추천 순서

1. public builder-first API만 먼저 Vercel로 이동
   - `projects`
   - `project_versions`
   - `shared`
   - `showcase`
2. worker는 Railway 유지
3. compatibility/ops용 intake/floorplan/revision 경로는 마지막에 정리

## 9) 2026-04-09 변경 동기화

Added:
- pinned snapshot / gallery / community 기준 배포 검증 절차
- `shared_projects` migration 전제조건과 베이스 스키마 주의사항
- legacy backfill dry-run 확인 절차
- Railway 수동 배포 시 최소 deploy context 운영 규칙
- 비용 절감용 `Vercel API + Railway Worker` 대안 토폴로지 설명
- Vercel Route Handler(`/api/v1/showcase`) 기반 public showcase read cache 절차
- Vercel Route Handler(`/api/v1/projects/:projectId/versions/latest`) 기반 authenticated latest-version read 절차

Updated:
- 배포 가이드를 builder-first 현재 운영 기준으로 전면 갱신
- active web surface와 compatibility/ops 경계를 분리해서 설명
- worker 역할을 long-running/background 경계 기준으로 재정의
- `gallery/community` showcase read path를 `no-store` direct fetch에서 `vercel cache layer -> railway source` 흐름으로 조정
- editor bootstrap latest-version read path를 `railway direct`에서 `vercel route 우선 + railway fallback`으로 조정
- API default mount 정책을 `legacy routes disabled by default`로 조정(`ENABLE_LEGACY_API_ROUTES=false`)

Removed/Deprecated:
- 도면 업로드 -> job -> floorplan result만을 중심으로 서술하던 예전 배포 가이드
- Vercel에 provider 키를 두거나 heavy processing을 올리는 운영 설명
