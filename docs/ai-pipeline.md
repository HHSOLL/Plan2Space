# AI Pipeline (Floorplan → Topology)

이 문서는 도면 이미지에서 **Topology(JSON)** 를 생성하는 AI 파이프라인 계약과 디버깅 기준을 정의합니다.

## 1) API 계약
엔드포인트: `POST /api/ai/parse-floorplan`

요청 바디:
```json
{
  "mode": "upload",
  "base64": "data:image/png;base64,...",
  "mimeType": "image/png",
  "skipCache": false,
  "forceProvider": "anthropic",
  "debug": true
}
```

카탈로그 요청 바디:
```json
{
  "mode": "catalog",
  "catalogQuery": {
    "apartmentName": "OO아파트",
    "typeName": "84A",
    "region": "서울"
  },
  "debug": true
}
```

응답(예시):
```json
{
  "metadata": {
    "imageWidth": 1200,
    "imageHeight": 900,
    "scale": 0.0024,
    "scaleInfo": {
      "value": 0.0024,
      "source": "ocr_dimension",
      "confidence": 0.82,
      "evidence": {
        "mmValue": 12530,
        "pxDistance": 5213,
        "ocrText": "12530"
      }
    },
    "unit": "pixels",
    "confidence": 0.72,
    "analysisCompleteness": {
      "totalWallSegments": 38,
      "exteriorWalls": 12,
      "interiorWalls": 26,
      "totalOpenings": 14,
      "doors": 9,
      "windows": 5,
      "balconies": 0,
      "columns": 0
    }
  },
  "walls": [
    { "id": "w1", "start": [10, 20], "end": [200, 20], "thickness": 12, "type": "exterior", "length": 190, "isPartOfBalcony": false, "confidence": 0.91 }
  ],
  "openings": [
    { "id": "o1", "wallId": "w1", "type": "door", "position": [60, 20], "width": 90, "offset": 50, "detectConfidence": 0.88, "attachConfidence": 0.93, "typeConfidence": 0.86 }
  ],
  "source": "anthropic",
  "cacheHit": false,
  "selection": {
    "sourceModule": "cv",
    "selectedScore": 74.2,
    "selectedPassId": "pass1",
    "preprocessProfile": "balanced"
  },
  "providerStatus": [
    { "provider": "anthropic", "configured": true, "status": "enabled", "reason": null },
    { "provider": "openai", "configured": true, "status": "enabled", "reason": null },
    { "provider": "snaptrude", "configured": false, "status": "skipped", "reason": "SNAPTRUDE_API_URL is missing." }
  ],
  "providerErrors": [],
  "selectedScore": 74.2
}
```

요청 모드:
- `mode="upload"`: `base64` 필수, 일반 도면 분석 플로우.
- `mode="catalog"`: `catalogQuery` 필수, 템플릿 조회 플로우.
  - 템플릿 manifest(`public/assets/floorplan-templates/manifest.json`)를 조회해 text score로 후보를 선택합니다.
  - 최고점이 임계치 미달이면 `422 + recoverable + errorCode=TEMPLATE_LOW_CONF`.
  - 후보가 없으면 `422 + recoverable + errorCode=TEMPLATE_NOT_FOUND`.

## 2) 전처리 (watermark/컬러 억제)
`sharp` 기반 전처리로 색상 채움/워터마크 영향을 줄입니다.
upload 모드에서는 **항상 다중 패스**를 실행합니다.
- `pass1=balanced` (기본)
- `pass2=lineart` (얇은 치수선/워터마크 억제 강화)
기본 순서:
- grayscale → normalize
- background suppression (blur + difference)
- median/blur
- contrast/brightness
- threshold

Provider에는 다음 3장을 함께 전달합니다.
1) 원본(텍스트/치수 컨텍스트)
2) 고대비 처리(벽 잉크 강조)
3) 구조 단순화 이미지(다운스케일+블러로 얇은 치수선 억제)

튜닝 환경 변수:
```
FLOORPLAN_PREPROCESS_THRESHOLD=200
FLOORPLAN_PREPROCESS_MEDIAN=3
FLOORPLAN_PREPROCESS_BLUR=0.3
FLOORPLAN_PREPROCESS_BG_BLUR=12
FLOORPLAN_PREPROCESS_CONTRAST=1.25
FLOORPLAN_PREPROCESS_BRIGHTNESS=-15
FLOORPLAN_PREPROCESS_DOWNSCALE=0.35
FLOORPLAN_PREPROCESS_CLAHE=3
FLOORPLAN_PREPROCESS_STRUCTURAL_BLUR=0.6

FLOORPLAN_PREPROCESS_LINEART_THRESHOLD=218
FLOORPLAN_PREPROCESS_LINEART_MEDIAN=2
FLOORPLAN_PREPROCESS_LINEART_BLUR=0.15
FLOORPLAN_PREPROCESS_LINEART_BG_BLUR=8
FLOORPLAN_PREPROCESS_LINEART_CONTRAST=1.45
FLOORPLAN_PREPROCESS_LINEART_BRIGHTNESS=-20
FLOORPLAN_PREPROCESS_LINEART_DOWNSCALE=0.5
FLOORPLAN_PREPROCESS_LINEART_CLAHE=5
FLOORPLAN_PREPROCESS_LINEART_STRUCTURAL_BLUR=1
```

## 3) Provider 순서 및 환경 변수
기본 순서: `anthropic,openai,snaptrude`

필수/옵션:
```
FLOORPLAN_PROVIDER_ORDER=
FLOORPLAN_PROVIDER_TIMEOUT_MS=45000
FLOORPLAN_CACHE_BUCKET=floorplan-cache

SNAPTRUDE_API_URL=
SNAPTRUDE_API_KEY=

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-... (comma-separated)

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Anthropic은 Tool Output을 우선 사용하고, 불가능하면 JSON 텍스트로 폴백합니다.

Provider 선택 규칙:
- upload 모드에서는 provider 호출 전에 image hash 기반 template retrieval을 먼저 시도합니다.
  - image exact/hash exact 후보가 임계치를 넘으면 template 후보를 scoring pool에 추가합니다.
- provider 호출 전 구성 상태를 사전 판별합니다.
  - misconfig provider는 호출하지 않고 `providerStatus[]`에 `skipped + reason`을 기록합니다.
- 사용 가능한 provider가 없으면 `422 + errorCode=PROVIDER_NOT_CONFIGURED + recoverable=true`.
- 첫 성공에서 종료하지 않고 provider 후보를 누적 평가합니다.
- provider(anthropic/openai)는 pass1/pass2를 모두 실행해 후보를 누적 평가합니다.
- 각 후보에 대해 동일한 `normalize -> refine -> validate`를 수행합니다.
- 점수는 `topologyScore + openingScore + scaleScore - penalty`로 계산합니다.
- 기하/스케일 지표를 함께 사용합니다:
  - wall/opening 개수, 축 정렬 비율, 고립벽, self-intersection
  - opening 부착률, opening overlap, opening 벽 범위 위반
  - wall thickness 이상치 비율, exterior loop penalty, exterior area sanity
  - scale source/confidence/evidence completeness
- `FLOORPLAN_MIN_ACCEPT_SCORE` 미만이면 `422`로 실패 처리.
- `FLOORPLAN_EARLY_STOP_SCORE` 이상이면 비용 절감을 위해 조기 종료 가능.

## 4) 정규화 및 스키마 검증
정규화 단계에서 다양한 응답 포맷을 흡수합니다.
- 좌표 포맷: `[x,y]` 외 `{x,y}`, `x1/y1/x2/y2` 지원
- 키 alias: `start/end`, `from/to`, `wall_id` 등
- `walls`가 없으면 `wallSegments/lines/segments`로 탐색
- `openings`가 없으면 `doors/windows` 배열 병합
- `topology/result/data` 등 중첩 응답 자동 언랩
- `balconies/rooms/columns`는 스키마 통과 항목만 유지

스키마 검증 실패 시 `providerErrors`에 상세 원인을 기록합니다.

## 5) Topology 보정(Refine)
정규화 후 보정 단계에서 구조를 안정화합니다.
- 좌표 스냅 (그리드 클러스터)
- 수평/수직 정렬
- 콜리니어 벽 병합
- 개구부 벽 재부착 및 오프셋 재계산

튜닝 환경 변수:
```
FLOORPLAN_SNAP_TOLERANCE=4
FLOORPLAN_MERGE_GAP_TOLERANCE=6
FLOORPLAN_MERGE_ALIGN_TOLERANCE=2
FLOORPLAN_OPENING_ATTACH_DISTANCE=20
FLOORPLAN_OPENING_MIN_CONFIDENCE=0.45
FLOORPLAN_MIN_ACCEPT_SCORE=25
FLOORPLAN_EARLY_STOP_SCORE=80
```

## 6) 검증/정제
- 얇은 선(치수선) 제거를 위한 최소 두께 필터.
- 짧은 고립 세그먼트(Orphan wall) 제거.
- 외벽 타입이 없으면 외곽 경계 기반으로 자동 분류.
- 입구가 없을 때 외벽 문 중 최적 후보를 자동 지정.
- 저신뢰 opening(`detect/attach/type` 최소 confidence) 필터링.
- `metadata.scaleInfo`를 항상 포함합니다.
  - `source`: `ocr_dimension | door_heuristic | user_measure | unknown`
  - `confidence`: `0..1`
  - `evidence`: mm/px 구간, OCR 텍스트/박스, 메모 등
- `source=unknown`이어도 evidence(mm/px + OCR 또는 p1/p2)가 충분하면 `ocr_dimension`으로 승격합니다.

## 7) 캐시
이미지 해시 기반 캐시를 우선 사용합니다.
- 로컬 캐시 + Supabase Storage 캐시
- SHA-256 exact hit 시 즉시 Topology 반환
- dHash near-match는 기본 비활성(`FLOORPLAN_CACHE_DHASH_THRESHOLD=0`)
- near-match를 켜는 경우 이미지 크기 유사도 2차 검증을 통과해야 함
- 캐시에는 선택된 후보의 `provider/score/metrics` 요약을 함께 저장

추가 환경 변수:
```
FLOORPLAN_CACHE_DHASH_THRESHOLD=0
FLOORPLAN_CACHE_SIZE_TOLERANCE_RATIO=0.02
FLOORPLAN_TEMPLATE_MAX_CANDIDATES=5
FLOORPLAN_TEMPLATE_MIN_CATALOG_SCORE=0.78
FLOORPLAN_TEMPLATE_MIN_IMAGE_SCORE=0.92
FLOORPLAN_TEMPLATE_SIZE_TOLERANCE_RATIO=0.02
```

## 8) 실패 시 폴백
모든 provider 실패 시 `HTTP 422`로 실패를 명시적으로 반환합니다.
- `errorCode=TOPOLOGY_EXTRACTION_FAILED`
- provider가 하나도 구성되지 않은 경우 `errorCode=PROVIDER_NOT_CONFIGURED`
- `recoverable=true`를 포함해 클라이언트가 2D 수동 보정 플로우로 전환 가능
- 실패를 성공(200)처럼 위장하지 않습니다.

## 9) 디버깅
`debug=true` 또는 개발 모드에서는 아래를 포함합니다.
- `providerErrors`, `providerOrder`, `providerStatus[]`
- `candidates[]`: provider별 `passId`, `preprocessProfile`, `score`, `scoreBreakdown`, `metrics`, `errors`, `timingMs`
- `selectedProvider`, `selectedPassId`, `selectedPreprocessProfile`, `selectedScore`
- `templateCandidates[]`: template retrieval 후보와 match score
- `scaleCandidates[]`: scale 선택 후보와 evidence 기반 score

이 정보로 “왜 해당 provider가 선택됐는지”를 재현 가능하게 추적합니다.

## 10) Recoverable UX 계약
- `422 + recoverable=true` 응답 시 클라이언트는 2D 편집으로 유지합니다.
- 복구 배너에는 3개 고정 액션을 노출합니다.
  - `Copy Errors`
  - `Try AI Again`
  - `Start Manual`

## 11) 2026-03-05 변경 동기화
Added:
- `providerStatus[]` 응답 계약.
- multi-pass 전처리(`balanced`, `lineart`) 및 pass 메타(`passId`, `preprocessProfile`).
- `PROVIDER_NOT_CONFIGURED` 오류 코드.

Updated:
- 기본 provider 순서 `anthropic,openai,snaptrude`.
- scale source 승격 규칙(`unknown` + strong evidence → `ocr_dimension`).
- 저신뢰 opening 필터(`FLOORPLAN_OPENING_MIN_CONFIDENCE`).

Removed/Deprecated:
- 단일 전처리 pass 가정.
- snaptrude 우선 기본 순서 가정.
