# Implementation Plan (Phases)

## Phase 0: Benchmark + Seed Catalog + Ops Foundation (진행)
목표: 상용화 착수를 위한 whitelist, benchmark, provenance, 최소 ops surface를 준비.

완료 조건:
- launch slice `12개 단지 whitelist` 확정.
- benchmark split에 `complex holdout + input channel slice` 반영.
- 최소 ops surface(`verify/reject`, `duplicate merge`, `alias edit`, `blocked`, `review queue`) 정의.
- privacy/provenance/withdrawal 정책 문서 확정.

## Phase 1: Revision / Intake Foundation (진행)
목표: `intake_session-first`, `layout_revisions` 단일 truth 기반으로 도메인을 재정렬.

완료 조건:
- `intake_sessions`, `layout_revisions`, `revision_source_links` 스키마 반영.
- 프로젝트가 `source_layout_revision_id`에 pin.
- `review_required` 상태와 exact-once finalize 경로 구현.
- `topology_hash`, `room_graph_hash`, `geometry_hash` 3계층 도입.

## Phase 2: 2D 보정 UX 강화 (진행)
목표: 분석 실패 시에도 사용자 복구 성공률 상승.

완료 조건:
- Recoverable 오류 및 `review_required` 시 2D 보정 모드 유지.
- `Copy Errors`, `Try AI Again`, `Start Manual` 복구 액션 유지.
- 390/768/1024 폭에서 핵심 플로우(업로드 -> 2D -> 3D) 조작 가능.

## Phase 3: 정확도/품질 고도화 (진행)
목표: multi-pass + 후보 스코어링 정확도 개선.

완료 조건:
- 동일 샘플에서 recoverable 실패율 감소.
- scale source가 근거 있을 때 `unknown` 과다 발생 방지.
- debug/diagnostics로 pass/profile 선택 근거 추적 가능.
- geometry repair + room reconstruction 기반으로 revision 품질 향상.

## Phase 4: 시각/경험 완성 (예정)
목표: 로딩/랜딩/인증/대시보드 UX와 3D 품질 완성.

완료 조건:
- `new_guideline/*` 기준 UX 동작.
- Top/Walk 모드 전환 및 상호작용 품질 기준 충족.
- PBR/HDR/Post FX 품질 유지.

## 운영 규칙
- 작업 시작 전 문서 확인 + 스킬 선택을 선행한다.
- 기능별 새 브랜치에서 개발하고, 검증 후 `main` 병합한다.
- 병합 후 로컬/원격 브랜치를 정리한다.
- 작업 종료 시 문서 Added/Updated/Removed를 동기화한다.

## 품질 게이트
- `npm --workspace apps/web run type-check`
- `npm --workspace apps/web run lint`
- `npm --workspace apps/web run build`
- `npm --workspace apps/api run typecheck`
- `npm --workspace apps/worker run typecheck`

## 2026-03-05 변경 동기화 (Railway Immediate Cutover)
Added:
- 즉시 전환 Phase와 API/Worker 분리 완료 기준.
- API/Worker 품질 게이트.

Updated:
- 핵심 파이프라인의 실행 위치를 Next route -> Railway worker로 변경.

Removed/Deprecated:
- Vercel 기반 동기 분석 경로를 완료 기준에서 제거.

## 2026-03-11 변경 동기화 (Preview Runtime Alignment)
Added:
- Preview 배포도 production과 동일한 Railway API를 사용하도록 운영 완료 기준 추가.
- Railway API CORS에 preview 도메인 패턴 허용 규칙 추가.

Updated:
- 운영 검증 범위에 preview 환경 변수/CORS 정합성 확인을 포함.

Removed/Deprecated:
- preview 배포를 production 설정과 분리해 수동 복구하는 운영 방식.

## 2026-03-11 변경 동기화 (Floorplan Normalization Accuracy Pass)
Added:
- Phase 2에 deterministic normalization 회귀 테스트(`apps/worker`) 추가.
- wall dedupe/merge, opening reattachment, scale evidence scoring 보강 완료 기준 추가.

Updated:
- 정확도 개선 작업을 provider 교체뿐 아니라 후처리/스코어링 계층까지 포함하도록 확장.

Removed/Deprecated:
- wall/opening raw count 위주의 후보 선택 방식.

## 2026-03-11 변경 동기화 (Commercialization Foundation V4)
Added:
- Phase 0 benchmark/seed catalog/ops foundation.
- Phase 1 revision/intake foundation과 exact-once finalize 완료 기준.
- spec 문서 4종을 선행 산출물로 고정.

Updated:
- 상용화 실행 순서를 `project-first`에서 `intake_session -> revision -> finalize project` 순서로 재정렬.
- 정확도 고도화 단계를 provider 선택뿐 아니라 geometry repair/room reconstruction까지 포함하도록 확장.

Removed/Deprecated:
- project를 먼저 만들고 업로드를 시작하는 단일 경로 중심 구현 순서.

## 2026-03-12 변경 동기화 (Web Intake Cutover + Remote E2E)
Added:
- Phase 1에 `apps/web` intake/catalog/finalize cutover 완료 기준을 추가.
- Phase 3에 room reconstruction 결과(`rooms`, `roomAdjacency`, `floors`)를 revision/scene에 저장하는 완료 기준을 추가.
- remote E2E 검증 항목에 `upload -> resolve -> review/finalize -> project pin` 실환경 시나리오를 추가.

Updated:
- Phase 1 진행 상태를 foundation-only에서 `web client wired + finalize RPC fixed` 단계로 상향.
- Phase 3 정확도/품질 고도화 범위를 worker room geometry 생성까지 포함하도록 구체화.

Removed/Deprecated:
- intake foundation을 API/DB까지만 완료로 보는 기준.

## 2026-03-12 변경 동기화 (Service Audit Cleanup + Migration Hygiene)
Added:
- Phase 1 운영 완료 기준에 `supabase migration history clean`과 `apps/web/scripts/e2e-intake-flow.ts` 재실행 가능 상태를 추가.
- CI optional `intake-e2e` job을 통해 secret-gated 실환경 검증 경로를 추가.

Updated:
- 불필요한 Next.js 내부 도메인 API, 정적 floorplan template/cache, 무참조 타입/스토어 메서드를 제거한 상태를 현재 기준으로 반영.
- Supabase finalize fix 마이그레이션 체인을 `20260305`, `20260311`, `20260312120000`으로 정리.

Removed/Deprecated:
- 정적 floorplan template manifest와 서버 로컬 floorplan cache 실험 코드.
- 삭제된 Next.js 내부 API route를 기준으로 한 웹 타입 생성물 의존.

## 2026-03-12 변경 동기화 (Asset Generation Worker Migration)
Added:
- Phase 1 운영 기준에 `jobs.result`와 `POST /v1/assets/generate` 기반 custom asset 비동기 경로를 추가.
- worker가 `ASSET_GENERATION` 잡을 처리하고 `assets-glb` 저장 및 `assets` row 생성을 완료 조건에 포함.

Updated:
- Vercel의 마지막 heavy path였던 custom asset 생성 경로를 Railway worker로 이동.

Removed/Deprecated:
- Next app route에서 provider 호출/GLB 다운로드/Storage 업로드를 수행하는 asset generation 경로.
