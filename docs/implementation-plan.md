# Implementation Plan (Phases)

## Phase 0: Railway Immediate Cutover (진행)
목표: Vercel UI / Railway API / Railway Worker 구조를 즉시 적용.

완료 조건:
- `apps/web`이 Railway API로만 도메인 호출.
- `apps/web`에서 무거운 분석/기하 처리 로직 제거.
- `apps/api`에 프로젝트/도면/잡/결과 API 제공.
- `apps/worker`에 floorplan pipeline 실행 및 잡 상태 전이 구현.
- `floorplans/jobs/floorplan_results` + `claim_jobs` 마이그레이션 반영.
- legacy Next API(`parse-floorplan`, `projects`, `furnitures`) 비활성화(410).
- CI에 `apps/api`, `apps/worker` 게이트 포함.

## Phase 1: 2D 보정 UX 강화 (진행)
목표: 분석 실패 시에도 사용자 복구 성공률 상승.

완료 조건:
- Recoverable 오류 시 2D 보정 모드 유지.
- `Copy Errors`, `Try AI Again`, `Start Manual` 복구 액션 유지.
- 390/768/1024 폭에서 핵심 플로우(업로드 -> 2D -> 3D) 조작 가능.

## Phase 2: 정확도/품질 고도화 (진행)
목표: multi-pass + 후보 스코어링 정확도 개선.

완료 조건:
- 동일 샘플에서 recoverable 실패율 감소.
- scale source가 근거 있을 때 `unknown` 과다 발생 방지.
- debug/diagnostics로 pass/profile 선택 근거 추적 가능.

## Phase 3: 시각/경험 완성 (예정)
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
