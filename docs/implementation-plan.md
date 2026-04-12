# 구현 계획 (공간 우선)

## P0
목표: 공간 우선 제품 표면 고정

완료:
- README 첫 문장을 공간 우선 제품 정의로 재작성
- `docs/legacy/` 분리 및 메인 문서 정리
- 레거시 에디터 래퍼를 호환 경계로 격리
- serif 제거 및 공통 토큰/레이아웃 셸 적용

## P1
목표: 구조 분해와 경계 명확화

완료:
- builder step 모듈 분해 (`Shape/Dimension/Opening/Style`)
- scene store slice hook(`useShellStore/useAssetStore/useSelectionStore/useCameraStore/usePublishStore`) 도입
- 에디터/뷰어 뷰포트 분리 (`ProjectEditorViewport`, `ReadOnlySceneViewport`)
- hotspot inspector 공통 컴포넌트화 (`ProductHotspotDrawer`)

## P2
목표: showcase 및 검증 체계 정렬

완료:
- gallery/community 카드 컴포넌트 단일화
- 한국어 utility copy로 메인 surface 정리
- script namespace를 `primary:*` / `legacy:*`로 분리
- primary E2E strict contract 기준을 CI 기본 게이트로 반영
- full-flow E2E 명령 추가 (`primary:e2e:room-flow:full`)
- legacy CI 잡은 `LEGACY_PIPELINE_CI_ENABLED=true`에서만 실행되도록 분리
- 성능 budget 문서화 (`docs/performance-budget.md`)
- deskterior 전용 자산 파이프라인 추가 (Blender 원본 + 카탈로그 동기화 스크립트)
- 커스텀 desk/lamp/monitor stand GLB를 메인 catalog에 연결

## P3
목표: 운영 관측성과 대형 scene 최적화

완료:
- publish/share/public 뷰어 오류 이벤트 로깅(`lib/telemetry/scene-events.ts`) 도입
- 뷰어 전용 interaction 계층을 에디터 계층과 분리 유지
- 성능 예산/회귀 검증 문서 및 CI 경로를 공간 우선 기준으로 정렬
- 조명 제품 동적 광원 처리(최대 6개 캡)로 deskterior 조명 상호작용 보강

## 레거시 트랙

과거 파이프라인/운영 아카이브:
- `docs/legacy/implementation-plan-archive.md`
- `docs/legacy/master-guide-archive.md`
- `docs/legacy/ai-pipeline.md`
