# 구현 계획 (Room-First Deskterior)

## P0
목표: 제품 방향 전환 고정 + 레거시 하드 제거

완료:
- floorplan/intake/legacy 런타임 경로 제거 (`apps/api`, `apps/worker`, `apps/web`)
- `legacy:*` 스크립트 및 legacy CI job 제거
- `packages/floorplan-core` 및 floorplan 계약 파일 제거
- bootstrap을 saved version(`sceneDocument`) 우선 경로로 단순화
- 레거시 DB 제거용 마이그레이션 런북 + preflight/postcheck SQL 추가
- live Supabase에서 legacy `floorplan*`/`intake_sessions` row purge + `floor-plans` bucket 삭제 완료
- legacy `jobs` floorplan payload scrub 완료
- live Supabase에서 `jobs.floorplan_id`, `project_versions.floor_plan`, `floorplans`, `intake_sessions`, `layout_revisions`, `source_assets`, `revision_source_links` 제거 완료

## P1
목표: IKEA Kreativ 스타일 room builder 완성도 강화

진행:
- 홈 시작하기 2-way 진입(`공간 선택`/`공간 만들기`)과 레퍼런스형 카드 레이아웃 적용
- `빈 공간`/`가구가 비치된 공간` 템플릿 브라우저 추가
- 템플릿 선택 즉시 project draft/save 후 editor로 직행하는 bootstrap 경로 적용
- furnished template별 시드 자산 구성을 분리하고 pre-seeded editor 회귀 항목에 포함
- 빌더를 레퍼런스 5-step split shell로 재구성하고 단계별 preview camera/overlay를 정렬
- 빌더 단계(Shape/Dimension/Opening/Style/Lighting)를 레퍼런스 density 기준으로 재작성
- 개구부 스타일 retune 및 auth restore 이후 상태 덮어쓰기 버그 수정
- builder desktop shell 무스크롤 fit 및 실 floor outline 기반 dimension overlay 적용
- builder exterior polygon/snap 안정화 및 shape-specific geometry 정합성 보강
- opening/style step preview에 orbit/zoom 카메라 UX 적용
- lighting step에 direct/indirect mood 선택 및 scene lighting payload 연결
- 템플릿 기반 방 생성 속도 개선
- 저장 직후 에디터/뷰어 일관성 확인 자동화
- project-media bucket 미구성 시 thumbnail upload 복구/재시도로 저장 실패를 완화

## P2
목표: 데스크테리어 편집 경험 고도화

진행:
- Blender 원본 -> GLB -> catalog sync 파이프라인 표준화
- `assets:export:deskterior` / `assets:sync:deskterior` / `assets:validate:deskterior` / `assets:verify:deskterior` 4단계 CLI 계약 고정
- 저장/연산 경계에서 placement 데이터를 mm 정수 기준으로 정규화하고, 렌더 직전에만 meter float로 변환하는 계약 도입
- `/project/[id]` 편집 흐름을 room mode와 desk precision mode로 분리하고 카메라/스냅/피킹 정책을 각 모드별로 고정
- curated runtime asset delivery를 `apps/web/public/assets/*` 직접 서빙에서 storage/CDN 기반 release URL 구조로 옮기는 cutover 설계 진행
- 신규 curated binary의 `apps/web/public/assets/*` 추가 동결
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
- shared viewport에 mode-aware render quality ladder 적용(top/builder 경량화, walk/viewer 품질 유지)
- top-view 자산 drag를 local preview 후 commit 방식으로 전환해 pointer-move store churn 완화
- physics/runtime shadow/contact shadow/post FX를 walk/viewer 중심으로 재배치해 furnished scene headroom 확보
- editor top-view 회전을 drag에서 버튼형 90도 회전 rail로 단순화
- direct lighting beam shader / indirect ceiling glow shader를 scene shell 렌더에 연결

## P3
목표: 커뮤니티 공유/조회 경험 강화

진행:
- publish -> shared viewer -> gallery/community 데이터 흐름 안정화
- shared viewer shell을 editor read-only mirror(top bar / hotspot drawer / grey viewport / right zoom rail / bottom pill status)로 통일
- gallery/community를 레퍼런스 8번 이미지 기준의 4열 furnished-space feed + URL 기반 filter rail로 통일
- 공유 씬 성능 예산(초기 로드, draw call, texture budget) 모니터링
- 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선

## 2026-04-19 심층 분석 기반 실행 순서
이 순서는 `/Users/sol/Downloads/Plan2Space 정밀 공간 편집 시스템 심층 분석 보고서.docx`의 제안을 현재 room-first 제품 흐름에 맞게 재배열한 것이다. P0~P3의 큰 축은 유지하되, 실제 실행은 아래 Phase와 Slice 단위로 끊어서 진행한다.

### Phase 1. 측정 기반 고정
목표:
- 추측이 아니라 숫자로 회귀를 잡을 수 있는 기준선을 먼저 만든다.

이번 범위:
- `docs/performance-budget.md`를 route shell 지표 중심 문서에서 편집/렌더/피킹 예산 문서로 확장
- empty room, furnished room, dense desk, high fidelity toggle의 4개 시나리오를 공통 벤치마크로 고정
- DevTools와 `renderer.info` 기준의 수집 템플릿을 정의

세부 Slice:
- Slice 1. 문서 기준선 정리
- Slice 2. 계측 훅/로그 포인트 배치
- Slice 3. 회귀 비교 포맷과 QA 루틴 연결

완료 기준:
- draw call, textures, geometries, heap, picking latency, placement tolerance 예산이 문서화된다.
- 같은 장면을 dev/build 모두에서 반복 측정하는 절차가 고정된다.

### Phase 2. 자산 파이프라인 강제
목표:
- Blender source -> runtime GLB -> manifest -> 검증/최적화까지를 끊기지 않는 체인으로 만든다.

이번 범위:
- `assets:sync:deskterior` 이후에 validate -> optimize -> verify 실행 순서를 고정
- manifest에 물리 메타와 배치 앵커 품질 검증을 강화
- 신규 curated binary의 repo-public 추가 동결 원칙을 storage/CDN cutover와 같이 추적

세부 Slice:
- Slice 1. validate:gltf 추가
- Slice 2. optimize:gltf와 asset size budget 연결
- Slice 3. anchor/support metadata 검증 확장

완료 기준:
- 새 deskterior 자산은 export -> sync -> validate -> optimize -> verify를 통과해야 한다.
- hero asset size와 texture 예산 초과가 CI 혹은 verify 단계에서 드러난다.

### Phase 3. 정밀 편집 엔진 분리
목표:
- room layout 편집과 desk precision 편집을 다른 조작 체계로 분리한다.

이번 범위:
- 저장 단위는 mm 정수, 렌더 경계는 meter float로 고정
- room mode는 top-down layout, desk precision mode는 surface/anchor 중심 미세 배치로 분리
- numeric inspector, measurement overlay, micro-view, surface lock의 우선순위를 명시

세부 Slice:
- Slice 1. 데이터 계약과 단위 타입 정리
- Slice 2. 카메라/스냅/피킹 정책 분리
- Slice 3. 정밀 배치 UI와 측정 오버레이
- Slice 4. save/load와 viewer 재현성 검증

완료 기준:
- 책상 위 자산 배치가 1~5mm 체감 오차 범위에서 유지된다.
- room mode와 desk precision mode가 서로의 조작 정책을 침범하지 않는다.

### Phase 4. 모드별 렌더 품질 사다리
목표:
- top view, desk precision, walk/viewer가 같은 렌더 비용을 계속 지지 않도록 분리한다.

이번 범위:
- lazy load, active finish only, selective post FX, shadow budget, light budget을 모드별로 고정
- builder/editor/viewer에 서로 다른 render ladder와 idle profile을 적용

세부 Slice:
- Slice 1. top-entry lazy load 정리
- Slice 2. desk showcase preset과 shared viewer preset 분리
- Slice 3. 조명/후처리/그림자 토글의 비용 재배치

완료 기준:
- room mode와 shared viewer는 안정적인 route shell 성능을 유지한다.
- desk precision mode에서만 필요한 품질 효과가 선택적으로 활성화된다.

### Phase 5. 공유/커뮤니티 안정화
목표:
- 정밀 편집 결과가 publish, shared viewer, gallery/community까지 동일하게 이어지게 한다.

이번 범위:
- read-only viewer 경량화
- shared snapshot과 community feed의 메타/썸네일/sceneDocument 일치성 강화
- 이후 collaboration/presence는 별도 실험 트랙으로 분리

세부 Slice:
- Slice 1. shared viewer runtime 경량화
- Slice 2. gallery/community summary와 필터 정확도 보강
- Slice 3. presence/realtime은 분리 브랜치에서 평가

완료 기준:
- publish 후 shared viewer와 community 카드가 같은 장면 상태를 재현한다.
- viewer에는 editor 전용 affordance가 남지 않는다.

현재 착수:
- Phase 1 / Slice 1: 성능 예산과 측정 절차를 숫자 중심으로 재정렬
- 다음 후보: Phase 2 / Slice 1 또는 Phase 3 / Slice 1

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
- Vercel/Railway 원격 프로젝트/환경 변수 정리는 인증된 inventory 확인 전까지 자동 삭제할 수 없다.
- mm 정수 계약 전환은 save/load, anchor solver, viewer 재현성을 동시에 건드리므로 단계적 마이그레이션이 필요하다.
- room mode와 desk precision mode 분리가 늦어지면 카메라/스냅/피킹 회귀가 계속 교차 발생할 수 있다.

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

## 2026-04-17 변경 동기화 (Editor Top-View Interaction Fixes)
Added:
- P2 범위에 rotate-only orthographic top-view camera와 좌측 add/settings shared drawer UX를 명시.
- P2 회귀 항목에 mobile share modal fit과 top-view/walk-view ceiling visibility 분리를 추가.

Updated:
- 편집 경험 목표를 `reference chrome`에서 `reference chrome + top-view legibility + walk-view entry framing`까지 확장.
- P2 안정화 기준에 top-view camera drag와 furniture transform interaction 분리, concave room wall offset 정합성을 추가.

Removed/Deprecated:
- top-view 편집이 pan/move affordance와 별도 `목록/속성/항목뷰` 보조 UI에 의존한다는 가정.
- `/studio` 개인 아카이브를 gallery 톤 카드 피드 + 필터/검색 구조로 정리하는 UI 슬라이스를 추가.

Updated:
- 전역 navbar 정렬 기준을 우측 탭 구조로 맞추고, non-editor surface 레이아웃 오프셋 점검을 P3 UX 안정화 항목에 포함.

Removed/Deprecated:
- `/community`와 `/gallery`가 동일한 구조로만 유지된다는 가정.

## 2026-04-17 변경 동기화 (Platform Cleanup Audit)
Added:
- P0 완료 항목에 live Supabase legacy data purge(`floorplan_match_events`, `floorplan_results`, `floorplans`, `intake_sessions`, `floor-plans` bucket)를 추가.
- P2 진행 항목에 curated runtime asset의 storage/CDN cutover와 repo-public freeze를 추가.

Updated:
- platform cleanup 우선순위를 `live data purge -> direct DB migration -> Vercel/Railway authenticated inventory cleanup` 순서로 고정.

Removed/Deprecated:
- `apps/web/public/assets/*`를 계속 늘려도 운영 구조에 큰 문제가 없다는 가정.

## 2026-04-18 변경 동기화 (Platform Runtime Hard Cleanup)
Added:
- P0 완료 항목에 live Supabase legacy schema drop(`jobs.floorplan_id`, `project_versions.floor_plan`, `floorplans`, `intake_sessions`, `layout_revisions`, `source_assets`, `revision_source_links`)을 추가.
- Vercel preview 환경에 `RAILWAY_API_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 채워 preview server-route parity를 확보한 운영 정리를 추가.

Updated:
- platform cleanup 상태를 `row purge only`에서 `row purge + schema drop + preview env parity` 완료로 상향.

Removed/Deprecated:
- legacy schema drop이 별도 maintenance window에 남아 있다는 이전 리스크.

## 2026-04-18 변경 동기화 (Viewport Performance Budget Pass)
Added:
- P2 진행 항목에 shared viewport mode-aware 품질 계단(top/builder 경량화, walk/viewer 유지)을 추가.

## 2026-04-18 변경 동기화 (Opening Asset Pass + Builder Entry Perf)
Added:
- P1 안정화 항목에 `선택한 벽으로 door/window 재배치`, `wall corner closed shell`, `opening asset runtime 경로 검증`을 추가.
- P2 진행 항목에 `top-view entry lazy load(HDRI/interactive lights/opening assets/full finish textures)`와 `opening GLB source/runtime 관리`를 추가.

Updated:
- builder opening step 완료 기준을 `wall 선택 + width/offset 조절 가능`에서 `wall reassignment가 시각적으로 즉시 반영되고, 코너 seam 없이 닫힌 shell이 유지됨`으로 강화.
- 렌더 최적화 범위를 `quality ladder`에서 `top-entry lazy load + active finish only texture load`까지 확장.

Removed/Deprecated:
- builder opening preview 내부 delete FAB와 하단 preview instruction 카드 의존.
- P2 안정화 항목에 top-view furniture drag local preview/commit 경로를 추가.

Updated:
- 데스크테리어 편집 성능 목표를 “기능 유지”에서 “60fps floor 확보를 위한 physics/shadow/post FX/drag churn 예산 관리”까지 확장.

Removed/Deprecated:
- builder/editor/viewer가 동일한 렌더 예산을 계속 공유해도 괜찮다는 가정.

## 2026-04-18 변경 동기화 (Builder Lighting Step + Top-View Interaction Cleanup)
Added:
- P1 범위에 builder final lighting step과 direct/indirect 저장 계약을 추가.
- P2 범위에 editor top-view button rotation 및 hidden material toggle 제거를 추가.

Updated:
- builder 완료 기준을 `4-step shell`에서 `5-step shell + lighting preview`까지 확장.
- 상단뷰 안정화 목표를 `drag 충돌 방지`에서 `drag 제거 + explicit rotate control`까지 강화.

Removed/Deprecated:
- 상단뷰 빈 공간 drag 회전 전제.
- 바닥/벽 클릭으로 재질을 바꾸는 임시 shortcut.

## 2026-04-18 변경 동기화 (Deskterior Asset Density Pass)
Added:
- P2 진행 항목에 Blender deskterior 자산 5종(머그/북스택/트레이/스피커/플랜터) 추가와 catalog verify 범위 확장을 명시.
- P2 안정화 항목에 `assets:optimize:deskterior` 기반 Meshopt 압축 루프를 추가.

Updated:
- 자산 품질 목표를 “source/export/sync 존재”에서 “source/export/sync/verify + open-source metadata density”까지 확장.

Removed/Deprecated:
- deskterior 신규 자산이 3종 curated baseline에만 머문다는 가정.

## 2026-04-19 변경 동기화 (Precision Editor Phase Plan From Analysis)
Added:
- 심층 분석 보고서 기반의 5단계 실행 순서(측정 기반 고정 -> 자산 파이프라인 강제 -> 정밀 편집 엔진 분리 -> 모드별 렌더 품질 사다리 -> 공유/커뮤니티 안정화)를 추가.
- P2 범위에 mm 정수 기반 placement 계약과 room mode / desk precision mode 분리 계획을 명시.
- 리스크 항목에 단위 계약 전환과 모드 분리 지연 리스크를 추가.

Updated:
- P2를 단일 대형 트랙이 아니라 Slice 단위로 끊어서 진행하는 실행 방식을 명시.
- 현재 착수 범위를 Phase 1 / Slice 1(성능 예산 재정렬)로 고정.

Removed/Deprecated:
- 정밀 편집 엔진, 자산 파이프라인, 실사 렌더 개선을 한 번에 병렬 추진한다는 가정.

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
