# Asset Guide (Railway Worker Asset Generation)

Plan2Space는 이미지 → GLB 생성을 Railway API/Worker 경로로 처리합니다.
웹은 `/v1/assets/generate`로 job을 enqueue하고, Railway worker가 TripoSR 또는 Meshy를 호출한 뒤 결과 GLB를 Supabase Storage에 저장합니다.

## 환경 변수

`apps/worker`

```
ASSET_STORAGE_BUCKET=assets-glb
ASSET_GENERATION_POLL_INTERVAL_MS=2000
ASSET_GENERATION_MAX_POLLS=45
TRIPOSR_API_URL=
TRIPOSR_API_KEY=
TRIPOSR_STATUS_URL=

# 선택: Meshy fallback
MESHY_API_URL=
MESHY_API_KEY=
MESHY_STATUS_URL=
```

## API 사용

`POST /v1/assets/generate`

```json
{
  "image": "data:image/png;base64,...",
  "fileName": "chair-01",
  "provider": "triposr"
}
```

응답 예시:

```json
{
  "jobId": "uuid",
  "status": "queued"
}
```

완료 결과는 `GET /v1/jobs/:jobId`의 `result.asset`에서 조회합니다.

```json
{
  "id": "uuid",
  "type": "ASSET_GENERATION",
  "status": "succeeded",
  "result": {
    "asset": {
      "assetId": "...",
      "assetUrl": "https://.../assets-glb/...",
      "label": "chair-01",
      "description": "Generated via triposr",
      "category": "Custom"
    }
  }
}
```

실패 시:

```json
{
  "id": "uuid",
  "type": "ASSET_GENERATION",
  "status": "failed",
  "errorCode": "PROVIDER_NOT_CONFIGURED",
  "error": "No asset generation provider configured."
}
```

## 저장 위치

- Storage Bucket: `assets-glb` (기본값)
- DB Table: `assets`
  - `glb_path`에 저장 경로 기록
  - `meta`에 Provider/스키마 정보 기록

## 최적화 (Draco)

대용량 GLB는 로딩 지연이 크므로 worker가 생성한 자산도 후속 Draco 압축 파이프라인을 추가하는 것이 좋습니다. 현재 v1 구현은 provider 결과 GLB를 그대로 저장합니다.
