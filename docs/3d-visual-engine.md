# 3D Visual Engine (Quality Bar)

이 문서는 공간 우선 에디터/뷰어 렌더 품질 기준을 정의합니다.

## 렌더링 기본 설정
`apps/web/src/app/(editor)/project/[id]/page.tsx`
- ToneMapping: `ACESFilmicToneMapping`
- `physicallyCorrectLights = true`
- `outputColorSpace = SRGB`
- Shadow: `PCFSoftShadowMap`

## 조명/환경
`apps/web/src/components/canvas/core/SceneEnvironment.tsx`
- HDRI manifest 기반 로딩
- 미존재 시 preset 폴백
- ContactShadows 유지

## 재질/텍스처
- `apps/web/src/components/canvas/features/ProceduralWall.tsx`
- `apps/web/src/components/canvas/features/ProceduralFloor.tsx`
- `apps/web/src/components/canvas/features/ProceduralCeiling.tsx`

기준:
- `MeshStandardMaterial` 기반 PBR
- 색상 텍스처는 SRGB, roughness/normal은 Linear

## 카메라/모드
`apps/web/src/components/canvas/core/CameraRig.tsx`
- Top: orthographic + map controls
- Walk: perspective + pointer lock + collision

## 뷰어 규칙
- `apps/web/src/components/viewer/ReadOnlySceneViewport.tsx`
- `apps/web/src/components/viewer/ProductHotspotDrawer.tsx`

기준:
- orbit/zoom/camera 이동 허용
- 제품 클릭 및 제품 정보 확인 허용
- 배치/삭제/저장/발행 등 편집 affordance 금지

## 성능 가드레일
- 프레임 루프 내부에서 네트워크 요청 금지
- 고비용 post-effect는 기본 비활성
- 에디터 대비 뷰어 interaction tree 경량화 유지

## Scene 데이터 소비 규칙
- `apps/web/src/lib/domain/scene-document.ts`를 scene 복원의 canonical 매핑 계층으로 사용
- scene 저장/복원은 `project_versions.customization.sceneDocument`를 우선 source로 사용
