# Master Guide (Engineering Source of Truth)

이 문서는 Plan2Space의 엔지니어링 단일 기준 문서입니다.

## Non-Negotiables
- Semantic parsing -> 2D correction -> Procedural 3D 파이프라인 유지.
- Top view / Walk mode 두 모드 카메라 경험 보장.
- PBR + HDR + Post FX 시각 품질 기준 유지.
- 무거운 이미지 분석/기하/씬 생성 연산은 Vercel에서 실행하지 않음.
- Worker 후보 선택 전 wall/opening/scale 정규화로 노이즈를 줄인 뒤 스코어링한다.
- 상용화 기준 canonical truth는 `scene`이 아니라 `geometry revision`이다.
- 프로젝트는 항상 `source_layout_revision_id`에 pin된다.
- 상용 수준 3D 맵 생성은 renderer 교체보다 `geometry reconstruction -> scene derived artifacts -> frontend consumption` 순서로 고도화한다.
- 외부 부동산 서비스 이미지는 자동 수집/재배포하지 않고, 권리 보유 사용자 업로드 또는 허가된 source만 intake에 사용한다.

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
1. 사용자 업로드 또는 catalog 검색
2. Railway API가 `intake_sessions` 생성 및 resolution 수행
3. exact reuse면 `layout_revisions` 선택, 아니면 `floorplans/jobs` 생성
4. Railway Worker 처리 (multi-pass + provider scoring)
5. `floorplan_results` + `layout_revisions` 저장
6. 필요 시 `review_required` 후 project finalize
7. 프론트엔드가 revision/result 기준으로 2D/3D 렌더링

## 책임 경계
- `apps/web`:
  - 업로드/잡 생성 요청/잡 상태 폴링/결과 렌더링
  - Supabase 로그인 세션(access token) 획득
  - recoverable auth 오류(`Invalid Refresh Token` 등) 발생 시 브라우저 세션을 정리하고 재로그인을 유도
- `apps/api`:
  - 사용자 인증 검증(Supabase JWT)
  - intake/catalog/project/floorplan/job/result/asset-generation 도메인 API 제공
  - signed upload URL 발급
- `apps/worker`:
  - 도면 분석, geometry revision 생성, scene JSON 파생 생성
  - asset generation provider 호출 및 GLB 저장
  - 잡 상태 전이(queued/running/retrying/succeeded/failed/dead_letter)
  - intake 상태 전이(queued/analyzing/review_required/resolved_generated/failed)

## 핵심 API 기준 (Railway `/v1`)
- `POST /v1/projects`
- `GET /v1/projects`
- `POST /v1/assets/generate`
- `POST /v1/intake-sessions`
- `GET /v1/intake-sessions/:id`
- `POST /v1/intake-sessions/:id/upload-url`
- `POST /v1/intake-sessions/:id/resolve`
- `POST /v1/intake-sessions/:id/select-candidate`
- `POST /v1/intake-sessions/:id/review-complete`
- `POST /v1/intake-sessions/:id/finalize-project`
- `GET /v1/catalog/search`
- `GET /v1/jobs/:jobId`
- `POST /v1/jobs/:jobId/retry`
- `GET /v1/floorplans/:floorplanId/result`
- `GET /v1/projects/:projectId/scene/latest`

## 프론트엔드 API 기준
- `NEXT_PUBLIC_RAILWAY_API_URL` 기반으로 Railway API 호출.
- `Authorization: Bearer <supabase access token>` 헤더 전달.
- Next.js 내부 도메인/파싱 API(`/api/ai/parse-floorplan`, `/api/projects/*`, `/api/furnitures/*`, `/api/assets/generate`)는 사용하지 않는다.

## 데이터 테이블 기준
- `projects` (기존)
- `floorplans`
- `jobs`
- `floorplan_results`
- `intake_sessions`
- `housing_complexes`
- `layout_families`
- `layout_variants`
- `layout_revisions`
- `source_assets`
- `revision_source_links`
- `catalog_search_index`
- `floorplan_match_events`

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
- `docs/specs/db-schema-v4.md`
- `docs/specs/intake-job-state-machine-v4.md`
- `docs/specs/geometry-canonicalization-hash-v4.md`
- `docs/specs/typed-patch-promotion-withdrawal-v4.md`
- `docs/specs/3d-map-commercial-roadmap.md`

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

## 2026-03-11 변경 동기화 (Commercialization Foundation V4)
Added:
- `intake_session-first`, `layout_revisions` 단일 truth, `revision_source_links`, `review_required` 상태를 기준 아키텍처로 추가.
- geometry-first revision 모델과 spec 문서 4종(`db-schema`, `state-machine`, `geometry-hash`, `patch-policy`) 추가.

Updated:
- 데이터 흐름을 `upload/search -> intake resolution -> revision or job -> project finalize`로 상향 조정.
- API 책임을 project-first에서 intake/catalog/revision 기반으로 확장.

Removed/Deprecated:
- scene JSON을 canonical truth로 보는 해석.
- project 생성 이후에만 업로드를 시작하는 단일 intake 방식.

## 2026-03-12 변경 동기화 (Intake Web Cutover + Finalize Fix + Room Geometry)
Added:
- `apps/web`가 intake/catalog/finalize API를 직접 사용하는 intake-first 구현으로 전환.
- worker가 `layout_revisions.geometry_json.rooms`, `exteriorShell`, `roomAdjacency`와 `derived_scene_json.floors`를 저장.
- `finalize_intake_session` RPC의 exact-once finalize 경로와 reuse/generated resolution state 복원 보정.
- 원격 검증 기준으로 `apps/web/scripts/e2e-intake-flow.ts` 기반 실환경 E2E를 추가.

Updated:
- `/project/[id]`는 saved scene이 없어도 `source_layout_revision_id`를 읽어 editor state를 복원하도록 확장.
- floor/ceiling 렌더링은 exterior heuristic보다 revision-derived `floors[]`를 우선 사용하도록 변경.
- Supabase migration history는 `20260305`, `20260311`, `20260312120000` 체인으로 정리한다.

Removed/Deprecated:
- 새 프로젝트 생성 시 project-first draft를 먼저 만드는 흐름.
- walls-only scene payload에만 의존하는 floor/ceiling 렌더링.
- 더 이상 사용하지 않는 Next.js 내부 도메인 API(`/api/projects/*`, `/api/furnitures/*`, `/api/realtime`, `/api/ai/parse-floorplan`).

## 2026-03-12 변경 동기화 (Asset Generation Worker Migration)
Added:
- `POST /v1/assets/generate`와 `jobs.result` 기반 asset generation 비동기 계약.
- Railway worker가 TripoSR/Meshy 호출, GLB 저장, `assets` row 생성까지 담당하는 경계.

Updated:
- AssetPanel의 custom asset 생성 경로를 `Vercel route -> Railway API enqueue -> worker process -> /v1/jobs poll`로 전환.
- asset provider 키와 bucket 설정을 worker 전용 환경 변수로 이동.

Removed/Deprecated:
- Next.js `/api/assets/generate` 동기/폴링 혼합 처리 경로.

## 2026-03-13 변경 동기화 (Commercial 3D Map Derived Scene V2)
Added:
- worker가 `rooms`, `floors`, `ceilings`, `navGraph`, `cameraAnchors`를 geometry 기준으로 파생 생성하는 규칙.
- `docs/specs/3d-map-commercial-roadmap.md`를 3D 맵 상용화 기준 문서로 추가.

Updated:
- Walk mode 초기 진입점은 wall/door heuristic보다 revision-derived entrance anchor를 우선 사용.
- 한국 아파트형 컬러 채움 평면도 대응을 위해 worker multi-pass 전처리에 `filled_plan` 프로파일을 포함한다.

Removed/Deprecated:
- renderer 교체를 3D 맵 상용화의 주된 해결책으로 보는 접근.
- 외부 listing gallery URL을 서비스가 직접 크롤링해 catalog/benchmark source로 삼는 접근.
