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

빠른 시작:
- `cp apps/web/.env.local.example apps/web/.env.local`

### Railway API (`apps/api`)
```
API_PORT=4000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CORS_ORIGINS=http://localhost:3100,http://127.0.0.1:3100,https://plan2space.vercel.app,https://plan2-space-web-*.vercel.app,https://plan2space-*.vercel.app
FLOORPLAN_UPLOAD_BUCKET=floor-plans
```

빠른 시작:
- `cp apps/api/.env.example apps/api/.env`

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
FLOORPLAN_REVIEW_SCORE_THRESHOLD=72
FLOORPLAN_REVIEW_CONFLICT_THRESHOLD=0.3
FLOORPLAN_REVIEW_DIMENSION_CONFLICT_THRESHOLD=0.35
FLOORPLAN_REVIEW_SCALE_CONFLICT_THRESHOLD=0.35
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
SNAPTRUDE_API_URL=
SNAPTRUDE_API_KEY=
ROBOFLOW_CUBICASA2_URL=
ROBOFLOW_CUBICASA3_URL=
ROBOFLOW_API_KEY=
PADDLEOCR_API_URL=
PADDLEOCR_API_TOKEN=
PADDLEOCR_DET_MODEL=PP-OCRv5_det
PADDLEOCR_REC_MODEL=korean_PP-OCRv5_mobile_rec
HF_FLOORPLAN_ENDPOINT_URL=
HF_FLOORPLAN_ENDPOINT_TOKEN=
TRIPOSR_API_URL=
TRIPOSR_API_KEY=
TRIPOSR_STATUS_URL=
MESHY_API_URL=
MESHY_API_KEY=
MESHY_STATUS_URL=
```

빠른 시작:
- `cp apps/worker/.env.example apps/worker/.env`
- `npm --workspace apps/worker run provider:floorplan:check`
- 상용화 baseline 직전에는 `npm --workspace apps/worker run provider:floorplan:check -- --strictCommercialization=1`

중요:
- AI/provider 키는 Vercel이 아니라 Railway Worker에만 둡니다.
- asset generation provider 키도 Railway Worker에만 둡니다.
- 외부 부동산 서비스 도면 이미지는 URL 자동 수집이 아니라 사용 권한이 있는 파일 업로드로만 넣습니다.
- `pdf_export`는 raw PDF가 아니라 PDF에서 rasterized된 이미지 채널로 운영합니다.

## 2) Supabase 적용 작업
- `supabase/migrations/20260305_railway_floorplan_queue.sql` 실행
- `supabase/migrations/20260311_v4_intake_revision_foundation.sql` 실행
- `supabase/migrations/20260312120000_v4_finalize_intake_session_resolution_state_fix.sql` 실행
- `supabase/migrations/20260312143000_asset_generation_jobs_result.sql` 실행
- `supabase/migrations/20260408153000_shared_projects_snapshot_pinning.sql` 실행
- `supabase/migrations/20260408172000_shared_projects_gallery_visibility.sql` 실행
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
- Vercel Production `NEXT_PUBLIC_APP_URL`을 `https://plan2space.vercel.app`로 고정
- Vercel Preview는 `NEXT_PUBLIC_APP_URL`을 비워 preview host 자체로 OAuth를 시작하게 유지
- Railway API CORS에 Vercel 프로덕션/프리뷰 도메인 포함
- Vercel `NEXT_PUBLIC_RAILWAY_API_URL`은 Production/Preview/Development 모두 동일한 Railway API URL로 동기화
- OAuth는 시작 host와 `/auth/callback` host가 반드시 동일해야 함(브라우저 PKCE verifier same-origin)
- `/auth/callback`은 브라우저 client에서 code exchange를 수행하므로 로그인 직후 redirect 중 탭/스토리지 정리가 없도록 확인
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
   - `apps/web/fixtures/floorplans/manifest.json`에 `channel`, `sourcePolicy`, `qualityTags`, `complexityTier`를 기록
   - `manifest.example.json -> manifest.json -> fixtures:floorplan:validate -> fixtures:floorplan:blind-gate -> eval:floorplan -> eval:floorplan:gate` 순서로 운영
   - benchmark fixture에는 가능하면 `gold.rooms`, `gold.dimensions`, `gold.scale`, `gold.reviewSeconds`, `gold.expectedReviewRequired`를 기록
   - `sourcePolicy`는 `partner_licensed`, `user_opt_in`, `manual_private`만 허용
   - 외부 listing gallery 이미지를 서비스가 자동 저장/수집한 fixture는 등록하지 않음
   - 구조/메타데이터 lint: `npm --workspace apps/web run fixtures:floorplan:validate`
   - blind set gate: `npm --workspace apps/web run fixtures:floorplan:blind-gate`
   - blind set 100장 기준 `korean_complex` 표본을 최소 20장 포함
12. semantic annotation QA:
   - room label 또는 치수 표기가 실제로 있는 fixture에서는 generated revision의 `geometry_json.evidenceRefs.semanticAnnotations.roomHints`와 `dimensionAnnotations`가 비어 있지 않은지 확인
   - semantic annotation이 존재하는 표본에서 `geometry_json.rooms[].labelSource`가 `annotation`으로 승격되는 케이스를 확인
   - 한글 치수 표기가 있는 fixture에서 `scale.source=ocr_dimension`으로 복원되는지 확인
   - `scene_json.scale`와 `scaleInfo.evidence.mmValue/pxDistance`가 대략 일치하는지 확인 (`10160 / 520px`라면 약 `0.0195 m/px`)

## 5) 실패 복구 QA
- provider 미구성 시 `PROVIDER_NOT_CONFIGURED` 노출
- recoverable 실패 시 2D 보정 전환
- 복구 배너 액션(`Copy Errors`, `Try AI Again`, `Start Manual`) 동작
- diagnostics에서 `axisAlignedRatio`, `orphanWallCount`, `selfIntersectionCount`, `scaleEvidenceCompleteness`를 함께 확인
- generated 결과가 low-confidence이면 `review_required`로 남는지 확인
- diagnostics에 `conflictScore`, `reviewReasons`, `conflictBreakdown.dimensionConflict`, `conflictBreakdown.scaleConflict`가 기록되는지 확인
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

## 15) 2026-03-24 변경 동기화 (Baseline Ops Readiness)
Added:
- `apps/web/.env.local.example`, `apps/api/.env.example`, `apps/worker/.env.example` 기반 빠른 시작 절차.
- `fixtures:floorplan:validate`, `fixtures:floorplan:blind-gate`, `provider:floorplan:check` 운영 명령.

Updated:
- blind set 검수를 수기 확인만이 아니라 manifest validator + blind gate 조합으로 수행하도록 확장.

Removed/Deprecated:
- operator가 문서만 보고 환경 변수와 blind set 구성을 수동 추정하는 방식.

## 15) 2026-03-13 변경 동기화 (Semantic Room Hints + OCR Dimension)
Added:
- semantic annotation QA(`roomHints`, `dimensionAnnotations`, `labelSource`) 절차.

Updated:
- 한국 아파트형 입력 검수는 벽/문 추출뿐 아니라 한글 room label과 치수 annotation 보존 여부까지 포함한다.

Removed/Deprecated:
- room semantics를 최종 3D 결과 화면만 보고 추정하는 QA 방식.

## 16) 2026-03-19 변경 동기화 (Scale Contract QA)
Added:
- 운영 QA에 `scene_json.scale`와 `scaleInfo.evidence` 일치성 확인 절차를 추가.

Updated:
- 3D 진입 실패 검수는 wall/opening 개수뿐 아니라 `metersPerPixel` 단위 정합성까지 확인하도록 확장.

Removed/Deprecated:
- 치수 evidence가 있어도 최종 scale 수치를 별도 검산하지 않는 QA 방식.

## 17) 2026-03-19 변경 동기화 (Accuracy Commercialization V2)
Added:
- Roboflow CubiCasa, PaddleOCR, HF Dedicated Endpoint worker env 설정 항목.
- benchmark manifest `qualityTags`, `complexityTier`, `gold.*` 작성 규칙.
- blind set `korean_complex >= 20%` 구성 및 conflict diagnostics QA.

Updated:
- benchmark 검수는 단순 channel 기록이 아니라 commercialization metrics와 review expectation까지 포함한다.

Removed/Deprecated:
- deprecated Next parse endpoint를 eval 기본 경로로 가정하는 운영 방식.

## 18) 2026-04-09 변경 동기화 (OAuth PKCE Callback)
Added:
- `/auth/callback` 브라우저 code exchange 운영 체크 항목.

Updated:
- OAuth 점검 규칙을 `production host 고정`보다 `시작 host = callback host` same-origin 검증 중심으로 강화.

Removed/Deprecated:
- `/auth/callback` server handler가 verifier를 직접 읽어도 된다는 운영 가정.

## 18) 2026-04-08 변경 동기화 (Builder-First Entry Flow)
Added:
- 운영 확인 시나리오에 `/studio/builder`에서 blank-room 프로젝트를 생성하고 바로 `/project/[id]`로 진입하는 수동 생성 경로를 추가한다.
- builder QA 항목으로 템플릿 선택, 치수 슬라이더, 재질 선택, version save 후 재진입 복원을 확인한다.

Updated:
- 신규 프로젝트 시작 절차를 `floorplan upload only`가 아니라 `builder-first`와 `intake-first` 두 경로로 구분한다.

Removed/Deprecated:
- 운영자가 모든 신규 프로젝트를 floorplan upload modal에서만 시작한다고 보는 절차.

## 19) 2026-04-08 변경 동기화 (Shared Viewer QA)
Added:
- 공유 QA에 share link 생성 후 `/shared/[token]`에서 top/walk 전환, asset/floor summary, expiry badge 노출을 확인하는 항목을 추가한다.
- builder-origin 프로젝트를 share한 뒤 shared viewer에서도 동일한 room shell/material preset이 보존되는지 확인한다.

Updated:
- 공유 링크 검수는 단순 token 생성이 아니라 `latest saved version` 기준 scene 복원까지 포함한다.

Removed/Deprecated:
- shared viewer를 walk-only 미리보기로만 간주하는 검수 방식.

## 19) 2026-04-08 변경 동기화 (Viewer-First Share QA)
Added:
- 공유 링크 QA에 `/shared/[token]`에서 top/walk 전환, scene stats 노출, read-only gating, 만료 링크 차단을 포함한다.

Updated:
- share link 검수는 단순 링크 생성 여부뿐 아니라 viewer shell의 메타 정보와 read-only 동작까지 확인하도록 확장한다.

Removed/Deprecated:
- 공유 링크를 walk-only preview 한 장면으로만 확인하는 절차.

## 20) 2026-04-08 변경 동기화 (Share Permission QA)
Added:
- 공유 링크 QA에 `View Only`와 `Edit Requested · Preview Only` 라벨이 실제 동작과 일치하는지 확인하는 항목을 추가한다.

Updated:
- 새 공유 링크는 모두 read-only viewer로 열리는 현재 계약을 기준으로 검수한다.

Removed/Deprecated:
- 공유 권한이 즉시 shared edit surface를 연다고 가정하는 검수 기준.

## 21) 2026-04-08 변경 동기화 (Builder-Only Editor QA)
Added:
- `/project/[id]`에서 legacy import 카드가 사라지고 builder launch, asset shelf, inspector만 남는지 확인한다.
- shared viewer와 main editor가 같은 viewport 시각 언어를 유지하는지, `Walk` 버튼 disabled 조건이 일치하는지 확인한다.

Updated:
- editor QA는 2D floorplan import 진입보다 builder launch -> asset placement -> save/share 흐름을 우선 검수한다.

Removed/Deprecated:
- 메인 editor에서 legacy floorplan upload/template lookup을 계속 검수 대상으로 두는 절차.

## 22) 2026-04-08 변경 동기화 (Editor Shell Isolation QA)
Added:
- `/shared/[token] -> /project/[id]` 이동 후 editor가 read-only 상태로 남지 않는지 확인한다.
- shared viewer를 열었다 닫은 뒤 editor mode toggle, library panel, inspector panel, transform mode가 이전 route 상태를 물고 오지 않는지 확인한다.
- top view에서 walk mode로 갔다가 다시 돌아올 때 stale inspector/library panel이 자동 복귀하지 않는지 확인한다.

Updated:
- Phase 4 QA 범위에 scene 렌더링뿐 아니라 editor/shared viewer shell state isolation 검수를 포함한다.

Removed/Deprecated:
- route 간 shell state는 수동 눈대중으로만 확인하고 별도 회귀 체크를 하지 않는 QA 방식.

## 23) 2026-04-08 변경 동기화 (Autosave + History QA)
Added:
- top view에서 자산 추가, 이동, 회전, 삭제, wall/floor finish 변경 후 `Unsaved changes -> Saving... -> Saved` 흐름이 보이는지 확인한다.
- mobile 폭에서 library/inspector 토글과 undo/redo 버튼이 노출되고 실제로 동작하는지 확인한다.
- undo/redo가 asset 배치와 finish 변경을 이전 상태로 되돌리고 다시 앞으로 진행하는지 확인한다.

Updated:
- editor QA는 save 버튼 클릭 여부만이 아니라 autosave badge와 mobile status text까지 포함해 검수한다.
- asset drag/transform QA는 시각적 이동뿐 아니라 history snapshot이 남는지까지 포함한다.

Removed/Deprecated:
- 저장 검수를 manual save toast만 보고 끝내는 절차.

## 24) 2026-04-08 변경 동기화 (Asset Catalog QA)
Added:
- top editor library shelf에서 canonical category chips, spotlight pick, featured picks, starter set CTA가 모두 보이는지 확인한다.
- 동일 자산을 이미 배치한 뒤 shelf와 spotlight card에서 `In Room` 상태가 노출되는지 확인한다.
- retired legacy overlay 없이 builder shelf 하나만으로 자산 검색, featured, starter set 흐름이 유지되는지 확인한다.

Updated:
- library QA는 단순 검색 결과 노출뿐 아니라 category normalization과 starter set selection 일관성까지 포함한다.
- manifest 검수 시 `assetId`가 `placeholder:` 또는 유효 경로 형식인지 확인하고, malformed `scale` 값은 catalog에 노출되지 않는지 확인한다.

Removed/Deprecated:
- builder shelf 외에 별도 legacy asset overlay를 QA 범위로 유지하는 절차.

## 25) 2026-04-08 변경 동기화 (Viewer Catalog Metadata QA)
Added:
- shared viewer에서 배치된 가구가 `Placed pieces` 카드로 보이고, category/collection/count가 scene과 맞는지 확인한다.
- inspector에서 선택 자산이 raw asset path가 아니라 catalog label/category/collection으로 표시되는지 확인한다.
- generated/custom asset처럼 catalog에 없는 항목이 있을 때 shared viewer에서 uncatalogued count로만 집계되고 scene 렌더는 유지되는지 확인한다.

Updated:
- share QA는 scene stats 외에 catalog-aware asset summary까지 포함해 검수한다.

Removed/Deprecated:
- shared viewer 검수를 벽/문/자산 총개수만 맞는지 보는 수준에서 끝내는 절차.

## 26) 2026-04-08 변경 동기화 (Project Summary Metadata QA)
Added:
- 저장 후 studio 카드에서 thumbnail이 보이거나, 없을 때 asset summary 기반 preview surface가 보이는지 확인한다.
- share modal을 열면 현재 project preview와 collection badges가 latest saved state와 일치하는지 확인한다.
- 동일 모델의 variant를 배치한 뒤 저장/재진입했을 때 inspector와 shelf의 `placed` 상태가 `catalogItemId` 기준으로 유지되는지 확인한다.

Updated:
- studio QA는 project 이름/날짜만이 아니라 `assetSummary` 기반 badge와 preview state까지 포함한다.

Removed/Deprecated:
- project card/share modal을 saved asset metadata 없이 정적 문구만 검수하는 절차.

## 27) 2026-04-08 변경 동기화 (Pinned Share Snapshot QA)
Added:
- `supabase/migrations/20260408153000_shared_projects_snapshot_pinning.sql`을 적용한다.
- share modal에서 링크를 생성한 뒤 active link row에 snapshot version badge가 보이는지 확인한다.
- 링크를 만든 뒤 프로젝트를 다시 저장해도 기존 `/shared/[token]` 링크가 새 latest version이 아니라 생성 당시 snapshot을 유지하는지 확인한다.
- 구버전 shared link도 migration backfill 후 최소한 pinned version id 또는 preview metadata를 갖는지 확인한다.

Updated:
- share QA는 링크 열림 여부만이 아니라 snapshot pinning과 preview metadata 일관성까지 포함한다.
- viewer QA는 live catalog 변경이 있더라도 pinned `assetSummary`가 summary rail에서 유지되는지 확인한다.
- pinned version이 없는 예전 shared row는 `/shared/[token]`에서 fail-closed 되는지 확인한다.

Removed/Deprecated:
- old share link가 later save 이후 최신 상태로 바뀌어도 문제로 보지 않는 QA 기준.

## 28) 2026-04-08 변경 동기화 (Published Gallery QA)
Added:
- `supabase/migrations/20260408172000_shared_projects_gallery_visibility.sql`을 적용한다.
- share modal에서 permanent view-only link를 만들고 `Publish to gallery`를 켰을 때 active link row에 `Published` badge가 보이는지 확인한다.
- `/gallery`에서 방금 공개한 snapshot card가 나타나고, 클릭 시 `/shared/[token]` pinned viewer로 이동하는지 확인한다.
- later save를 한 뒤에도 gallery card가 가리키는 shared viewer가 같은 pinned snapshot version을 유지하는지 확인한다.

Updated:
- publish QA는 mock feed 확인이 아니라 `share modal -> gallery -> shared viewer` 실경로를 기준으로 검수한다.
- `/community`는 gallery redirect가 아니라 published snapshot 기반 recent/feed surface를 렌더하는지 확인한다.
- showcase API/env를 일부러 끊거나 실패시켰을 때 gallery/community가 ordinary empty state가 아니라 unavailable state를 보여주는지 확인한다.

Removed/Deprecated:
- gallery/community 페이지에 정적 데모 카드만 보이더라도 publish flow가 동작한다고 간주하는 검수 방식.

## 29) 2026-04-09 변경 동기화 (Legacy Compatibility Migration QA)
Added:
- targeted backfill 실행 후 해당 project의 `current_version_id`가 새 `project_versions.id`와 일치하는지 확인한다.
- landing/community/new-project 표면에서 더 이상 새 upload/intake 진입을 안내하지 않는지 확인한다.
- network/devtools 기준으로 active builder/community/gallery/share 플로우에서 `intake-sessions`, `floorplans`, legacy upload helper 요청이 새로 발생하지 않는지 확인한다.

Updated:
- legacy project QA는 단순히 "열리기만 하는지"가 아니라 backfill 후 saved version 경로로 전환되었는지까지 포함한다.
- web regression QA는 old project data를 유지하면서도 active surface bundle에서 legacy intake helper와 compatibility bootstrap client가 제거된 상태를 기준으로 본다.

Removed/Deprecated:
- old project를 legacy source에서 계속 읽기만 해도 전환 완료로 간주하는 검수 방식.

## 30) 2026-04-09 변경 동기화 (Latest Version Cutover + Backfill Ops QA)
Added:
- saved version이 있는 project를 열었을 때 network 기준으로 `GET /v1/projects/:projectId/versions/latest`가 먼저 호출되고, 같은 진입에서 `scene/latest`는 호출되지 않는지 확인한다.
- web local route가 활성인 배포에서는 `GET /api/v1/projects/:projectId/versions/latest`가 먼저 호출되고, 실패 시에만 Railway `/v1/projects/:projectId/versions/latest`로 fallback 되는지 확인한다.
- Railway production `api` env에서 `backfill:legacy-project-versions -- --dry-run --limit 20` 결과 remaining candidate가 `0`인지 확인한다.
- ops dry-run으로 `npm --workspace apps/api run backfill:legacy-project-versions -- --dry-run --limit 20`를 실행해 candidate/source/action이 예상대로 나오는지 확인한다.

Updated:
- legacy retirement QA는 UI surface 제거뿐 아니라 latest saved version read path만 남고 active editor compatibility fallback이 제거되었는지까지 포함한다.
- backfill 운영 검수는 로컬 셸이 아니라 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`가 주입된 ops 환경을 기준으로 수행한다.
- valid project에서 `versions/latest` 읽기가 실패하면 `/project/[id]`가 builder launch로 보이지 않고 workspace load failure 상태를 보여주는지 확인한다.

Removed/Deprecated:
- active saved project가 계속 `scene/latest`를 먼저 읽어도 괜찮다고 보는 검수 방식.

## 31) 2026-04-09 변경 동기화 (Anchor Placement QA)
Added:
- top editor에서 자산을 선택한 뒤 Inspector의 Anchor를 `floor`, `wall`, `ceiling`, `desk_surface`로 바꿨을 때 즉시 위치가 anchor 규칙으로 재정렬되는지 확인한다.
- `wall` anchor에서 drag/transform 후 release 시 자산이 최근접 벽 선분으로 snap되고 yaw가 벽 방향으로 맞춰지는지 확인한다.
- `ceiling` anchor에서 drag/transform 후 Y값이 ceiling height로 유지되는지 확인한다.

Updated:
- 배치 QA는 단순 X/Z 이동 확인이 아니라 anchorType 변경에 따른 제약 규칙(벽 스냅/표면 높이 고정)까지 포함한다.
- 저장/재진입 QA는 `catalogItemId`와 `anchorType`이 함께 복원되는지 확인한다.

Removed/Deprecated:
- 자산 배치를 항상 바닥 자유 이동만 확인하는 검수 절차.

## 32) 2026-04-09 변경 동기화 (Viewer Product Hotspot QA)
Added:
- `/shared/[token]`에서 `Product hotspots` 리스트가 배치 자산 수와 일치하게 렌더되는지 확인한다.
- hotspot을 클릭하면 viewport에서 선택 링이 이동하고 `Selected detail` 카드의 label/category/collection/anchor 정보가 같이 바뀌는지 확인한다.

Updated:
- viewer QA는 aggregate `Placed pieces` 카드만 확인하지 않고 개별 product inspection 흐름까지 포함한다.

Removed/Deprecated:
- shared viewer 검수를 summary count 확인으로만 끝내는 절차.

## 33) 2026-04-09 변경 동기화 (Lighting Persistence + Legacy Route Gate QA)
Added:
- editor inspector에서 Ambient/Hemisphere/Sun/Environment Blur 슬라이더를 조절했을 때 뷰포트 조명이 즉시 반영되는지 확인한다.
- 조명을 조절한 뒤 저장/새로고침/재진입 시 동일 조명값이 복원되는지 확인한다.
- `ENABLE_LEGACY_API_ROUTES=false` 배포에서 `/v1/intake-sessions`, `/v1/floorplans`, `/v1/jobs`, `/v1/revisions`, `/v1/projects/:id/scene/latest` 호출이 404 또는 비노출 상태인지 확인한다.

Updated:
- editor QA 범위에 finish/asset 편집뿐 아니라 조명값의 저장/복원 일관성을 포함한다.

Removed/Deprecated:
- legacy 라우트를 항상 켜둔 상태에서만 운영 검수를 수행하는 절차.
