# Asset Guide (TripoSR + GLB 저장)

Plan2Space는 이미지 → GLB 생성 요청을 `/api/assets/generate`로 처리합니다.
TripoSR 또는 Meshy 중 설정된 Provider를 사용하고, 결과 GLB를 Supabase Storage에 저장합니다.

## 환경 변수

`apps/web/.env.local`

```
ASSET_STORAGE_BUCKET=assets-glb
TRIPOSR_API_URL=
TRIPOSR_API_KEY=
TRIPOSR_STATUS_URL=

# 선택: Meshy fallback
MESHY_API_URL=
MESHY_API_KEY=
MESHY_STATUS_URL=
```

## API 사용

`POST /api/assets/generate`

```json
{
  "image": "data:image/png;base64,...",
  "fileName": "chair-01",
  "provider": "triposr"
}
```

응답 예시:

- 완료 즉시 반환
```json
{
  "status": "complete",
  "asset": {
    "assetId": "...",
    "assetUrl": "https://.../assets-glb/...",
    "label": "chair-01"
  }
}
```

- 비동기 처리
```json
{
  "status": "processing",
  "jobId": "triposr:...",
  "provider": "triposr"
}
```

## 저장 위치

- Storage Bucket: `assets-glb` (기본값)
- DB Table: `assets`
  - `glb_path`에 저장 경로 기록
  - `meta`에 Provider/스키마 정보 기록

## 최적화 (Draco)

대용량 GLB는 로딩 지연이 크므로 Draco 압축을 권장합니다.

```bash
npm run assets:download
npm run assets:draco
```
