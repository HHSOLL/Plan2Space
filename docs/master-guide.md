# Master Guide (Engineering Source of Truth)

이 문서는 Plan2Space의 엔지니어링 단일 기준 문서입니다.

## Non-Negotiables
- Semantic parsing -> 2D correction -> Procedural 3D 파이프라인 유지.
- Top view / Walk mode 두 모드 카메라 경험 보장.
- PBR + HDR + Post FX 시각 품질 기준 유지.
- 무거운 이미지 분석/기하/씬 생성 연산은 Vercel에서 실행하지 않음.
- Worker 후보 선택 전 wall/opening/scale 정규화로 노이즈를 줄인 뒤 스코어링한다.

## 운영 프로토콜 (필수)
- 작업 시작 전 `AGENTS.md`의 Must Read 문서를 순서대로 확인한다.
- 작업 시작 전 스킬을 선택한다.
  - 아키텍처/범위: `plan2space-project-core`
  - UX/비주얼: `plan2space-studio-ux`
  - 도면 AI: `plan2space-blueprint-ai`
- 기능/버그/리팩터링은 항상 새 브랜치에서 작업하고 품질 게이트 통과 후 `main`에 병합한다.
- 작업 종료 전 문서 Added/Updated/Removed 동기화를 완료한다.

## 시스템 아키텍처
- Frontend: `apps/web` (Vercel, UI 전용)
- Backend API: `apps/api` (Railway)
- Worker: `apps/worker` (Railway background worker)
- Database/Auth/Storage: Supabase

데이터 흐름:
1. 사용자 업로드
2. Supabase Storage 저장
3. Railway API 잡 생성
4. Railway Worker 처리 (multi-pass + provider scoring)
5. `floorplan_results` 저장
6. 프론트엔드 폴링 후 결과 렌더링

## 책임 경계
- `apps/web`:
  - 업로드/잡 생성 요청/잡 상태 폴링/결과 렌더링
  - Supabase 로그인 세션(access token) 획득
- `apps/api`:
  - 사용자 인증 검증(Supabase JWT)
  - 프로젝트/도면/잡/결과 도메인 API 제공
  - signed upload URL 발급
- `apps/worker`:
  - 도면 분석, 기하 추출, scene JSON 생성
  - 잡 상태 전이(queued/running/retrying/succeeded/failed/dead_letter)

## 핵심 API 기준 (Railway `/v1`)
- `POST /v1/projects`
- `GET /v1/projects`
- `POST /v1/floorplans/upload-url`
- `POST /v1/projects/:projectId/floorplans`
- `GET /v1/jobs/:jobId`
- `POST /v1/jobs/:jobId/retry`
- `GET /v1/floorplans/:floorplanId/result`
- `GET /v1/projects/:projectId/scene/latest`

## 프론트엔드 API 기준
- `NEXT_PUBLIC_RAILWAY_API_URL` 기반으로 Railway API 호출.
- `Authorization: Bearer <supabase access token>` 헤더 전달.
- Next.js 내부 도메인/파싱 API(`/api/ai/parse-floorplan`, `/api/projects/*`, `/api/furnitures/*`)는 사용하지 않는다.

## 데이터 테이블 기준
- `projects` (기존)
- `floorplans`
- `jobs`
- `floorplan_results`

Queue는 Supabase Postgres(`claim_jobs` + `FOR UPDATE SKIP LOCKED`) 기반으로 운영한다.

## 품질 게이트
- `npm --workspace apps/web run type-check`
- `npm --workspace apps/web run lint`
- `npm --workspace apps/web run build`
- `npm --workspace apps/api run typecheck`
- `npm --workspace apps/worker run typecheck`

## 관련 문서
- `docs/ai-pipeline.md`
- `docs/3d-visual-engine.md`
- `docs/implementation-plan.md`
- `docs/user-action-guide.md`
- `docs/deployment.md`

## 2026-03-05 변경 동기화 (Railway Immediate Cutover)
Added:
- Vercel UI / Railway API / Railway Worker / Supabase 분리 아키텍처.
- 잡 큐 기반 파이프라인과 `floorplans/jobs/floorplan_results` 기준.
- Web/API/Worker 공통 품질 게이트.

Updated:
- 프론트엔드 데이터 경계를 Railway API 호출 중심으로 변경.
- provider 실행 위치를 Next route에서 Railway worker로 이동.

Removed/Deprecated:
- Vercel `parse-floorplan` 직접 처리 모델.
- Next.js 도메인 API(`/api/projects/*`, `/api/furnitures/*`) 중심 아키텍처.

## 2026-03-11 변경 동기화 (Floorplan Normalization Accuracy Pass)
Added:
- Worker 후보 선택 전 deterministic wall/opening/scale 정규화 규칙.

Updated:
- 정확도 개선 범위를 provider 호출 자체보다 정규화/재부착/스코어링 강화로 확장.

Removed/Deprecated:
- opening을 중심점 근사로만 벽에 부착하는 단순 규칙.
