# 3D Engine (R3F + Rapier + CSG)

Plan2Space의 3D 스튜디오는 React Three Fiber 기반으로 구성됩니다.
**Top View / Walk Mode** 두 가지 모드를 유지하며, 절차적 3D 생성과 PBR 렌더링을 기본으로 합니다.

## 뷰 모드

- **2D Edit**: 도면 보정 단계 (FloorplanEditor)
- **Top View**: Orthographic 느낌의 편집 시점, 천장 숨김
- **Walk Mode**: 1인칭 탐험 시점, 천장 표시 + 충돌 처리

상태: `apps/web/src/lib/stores/useEditorStore.ts`

## 절차적 생성

- 벽/바닥/천장: `components/canvas/features/*`
- 벽 생성은 2D 라인을 **Extrude** 후 CSG로 문/창문을 뚫습니다.
  - `ProceduralWall.tsx`에서 `@react-three/csg` 사용
- Floorplan 스케일(`scale`) 기반으로 실제 단위를 적용합니다.

## 물리/충돌

- Rapier (`@react-three/rapier`) 사용
- Walk Mode에서 벽/바닥 충돌 활성화

## 렌더링 품질

- PBR 기본: `MeshStandardMaterial`/`MeshPhysicalMaterial`
- HDR 환경광: `SceneEnvironment`
- Post FX: `PostEffects` (Bloom/Vignette/Noise 기본, SSAO/DoF는 옵션)

## 에셋 로딩 (Draco + LOD)

- `useGLBAsset`에서 DRACO 디코더 적용
- `Furniture.tsx`에서 간이 LOD 생성 (고해상도 + 박스 프록시)

## WebGPU 옵션

- `?renderer=webgpu` 쿼리로 활성화
- 초기화 실패 시 WebGL로 자동 폴백

## 입력/상호작용

- Walk Mode: WASD + 마우스 룩
- Top View: 드래그/스냅 배치
- 상호작용 가능 객체는 커서/하이라이트로 표시
