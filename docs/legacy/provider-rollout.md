# Provider Rollout Contract

이 문서는 worker external lane이 기대하는 최소 request/response shape를 정리합니다.

## 1) Common rule
- worker는 endpoint를 직접 vendor SDK로 호출하지 않고 `HTTP JSON wrapper`를 기대한다.
- env가 없으면 해당 lane은 `skipped`로 기록되고 호출되지 않는다.
- raw PDF는 현재 지원하지 않는다. PDF 계열 입력은 PNG/JPEG로 rasterize한 뒤 `channel=pdf_export`로 운영한다.

## 2) PaddleOCR wrapper
env:
- `PADDLEOCR_API_URL`
- `PADDLEOCR_API_TOKEN` optional
- `PADDLEOCR_DET_MODEL`
- `PADDLEOCR_REC_MODEL`

request:
```json
{
  "image": "data:image/png;base64,...",
  "mimeType": "image/png",
  "detectorModel": "PP-OCRv5_det",
  "recognitionModel": "korean_PP-OCRv5_mobile_rec"
}
```

accepted response shapes:
- direct array of OCR items
- object with `rec_texts[]`, `rec_scores[]`, `dt_polys[]`
- object with `data[]`, `result[]`, `results[]`, `ocr_results[]`, `items[]`, `predictions[]`

minimum OCR item shape:
```json
{
  "text": "거실",
  "confidence": 0.98,
  "polygon": [[20, 20], [60, 20], [60, 40], [20, 40]]
}
```

## 3) Roboflow CubiCasa wrapper
env:
- `ROBOFLOW_CUBICASA2_URL`
- `ROBOFLOW_CUBICASA3_URL`
- `ROBOFLOW_API_KEY` optional

request:
```json
{
  "image": "data:image/png;base64,...",
  "mimeType": "image/png",
  "model": "roboflow_cubicasa2",
  "format": "json"
}
```

accepted response shapes:
- object with `topology`
- object with `result`
- generic `predictions[]` payload containing wall/opening/room labels

preferred topology payload:
```json
{
  "topology": {
    "scale": 0.02,
    "scaleInfo": {
      "value": 0.02,
      "source": "ocr_dimension",
      "confidence": 0.9
    },
    "walls": [],
    "openings": [],
    "semanticAnnotations": {
      "roomHints": [],
      "dimensionAnnotations": []
    }
  }
}
```

## 4) HF Dedicated Endpoint wrapper
env:
- `HF_FLOORPLAN_ENDPOINT_URL`
- `HF_FLOORPLAN_ENDPOINT_TOKEN` optional

request:
```json
{
  "image": "data:image/png;base64,...",
  "mimeType": "image/png",
  "prompt": "Analyze this architectural floorplan image and return strict JSON only..."
}
```

accepted response shapes:
- object with `topology`
- object with `walls/openings`
- object with `generated_text`, `output_text`, or `text` containing JSON
- object with `choices[].message.content` containing JSON

## 5) Operational sequence
1. worker env 작성
2. `npm --workspace apps/worker run provider:floorplan:check`
3. strict commercialization 전 `npm --workspace apps/worker run provider:floorplan:check -- --strictCommercialization=1`
4. fixture 작성
5. `npm --workspace apps/web run legacy:fixtures:floorplan:validate`
6. `npm --workspace apps/web run legacy:fixtures:floorplan:blind-gate`
7. `npm --workspace apps/web run legacy:eval:floorplan`
8. `npm --workspace apps/web run legacy:eval:floorplan:gate`
