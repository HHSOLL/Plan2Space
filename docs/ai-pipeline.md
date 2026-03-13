# AI Pipeline (Railway Worker)

이 문서는 도면 분석 파이프라인의 API 계약과 실패/복구 규약을 정의합니다.

## 1) 엔드포인트 계약
Base: Railway API `/v1`

1. intake 세션 생성/해상도 결정
- `POST /v1/intake-sessions`
- `POST /v1/intake-sessions/:id/upload-url`
- `POST /v1/intake-sessions/:id/resolve`
- `POST /v1/intake-sessions/:id/select-candidate`
- `POST /v1/intake-sessions/:id/review-complete`
- `POST /v1/intake-sessions/:id/finalize-project`
- `GET /v1/catalog/search`

2. 잡 상태 조회
- `GET /v1/jobs/:jobId`
- Response: `{ id, type, status, attempts, progress, errorCode?, error?, recoverable?, providerStatus?, providerErrors?, details? }`

3. 잡 재시도
- `POST /v1/jobs/:jobId/retry`

4. 분석 결과 조회
- `GET /v1/floorplans/:floorplanId/result`
- Response: `{ floorplanId, wallCoordinates, roomPolygons, scale, sceneJson, diagnostics }`

## 2) 파이프라인 단계
1. 프론트엔드가 업로드 또는 catalog 검색으로 `intake_session` 생성.
2. API가 exact reuse 또는 catalog match를 먼저 시도.
3. reuse가 없으면 `floorplans` + `jobs` 레코드 생성.
4. Worker가 `claim_jobs`로 잡 점유.
5. Worker가 이미지 다운로드 후 multi-pass 분석 실행.
6. Topology 정규화/검증/스코어링.
7. geometry revision(`layout_revisions`) + derived `scene_json` 생성.
8. `floorplan_results` upsert.
9. `jobs`, `floorplans`, `intake_sessions` 상태 업데이트.

정규화 규칙:
- wall: axis 정렬 스냅 -> 중복 제거 -> 짧은 noise wall 제거 -> axis-aligned segment 병합
- opening: wall 중심점이 아니라 wall 선분에 투영해 재부착
- opening: low-confidence / far-from-wall 후보 제거, 같은 wall 내 중첩 opening 정리
- scale: `unknown` 이어도 evidence completeness가 높으면 `ocr_dimension`으로 승격

geometry-first 규칙:
- canonical truth는 `layout_revisions.geometry_json`
- `derived_scene_json`, `derived_nav_json`, `derived_camera_json`는 파생 산출물
- `topology_hash`, `room_graph_hash`, `geometry_hash`를 함께 저장

## 3) Provider 정책
- 기본 순서: `anthropic,openai,snaptrude`
- worker에서 provider 구성 상태를 사전 판별.
- 미구성 provider는 호출하지 않고 `providerStatus[]`에 reason 기록.
- upload 분석은 항상 multi-pass(`balanced`, `lineart`) 후보를 누적 평가.
- 첫 성공 즉시 종료하지 않고 최고점 후보를 선택.
- 후보 선택 시 wall count만 보지 않고 axis alignment, orphan/self-intersection, opening overlap, scale evidence completeness까지 반영.

주요 env:
- `FLOORPLAN_PROVIDER_ORDER`
- `FLOORPLAN_PROVIDER_TIMEOUT_MS`
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SNAPTRUDE_API_URL`, `SNAPTRUDE_API_KEY`
- 전처리 관련 `FLOORPLAN_PREPROCESS_*`

## 4) 실패/복구 계약
Recoverable failure는 `422` + 아래 필드를 유지한다.
- `recoverable: true`
- `errorCode`
- `details`
- `providerStatus[]`
- `providerErrors[]`

대표 코드:
- `PROVIDER_NOT_CONFIGURED`
- `TOPOLOGY_EXTRACTION_FAILED`
- `JOB_TIMEOUT`

클라이언트는 recoverable 실패 시 2D 수동 보정 흐름으로 전환한다.

## 5) 잡 상태 전이
- `queued -> running -> succeeded`
- 실패 시:
  - retry 가능: `retrying` (backoff 후 재실행)
  - 복구 실패: `failed`
  - 재시도 한도 초과: `dead_letter`

기본 재시도 정책:
- `max_attempts = 3`
- backoff: `min(2^attempt * 5s, 15m)`

## 5-1) intake 상태 전이
- `created -> uploading -> resolving`
- resolution 결과:
  - `resolved_reuse`
  - `disambiguation_required`
  - `queued`
  - `failed`
- generated 결과:
  - `queued -> analyzing -> review_required | resolved_generated | failed`
- finalize:
  - `resolved_reuse | resolved_generated -> finalizing -> project pinned`

## 6) 디버깅 필드
`diagnostics` 및 job 응답을 통해 아래를 추적한다.
- provider 상태/오류
- 후보별 점수 및 선택 결과
- pass/profile 정보
- 후보별 구조 품질 메트릭:
  - `axisAlignedRatio`
  - `orphanWallCount`
  - `selfIntersectionCount`
  - `openingOverlapCount`
  - `openingOutOfWallRangeCount`
  - `exteriorLoopClosed`
  - `scaleEvidenceCompleteness`

## 7) Deprecated
- Next.js `/api/ai/parse-floorplan` 직접 분석 경로는 폐기(410 반환).

## 8) 2026-03-05 변경 동기화 (Railway Immediate Cutover)
Added:
- Railway API + Worker 중심 비동기 잡 파이프라인 계약.
- `providerStatus[]`, `providerErrors[]` 기반 진단 규약.

Updated:
- 분석 실행 위치를 worker로 이동하고 multi-pass를 worker 표준으로 고정.

Removed/Deprecated:
- Vercel 런타임에서 provider 호출/기하 생성 수행.

## 9) 2026-03-11 변경 동기화 (Normalization Accuracy Pass)
Added:
- deterministic wall/opening cleanup 및 선분 기반 opening reattachment 규칙.
- 후보 디버그 메트릭에 구조 품질/scale evidence completeness 추가.

Updated:
- multi-pass 후보 선택을 단순 wall/opening count에서 구조 품질 중심 스코어링으로 강화.
- `unknown` scale의 승격 기준을 evidence completeness 기반으로 강화.

Removed/Deprecated:
- 중심점 nearest-wall 방식의 opening 부착.

## 10) 2026-03-11 변경 동기화 (Commercialization Foundation V4)
Added:
- `intake_sessions`, `layout_revisions`, `revision_source_links`, `floorplan_match_events` 기반 계약.
- generated 결과를 `private_generated` revision으로 저장하고 intake 상태를 `review_required/resolved_generated`로 전이하는 규약.

Updated:
- 파이프라인 canonical truth를 `scene_json`이 아니라 geometry revision으로 재정의.
- `sha256 exact -> catalog exact -> queued` 순서의 precision-first resolution 규칙을 추가.

Removed/Deprecated:
- project-first 업로드만을 전제로 한 단일 분석 시작 계약.

## 11) 2026-03-12 변경 동기화 (Intake Runtime + Geometry Revision Enrichment)
Added:
- web client가 `POST /v1/intake-sessions`, `.../resolve`, `.../select-candidate`, `.../review-complete`, `.../finalize-project`, `GET /v1/catalog/search`를 실제 업로드/검색 진입점으로 사용.
- worker geometry 단계에서 `exteriorShell`, `roomPolygons`, `roomAdjacency`를 복원하고 `derived_scene_json.floors`를 생성.
- finalize RPC가 `resolution_payload`를 참조해 `reused/generated` 상태를 정확히 복원하는 규약.

Updated:
- revision 조회 결과를 프론트 editor/viewer가 직접 scene state로 매핑하도록 계약을 확장.
- recoverable/generated 결과의 후속 상태를 `review_required -> review-complete -> resolved_generated -> finalize`로 명확히 정리.

Removed/Deprecated:
- finalize 직전 `finalizing` 상태만 보고 resolution state를 추론하는 단순 규칙.

## 12) 2026-03-12 변경 동기화 (Cleanup + E2E)
Added:
- `apps/web/scripts/e2e-intake-flow.ts` 기반 실환경 Railway/Supabase intake E2E 계약.
- CI optional `intake-e2e` job과 secret-gated 실행 규칙.

Updated:
- 업로드 진입점 문서를 intake 세션 기준으로 단순화하고, legacy project-first upload endpoint를 기본 계약에서 제외.
- migration history 기준 문서를 `20260305`, `20260311`, `20260312120000` 체인으로 정정.

Removed/Deprecated:
- 정적 template/cache 기반 floorplan reuse 실험 코드 경로.
