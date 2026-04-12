# Plan2Space File Role Index

이 문서는 "어느 파일이 무슨 역할을 하는지" 빠르게 찾기 위한 경로 인덱스입니다.

규칙:

- 설명은 짧게 적었습니다.
- public product에서 중요한 파일과 ops/legacy 파일을 구분했습니다.
- 모든 파일을 한 줄 한 줄 외우는 것이 목적이 아니라, "어디를 먼저 봐야 하는지" 찾는 것이 목적입니다.

## 1. Root

- `AGENTS.md`
  - Codex/에이전트 작업 규칙
- `README.md`
  - 저장소 빠른 시작
- `package.json`
  - monorepo 루트 스크립트
- `schema.sql`
  - Supabase 전체 스키마 기준
- `infra/railway/railway.api.json`
  - Railway API 배포 설정
- `infra/railway/railway.worker.json`
  - Railway Worker 배포 설정
- `scripts/assets-download.mjs`
  - 에셋 다운로드 유틸리티
- `scripts/draco-compress.mjs`
  - GLB 압축 유틸리티
- `scripts/qa/agent-browser-e2e.sh`
  - 브라우저 검증 보조 스크립트

## 2. `apps/web/src/app`

### Auth / public pages

- `apps/web/src/app/layout.tsx`
  - 전체 앱 레이아웃과 전역 provider
- `apps/web/src/app/page.tsx`
  - 랜딩 페이지
- `apps/web/src/app/auth/page.tsx`
  - auth 진입 화면
- `apps/web/src/app/auth/callback/route.ts`
  - OAuth callback 처리
- `apps/web/src/app/(auth)/login/page.tsx`
  - 로그인 페이지
- `apps/web/src/app/(auth)/signup/page.tsx`
  - 회원가입 페이지
- `apps/web/src/app/assets/page.tsx`
  - 에셋 관련 공개/테스트 화면
- `apps/web/src/app/gallery/page.tsx`
  - 공개 pinned snapshot archive
- `apps/web/src/app/community/page.tsx`
  - 공개 community feed
- `apps/web/src/app/studio/page.tsx`
  - 스튜디오 허브
- `apps/web/src/app/studio/builder/page.tsx`
  - builder-first room 생성 화면
- `apps/web/src/app/studio/create/page.tsx`
  - create alias route
- `apps/web/src/app/error.tsx`
  - 앱 에러 fallback
- `apps/web/src/app/not-found.tsx`
  - 404 화면

### Editor / shared

- `apps/web/src/app/(editor)/project/[id]/page.tsx`
  - 메인 3D editor
- `apps/web/src/app/shared/[token]/page.tsx`
  - shared viewer 서버 진입점
- `apps/web/src/app/shared/[token]/SharedProjectClient.tsx`
  - shared viewer 클라이언트 렌더링

## 3. `apps/web/src/components`

### Common / providers

- `apps/web/src/components/sonner-toaster.tsx`
  - toast UI
- `apps/web/src/components/providers/Providers.tsx`
  - React provider 집합
- `apps/web/src/components/auth-panel.tsx`
  - auth 관련 상위 패널
- `apps/web/src/components/common/Button.tsx`
  - 공용 버튼
- `apps/web/src/components/common/Loading.tsx`
  - 공용 로딩 UI
- `apps/web/src/components/common/Modal.tsx`
  - 공용 모달

### Auth

- `apps/web/src/components/auth/LoginForm.tsx`
  - 로그인 폼
- `apps/web/src/components/auth/SignupForm.tsx`
  - 회원가입 폼

### Landing / navigation

- `apps/web/src/components/navigation/PremiumNavbar.tsx`
  - 상단 네비게이션
- `apps/web/src/components/landing/landing-hero-canvas.tsx`
  - 랜딩 배경/hero canvas

### Overlay / modal / HUD

- `apps/web/src/components/overlay/AuthPopup.tsx`
  - 소셜 로그인 팝업
- `apps/web/src/components/overlay/LoadingOverlay.tsx`
  - 초기 로딩 오버레이
- `apps/web/src/components/overlay/NewProjectModal.tsx`
  - 새 프로젝트 관련 오버레이
- `apps/web/src/components/overlay/panels/AIAssistantPanel.tsx`
  - AI 보조 패널
- `apps/web/src/components/overlay/hud/Crosshair.tsx`
  - walk mode 조준점
- `apps/web/src/components/overlay/hud/MobileControls.tsx`
  - 모바일 조작 HUD
- `apps/web/src/components/overlay/hud/MobileTouchHint.tsx`
  - 모바일 힌트 UI

### Editor shell

- `apps/web/src/components/editor/ProjectEditorHeader.tsx`
  - editor 상단 헤더
- `apps/web/src/components/editor/BuilderLaunchState.tsx`
  - 빈 상태/launch 상태 화면
- `apps/web/src/components/editor/BuilderLibraryShelf.tsx`
  - 좌측 가구/카탈로그 패널
- `apps/web/src/components/editor/BuilderInspectorPanel.tsx`
  - 우측 inspector 패널
- `apps/web/src/components/editor/SceneViewport.tsx`
  - editor/shared 공통 3D viewport
- `apps/web/src/components/editor/StudioModeToggle.tsx`
  - top/walk 모드 토글
- `apps/web/src/components/editor/StudioMetricGrid.tsx`
  - 통계/메트릭 카드 그리드
- `apps/web/src/components/editor/SaveButton.tsx`
  - 저장 버튼
- `apps/web/src/components/editor/EditorStatusBadge.tsx`
  - dirty/saving/saved 상태 표시
- `apps/web/src/components/editor/ShareModal.tsx`
  - 공유 링크/공개 설정 모달
- `apps/web/src/components/editor/MobileEditorControls.tsx`
  - 모바일 편집 컨트롤
- `apps/web/src/components/editor/RoomShellEditor.tsx`
  - room shell 보정용 2D 편집 컴포넌트
- `apps/web/src/components/editor/legacy/FloorplanEditor.tsx`
  - legacy 호환 wrapper
- `apps/web/src/components/editor/useAssetCatalog.ts`
  - 카탈로그 검색/필터 훅
- `apps/web/src/components/editor/useEditorSaveSession.ts`
  - autosave/session 상태 훅

### Canvas core

- `apps/web/src/components/canvas/core/CameraRig.tsx`
  - top/walk 카메라 제어
- `apps/web/src/components/canvas/core/PhysicsWorld.tsx`
  - Rapier world wrapper
- `apps/web/src/components/canvas/core/SceneEnvironment.tsx`
  - HDRI / scene environment

### Canvas effects

- `apps/web/src/components/canvas/effects/Lights.tsx`
  - 기본 조명 세트
- `apps/web/src/components/canvas/effects/PostEffects.tsx`
  - bloom/noise/vignette 후처리

### Canvas features

- `apps/web/src/components/canvas/features/ProceduralWall.tsx`
  - 벽 렌더링
- `apps/web/src/components/canvas/features/ProceduralFloor.tsx`
  - 바닥 렌더링
- `apps/web/src/components/canvas/features/ProceduralCeiling.tsx`
  - 천장 렌더링
- `apps/web/src/components/canvas/features/Furniture.tsx`
  - 씬 안의 가구 렌더링/선택
- `apps/web/src/components/canvas/features/InteractiveDoors.tsx`
  - 문 상호작용
- `apps/web/src/components/canvas/features/InteractiveLights.tsx`
  - 조명 상호작용

### Canvas interaction

- `apps/web/src/components/canvas/interaction/InteractionManager.tsx`
  - 씬 상호작용 관리자
- `apps/web/src/components/canvas/interaction/AssetTransformControls.tsx`
  - 가구 변환 gizmo
- `apps/web/src/components/canvas/interaction/EditorHotkeys.tsx`
  - 단축키 처리

### Other canvas / furniture helpers

- `apps/web/src/components/canvas/WallManager.tsx`
  - 벽 관리 보조 컴포넌트
- `apps/web/src/components/canvas/FirstPersonController.tsx`
  - 1인칭 컨트롤 보조
- `apps/web/src/components/canvas/FirstPersonPlayer.tsx`
  - 1인칭 플레이어 표현
- `apps/web/src/components/canvas/FurnitureMesh.tsx`
  - 개별 가구 mesh 보조
- `apps/web/src/components/furniture/Bed.tsx`
  - 침대 모델/프리셋 컴포넌트
- `apps/web/src/components/furniture/Chair.tsx`
  - 의자 모델/프리셋 컴포넌트
- `apps/web/src/components/furniture/Desk.tsx`
  - 책상 모델/프리셋 컴포넌트
- `apps/web/src/components/furniture/Sofa.tsx`
  - 소파 모델/프리셋 컴포넌트
- `apps/web/src/components/furniture/Table.tsx`
  - 테이블 모델/프리셋 컴포넌트
- `apps/web/src/components/furniture/FurnitureObject.tsx`
  - 가구 공통 wrapper

### Library / project cards

- `apps/web/src/components/library/ModelCard.tsx`
  - 모델 카드
- `apps/web/src/components/library/ModelLibraryModal.tsx`
  - 모델 라이브러리 모달
- `apps/web/src/components/library/ModelPreview.tsx`
  - 모델 미리보기
- `apps/web/src/components/project/PremiumProjectCard.tsx`
  - 스튜디오 프로젝트 카드
- `apps/web/src/components/project/PublishedSnapshotCard.tsx`
  - gallery/community 공개 카드

## 4. `apps/web/src/lib`

### API / backend bridge

- `apps/web/src/lib/api.ts`
  - 웹 API 보조 진입점
- `apps/web/src/lib/api/project.ts`
  - 프로젝트/버전 API 호출
- `apps/web/src/lib/api/showcase.ts`
  - gallery/community API 호출
- `apps/web/src/lib/backend/client.ts`
  - Railway API fetch wrapper
- `apps/web/src/lib/backend/auth.ts`
  - API 인증 보조

### AI / share / builder

- `apps/web/src/lib/ai/scaleInfo.ts`
  - scale 정보 파싱/검증
- `apps/web/src/lib/ai-ui/stub.ts`
  - AI UI stub
- `apps/web/src/lib/builder/catalog.ts`
  - builder 카탈로그 계약과 summary 계산
- `apps/web/src/lib/builder/templates.ts`
  - room 템플릿과 마감 프리셋
- `apps/web/src/lib/share/permissions.ts`
  - 공유 권한 정규화
- `apps/web/src/lib/share/preview.ts`
  - 공유 미리보기 메타 처리

### Geometry / loaders / 3D

- `apps/web/src/lib/geometry/floor-shape.ts`
  - 바닥 shape 계산
- `apps/web/src/lib/geometry/wall-generator.ts`
  - 벽 geometry 보조
- `apps/web/src/lib/loaders/AssetLoader.ts`
  - 3D 에셋 로더
- `apps/web/src/lib/three-utils.ts`
  - Three.js 유틸리티

### Auth / storage / misc

- `apps/web/src/lib/auth/browser-origin.ts`
  - 브라우저 origin 처리
- `apps/web/src/lib/auth/session-recovery.ts`
  - 세션 복구 보조
- `apps/web/src/lib/storage.ts`
  - 브라우저 저장소 보조
- `apps/web/src/lib/collaboration.ts`
  - 협업 관련 보조 로직
- `apps/web/src/lib/i18n/translations.ts`
  - 다국어 문자열
- `apps/web/src/lib/supabase.ts`
  - Supabase 공통 진입점
- `apps/web/src/lib/supabase/client.ts`
  - 브라우저용 Supabase client
- `apps/web/src/lib/supabase/server.ts`
  - 서버용 Supabase client

### Stores

- `apps/web/src/lib/stores/useAuthStore.ts`
  - 인증 상태 store
- `apps/web/src/lib/stores/useEditorStore.ts`
  - editor shell 상태 store
- `apps/web/src/lib/stores/useInteractionStore.ts`
  - 상호작용 상태 store
- `apps/web/src/lib/stores/useLanguageStore.ts`
  - 언어 선택 store
- `apps/web/src/lib/stores/useMobileControlsStore.ts`
  - 모바일 컨트롤 store
- `apps/web/src/lib/stores/useProjectStore.ts`
  - 프로젝트 목록/현재 프로젝트 store
- `apps/web/src/lib/stores/useSceneStore.ts`
  - 씬 데이터/히스토리 store

## 5. `apps/web/src/features`, `hooks`, `data`, `types`, `utils`

- `apps/web/src/features/assets/generate.ts`
  - custom asset generation 기능 보조
- `apps/web/src/features/floorplan/result-mapper.ts`
  - API/버전 데이터를 scene state로 변환
- `apps/web/src/hooks/useAuth.ts`
  - auth hook
- `apps/web/src/hooks/useDebounce.ts`
  - debounce hook
- `apps/web/src/hooks/useProjects.ts`
  - 프로젝트 hook
- `apps/web/src/hooks/useRealtime.ts`
  - realtime hook
- `apps/web/src/hooks/useRealtimeSync.ts`
  - realtime sync hook
- `apps/web/src/hooks/useThreeScene.ts`
  - Three scene hook
- `apps/web/src/data/furnitureModels.ts`
  - 가구 모델 메타데이터
- `apps/web/src/types/auth.ts`
  - auth 타입
- `apps/web/src/types/furniture.ts`
  - 가구 타입
- `apps/web/src/types/index.ts`
  - 타입 barrel
- `apps/web/src/utils/export.ts`
  - export 유틸리티

## 6. `apps/web/scripts`

- `apps/web/scripts/smoke-preview-runtime.mjs`
  - preview 런타임 검증
- `apps/web/scripts/e2e-intake-flow.ts`
  - intake 실환경 E2E
- `apps/web/scripts/eval-floorplan.ts`
  - floorplan 평가 실행
- `apps/web/scripts/eval-floorplan-gate.ts`
  - 평가 결과 게이트
- `apps/web/scripts/validate-floorplan-fixtures.ts`
  - fixture 검증

## 7. `apps/api/src`

### Entrypoints / config / middleware

- `apps/api/src/server.ts`
  - API 서버 시작
- `apps/api/src/app.ts`
  - Express app, router, error handler
- `apps/api/src/config/env.ts`
  - API env 파싱
- `apps/api/src/config/env.test.ts`
  - env 테스트
- `apps/api/src/middleware/auth.ts`
  - JWT 인증 middleware

### Routes

- `apps/api/src/routes/health.ts`
  - health check
- `apps/api/src/routes/projects.ts`
  - 프로젝트/버전 API
- `apps/api/src/routes/showcase.ts`
  - 공개 snapshot API
- `apps/api/src/routes/scenes.ts`
  - ops/legacy scene seam
- `apps/api/src/routes/revisions.ts`
  - layout revision 조회
- `apps/api/src/routes/intake.ts`
  - intake API
- `apps/api/src/routes/floorplans.ts`
  - floorplan 결과 API
- `apps/api/src/routes/jobs.ts`
  - job 상태 API
- `apps/api/src/routes/catalog.ts`
  - catalog search API
- `apps/api/src/routes/assets.ts`
  - asset generation API

### Services

- `apps/api/src/services/errors.ts`
  - API 에러 타입
- `apps/api/src/services/supabase.ts`
  - Supabase client 생성
- `apps/api/src/services/project-service.ts`
  - 프로젝트 도메인 서비스
- `apps/api/src/services/project-version-service.ts`
  - project version 생성/직렬화
- `apps/api/src/services/scene-service.ts`
  - latest version resolve 보조
- `apps/api/src/services/floorplan-service.ts`
  - floorplan 관련 서비스
- `apps/api/src/services/intake-service.ts`
  - intake 서비스
- `apps/api/src/services/job-service.ts`
  - job 서비스
- `apps/api/src/services/asset-service.ts`
  - asset 서비스
- `apps/api/src/services/legacy-backfill-service.ts`
  - old project -> version backfill

### Repositories

- `apps/api/src/repositories/projects-repo.ts`
  - projects table access
- `apps/api/src/repositories/results-repo.ts`
  - floorplan_results / project_versions read
- `apps/api/src/repositories/floorplans-repo.ts`
  - floorplans table access
- `apps/api/src/repositories/intake-sessions-repo.ts`
  - intake_sessions table access
- `apps/api/src/repositories/jobs-repo.ts`
  - jobs table access
- `apps/api/src/repositories/revisions-repo.ts`
  - revisions table access
- `apps/api/src/repositories/source-assets-repo.ts`
  - source assets access
- `apps/api/src/repositories/catalog-repo.ts`
  - catalog access

## 8. `apps/api/scripts`

- `apps/api/scripts/backfill-legacy-project-versions.ts`
  - old project를 `project_versions`로 채우는 ops CLI

## 9. `apps/worker/src`

### Entrypoints / config

- `apps/worker/src/worker.ts`
  - worker 메인 루프
- `apps/worker/src/config/env.ts`
  - worker env 파싱

### Queue

- `apps/worker/src/queue/claim-next-job.ts`
  - 다음 작업 claim

### Processors

- `apps/worker/src/processors/floorplan-processor.ts`
  - floorplan job 처리
- `apps/worker/src/processors/asset-generation-processor.ts`
  - asset generation job 처리
- `apps/worker/src/processors/floorplan-accuracy.test.ts`
  - 정확도 테스트
- `apps/worker/src/processors/asset-generation-processor.test.ts`
  - asset generation 테스트

### Pipeline

- `apps/worker/src/pipeline/preprocess.ts`
  - 입력 이미지 전처리
- `apps/worker/src/pipeline/provider-executor.ts`
  - provider 호출 오케스트레이션
- `apps/worker/src/pipeline/provider-executor.test.ts`
  - provider 실행 테스트
- `apps/worker/src/pipeline/normalize-validate.ts`
  - topology 정규화/검증
- `apps/worker/src/pipeline/geometry-builder.ts`
  - geometry 구성
- `apps/worker/src/pipeline/geometry-builder.test.ts`
  - geometry 테스트
- `apps/worker/src/pipeline/revision-builder.ts`
  - revision 생성
- `apps/worker/src/pipeline/scene-builder.ts`
  - scene artifact 생성

### Worker repositories / services

- `apps/worker/src/services/supabase.ts`
  - worker용 Supabase client
- `apps/worker/src/repositories/assets-repo.ts`
  - asset repo
- `apps/worker/src/repositories/floorplans-repo.ts`
  - floorplan repo
- `apps/worker/src/repositories/intake-sessions-repo.ts`
  - intake repo
- `apps/worker/src/repositories/jobs-repo.ts`
  - jobs repo
- `apps/worker/src/repositories/projects-repo.ts`
  - projects repo
- `apps/worker/src/repositories/results-repo.ts`
  - results repo
- `apps/worker/src/repositories/revisions-repo.ts`
  - revisions repo
- `apps/worker/src/repositories/source-assets-repo.ts`
  - source assets repo

## 10. `packages`

### `packages/contracts`

- `packages/contracts/src/index.ts`
  - barrel export
- `packages/contracts/src/projects.ts`
  - project 계약
- `packages/contracts/src/floorplans.ts`
  - floorplan 계약
- `packages/contracts/src/jobs.ts`
  - job 계약
- `packages/contracts/src/scenes.ts`
  - scene 계약
- `packages/contracts/src/catalog.ts`
  - catalog 계약
- `packages/contracts/src/intake.ts`
  - intake 계약
- `packages/contracts/src/revisions.ts`
  - revision 계약
- `packages/contracts/src/assets.ts`
  - asset 계약

### `packages/floorplan-core`

- `packages/floorplan-core/src/index.ts`
  - barrel export
- `packages/floorplan-core/src/analyze.ts`
  - floorplan core 분석 진입점

### `packages/shared`

- `packages/shared/src/types.ts`
  - shared 타입 모음

## 11. 문서 / 운영 자료

- `docs/master-guide.md`
  - 엔지니어링 source of truth
- `docs/implementation-plan.md`
  - phase 계획
- `docs/user-action-guide.md`
  - 사람이 직접 해야 하는 운영 작업
- `docs/ai-pipeline.md`
  - AI/worker 계약
- `docs/3d-visual-engine.md`
  - 렌더링 품질 기준
- `docs/deployment.md`
  - 배포 안내
- `docs/developer-handbook.md`
  - 비개발자도 읽을 수 있는 큰 설명서

## 12. 읽는 순서 추천

1. `README.md`
2. `docs/developer-handbook.md`
3. `docs/master-guide.md`
4. `docs/file-role-index.md`
5. 실제 수정하려는 앱의 엔트리 파일
