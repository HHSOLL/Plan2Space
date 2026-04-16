# 마스터 가이드 (엔지니어링 단일 기준)

이 문서는 Plan2Space의 현재 제품 기준을 정의합니다.

## 핵심 제품 정의
Plan2Space의 메인 제품은 **IKEA Kreativ 스타일 room-first 데스크테리어 빌더/에디터/뷰어/커뮤니티**입니다.

핵심 경로:
1. `/` 시작하기 화면에서 `공간 선택` 또는 `공간 만들기` 진입점을 선택
2. `/studio/select`에서 빈 공간 템플릿 또는 가구가 배치된 템플릿을 고르고 즉시 프로젝트를 만든다
3. `/studio/builder`에서 맞춤형 방 생성 4단계를 거쳐 프로젝트를 만든다
4. `/project/[id]`에서 데스크테리어 배치/편집/저장
5. 공유 모달에서 링크 발행
6. `/shared/[token]`, `/gallery`, `/community`에서 읽기 전용 3D 뷰어로 조회

## 제품 규칙
- 홈/선택/빌더/에디터/뷰어/갤러리/커뮤니티는 같은 디자인 시스템을 사용한다.
- 홈/선택/빌더는 공통 상단 bar에서 좌측 브랜드와 우측 로그인/로그아웃 affordance를 유지한다.
- 레이아웃 기본은 `상단 app bar + 좌측 rail + 중앙 grey viewport + 하단 pill toolbar`다.
- 좌측 rail 폭은 360~380px(기본 368px)로 고정한다.
- 뷰어는 읽기 전용이며 편집 affordance를 노출하지 않는다.
- 제품 클릭 시 제품 정보를 확인할 수 있어야 한다.
- 커뮤니티 게시물은 동일한 3D 씬 데이터 계약(`sceneDocument`)으로 재생되어야 한다.
- 제품 메타데이터는 실측 규격(`dimensionsMm`)과 마감(`finishColor`, `finishMaterial`, `detailNotes`)을 유지해야 한다.
- 실측 고정 제품(`scaleLocked=true`)은 에디터에서 임의 스케일 변경을 허용하지 않는다.
- 데스크/선반 표면 배치는 실측 규격이 있으면 해당 값 기반으로 support surface를 계산한다.
- floor/surface 배치는 active asset footprint 기반 wall clearance + 자산 간 분리(relaxation)를 적용한다.
- Blender 슬롯(`DeskWood`, `DeskMetal`, `StandWood`, `StandPad`, `LampBody`, `LampAccent`, `LampBulb`)은 slot-aware finish 매핑을 우선 적용한다.
- project thumbnail storage가 일시적으로 준비되지 않았더라도 version save와 editor 진입은 계속되어야 한다.

## 아키텍처 경계
- Frontend: `apps/web` (active product surface)
- API: `apps/api` (asset generation enqueue + health)
- Worker: `apps/worker` (asset generation processing)
- Supabase: auth/storage/database
- Asset pipeline: `assets/blender/deskterior`(source) + `apps/web/public/assets/models`(runtime) + `apps/web/public/assets/catalog/manifest.json`(catalog)

## 활성 웹 계약
- `GET /api/v1/projects/:projectId/bootstrap`
- `GET /api/v1/projects/:projectId/versions/latest`
- `POST /api/v1/projects/:projectId/versions`
- `GET /api/v1/catalog`
- `GET /api/v1/showcase`
- `GET /api/v1/public-scenes/[token]`
- `POST /api/v1/assets/generate`
- `GET /api/v1/jobs/:jobId`

## 품질 게이트
- `npm --workspace apps/web run type-check`
- `npm --workspace apps/web run lint`
- `npm --workspace apps/web run build`

## 필수 참조 문서
- `docs/implementation-plan.md`
- `docs/3d-visual-engine.md`
- `docs/user-action-guide.md`
- `docs/deployment.md`

## 2026-04-14 변경 동기화 (IKEA Kreativ Pivot Hard Cleanup)
Added:
- IKEA Kreativ 스타일 room-first + deskterior + community 3D viewing을 canonical 제품 정의로 고정.
- API/Worker 역할을 asset generation 전용으로 재정의.

Updated:
- 활성 계약에 자산 생성 작업(`assets/generate`, `jobs/:jobId`)을 명시.
- 경계 정의에서 floorplan/intake 파이프라인 의존을 제거.

Removed/Deprecated:
- `docs/legacy/*` 및 floorplan/intake compatibility를 메인 기준으로 참조하던 항목.
- legacy 파이프라인 보존 전제.

## 2026-04-16 변경 동기화 (Reference Start Flow + Template Browser)
Added:
- 홈 시작하기 화면(`/`)과 템플릿 선택 화면(`/studio/select`)을 메인 제품 경로에 추가.
- 빈 공간 템플릿과 가구 배치 템플릿을 같은 빌더/에디터 계약으로 연결하는 기준을 명시.

Updated:
- 핵심 경로를 `홈 -> 공간 선택/공간 만들기 -> builder -> editor -> share/view/community` 순서로 재정의.
- 동일 디자인 시스템 적용 범위를 홈/선택 화면까지 확장.

Removed/Deprecated:
- 사용자가 항상 `/studio/builder`에서 직접 시작한다는 가정.

## 2026-04-16 변경 동기화 (Reference 4-Step Builder Shell)
Added:
- `/studio/builder`를 레퍼런스 기준의 고정 4-step split shell(좌측 white configurator + 우측 grey viewport)로 정렬.
- step 2는 top-view 치수 오버레이, step 3/4는 isometric preview를 기본값으로 사용하는 규칙을 추가.

Updated:
- 빌더 단계 UI를 `모양 -> 치수 -> 문/창문 -> 스타일` 레퍼런스 레이아웃 기준으로 재정의.
- 개구부 스타일 변경과 로그인 복귀 초안 복원이 빌더 상태를 덮어쓰지 않도록 restore 동작을 강화.

Removed/Deprecated:
- 빌더 내부 상단 quick-start badge, step chip, preview summary 카드 중심의 이전 shell.

## 2026-04-16 변경 동기화 (Editor Precision Controls)
Added:
- `/project/[id]` 상단뷰 편집에서 `월드/로컬` transform space 토글을 기본 편집 affordance에 추가.
- TransformControls 드래그 중에도 room bounds + anchor solver를 재적용하는 live placement clamp 규칙을 추가.

Updated:
- 상단뷰 자산 조작 기준을 `이동/회전`만이 아니라 `이동/회전 + world/local 좌표계`까지 포함하도록 확장.

Removed/Deprecated:
- gizmo 보정이 mouse-up 시점에만 적용된다는 전제.

## 2026-04-16 변경 동기화 (Editor Reference Chrome Pass)
Added:
- `/project/[id]` 상단 app bar, 좌측 catalog rail, 우측 zoom rail, 하단 pill toolbar를 레퍼런스 7번 이미지 기준 shell로 고정.
- 공유 모달을 editor shell과 같은 light rail 언어로 정렬.

Updated:
- editor 기본 chrome을 floating card 조합에서 `flat top bar + slim rail + grey viewport + compact bottom toolbar` 구조로 재정의.
- 좌측 rail 기본 폭을 368px 기준으로 축소해 레퍼런스 density에 맞춤.

Removed/Deprecated:
- 에디터 상단의 개별 floating badge/card 조합과 dark glass 공유 모달.

## 2026-04-16 변경 동기화 (Shared Viewer + Furnished Feed Reference Pass)
Added:
- `/shared/[token]`를 editor shell의 읽기 전용 미러(top bar + grey viewport + right zoom rail + bottom status pill)로 고정.
- `/gallery`, `/community`를 레퍼런스 8번 이미지 기준의 furnished-space 카드 피드 shell로 고정.

Updated:
- shared viewer 제품 정보 노출 방식을 `상단 hero/metric` 중심에서 `뷰포트 우선 + hotspot drawer 상세 정보` 구조로 재정의.
- gallery/community 기본 밀도를 4열 카드 그리드와 상단 필터 rail 중심으로 정렬.

Removed/Deprecated:
- shared viewer 상단 hero metric strip과 gallery/community의 분산된 보조 status card 조합.

## 2026-04-16 변경 동기화 (Start Flow Fixes + Builder Shell Fit)
Added:
- 홈/선택/빌더 상단에 브랜드 + 로그인/로그아웃 단순 bar 규칙을 추가.
- 선택 템플릿이 builder를 거치지 않고 저장된 project를 만든 뒤 editor로 직접 진입하는 기준을 명시.
- builder step 2 치수 overlay가 실제 floor outline을 사용해야 한다는 규칙을 추가.

Updated:
- builder를 "템플릿 보정 + 맞춤 생성" 공용 진입점에서 "맞춤형 방 생성 전용" 흐름으로 좁힘.
- builder desktop shell을 viewport 높이에 맞춰 페이지 스크롤 없이 유지하고, 내부 rail만 최소 스크롤을 허용하는 구조로 갱신.
- storage bucket 미준비 시 thumbnail upload를 복구/재시도하고, 실패해도 save 자체는 계속하도록 저장 규칙을 강화.

Removed/Deprecated:
- 템플릿 선택이 `/studio/builder` 쿼리스트링 복원 경로를 항상 거친다는 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Runtime Pass)
Added:
- 실측/마감 메타데이터를 catalog -> save pipeline -> sceneDocument -> viewer hotspot까지 유지하는 계약을 기본 규칙으로 추가.
- `scaleLocked` 제품의 에디터 스케일 변경 차단 정책을 제품 규칙에 명시.

Updated:
- 공유 뷰어 제품 정보 기준을 브랜드/가격/옵션 중심에서 실측 규격/마감/디테일까지 확장.

Removed/Deprecated:
- 규격 정보가 문자열 옵션(`options`)에만 의존하던 운영 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-2)
Added:
- `dimensionsMm` 기반 support 배치 정합성을 제품 규칙에 추가.

Updated:
- 마감 메타데이터 소비 범위를 정보 표시에서 런타임 재질 반영까지 확장.

Removed/Deprecated:
- support 배치가 키워드 기반 휴리스틱에만 의존한다는 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-3)
Added:
- active asset footprint를 반영하는 wall clearance + inter-asset separation 솔버를 배치 기본 규칙에 추가.
- Blender 알려진 머티리얼 슬롯 우선의 slot-aware finish 반영 기준을 추가.

Updated:
- 신규 자산 추가 경로도 실측 메타를 넘겨 첫 배치 시점부터 물리 솔버가 동작하도록 갱신.

Removed/Deprecated:
- 신규 배치에서 fallback 규격만으로 배치 정합성을 판단하던 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-4)
Added:
- 홈 화면 레퍼런스 사진 톤을 기준으로 3D 캔버스의 기본 룩(채광/대비/접지감) 품질 목표를 추가.
- HDRI 선택 우선순위(kiara/hotel/photo-studio 계열) 기준을 기본 렌더 규약으로 명시.

Updated:
- 배치 정확도 중심 규칙을 유지하면서도, 에디터/뷰어 기본 노출과 조명 균형을 사진 레퍼런스 수준으로 상향.

Removed/Deprecated:
- 첫 HDRI 항목을 무조건 사용하던 비결정적 환경 선택 가정.
