# AI Pipeline (Railway Worker)

이 문서는 도면 분석 파이프라인의 API 계약과 실패/복구 규약을 정의합니다.

## 1) 엔드포인트 계약
Base: Railway API `/v1`

1. 업로드 URL 발급
- `POST /v1/floorplans/upload-url`
- Request: `{ projectId, fileName, mimeType, size }`
- Response: `{ objectPath, signedUploadUrl, expiresAt }`

2. 도면 등록 + 잡 생성
- `POST /v1/projects/:projectId/floorplans`
- Request: `{ objectPath, originalFileName, mimeType, width?, height? }`
- Response: `{ floorplanId, jobId, floorplanStatus, jobStatus }`

3. 잡 상태 조회
- `GET /v1/jobs/:jobId`
- Response: `{ id, type, status, attempts, progress, errorCode?, error?, recoverable?, providerStatus?, providerErrors?, details? }`

4. 잡 재시도
- `POST /v1/jobs/:jobId/retry`

5. 분석 결과 조회
- `GET /v1/floorplans/:floorplanId/result`
- Response: `{ floorplanId, wallCoordinates, roomPolygons, scale, sceneJson, diagnostics }`

## 2) 파이프라인 단계
1. 프론트엔드가 이미지를 Supabase Storage에 업로드.
2. API가 `floorplans` + `jobs` 레코드 생성.
3. Worker가 `claim_jobs`로 잡 점유.
4. Worker가 이미지 다운로드 후 multi-pass 분석 실행.
5. Topology 정규화/검증/스코어링.
6. geometry(`wall_coordinates`, `room_polygons`) + `scene_json` 생성.
7. `floorplan_results` upsert.
8. `jobs`, `floorplans` 상태 업데이트.

## 3) Provider 정책
- 기본 순서: `anthropic,openai,snaptrude`
- worker에서 provider 구성 상태를 사전 판별.
- 미구성 provider는 호출하지 않고 `providerStatus[]`에 reason 기록.
- upload 분석은 항상 multi-pass(`balanced`, `lineart`) 후보를 누적 평가.
- 첫 성공 즉시 종료하지 않고 최고점 후보를 선택.

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

## 6) 디버깅 필드
`diagnostics` 및 job 응답을 통해 아래를 추적한다.
- provider 상태/오류
- 후보별 점수 및 선택 결과
- pass/profile 정보

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
