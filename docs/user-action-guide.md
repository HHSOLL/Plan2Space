# User Action Guide

이 문서는 코딩 에이전트가 대신할 수 없는 사용자 작업을 정리합니다.

## 1) 환경 변수 설정
서비스별로 분리해서 설정합니다.

### Vercel (`apps/web`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_RAILWAY_API_URL=
NEXT_PUBLIC_APP_URL=
```

### Railway API (`apps/api`)
```
API_PORT=4000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CORS_ORIGINS=http://localhost:3100,http://127.0.0.1:3100,https://plan2space.vercel.app,https://plan2-space-web-*.vercel.app,https://plan2space-*.vercel.app
FLOORPLAN_UPLOAD_BUCKET=floor-plans
```

참고:
- Railway 런타임에서는 `PORT`가 자동 주입되며, API는 이를 우선 사용합니다.
- `CORS_ORIGINS`는 exact origin과 `*` 와일드카드를 함께 사용할 수 있습니다.
- Vercel preview는 `https://plan2-space-web-*.vercel.app`, `https://plan2space-*.vercel.app` 패턴으로 맞춥니다.

### Railway Worker (`apps/worker`)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WORKER_CONCURRENCY=2
WORKER_POLL_INTERVAL_MS=1000
ASSET_STORAGE_BUCKET=assets-glb
ASSET_GENERATION_POLL_INTERVAL_MS=2000
ASSET_GENERATION_MAX_POLLS=45

FLOORPLAN_PROVIDER_ORDER=anthropic,openai,snaptrude
FLOORPLAN_PROVIDER_TIMEOUT_MS=45000
FLOORPLAN_PREPROCESS_PROFILES=balanced,lineart,filled_plan
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
SNAPTRUDE_API_URL=
SNAPTRUDE_API_KEY=
TRIPOSR_API_URL=
TRIPOSR_API_KEY=
TRIPOSR_STATUS_URL=
MESHY_API_URL=
MESHY_API_KEY=
MESHY_STATUS_URL=
```

중요:
- AI/provider 키는 Vercel이 아니라 Railway Worker에만 둡니다.
- asset generation provider 키도 Railway Worker에만 둡니다.
- 외부 부동산 서비스 도면 이미지는 URL 자동 수집이 아니라 사용 권한이 있는 파일 업로드로만 넣습니다.

## 2) Supabase 적용 작업
- `supabase/migrations/20260305_railway_floorplan_queue.sql` 실행
- `supabase/migrations/20260311_v4_intake_revision_foundation.sql` 실행
- `supabase/migrations/20260312120000_v4_finalize_intake_session_resolution_state_fix.sql` 실행
- `supabase/migrations/20260312143000_asset_generation_jobs_result.sql` 실행
- 신규 테이블 확인:
  - `floorplans`
  - `jobs`
  - `floorplan_results`
  - `intake_sessions`
  - `layout_revisions`
  - `revision_source_links`
- `claim_jobs` 함수/권한(service_role) 적용 확인
- `finalize_intake_session` RPC 적용 확인
- `finalize_intake_session` RPC가 `resolved_reuse -> reused`, `resolved_generated -> generated`를 유지하는지 확인

## 3) OAuth/도메인 점검
- Supabase Auth URL 설정에 실제 배포 도메인만 등록
- Railway API CORS에 Vercel 프로덕션/프리뷰 도메인 포함
- Vercel `NEXT_PUBLIC_RAILWAY_API_URL`은 Production/Preview/Development 모두 동일한 Railway API URL로 동기화
- 브라우저에서 `Invalid Refresh Token`이 보이면 기존 `sb-*` 쿠키/스토리지를 정리한 뒤 재로그인

## 4) 운영 확인 시나리오
1. intake session 생성
2. 도면 업로드 또는 catalog search
3. resolution 결과 확인(`resolved_reuse | disambiguation_required | queued`)
4. 잡 생성 확인(`jobs` 상태: queued/running)
5. 완료 후 `floorplan_results`와 `layout_revisions` 생성 확인
6. `review_required` 또는 `resolved_generated` 상태 확인
7. finalize 후 project가 `source_layout_revision_id`를 가지는지 확인
8. preview 배포 검증:
   - `npm --workspace apps/web run smoke:preview-runtime -- --url=<vercel-preview-url> --expected=https://api-production-473bd.up.railway.app`
9. 실환경 intake E2E 검증:
   - `npm --workspace apps/web run e2e:intake -- --api=https://api-production-473bd.up.railway.app`
10. custom asset generation 경로 검증:
   - `/v1/assets/generate` 호출 후 `GET /v1/jobs/:jobId`가 `result.asset`를 반환하는지 확인
11. benchmark fixture 검수:
   - `apps/web/fixtures/floorplans/manifest.json`에 `channel`, `sourcePolicy`를 기록
   - `sourcePolicy`는 `partner_licensed`, `user_opt_in`, `manual_private`만 허용
   - 외부 listing gallery 이미지를 서비스가 자동 저장/수집한 fixture는 등록하지 않음
12. semantic annotation QA:
   - room label 또는 치수 표기가 실제로 있는 fixture에서는 generated revision의 `geometry_json.evidenceRefs.semanticAnnotations.roomHints`와 `dimensionAnnotations`가 비어 있지 않은지 확인
   - semantic annotation이 존재하는 표본에서 `geometry_json.rooms[].labelSource`가 `annotation`으로 승격되는 케이스를 확인
   - 한글 치수 표기가 있는 fixture에서 `scale.source=ocr_dimension`으로 복원되는지 확인

## 5) 실패 복구 QA
- provider 미구성 시 `PROVIDER_NOT_CONFIGURED` 노출
- recoverable 실패 시 2D 보정 전환
- 복구 배너 액션(`Copy Errors`, `Try AI Again`, `Start Manual`) 동작
- diagnostics에서 `axisAlignedRatio`, `orphanWallCount`, `selfIntersectionCount`, `scaleEvidenceCompleteness`를 함께 확인
- generated 결과가 low-confidence이면 `review_required`로 남는지 확인
- auto-reuse가 잘못되면 `reuse_invalidated` 후 remediation intake가 생성되는지 확인

## 6) 모바일 QA
- 390/768/1024 폭에서 핵심 조작(업로드/보정/3D 진입) 가능 여부 점검

## 7) 키/보안
- 서비스 role 키/AI 키는 절대 클라이언트 번들에 노출하지 않음
- 로그 공유 시 키/토큰 마스킹 필수

## 8) 2026-03-05 변경 동기화 (Railway Immediate Cutover)
Added:
- 서비스별 환경 변수 분리 가이드(Vercel/API/Worker).
- Supabase queue 스키마 적용 절차.

Updated:
- 업로드/분석 검수 흐름을 job polling 기반으로 변경.

Removed/Deprecated:
- Vercel에 provider 키를 두는 방식.

## 9) 2026-03-11 변경 동기화 (Preview Runtime Alignment)
Added:
- Vercel preview 도메인 패턴 운영 규칙.
- Railway API CORS 와일드카드 사용 규칙.
- preview 번들 Railway API 연결 여부를 확인하는 smoke 검증 절차.

Updated:
- `NEXT_PUBLIC_RAILWAY_API_URL`를 Preview까지 동일하게 맞추는 절차 명시.

Removed/Deprecated:
- Preview 도메인을 exact URL만으로 수동 관리하는 방식.

## 10) 2026-03-11 변경 동기화 (Floorplan Normalization Accuracy Pass)
Added:
- recoverable 분석 시 구조 품질 diagnostics 확인 항목.

Updated:
- 정확도 QA를 provider 성공 여부뿐 아니라 구조 품질 메트릭까지 포함하도록 확장.

Removed/Deprecated:
- wall/opening 개수만으로 정확도를 판단하는 QA 방식.

## 11) 2026-03-11 변경 동기화 (Commercialization Foundation V4)
Added:
- `intake_sessions`, `layout_revisions`, `revision_source_links`, `finalize_intake_session` 운영 확인 항목.
- project finalize 전 resolution/review 상태 확인 절차.
- wrong reuse remediation(`reuse_invalidated`) QA 항목.

Updated:
- 운영 확인 시나리오를 project-first 업로드가 아니라 intake-first 흐름으로 변경.

Removed/Deprecated:
- 업로드 직후 바로 project를 생성하는 수동 운영 가정.

## 12) 2026-03-12 변경 동기화 (Intake Finalize + Revision Floors)
Added:
- finalize RPC 보정 마이그레이션 2종과 상태 복원 확인 절차.
- revision 기반 `rooms/floors`가 저장되는지 확인하는 운영 체크.
- 원격 E2E에서 `project.source_layout_revision_id`, `project.resolution_state`, `revision.room_graph_hash`, `revision.derived_scene_json.floors` 확인 항목.

Updated:
- intake 운영 점검을 `resolve -> review_required/resolved_generated -> finalize`의 exact-once 시나리오까지 포함하도록 확장.
- Supabase migration history 기준을 `20260305`, `20260311`, `20260312120000`로 정리.

Removed/Deprecated:
- finalize 성공 여부만 보고 resolution state 정합성을 생략하는 검수 방식.

## 13) 2026-03-12 변경 동기화 (Asset Generation Worker Migration)
Added:
- `ASSET_STORAGE_BUCKET`, `TRIPOSR_*`, `MESHY_*`, asset generation poll env를 worker 설정 항목으로 추가.
- `jobs.result.asset` 기반 custom asset 완료 검수 항목 추가.

Updated:
- custom asset 생성 운영 경로를 Next route가 아니라 Railway API/worker 기준으로 변경.

Removed/Deprecated:
- Vercel `/api/assets/generate`에 provider 키를 두고 직접 호출하는 운영 방식.

## 14) 2026-03-13 변경 동기화 (Korean Apartment Input Policy + Filled Plan Eval)
Added:
- `FLOORPLAN_PREPROCESS_PROFILES=balanced,lineart,filled_plan` 운영 규칙.
- fixture `manifest.json`에 `channel`, `sourcePolicy`를 기록하는 benchmark 검수 절차.

Updated:
- 외부 부동산 서비스 이미지는 URL 직접 intake가 아니라 권리 보유 파일 업로드 기준으로 운영하도록 명시.

Removed/Deprecated:
- 외부 listing gallery URL을 fixture/catalog source로 자동 수집하는 운영 방식.

## 15) 2026-03-13 변경 동기화 (Semantic Room Hints + OCR Dimension)
Added:
- semantic annotation QA(`roomHints`, `dimensionAnnotations`, `labelSource`) 절차.

Updated:
- 한국 아파트형 입력 검수는 벽/문 추출뿐 아니라 한글 room label과 치수 annotation 보존 여부까지 포함한다.

Removed/Deprecated:
- room semantics를 최종 3D 결과 화면만 보고 추정하는 QA 방식.
