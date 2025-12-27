# 3D 시뮬레이션(설계도→3D) 스펙 — plan2space

문서 목적: 입력(도면/2D 편집)부터 3D 산출(GLB)·자재/가구 적용·렌더까지의 파이프라인과 “자동 + 보정 UX” 기준을 정의한다.

---

## 1) 지원 입력

### 1.1 이미지/PDF(기본)
- 포맷: JPG/PNG/PDF
- 필수: **스케일/치수 1개 이상**(예: 문 폭 900mm, 벽 길이 3.2m)
- 처리: PDF는 이미지로 변환 후 인식/트레이싱 보정 단계로 진입

### 1.2 2D 평면도 에디터(기본)
- 벽/방/문/창을 직접 배치하고 치수 입력
- 스냅(직각/평행), 치수 표시, undo/redo 지원

### 1.3 DXF/IFC(고급)
- DXF: 레이어/단위/스케일 해석 + 2D 중간표현으로 변환
- IFC: 공간/벽/문/창 파싱 + 단위 표준화, 필요 시 2D 추출 후 보정

---

## 2) 중간표현(IR) — `Plan2D` (권장 JSON)

목표: 입력 종류가 달라도 동일한 구조로 3D 생성이 가능하도록 표준화.

### 2.1 예시 스키마(개략)
```json
{
  "unit": "m",
  "scale": 1,
  "params": { "wallHeight": 2.4, "wallThickness": 0.1, "ceilingHeight": 2.4 },
  "vertices": [{ "id": "v1", "x": 0, "y": 0 }],
  "walls": [{ "id": "w1", "a": "v1", "b": "v2", "thickness": 0.1 }],
  "openings": [{
    "id": "o1",
    "wallId": "w1",
    "type": "door",
    "offset": 1.2,
    "width": 0.9,
    "height": 2.1,
    "swing": "left"
  }],
  "rooms": [{ "id": "r1", "polygon": ["v1","v2","v3"], "name": "거실" }]
}
```

### 2.2 검증 규칙(최소)
- 모든 room polygon은 닫혀 있어야 함
- 벽 두께/높이/문폭/창높이의 하한/상한 검증
- self-intersection/중복 벽/길이 0 벽 금지

### 2.3 제약/잠금(철거 불가) 모델
- 구조 편집을 위해 `Plan2D` 요소(벽/오프닝/룸)는 아래 속성을 가질 수 있음
  - `editable`: 편집 가능 여부(기본 true)
  - `demolishable`: 이동/삭제 가능 여부(기본은 입력 종류에 따라 다름)
  - `lockReason`: 잠금 사유(예: 구조벽/샤프트/기둥/배관)
- 이미지/PDF 입력은 구조 안전성 자동 판별이 어려우므로, 기본은 `demolishable=unknown`(또는 `true` + 경고)로 두고 **업체가 확정**하는 흐름을 권장
- IFC 입력은 가능한 범위에서 “구조/내력” 속성을 매핑(단, 파일 품질/표준 준수에 의존)

---

## 3) 자동 인식(Recognition) — 목표와 한계

### 3.1 목표
- 벽/방 경계, 문/창 위치 후보를 추출하고 “초안”을 만든다.
- 결과는 **신뢰도 스코어**와 함께 표시해 사용자가 보정하도록 한다.

### 3.2 신뢰도/오류 하이라이트
- room polygon 닫힘 여부, 문/창 후보 불확실성, 스케일 불일치 등을 UI에 표시
- “이대로 3D 생성 가능” 상태로 만들기 위한 TODO 리스트를 제공

---

## 4) 3D 생성(Geometry)

### 4.1 기본 생성
- 벽: `Plan2D.walls` 기반 Extrusion
- 바닥/천장: room polygon 기반 메쉬 생성
- 오프닝: wall 메쉬에 boolean 컷(또는 절단 지오메트리 생성)

### 4.2 고급(선택)
- 몰딩/걸레받이/천장 단차: 프리셋 기반 파라메트릭 생성
- 기둥/보/경사천장: 단순 프리셋부터 확장

---

## 5) 자산/머티리얼/가구

### 5.1 머티리얼(PBR)
- 적용 대상: 벽/바닥/천장/몰딩
- 텍스처: albedo/normal/roughness/metallic(필요 시 AO)
- 최적화: KTX2(ETC1S/UASTC) 옵션

### 5.2 오브젝트(glTF)
- 가구/조명 프리셋은 GLB로 관리
- 스냅: 바닥/벽면/코너, 충돌(옵션)

### 5.3 표면/자재 할당(Material Assignment)
- 표면(surface) ID 체계를 정의해 머티리얼 적용을 안정적으로 저장한다.
  - 예: `wall:{wallId}:face:in`, `wall:{wallId}:face:out`, `floor:{roomId}`, `ceiling:{roomId}`
- `surfaceId → materialSkuId` 매핑을 디자인 상태(DesignDocState)로 저장한다.
- 프로젝트/씬 기준으로 자재 라이브러리를 제한할 수 있도록 설계(필요 시)

---

## 6) 인터랙션/편집 모델(DesignDocState)

### 6.1 편집 가능한 동작(최소)
- 자재: 표면 선택 → 자재(SKU) 적용/되돌리기
- 구조(2D/3D): 벽/가벽 추가·이동·삭제, 문/창 배치/치수 수정
- 가구: 추가/이동/회전/삭제, 스냅, 간단 충돌(옵션)

### 6.2 구조 편집 규칙(철거 불가/검증)
- `demolishable=false` 또는 `locked=true` 요소는 이동/삭제 op를 저장 단계에서 거부해야 함(클라만 차단 금지)
- 편집 후 검증을 즉시 수행하고 오류를 UI에 표시
  - 룸 폴리곤 닫힘/교차, 최소 벽 길이, 오프닝이 벽 구간 밖으로 나감 등
- 구조 변경은 3D 씬에 즉시 반영(부분 재생성/리빌드)

### 6.3 가구 배치(권장 동작)
- 스냅 우선(바닥/벽면/코너) + 필요한 경우 수동 미세 조정
- 오브젝트 메타데이터(바운딩 박스/피벗/스케일)를 자산 파이프라인에서 고정

### 6.4 3D 렌더링 백엔드(WebGPU/WebGL 폴백)
- WebGPU 가능 시 `three.js` `WebGPURenderer` 사용, 불가 시 `WebGLRenderer(WebGL2)`로 폴백(지원 편차 고려)
- 피킹: Raycaster(대형 씬은 BVH 권장), TransformControls/기즈모 기반 편집
- 성능: LOD/텍스처 압축(KTX2)/meshopt/스트리밍 로드
- 드로우콜 최적화: 인스턴싱(가구/오브젝트), 머티리얼/텍스처 아틀라스(가능 시), 정적 메쉬 병합(편집 단위 고려)
- 컬링: frustum culling 기본, (옵션) 룸 단위/포털 기반 coarse culling, (옵션) occlusion(복잡도 고려)
- 그림자/조명: 그림자 캐스케이딩/해상도/거리 제한, 베이크드 라이트(옵션)로 워크스루 FPS 안정화

### 6.5 Walkthrough(1인칭) 모드(게임식 이동)
- 진입: “돌아다녀보기” 버튼으로 Orbit/편집 모드 ↔ 1인칭 모드 전환
- 조작: WASD 이동 + 마우스 룩(포인터 락), `ESC`로 종료(명확한 안내 오버레이 제공)
- 이동 모델: 눈높이 카메라(예: 1.6m), 속도/가속 설정, (옵션) 스프린트/앉기
- 충돌: 벽/가구/문틀 등 정적 콜라이더와 충돌(권장: BVH + capsule collision)
- 안전/UX: 모션 민감 사용자 대비(이동 속도/마우스 감도/흔들림 옵션), “원위치/리셋” 제공

### 6.6 인터랙티브 오브젝트(문 열기 등)
- 대상(예시): `door`, `drawer`, `cabinet`, `light_switch`
- 상호작용 방식: 화면 중앙(크로스헤어) 또는 마우스 포인터 기반 피킹 → 클릭/키(E 등)로 토글
- 도어 모델링 기준(권장)
  - 문짝(leaf)을 별도 노드로 분리하고, 힌지(pivot)를 회전축에 배치
  - `Plan2D.openings`의 `swing`/방향 정보를 메타데이터로 유지해 기본 회전 방향/각도(예: 0→90°)를 결정
- 상태 범위
  - 기본: 워크스루 중 “체감/검증”을 위한 **런타임 상태**(저장/버전/견적에는 반영하지 않음)
  - 옵션: 프로젝트룸에서 참가자 간 런타임 상호작용 상태를 공유(동기화 이벤트로 브로드캐스트, 스냅샷에는 미포함)

### 6.7 협업(옵션)
- 실시간 공동 편집은 후속 단계에서 확장 가능하도록 모듈 구조를 유지한다

---

## 7) 산출물/저장

- 3D 산출: `GLB`(필수), 필요 시 `gltf + bin + textures`
- 스냅샷: PNG/JPEG
- 서버 렌더(옵션): 고해상도 이미지 또는 짧은 턴테이블 영상

---

## 8) 작업 큐/상태 머신

- Job types: `import`, `recognize`, `generate_3d`, `render`
- States: `queued → processing → succeeded | failed`
- 재시도: 일시 오류는 자동 재시도, 입력 품질 문제는 “보정 필요”로 전환

---

## 9) 품질 지표(운영)

- 자동 인식 성공률(보정 없이) / 보정 후 완성률
- 평균 처리 시간(import/recognize/generate/render)
- 사용자 보정 시간(평균) 및 이탈률
- GLB 용량/텍스처 용량/뷰어 FPS(기기별)

---

## 10) V2 아키텍처 (Refactored Implementation)

### 10.1 핵심 모듈 구조
- **Experience**: 싱글톤 엔트리 포인트, 전체 모듈(Scene, Renderer, Camera, World 등) 오케스트레이션.
- **Renderer**: WebGPU 우선, WebGL2 폴백 지원. 비동기 초기화 및 리사이즈 처리.
- **World**: `Apartment` (벽/방), `Furniture` (가구), `Environment` (조명/무드) 관리.
- **Navigation**: `OrbitControls` (Spherical damp)와 `FirstPersonController` (WASD + PointerLock) 모드 전환.

### 10.2 3D 생성 로직 (WallBuilder)
- **ExtrudeGeometry**: 2D Flat Shape + Holes(문/창) → 3D Wall Mesh 생성.
- **Baseboard**: 문 구간을 제외한 벽 하단 몰딩 자동 생성.
- **CSG**: Shape Path의 holes 속성을 사용하여 오프닝 컷아웃 구현.

### 10.3 조명 및 머티리얼 (Baked System)
- **BakedMaterial**: `ShaderMaterial` 기반 커스텀 셰이더.
- **Multi-texture Blending**: Day/Night 라이트맵 믹싱 + Neutral 텍스처 합성.
- **Dynamic Accent**: 셰이더 Uniform을 통해 추가적인 동적 조명(TV, 스탠드) 효과 연출.

### 10.4 가구 및 에셋 관리
- **Resources**: KTX2(텍스처), DRACO/Meshopt(GLB) 디코더 내장 로더.
- **InstancedModel**: 반복되는 오브젝트(의자, 소품 등) GPU 인스턴싱 최적화 유틸리티.
- **TransformController**: 가구 이동/회전을 위한 기즈모 및 스냅 헬퍼(SnapHelper) 통합.
