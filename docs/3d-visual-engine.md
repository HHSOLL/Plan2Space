# 3D Visual Engine (Quality Bar)

이 문서는 room-first deskterior 에디터/뷰어의 렌더 품질 기준을 정의합니다.

## 렌더링 기본 설정
`apps/web/src/components/editor/SceneViewport.tsx`
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
- 알려진 Blender 슬롯(`DeskWood`, `DeskMetal`, `StandWood`, `StandPad`, `LampBody`, `LampAccent`, `LampBulb`)은 slot-aware finish를 우선 적용한다.

## 카메라/모드
`apps/web/src/components/canvas/core/CameraRig.tsx`
- Editor: 배치 정확도를 위한 top 중심 카메라 UX
- Preview/Viewer: 읽기 중심 탐색 카메라 UX
- 모드 전환은 편집 상태를 깨지 않아야 한다.

추가 기준:
- builder opening/style preview는 room center를 target으로 하는 orbit camera를 사용한다.
- preview orbit은 wheel zoom과 drag rotation을 기본 제스처로 제공하고 pan은 보조 동작으로 제한하거나 비활성화한다.
- editor top-view는 orthographic top camera를 방 중심에 고정하고 drag rotation + zoom만 허용하며 pan은 금지한다.
- editor top-view의 room shell은 floor 위 footprint strip으로 읽혀야 하고, walk/builder-preview에서만 full-height wall mesh를 사용한다.
- walk view 진입 시 기본 시선은 room center/entrance target을 향해야 한다.

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
- 제품 물리 메타데이터(`dimensionsMm`, `finishColor`, `finishMaterial`, `detailNotes`, `scaleLocked`)를 누락 없이 전달한다.

## 물리 정합성 기준
- Blender 소스(`assets/blender/deskterior`)의 실측 envelope 기준으로 카탈로그 규격을 관리한다.
- 실측 고정 제품(`scaleLocked=true`)은 변환 컨트롤/인스펙터 입력에서 스케일 변경을 저장하지 않는다.
- 뷰어 제품 정보 drawer는 규격(W/D/H mm), 마감 색상/재질, 디테일 노트를 표시한다.
- support surface 배치는 `dimensionsMm`가 있을 때 해당 실측값을 우선 사용해 surface size/top을 계산한다.
- floor/surface 배치는 active asset footprint를 반영해 wall clearance + inter-asset separation을 수행한다.

## 2026-04-14 변경 동기화 (Deskterior Visual Baseline)
Added:
- deskterior 편집/공유 뷰어 중심 카메라 규칙.
- `sceneDocument` 우선 복원 정책을 품질 기준으로 고정.

Updated:
- floorplan 기반 3D 생성 컨텍스트 없이도 일관되게 작동하는 렌더 기준으로 재정렬.

Removed/Deprecated:
- floorplan 인식 결과를 전제로 한 시각 품질 설명.

## 2026-04-14 변경 동기화 (Physical Fidelity Quality Gate)
Added:
- 실측 규격/마감 메타데이터 전달을 visual quality bar의 필수 항목으로 추가.
- 실측 고정 제품 스케일 보호를 렌더/인터랙션 품질 기준에 추가.

Updated:
- 제품 정보 표시 기준을 옵션 문자열 중심에서 구조화된 규격/마감 중심으로 전환.

Removed/Deprecated:
- 규격 정확도 검증 없이 시각 유사성만으로 승인하던 기준.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-2)
Added:
- `dimensionsMm` 기반 support profile 추론/배치 클램프를 렌더 상호작용 품질 기준에 포함.

Updated:
- `finishColor`/`finishMaterial`를 GLB 머티리얼 tint 및 roughness/metalness 보정에 반영하는 런타임 기준 추가.

Removed/Deprecated:
- 마감 정보가 정보 패널 텍스트로만 소비되던 기준.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-3)
Added:
- 물리 배치 품질 기준에 wall clearance + 자산 간 분리(relaxation) 루프를 추가.
- Blender 알려진 슬롯 기반의 slot-aware finish 반영 기준을 추가.

Updated:
- 신규 자산 추가 시점부터 실측 메타를 사용해 배치 클램프와 충돌 완화를 수행하도록 상호작용 기준을 강화.

Removed/Deprecated:
- 전체 자산에 단일 finish 보정만 적용하던 런타임 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-4)
Added:
- HDRI 우선 선택 정책(kiara_interior -> hotel_room -> photo_studio_loft_hall -> photo_studio_01 -> small_empty_room_1).
- 홈 레퍼런스 기준의 조명 리밸런싱(웜 키라이트 + 쿨 필라이트 + 강화된 contact shadow) 품질 기준.

## 2026-04-17 변경 동기화 (Builder Shell Alignment Fix)
Added:
- builder preview/runtime shell에서 wall/door/window/collider plane은 primary floor outline 기준 exterior 방향 반 두께 오프셋을 공유해야 한다.

Updated:
- procedural wall mesh는 wall local space와 opening hole local space를 동일 좌표계로 유지하고, 코너는 반 두께 겹침으로 닫히도록 렌더링 규칙을 강화.
- builder orbit preview 기본 카메라는 room shell 전체 footprint를 우선 보여주는 framing을 사용하도록 조정.

Removed/Deprecated:
- wall mesh를 floor outline 중심선에 그대로 배치하던 preview 렌더 가정.

## 2026-04-17 변경 동기화 (Top-View Legibility + Surface Stability)
Added:
- 상단뷰 room shell legibility를 위해 wall footprint strip 렌더 규칙을 추가.
- walk view initial look target을 room center 기반으로 정렬하는 카메라 품질 기준을 추가.

Updated:
- floor texture는 저각도 시점 shimmer를 줄이기 위해 보수적 repeat와 높은 anisotropy를 사용한다.
- walk view contact shadow / directional shadow bias를 보수적으로 조정해 floor acne와 coplanar shimmer를 줄인다.

Removed/Deprecated:
- top-view에서 full-height wall mesh만으로 shell legibility를 확보한다는 가정.
- 포스트FX 기준(SSAO + 보수적 bloom + 완화된 vignette + 저강도 noise) 추가.

Updated:
- 에디터/뷰어 기본 노출 값을 상향해 홈 레퍼런스의 밝기/재질 가독성에 맞춤.

Removed/Deprecated:
- 깊이감 보정(occlusion) 없이 bloom/vignette만으로 룩을 구성하던 기준.
