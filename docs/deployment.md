# Deployment Guide (Vercel + Railway + Supabase)

## 1) Architecture
- Frontend: Vercel (`apps/web`)
- API: Railway (`apps/api`)
- Worker: Railway (`apps/worker`)
- DB/Auth/Storage: Supabase

무거운 분석/기하/scene 생성은 Railway Worker에서만 수행한다.

## 2) Vercel 설정 (`apps/web`)
- Root Directory: `apps/web`
- Install Command: `npm install`
- Build Command: `npm run build`

필수 env:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_RAILWAY_API_URL=
NEXT_PUBLIC_APP_URL=
```

주의:
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SNAPTRUDE_API_KEY`를 Vercel에 두지 않는다.

## 3) Railway API 배포 (`apps/api`)
- Start: `npm --workspace apps/api run start`
- Health: `GET /v1/health`
- 포트: Railway의 `PORT`를 우선 사용하고, 로컬에서는 `API_PORT`로 폴백
- Docker base image: `node:22-bookworm-slim` (`sharp`/`libvips` 호환성 확보)

필수 env:
```
API_PORT=4000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CORS_ORIGINS=http://localhost:3100,http://127.0.0.1:3100,https://plan2space.vercel.app,https://plan2-space-web-*.vercel.app,https://plan2space-*.vercel.app
FLOORPLAN_UPLOAD_BUCKET=floor-plans
```

주의:
- `CORS_ORIGINS`는 쉼표 구분 exact origin + `*` 와일드카드를 함께 지원한다.
- Preview 도메인은 `https://plan2-space-web-*.vercel.app`, `https://plan2space-*.vercel.app`처럼 Plan2Space 프로젝트 패턴만 좁혀서 허용한다.

## 4) Railway Worker 배포 (`apps/worker`)
- Start: `npm --workspace apps/worker run start`
- Docker base image: `node:22-bookworm-slim` (`sharp`/`libvips` 호환성 확보)

필수 env:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WORKER_CONCURRENCY=2
WORKER_POLL_INTERVAL_MS=1000
FLOORPLAN_PROVIDER_ORDER=anthropic,openai,snaptrude
FLOORPLAN_PROVIDER_TIMEOUT_MS=45000
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
SNAPTRUDE_API_URL=
SNAPTRUDE_API_KEY=
```

## 5) Supabase 준비
1. 마이그레이션 적용:
   - `supabase/migrations/20260305_railway_floorplan_queue.sql`
2. Storage bucket 확인:
   - `floor-plans`
3. RLS/함수 확인:
   - `claim_jobs` (service_role execute 허용)

## 6) 배포 후 검증
1. 로그인 후 프로젝트 생성
2. 도면 업로드 -> job 생성
3. `jobs` 상태가 `queued/running/succeeded`로 진행
4. `floorplan_results` 생성 확인
5. 프론트에서 결과 렌더링(2D/3D) 확인

## 7) CI 기준
- `web`: type-check + lint + build
- `api`: typecheck + test
- `worker`: typecheck + test
- legacy `parse-floorplan` eval gate는 Railway cutover에서는 기본 비활성

## 8) 2026-03-05 변경 동기화 (Railway Immediate Cutover)
Added:
- Railway API/Worker 배포 절차 및 env 계약.
- Supabase queue 스키마 적용 절차.

Updated:
- 배포 토폴로지를 Vercel 단일 실행에서 분산 구조로 전환.
- Railway API가 플랫폼 주입 `PORT`를 우선 사용하도록 반영.
- Railway API/Worker Docker base를 `alpine`에서 `bookworm-slim`으로 변경.

Removed/Deprecated:
- Vercel에서 provider 키를 사용해 직접 도면 분석하는 방식.

## 9) 2026-03-11 변경 동기화 (Preview Runtime Alignment)
Added:
- Railway API `CORS_ORIGINS`에 와일드카드 패턴 지원 규약 추가.
- Vercel preview 배포용 Plan2Space 도메인 패턴 예시 추가.

Updated:
- Preview/production이 동일한 Railway API를 사용하도록 Vercel env 운영 기준 명시.

Removed/Deprecated:
- Railway API CORS를 exact origin만으로 관리하는 운영 방식.
