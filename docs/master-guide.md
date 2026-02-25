# Master Guide (Engineering Source of Truth)

이 문서는 Plan2Space의 **엔지니어링 기준 문서**입니다. 코드/문서/아키텍처 변경 시 가장 먼저 갱신해야 합니다.

## Non-Negotiables
- Semantic parsing → 2D correction → Procedural 3D 파이프라인 유지.
- Top view / Walk mode 두 모드 카메라 경험 보장.
- PBR 재질 + HDR 환경광 + 후처리(Post FX)로 고품질 시각 유지.

## 운영 프로토콜 (필수)
- 작업 시작 전 `AGENTS.md`의 Must Read 문서를 순서대로 확인합니다.
- 작업 유형에 맞는 스킬을 먼저 선택합니다.
  - Architecture/Scope: `plan2space-project-core`
  - UX/Visual: `plan2space-studio-ux`
  - Blueprint AI: `plan2space-blueprint-ai`
- 코드/구조 변경 후 문서를 반드시 동기화합니다.
  - 제약 변경: `docs/master-guide.md`
  - 단계/완료조건 변경: `docs/implementation-plan.md`
  - AI 계약 변경: `docs/ai-pipeline.md`
  - 시각 품질 변경: `docs/3d-visual-engine.md`

## 시스템 구성 요약
- **프레임워크**: Next.js 14 App Router (`apps/web`)
- **3D 엔진**: React Three Fiber + Drei + Rapier + CSG
- **AI 파이프라인**: `POST /api/ai/parse-floorplan` → Topology 반환
- **Template Retrieval**: `apps/web/src/lib/ai/template/retrieval.ts` (catalog text/image hash 매칭)
- **UI Assistant**: json-render 기반 패널 (씬 스냅샷/퀵 액션)
- **스토리지/인증**: Supabase (Auth, Storage, RPC)

## 핵심 파이프라인
1) 도면 업로드 → `parse-floorplan` 호출
2) AI 응답 정규화/검증 → 2D 보정 편집기 노출 (스케일 측정/자동 도어 스케일 포함)
3) 사용자 확인 → 절차적 3D 생성
4) 저장/공유 시 Supabase RPC(`create_project_version`)로 버전 저장

카탈로그 파이프라인:
1) `mode="catalog"` + `catalogQuery(apartmentName/typeName/region?)`
2) 템플릿 후보 매칭(text/image hash) + topology 품질 게이트
3) 성공 시 2D 보정으로 진입, 실패 시 `422 recoverable`로 수동 복구

세부 흐름은 `docs/ai-pipeline.md`, `docs/floorplan-3d-flow.md`를 따릅니다.

## 디렉토리 기준
```
apps/web/src/app/              Next.js 라우트, API
apps/web/src/components/       UI/3D 컴포넌트
apps/web/src/lib/              스토어, AI/캐시, Supabase, geometry
apps/web/src/types/            타입 계약
```

## 상태 경계 (Zustand)
- `useEditorStore`: 뷰 모드/패널/선택 상태 (UI)
- `useSceneStore`: 벽/개구부/바닥/에셋/스케일 (3D 데이터)
- `useProjectStore`: 프로젝트 메타 (현재 로컬 저장소 기반)

UI 상태와 씬 데이터는 반드시 분리하며, 렌더 루프에 불필요한 상태 변화를 주지 않습니다.

## 3D 시각 품질 기준
- `SceneEnvironment` + HDRI + ContactShadows 활성화
- `PostEffects`(Bloom/Vignette/Noise) 기본 적용
- ToneMapping: ACESFilmic + physicallyCorrectLights 적용

상세는 `docs/3d-visual-engine.md`와 `docs/3d-engine.md`를 따릅니다.

## 품질/성능 가드레일
- 도면 분석 실패는 `HTTP 422 + recoverable=true`로 명시하며, 성공(200)으로 위장하지 않음.
- 도면 분석 실패 시에도 2D 보정으로 복구 가능해야 함.
- provider는 첫 성공 즉시 채택하지 않고 후보 스코어링으로 최고점 결과를 선택.
- 후보 스코어링은 `topology/opening/scale/penalty` breakdown을 포함해 debug에서 추적 가능해야 함.
- `metadata.scaleInfo(value/source/confidence/evidence)`를 계약으로 유지하고 저장/복원 시 보존.
- 스케일 보정 없이 3D 생성(Top/Walk 진입)이 진행되지 않도록 게이팅.
  - `source=unknown` 또는 `confidence<0.6`이면 3D 진입 차단.
- 2D 편집기에서 wall/opening confidence(초록/노랑/빨강)를 시각화하고, 저신뢰 요소를 우선 수정하도록 안내.
- Walk 모드에서 벽 관통 금지(물리 충돌 유지).
- 물리 콜라이더에서 window는 통로로 제거하지 않고, door만 통로 처리.
- Post FX는 성능 부담이 큰 옵션(SSAO/DoF 등)을 기본 비활성으로 유지.
- `apps/web/scripts/eval-floorplan.ts` + `apps/web/scripts/eval-floorplan-gate.ts` 결과를 회귀 지표로 사용.

기본 품질 게이트:
- `npm --workspace apps/web run type-check`
- `npm --workspace apps/web run lint`
- `npm --workspace apps/web run build`

## 관련 문서
- `docs/ai-pipeline.md`
- `docs/floorplan-3d-flow.md`
- `docs/3d-visual-engine.md`
- `docs/3d-engine.md`
- `docs/implementation-plan.md`
- `docs/user-action-guide.md`
