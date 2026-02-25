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
