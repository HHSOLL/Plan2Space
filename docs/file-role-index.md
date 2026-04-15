# 파일 역할 인덱스 (활성 제품)

이 문서는 공간 우선 메인 제품 경로에서 자주 수정하는 파일만 빠르게 찾기 위한 인덱스입니다.

## 1) 라우트

- `apps/web/src/app/page.tsx`
  - 랜딩
- `apps/web/src/app/studio/page.tsx`
  - 스튜디오 허브
- `apps/web/src/app/studio/builder/page.tsx`
  - 룸 빌더 4단계
- `apps/web/src/app/(editor)/project/[id]/page.tsx`
  - 에디터
- `apps/web/src/app/shared/[token]/page.tsx`
  - 공유 뷰어 서버 진입점
- `apps/web/src/app/shared/[token]/SharedProjectClient.tsx`
  - 공유 뷰어 클라이언트
- `apps/web/src/app/gallery/page.tsx`
  - 갤러리
- `apps/web/src/app/community/page.tsx`
  - 커뮤니티

## 2) 빌더

- `apps/web/src/features/builder/BuilderFooter.tsx`
- `apps/web/src/features/builder/BuilderPreviewPane.tsx`
- `apps/web/src/features/builder/BuilderStepHeader.tsx`
- `apps/web/src/features/builder/steps/BuilderShapeStep.tsx`
- `apps/web/src/features/builder/steps/BuilderDimensionsStep.tsx`
- `apps/web/src/features/builder/steps/BuilderOpeningsStep.tsx`
- `apps/web/src/features/builder/steps/BuilderStyleStep.tsx`

## 3) 에디터

- `apps/web/src/components/editor/ProjectEditorHeader.tsx`
- `apps/web/src/components/editor/ProjectEditorViewport.tsx`
- `apps/web/src/components/editor/BuilderLibraryShelf.tsx`
- `apps/web/src/components/editor/BuilderInspectorPanel.tsx`
- `apps/web/src/components/editor/SceneViewport.tsx`
- `apps/web/src/components/editor/ShareModal.tsx`

## 4) 뷰어 / 쇼케이스

- `apps/web/src/components/viewer/ReadOnlySceneViewport.tsx`
- `apps/web/src/components/viewer/ProductHotspotDrawer.tsx`
- `apps/web/src/components/project/PublishedSnapshotCard.tsx`
- `apps/web/src/components/showcase/ShowcaseFilterRail.tsx`

## 5) 상태 / 도메인 / API

- `apps/web/src/lib/stores/scene-slices.ts`
- `apps/web/src/lib/stores/useSceneStore.ts`
- `apps/web/src/lib/domain/scene-document.ts`
- `apps/web/src/lib/server/showcase.ts`
- `apps/web/src/lib/server/projects.ts`
- `apps/web/src/lib/server/shares.ts`

## 6) 검증 / 스크립트

- `apps/web/scripts/e2e-primary-room-flow.ts`
- `apps/web/package.json`
- `.github/workflows/ci.yml`
