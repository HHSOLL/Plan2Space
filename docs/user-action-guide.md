# User Action Guide

이 문서는 **코딩 에이전트가 할 수 없는 작업**을 사용자 관점에서 정리한 가이드입니다.

## 1) 환경 변수 준비
`apps/web/.env.local`에 아래 값을 준비합니다.
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

FLOORPLAN_PROVIDER_ORDER=anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-...
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

FLOORPLAN_PREPROCESS_DOWNSCALE=0.35
FLOORPLAN_PREPROCESS_CLAHE=3
FLOORPLAN_PREPROCESS_STRUCTURAL_BLUR=0.6
FLOORPLAN_MIN_WALL_THICKNESS=6
FLOORPLAN_ORPHAN_MAX_LENGTH=60
FLOORPLAN_CACHE_DHASH_THRESHOLD=0
FLOORPLAN_CACHE_SIZE_TOLERANCE_RATIO=0.02
FLOORPLAN_MIN_ACCEPT_SCORE=25
FLOORPLAN_EARLY_STOP_SCORE=80
FLOORPLAN_TEMPLATE_MAX_CANDIDATES=5
FLOORPLAN_TEMPLATE_MIN_CATALOG_SCORE=0.78
FLOORPLAN_TEMPLATE_MIN_IMAGE_SCORE=0.92
FLOORPLAN_TEMPLATE_SIZE_TOLERANCE_RATIO=0.02

SNAPTRUDE_API_URL=
SNAPTRUDE_API_KEY=

ASSET_STORAGE_BUCKET=assets-glb
TRIPOSR_API_URL=
TRIPOSR_API_KEY=
TRIPOSR_STATUS_URL=
```

## 2) 품질 검증용 도면 세트
인터넷에서 다운받은 도면(워터마크 포함/컬러 포함)을 최소 5~10장 준비합니다.
동일 이미지로 반복 테스트하여 전처리 튜닝 결과를 비교합니다.
- fixture를 `apps/web/fixtures/floorplans`에 두고 아래 하네스로 후보 점수 회귀를 기록합니다.
  - `npm --workspace apps/web run eval:floorplan -- --endpoint=http://127.0.0.1:3100/api/ai/parse-floorplan`
  - `npm --workspace apps/web run eval:floorplan:gate -- --input=$PWD/apps/web/.eval/floorplan/summary.json`

## 3) HDRI/텍스처 에셋 준비
- `/apps/web/public/assets/hdri/manifest.json`에 HDRI 목록 등록
- `/apps/web/public/assets/textures/manifest.json`에 텍스처 목록 등록
- 1K~2K 해상도 권장 (로딩과 품질 균형)

## 4) GLB 에셋 큐레이션
가구/조명/소품 GLB를 준비하고, 용량이 큰 파일은 Draco 압축을 권장합니다.

## 4-1) Floorplan Template Catalog 준비
- 템플릿 매칭을 사용하려면 `apps/web/public/assets/floorplan-templates/manifest.json`에 항목을 등록합니다.
- 각 항목 최소 필드:
  - `id`, `apartmentName`, `typeName`, `topologyPath`, `licenseStatus`, `version`
- `topologyPath`는 `public` 기준 상대 경로(`/assets/floorplan-templates/...`)를 사용합니다.
- `licenseStatus=blocked` 항목은 조회에서 제외됩니다.
- 이미지 기반 매칭을 쓰려면 `imageSha256`(권장) 또는 `imageHash`를 함께 기록합니다.

## 5) UX 검수 체크
- 2D 보정 단계에서 벽/문/창 위치가 수정 가능한가
- 2D 보정 단계에서 스케일 측정(두 점 클릭 → mm 입력)과 Auto door 스케일 보정이 가능한가
- 스케일 미보정(`source=unknown` 또는 `confidence<0.6`) 상태에서 Top/Walk 3D 진입이 차단되는가
- AI 실패(422 recoverable) 시 2D 편집기가 열리고 provider 에러 복사가 가능한가
- AI 실패(422 recoverable) 배너에 `Copy Errors`, `Try AI Again`, `Start Manual` 3개 액션이 보이는가
- Walk mode에서 벽 관통이 불가능한가
- Post FX/조명이 과하지 않고 안정적인가

## 6) 키 관리
API 키가 외부에 노출되지 않도록 공유 시에는 마스킹된 로그만 전달합니다.
