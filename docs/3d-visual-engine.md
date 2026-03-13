# 3D Visual Engine (Quality Bar)

이 문서는 상용 수준의 시각 품질을 유지하기 위한 렌더링 기준을 정의합니다.

## 렌더링 기본 설정
`apps/web/src/app/(editor)/project/[id]/page.tsx`
- ToneMapping: `ACESFilmicToneMapping`
- `physicallyCorrectLights = true`
- `outputColorSpace = SRGB`
- Shadow: `PCFSoftShadowMap`

## 조명 & 환경
`apps/web/src/components/canvas/core/SceneEnvironment.tsx`
- HDRI 로딩: `/assets/hdri/manifest.json`에서 첫 항목 사용
- HDRI 없으면 preset 환경(`apartment`)으로 폴백
- ContactShadows로 바닥 접지감 보강

## 재질/텍스처
`apps/web/src/components/canvas/features/ProceduralWall.tsx`
- `MeshStandardMaterial` 기반 PBR
- 텍스처 manifest: `/assets/textures/manifest.json`
- diffuse는 `SRGB`, roughness/normal은 `Linear`로 설정

## Post Effects
`apps/web/src/components/canvas/effects/PostEffects.tsx`
- 기본: Bloom + Vignette + Noise
- 성능 민감 옵션(SSAO/DoF)은 기본 비활성

## 카메라/모드
`apps/web/src/components/canvas/core/CameraRig.tsx`
- **Top view**: `OrthographicCamera` + `MapControls`
- **Walk mode**: `PerspectiveCamera` + `PointerLockControls`
- Walk mode는 Rapier 충돌을 통해 벽 관통 방지

## 성능 가드레일
- 렌더 루프 안에서 API 호출/상태 업데이트 금지
- 텍스처 해상도는 기본 1K~2K 권장
- Post FX는 모바일에서 최소화

## Geometry Consumption Rules
- `apps/web/src/components/canvas/features/ProceduralFloor.tsx`
  - revision/result에서 내려온 `floors[]`를 우선 렌더링한다.
  - `floors[]`가 없을 때만 exterior polygon heuristic으로 폴백한다.
- `apps/web/src/components/canvas/features/ProceduralCeiling.tsx`
  - revision/result에서 내려온 `ceilings[]`를 우선 렌더링한다.
  - `ceilings[]`가 없을 때만 `floors[] -> exterior polygon heuristic` 순서로 폴백한다.
- `apps/web/src/features/floorplan/result-mapper.ts`
  - `layout_revisions.geometry_json`과 `derived_scene_json`를 scene store로 매핑할 때 room/floor/ceiling/camera/nav 정보를 유지한다.
- `apps/web/src/components/canvas/core/CameraRig.tsx`
  - Walk mode 시작점은 entrance anchor -> overview anchor -> room center anchor -> opening heuristic 순서로 결정한다.

## 2026-03-12 변경 동기화 (Revision-Derived Floors)
Added:
- revision-derived `floors[]` 기반 바닥/천장 렌더링 우선 규칙.

Updated:
- floor/ceiling 생성 기준을 exterior loop heuristic 단독에서 `revision floors -> exterior fallback` 순서로 변경.

Removed/Deprecated:
- wall 외곽선만으로 floor/ceiling을 항상 재구성하는 단일 경로.

## 2026-03-13 변경 동기화 (Derived Ceiling + Camera Anchors)
Added:
- derived `ceilings[]`, `cameraAnchors`, `navGraph` 소비 규칙.

Updated:
- Walk mode spawn 기준을 opening heuristic 단독에서 anchor 우선 경로로 상향.

Removed/Deprecated:
- wall/opening만으로 walk spawn과 천장을 전부 추론하는 접근.
