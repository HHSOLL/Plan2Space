# Implementation Plan (Phases)

이 문서는 개발 단계를 정의하고, 각 단계의 완료 조건을 명시합니다.

## Phase 0: 파이프라인 안정화 (현재 진행)
목표: 업로드 → 분석 → 2D 보정까지 끊김 없이 도달.

완료 조건:
- `apps/web` 품질 게이트(`type-check`, `lint`, `build`)가 대화형 입력 없이 통과.
- `parse-floorplan` 실패 시에도 2D 편집기로 복구 가능.
- `parse-floorplan` 실패는 `HTTP 422 + recoverable=true`로 명시되어야 함(성공 위장 금지).
- provider 후보 스코어링이 동작하고, 최고점 후보가 선택되어야 함(첫 성공 종료 금지).
- debug 응답에 `candidates[]`, `selectedProvider`, `selectedPassId`, `selectedPreprocessProfile`, `selectedScore`가 표시되어야 함.
- `candidates[]`에는 `scoreBreakdown(topology/opening/scale/penalty)`와 확장 metrics가 포함되어야 함.
- `providerErrors`와 `providerStatus[]`로 에러 원인이 명확히 표시됨.
- 전처리 튜닝 파라미터로 워터마크/컬러 도면 대응.
- 다중 전처리 pass(`balanced`, `lineart`) 후보 평가가 항상 수행되어야 함.
- `apps/web/scripts/eval-floorplan.ts`로 fixture 회귀 비교(JSON/CSV)가 가능해야 함.
- `apps/web/scripts/eval-floorplan-gate.ts`로 CI 임계치(success/loop/attach/422/unknown-scale)를 자동 판정할 수 있어야 함.
- `useSearchParams`/CSR 훅 사용으로 인한 빌드 타임 prerender 오류가 없어야 함.

## Phase 1: 2D 보정 UX 강화 (진행)
목표: 사용자 수정으로 정확도를 상용 수준까지 끌어올림.

완료 조건:
- 벽/개구부 추가·이동·삭제가 최소 클릭으로 가능.
- 스냅/정렬 피드백(가이드 라인) 제공.
- wall/opening confidence를 색상(초록/노랑/빨강)으로 시각화하고, 저신뢰 요소를 즉시 식별할 수 있어야 함.
- 스케일 측정(치수 입력) 및 자동 도어 스케일 보정 제공.
- 스케일 정보(`scaleInfo`)가 저장/복원되어 근거(source/evidence)가 유지되어야 함.
- 스케일 미보정 상태(`source=unknown` 또는 `confidence<0.6`)에서는 3D 진입(Top/Walk)이 차단되어야 함.
- recoverable 배너의 고정 액션(`Copy Errors`, `Try AI Again`, `Start Manual`)이 제공되어야 함.
- 편집 후 결과가 3D로 정확히 반영.
- 핵심 플로우(`/studio` → `NewProjectModal` → `/project/[id]`)가 360/768/1024px에서 가로 스크롤 없이 동작.

추가 진행:
- `mode="catalog"` + `catalogQuery` 요청 계약 도입.
- 템플릿 인덱스(`public/assets/floorplan-templates/manifest.json`) 기반 조회/게이팅 추가.

## Phase 2: 절차적 3D 품질 고도화 (진행)
목표: 구조/재질/조명 품질을 상용 레벨로 고정.

완료 조건:
- CSG 개구부 정확도 유지.
- PBR + HDRI + Post FX 기본 적용.
- Walk mode에서 충돌/조명 상호작용 정상.
- 물리 충돌에서 window는 통로로 제거하지 않고, door만 통로 처리.

## Phase 3: 경험/브랜딩 완성 (예정)
목표: 로딩/랜딩/인증/대시보드 UX 완성.

완료 조건:
- 로딩/랜딩이 `new_guideline/*` 참조 이미지와 일치.
- 3D 로그인 팝업, 키패드 네비게이션 동작.
- 프로젝트 생성/공유 UX 안정화.
- AI Assistant 패널(씬 스냅샷/퀵 액션) 적용.

## Phase 4: 커뮤니티/협업 (예정)
목표: 공유/게시/실시간 편집 확장.

완료 조건:
- 공유 링크로 프로젝트 뷰 가능.
- 실시간 동기화 전략 수립 및 적용.

## 변경 기록
변경이 발생할 때마다 Phase 항목에 반영하고, `docs/master-guide.md`에 제약 조건을 함께 기록합니다.

운영 규칙:
- 작업 시작 전 문서 확인과 스킬 선택을 완료해야 함.
- 기능/버그/리팩터링은 새 브랜치에서 작업하고 검증 완료 후 `main`에 병합해야 함.
- 다기능 동시 개발 시 기능별 브랜치를 분리해야 함.
- 작업 종료 시 문서 Added/Updated/Removed 항목을 동기화해야 함.

## 2026-03-05 변경 동기화
Added:
- 업로드 분석의 항상 multi-pass(`balanced`, `lineart`) 평가 기준.
- provider 구성 진단(`providerStatus`) 및 미구성 코드(`PROVIDER_NOT_CONFIGURED`) 검증 기준.
- 핵심 플로우 모바일 폭(360/768/1024) UX 완료 조건.

Updated:
- debug 필수 필드에 `selectedPassId`, `selectedPreprocessProfile` 포함.
- provider 오류 검증 기준을 `providerErrors` 단독에서 `providerErrors + providerStatus`로 확장.

Removed/Deprecated:
- 단일 전처리 pass만 고려하는 과거 기준.
