# 구현 계획 (Room-First Deskterior)

## P0
목표: 제품 방향 전환 고정 + 레거시 하드 제거

완료:
- floorplan/intake/legacy 런타임 경로 제거 (`apps/api`, `apps/worker`, `apps/web`)
- `legacy:*` 스크립트 및 legacy CI job 제거
- `packages/floorplan-core` 및 floorplan 계약 파일 제거
- bootstrap을 saved version(`sceneDocument`) 우선 경로로 단순화
- 레거시 DB 제거용 마이그레이션 런북 + preflight/postcheck SQL 추가

## P1
목표: IKEA Kreativ 스타일 room builder 완성도 강화

진행:
- 홈 시작하기 2-way 진입(`공간 선택`/`공간 만들기`)과 레퍼런스형 카드 레이아웃 적용
- `빈 공간`/`가구가 비치된 공간` 템플릿 브라우저 추가
- 템플릿 선택 즉시 project draft/save 후 editor로 직행하는 bootstrap 경로 적용
- furnished template별 시드 자산 구성을 분리하고 pre-seeded editor 회귀 항목에 포함
- 빌더를 레퍼런스 4-step split shell로 재구성하고 단계별 preview camera/overlay를 정렬
- 빌더 단계(Shape/Dimension/Opening/Style)를 레퍼런스 density 기준으로 재작성
- 개구부 스타일 retune 및 auth restore 이후 상태 덮어쓰기 버그 수정
- builder desktop shell 무스크롤 fit 및 실 floor outline 기반 dimension overlay 적용
- builder exterior polygon/snap 안정화 및 shape-specific geometry 정합성 보강
- opening/style step preview에 orbit/zoom 카메라 UX 적용
- 템플릿 기반 방 생성 속도 개선
- 저장 직후 에디터/뷰어 일관성 확인 자동화
- project-media bucket 미구성 시 thumbnail upload 복구/재시도로 저장 실패를 완화

## P2
목표: 데스크테리어 편집 경험 고도화

진행:
- Blender 원본 -> GLB -> catalog sync 파이프라인 표준화
- `assets:export:deskterior` / `assets:sync:deskterior` / `assets:verify:deskterior` 3단계 CLI 계약 고정
- 제품 메타데이터(브랜드/가격/외부 링크/옵션) 채움률 개선
- 제품 물리 메타데이터(`dimensionsMm`, `finishColor`, `finishMaterial`, `detailNotes`, `scaleLocked`)를 catalog/save/viewer 전 구간으로 확장
- 실측 고정 제품의 스케일 변경 차단(Inspector + TransformControls) 적용
- 공유 뷰어 hotspot drawer에 W/D/H 규격 및 마감/디테일 노출 적용
- 스냅/배치/회전 정밀도 개선 및 뷰어 hotspot 신뢰도 강화
- floor/surface 배치에 wall clearance + inter-asset separation + support re-clamp 기반 물리 솔버 적용
- 상단뷰 에디터에 world/local transform space 토글과 live placement clamp 적용
- 에디터 shell을 레퍼런스 7번 기준(top bar / slim catalog rail / grey viewport / bottom pill toolbar)으로 통일
- Blender 알려진 슬롯 기준(`DeskWood`, `DeskMetal`, `StandWood`, `StandPad`, `LampBody`, `LampAccent`, `LampBulb`)의 slot-aware finish 매핑 적용
- 오픈소스/공식문서/논문 기반 개선안은 `docs/research-roadmap.md`를 기준으로 추적

## P3
목표: 커뮤니티 공유/조회 경험 강화

진행:
- publish -> shared viewer -> gallery/community 데이터 흐름 안정화
- shared viewer shell을 editor read-only mirror(top bar / hotspot drawer / grey viewport / right zoom rail / bottom pill status)로 통일
- gallery/community를 레퍼런스 8번 이미지 기준의 4열 furnished-space feed + URL 기반 filter rail로 통일
- 공유 씬 성능 예산(초기 로드, draw call, texture budget) 모니터링
- 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선

## 품질/회귀 게이트
- `npm --workspace apps/web run type-check`
- `npm --workspace apps/web run lint`
- `npm --workspace apps/web run build`
- `npm --workspace apps/api run typecheck`
- `npm --workspace apps/worker run typecheck`

## 리스크
- 기존 DB의 floorplan/intake 관련 historical data는 더 이상 bootstrap source로 사용하지 않는다.
- `sceneDocument`가 없는 오래된 프로젝트는 초기 로드 시 empty bootstrap으로 처리될 수 있다.
- 자산 품질 편차(폴리곤/텍스처/스케일)는 Blender export 규칙 미준수 시 즉시 UX 저하로 이어진다.
- Blender 실행 파일 미탐지 환경에서는 export 자동화가 실패할 수 있으며(`BLENDER_BIN` 필요), preflight/report 모드로 사전 점검이 필요하다.
- 신규 자산 추가 경로에서 `activeAsset` 메타가 누락되면 fallback 규격으로 솔버가 동작하므로, catalog/입력 메타 품질 의존도가 남아 있다.

## 2026-04-14 변경 동기화 (Legacy Hard Retirement + Deskterior Focus)
Added:
- floorplan/intake 레거시 제거를 P0 완료조건으로 명시.
- asset generation + Blender 파이프라인 중심의 P2 실행 항목.

Updated:
- 제품 완성 기준을 room-first deskterior + community shared viewer로 재정렬.
- 품질 게이트에 api/worker 타입체크를 병행하도록 추가.

Removed/Deprecated:
- legacy 트랙 및 `docs/legacy/*` 아카이브 참조.
- floorplan eval/blind gate/intake e2e 기반 완료 조건.

## 2026-04-16 변경 동기화 (Reference Start Flow + Template Browser)
Added:
- P1 범위에 홈 시작하기 화면, 공간 선택 브라우저, seeded template bootstrapping을 명시.

Updated:
- room builder 완료 조건을 "직접 생성" 단일 경로에서 "템플릿 선택 + 맞춤 생성" 이중 경로로 확장.

Removed/Deprecated:
- 사용자가 빌더 내부에서만 템플릿을 고른다는 전제.

## 2026-04-16 변경 동기화 (Reference 4-Step Builder Shell)
Added:
- P1 범위에 레퍼런스 4-step builder shell, dimension overlay, opening/style step catalog UI를 명시.

Updated:
- builder 완료 기준을 "기능 존재"에서 "레퍼런스 쉘/단계 밀도/복원 안정성"까지 확장.

Removed/Deprecated:
- 이전 builder 상단 퀵 액션/step chip/summary card 중심 레이아웃.

## 2026-04-16 변경 동기화 (Editor Precision Controls)
Added:
- P2 범위에 `world/local` transform space 토글과 live placement clamp를 명시.

Updated:
- 상단뷰 편집 정확도 목표를 “snap + solver”에서 “snap + solver + live bounds”까지 확장.

Removed/Deprecated:
- gizmo 배치 보정이 drag 종료 후 한 번만 일어난다는 전제.

## 2026-04-16 변경 동기화 (Editor Reference Chrome Pass)
Added:
- P2 범위에 editor reference chrome 통일(top bar, slim catalog rail, right zoom rail, bottom pill toolbar, light share modal)을 명시.

Updated:
- 데스크테리어 편집 경험 목표를 “정밀 배치”에서 “정밀 배치 + 레퍼런스형 shell 일관성”까지 확장.

Removed/Deprecated:
- editor 상단/하단을 개별 floating card들로 유지하던 이전 shell.

## 2026-04-16 변경 동기화 (Shared Viewer + Furnished Feed Reference Pass)
Added:
- P3 범위에 shared viewer read-only mirror shell과 hotspot drawer 중심 상세 정보 구조를 명시.
- gallery/community의 레퍼런스 8번식 4열 furnished feed와 URL 기반 filter rail 유지 규칙을 명시.

Updated:
- 커뮤니티 공유/조회 경험 목표를 “데이터 흐름 안정화”에서 “데이터 흐름 안정화 + 레퍼런스형 viewer/feed chrome 일관성”까지 확장.

Removed/Deprecated:
- shared viewer hero metric strip과 community featured/recent 분리 카드 레이아웃.

## 2026-04-16 변경 동기화 (Start Flow Fixes + Builder Shell Fit)
Added:
- P1 범위에 `템플릿 선택 -> 즉시 editor 진입` 경로와 desktop builder shell fit을 명시.
- thumbnail storage bucket 누락 시 save fallback/retry를 P1 안정화 항목에 추가.
- P1 안정화 항목에 shape별 치수 clamp 정규화와 geometry 동기화 검증을 추가.

Updated:
- 템플릿 진입 완료 기준을 "builder 초기값 복원"에서 "saved project 생성 후 editor 직행"으로 변경.
- builder 완료 기준에 "페이지 무스크롤", "실제 floor outline 기반 치수 overlay"를 추가.
- P2 editor chrome 기준을 "slim rail" 일반론에서 "desktop left catalog 고정 + compact header + compact bottom toolbar"로 구체화.

Removed/Deprecated:
- 템플릿 선택이 항상 builder step flow를 지난다는 완료 조건.

## 2026-04-16 변경 동기화 (Community + Studio Shell Differentiation)
Added:
- P3 범위에 community 대화형 허브 구조(토론/챌린지/최신 게시물 구분)를 추가.

## 2026-04-17 변경 동기화 (Builder Shell Alignment Fix)
Added:
- P1 안정화 항목에 "builder step 3/4 wall/opening/collider exterior offset 정렬" 검증을 추가.
- P1 안정화 항목에 rect/L/U shape 브라우저 shell smoke를 명시.

Updated:
- builder opening step 완료 기준을 "개구부 배치 가능"에서 "wall/floor/opening이 한 좌표계에서 닫힌 shell로 보임"으로 강화.

Removed/Deprecated:
- rect template만 정상이어도 builder shell 안정화가 완료된다는 가정.
- `/studio` 개인 아카이브를 gallery 톤 카드 피드 + 필터/검색 구조로 정리하는 UI 슬라이스를 추가.

Updated:
- 전역 navbar 정렬 기준을 우측 탭 구조로 맞추고, non-editor surface 레이아웃 오프셋 점검을 P3 UX 안정화 항목에 포함.

Removed/Deprecated:
- `/community`와 `/gallery`가 동일한 구조로만 유지된다는 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-1)
Added:
- Blender 실측 envelope를 기준으로 curated deskterior 규격 메타를 동기화하고 pipeline verify PASS 확보.
- 구조화된 물리 메타 기반의 에디터/뷰어 표시 및 스케일 잠금 런타임 적용.

Updated:
- P2 목표를 “메타 채움률”에서 “실측 정합성(표시+편집 보호)”까지 확장.

Removed/Deprecated:
- 규격을 `options` 텍스트로만 전달하던 방식.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-2)
Added:
- `anchors`/`support-profiles` 경로에 `dimensionsMm` 기반 support surface size/top 계산을 연결해 배치 정합성 개선.
- curated 자산 검증 스크립트에서 구조화된 물리 메타(`dimensionsMm/finishColor/finishMaterial/detailNotes/scaleLocked`)를 엄격 검증.

Updated:
- 런타임 GLB 렌더 경로에서 `finishColor`/`finishMaterial` 힌트를 보수적으로 재질 tint/roughness/metalness에 반영.

Removed/Deprecated:
- 물리 메타데이터가 뷰어 텍스트 표시 전용이라는 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-3)
Added:
- `anchors` 물리 솔버에 wall clearance + inter-asset separation + bounded relaxation 루프를 추가.
- 신규 배치 경로(`project page`, `AI panel`)에 `activeAsset` 전달을 연결해 첫 배치부터 실측 규격 사용을 보장.
- `Furniture` 런타임 재질 경로에 Blender 알려진 슬롯 기반 slot-aware finish 매핑을 추가.

Updated:
- P2 목표를 support top 정합성에서 “표면 overhang/벽 간섭/자산 간 충돌 완화 + 슬롯별 재질 디테일”까지 확장.

Removed/Deprecated:
- 신규 자산은 물리 솔버에서 fallback bounds만 사용한다는 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-4)
Added:
- 렌더 파이프라인에 홈 레퍼런스 룩 패스(HDRI 우선 선택 + 조명 리밸런싱 + 포스트FX 보정) 적용.
- fallback lighting 기본값을 레퍼런스 톤 기준으로 상향(ambient/hemisphere/directional/environmentBlur).

Updated:
- P2의 품질 범위를 물리 정합성 중심에서 "물리 정합성 + 홈 레퍼런스 시각 퀄리티"로 확장.

Removed/Deprecated:
- 톤 일관성 없이 scene별 초기 조명 체감이 달라지는 기존 기본값 전제.
