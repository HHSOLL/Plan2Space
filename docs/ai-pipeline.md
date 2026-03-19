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
   - 외부 부동산 서비스 이미지는 URL 자동 fetch가 아니라 권리 보유 사용자의 파일 업로드만 intake 입력으로 받는다.
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
- scale: `scaleInfo.evidence.mmValue/pxDistance`가 있으면 raw `value`보다 evidence 재계산값을 canonical 값으로 우선한다.
- scale: provider raw `value`가 evidence와 크게 모순되면 evidence 재계산값으로 교정해 `metersPerPixel` 계약을 유지한다.

geometry-first 규칙:
- canonical truth는 `layout_revisions.geometry_json`
- `derived_scene_json`, `derived_nav_json`, `derived_camera_json`는 파생 산출물
- `topology_hash`, `room_graph_hash`, `geometry_hash`를 함께 저장
- worker는 derived scene에 최소 `rooms`, `floors`, `ceilings`, `navGraph`, `cameraAnchors`를 포함한다.
- provider 출력은 선택적으로 `semanticAnnotations.roomHints`, `semanticAnnotations.dimensionAnnotations`를 포함할 수 있으며, worker는 이를 room reconstruction/scale 보정 priors로 사용한다.

## 3) Provider 정책
- 기본 순서: `anthropic,openai,snaptrude`
- worker에서 provider 구성 상태를 사전 판별.
- 미구성 provider는 호출하지 않고 `providerStatus[]`에 reason 기록.
- upload 분석은 항상 multi-pass(`balanced`, `lineart`, `filled_plan`) 후보를 누적 평가.
- 첫 성공 즉시 종료하지 않고 최고점 후보를 선택.
- 후보 선택 시 wall count만 보지 않고 axis alignment, orphan/self-intersection, opening overlap, scale evidence completeness까지 반영.
- `filled_plan` 프로파일은 네이버부동산형 컬러 채움/텍스처 평면도 같은 한국 아파트 gallery 입력을 위한 기본 상용 패스다.
- room label과 dimension OCR은 PaddleOCR(`korean_PP-OCRv5_mobile_rec`) 외부 lane을 우선 허용하고, 그 결과를 `semanticAnnotations.roomHints/dimensionAnnotations`로 merge한다.
- 외부 구조 파서 후보는 Roboflow CubiCasa2/3, HF Dedicated Endpoint를 optional candidate로 추가할 수 있다.

정확도 상용화 규칙:
- blind eval은 Railway intake/job/result 실경로를 사용한다.
- fixture manifest는 `channel`, `sourcePolicy` 외에 `qualityTags`, `complexityTier`, `gold.*`를 포함한다.
- blind set은 기본 100장 기준이며 `korean_complex >= 20%`를 유지한다.
- review gate는 `selectedScore` 단독이 아니라 `conflictScore`, `dimensionConflict`, `scaleConflict`를 함께 본다.
- `conflictScore = 0.4 * dimension_conflict + 0.25 * scale_conflict + 0.2 * room_hint_conflict + 0.15 * opening_topology_conflict`
- `conflictScore > 0.3`, `dimension_conflict > 0.35`, `scale_conflict > 0.35`면 `review_required`.

주요 env:
- `FLOORPLAN_PROVIDER_ORDER`
- `FLOORPLAN_PROVIDER_TIMEOUT_MS`
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SNAPTRUDE_API_URL`, `SNAPTRUDE_API_KEY`
- 전처리 관련 `FLOORPLAN_PREPROCESS_*`
- benchmark fixture source policy는 `partner_licensed`, `user_opt_in`, `manual_private`만 허용한다.

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
- `dimensionConflict`
- `scaleConflict`
- `conflictScore`
- `reviewReasons[]`

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

## 13) 2026-03-13 변경 동기화 (Commercial Scene V2 Derivation)
Added:
- worker geometry 단계에서 room taxonomy, estimated ceiling height, connected room IDs를 revision에 저장하는 규약.
- derived artifact로 `ceilings[]`, `navGraph`, `cameraAnchors`를 생성하는 scene v2 기준.

Updated:
- frontend는 revision/result를 읽을 때 scene v2 정보를 버리지 않고 store에 보존해야 한다.
- 한국 아파트형 입력 채널 대응을 위해 `filled_plan` 전처리 프로파일을 기본 multi-pass에 추가한다.

Removed/Deprecated:
- `rooms/floors`만 만들고 ceiling/nav/camera는 프론트에서 전부 추론하는 접근.
- 외부 listing gallery 이미지를 worker가 URL로 직접 수집하는 intake 방식.

## 14) 2026-03-13 변경 동기화 (Semantic Room Hints + OCR Dimension)
Added:
- provider JSON 스키마에 `roomHints[]`, `dimensionAnnotations[]` 선택 필드를 추가.
- `normalizeTopology`가 한글 room label을 `living_room`, `kitchen`, `balcony`, `utility` 등 taxonomy로 정규화하는 규칙.

Updated:
- `normalizeScaleInfo`는 raw `scaleInfo`가 약하거나 누락돼도 dimension annotation 기반으로 `ocr_dimension` scale을 재구성한다.
- room reconstruction은 wall loop가 부족할 때 semantic room hint polygon을 fallback base room으로 사용할 수 있다.

Removed/Deprecated:
- `scaleInfo`만 존재하면 충분하다고 보는 단일 scale 추정 경로.

## 15) 2026-03-19 변경 동기화 (Scale Evidence Canonicalization)
Added:
- `scaleInfo.evidence(mmValue, pxDistance, p1/p2)` 기반 canonical scale 재계산 규칙.

Updated:
- provider가 `ocr_dimension`을 반환해도 raw `value`가 evidence와 모순되면 worker가 evidence 기준 `metersPerPixel`로 교정한다.

Removed/Deprecated:
- evidence가 있어도 provider raw `scaleInfo.value`를 그대로 신뢰하는 처리.

## 16) 2026-03-19 변경 동기화 (Accuracy Commercialization V2)
Added:
- PaddleOCR, Roboflow CubiCasa, HF Dedicated Endpoint optional lane.
- conflict-based review gate와 blind-set commercialization metrics(`roomTypeF1`, `dimensionValueAccuracy`, `scaleAgreement`, `reviewRate`).

Updated:
- semantic/dimension annotation은 selection과 review gating의 1급 신호로 승격.
- eval harness는 deprecated Next parse endpoint가 아니라 Railway intake/job/result 흐름을 사용한다.

Removed/Deprecated:
- vision provider structured output만으로 room/dimension OCR을 끝내는 단일 경로.
