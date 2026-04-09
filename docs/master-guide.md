# Master Guide (Engineering Source of Truth)

이 문서는 Plan2Space의 엔지니어링 단일 기준 문서입니다.

## Non-Negotiables
- Semantic parsing -> 2D correction -> Procedural 3D 파이프라인 유지.
- Top view / Walk mode 두 모드 카메라 경험 보장.
- PBR + HDR + Post FX 시각 품질 기준 유지.
- 무거운 이미지 분석/기하/씬 생성 연산은 Vercel에서 실행하지 않음.
- Worker 후보 선택 전 wall/opening/scale 정규화로 노이즈를 줄인 뒤 스코어링한다.
- 상용 정확도 기준선은 `Railway worker eval blind set -> conflict-gated review_required -> 2D correction telemetry` 순서로 관리한다.
- 상용화 기준 canonical truth는 `scene`이 아니라 `geometry revision`이다.
- 프로젝트는 항상 `source_layout_revision_id`에 pin된다.
- 상용 수준 3D 맵 생성은 renderer 교체보다 `geometry reconstruction -> scene derived artifacts -> frontend consumption` 순서로 고도화한다.
- 외부 부동산 서비스 이미지는 자동 수집/재배포하지 않고, 권리 보유 사용자 업로드 또는 허가된 source만 intake에 사용한다.

## 운영 프로토콜 (필수)
- 작업 시작 전 `AGENTS.md`의 Must Read 문서를 순서대로 확인한다.
- 작업 시작 전 스킬을 선택한다.
  - 아키텍처/범위: `plan2space-project-core`
  - UX/비주얼: `plan2space-studio-ux`
  - 도면 AI: `plan2space-blueprint-ai`
- 기능/버그/리팩터링은 항상 새 브랜치에서 작업하고 품질 게이트 통과 후 `main`에 병합한다.
- 작업 종료 전 문서 Added/Updated/Removed 동기화를 완료한다.

## 시스템 아키텍처
- Frontend: `apps/web` (Vercel, UI 전용)
- Backend API: `apps/api` (Railway)
- Worker: `apps/worker` (Railway background worker)
- Database/Auth/Storage: Supabase

데이터 흐름:
1. 사용자 업로드 또는 catalog 검색
2. Railway API가 `intake_sessions` 생성 및 resolution 수행
3. exact reuse면 `layout_revisions` 선택, 아니면 `floorplans/jobs` 생성
4. Railway Worker 처리 (multi-pass + provider scoring)
5. `floorplan_results` + `layout_revisions` 저장
6. 필요 시 `review_required` 후 project finalize
7. 프론트엔드가 revision/result 기준으로 2D/3D 렌더링

## 책임 경계
- `apps/web`:
  - 업로드/잡 생성 요청/잡 상태 폴링/결과 렌더링
  - Supabase 로그인 세션(access token) 획득
  - OAuth callback(`/auth/callback`)은 브라우저 Supabase client의 PKCE URL 감지와 cookie storage를 사용하고, callback page는 세션 감지만 수행한다.
  - recoverable auth 오류(`Invalid Refresh Token` 등) 발생 시 브라우저 세션을 정리하고 재로그인을 유도
- `apps/api`:
  - 사용자 인증 검증(Supabase JWT)
  - intake/catalog/project/floorplan/job/result/asset-generation 도메인 API 제공
  - signed upload URL 발급
- `apps/worker`:
  - 도면 분석, geometry revision 생성, scene JSON 파생 생성
  - asset generation provider 호출 및 GLB 저장
  - 잡 상태 전이(queued/running/retrying/succeeded/failed/dead_letter)
  - intake 상태 전이(queued/analyzing/review_required/resolved_generated/failed)

## 핵심 API 기준 (Railway `/v1`)
- `POST /v1/projects`
- `GET /v1/projects`
- `POST /v1/assets/generate`
- `POST /v1/intake-sessions`
- `GET /v1/intake-sessions/:id`
- `POST /v1/intake-sessions/:id/upload-url`
- `POST /v1/intake-sessions/:id/resolve`
- `POST /v1/intake-sessions/:id/select-candidate`
- `POST /v1/intake-sessions/:id/review-complete`
- `POST /v1/intake-sessions/:id/finalize-project`
- `GET /v1/catalog/search`
- `GET /v1/jobs/:jobId`
- `POST /v1/jobs/:jobId/retry`
- `GET /v1/floorplans/:floorplanId/result`
- `GET /v1/projects/:projectId/versions/latest`
- `GET /v1/projects/:projectId/scene/latest`

## 프론트엔드 API 기준
- `NEXT_PUBLIC_RAILWAY_API_URL` 기반으로 Railway API 호출.
- `Authorization: Bearer <supabase access token>` 헤더 전달.
- active builder-first web surface는 `projects`, `project versions`, `shared`, `showcase` 중심으로 동작하고, intake/floorplan/revision fetch는 compatibility 또는 ops 경계에서만 사용한다.
- public showcase read surface(`gallery`, `community`)는 Vercel Route Handler(`/api/v1/showcase`)에서 60초 재검증 캐시를 사용하고, upstream source는 Railway `/v1/showcase`를 유지한다.
- `GET /v1/projects/:projectId/versions/latest`는 active editor/viewer가 latest saved snapshot을 읽는 기본 경로다.
- `GET /v1/projects/:projectId/scene/latest`는 archived room bootstrap과 ops 검증용 compatibility 경로로만 유지한다.
- Next.js 내부 도메인/파싱 API(`/api/ai/parse-floorplan`, `/api/projects/*`, `/api/furnitures/*`, `/api/assets/generate`)는 사용하지 않는다.

## 데이터 테이블 기준
- `projects` (기존)
- `floorplans`
- `jobs`
- `floorplan_results`
- `intake_sessions`
- `housing_complexes`
- `layout_families`
- `layout_variants`
- `layout_revisions`
- `source_assets`
- `revision_source_links`
- `catalog_search_index`
- `floorplan_match_events`

Queue는 Supabase Postgres(`claim_jobs` + `FOR UPDATE SKIP LOCKED`) 기반으로 운영한다.

## 품질 게이트
- `npm --workspace apps/web run type-check`
- `npm --workspace apps/web run lint`
- `npm --workspace apps/web run build`
- `npm --workspace apps/api run typecheck`
- `npm --workspace apps/worker run typecheck`

## 관련 문서
- `docs/ai-pipeline.md`
- `docs/3d-visual-engine.md`
- `docs/implementation-plan.md`
- `docs/user-action-guide.md`
- `docs/deployment.md`
- `docs/specs/db-schema-v4.md`
- `docs/specs/intake-job-state-machine-v4.md`
- `docs/specs/geometry-canonicalization-hash-v4.md`
- `docs/specs/typed-patch-promotion-withdrawal-v4.md`
- `docs/specs/3d-map-commercial-roadmap.md`

## 2026-03-05 변경 동기화 (Railway Immediate Cutover)
Added:
- Vercel UI / Railway API / Railway Worker / Supabase 분리 아키텍처.
- 잡 큐 기반 파이프라인과 `floorplans/jobs/floorplan_results` 기준.
- Web/API/Worker 공통 품질 게이트.

Updated:
- 프론트엔드 데이터 경계를 Railway API 호출 중심으로 변경.
- provider 실행 위치를 Next route에서 Railway worker로 이동.

Removed/Deprecated:
- Vercel `parse-floorplan` 직접 처리 모델.
- Next.js 도메인 API(`/api/projects/*`, `/api/furnitures/*`) 중심 아키텍처.

## 2026-03-11 변경 동기화 (Floorplan Normalization Accuracy Pass)
Added:
- Worker 후보 선택 전 deterministic wall/opening/scale 정규화 규칙.

Updated:
- 정확도 개선 범위를 provider 호출 자체보다 정규화/재부착/스코어링 강화로 확장.

Removed/Deprecated:
- opening을 중심점 근사로만 벽에 부착하는 단순 규칙.

## 2026-03-11 변경 동기화 (Commercialization Foundation V4)
Added:
- `intake_session-first`, `layout_revisions` 단일 truth, `revision_source_links`, `review_required` 상태를 기준 아키텍처로 추가.
- geometry-first revision 모델과 spec 문서 4종(`db-schema`, `state-machine`, `geometry-hash`, `patch-policy`) 추가.

Updated:
- 데이터 흐름을 `upload/search -> intake resolution -> revision or job -> project finalize`로 상향 조정.
- API 책임을 project-first에서 intake/catalog/revision 기반으로 확장.

Removed/Deprecated:
- scene JSON을 canonical truth로 보는 해석.
- project 생성 이후에만 업로드를 시작하는 단일 intake 방식.

## 2026-03-12 변경 동기화 (Intake Web Cutover + Finalize Fix + Room Geometry)
Added:
- `apps/web`가 intake/catalog/finalize API를 직접 사용하는 intake-first 구현으로 전환.
- worker가 `layout_revisions.geometry_json.rooms`, `exteriorShell`, `roomAdjacency`와 `derived_scene_json.floors`를 저장.
- `finalize_intake_session` RPC의 exact-once finalize 경로와 reuse/generated resolution state 복원 보정.
- 원격 검증 기준으로 `apps/web/scripts/e2e-intake-flow.ts` 기반 실환경 E2E를 추가.

Updated:
- `/project/[id]`는 saved scene이 없어도 `source_layout_revision_id`를 읽어 editor state를 복원하도록 확장.
- floor/ceiling 렌더링은 exterior heuristic보다 revision-derived `floors[]`를 우선 사용하도록 변경.
- Supabase migration history는 `20260305`, `20260311`, `20260312120000` 체인으로 정리한다.

Removed/Deprecated:
- 새 프로젝트 생성 시 project-first draft를 먼저 만드는 흐름.
- walls-only scene payload에만 의존하는 floor/ceiling 렌더링.
- 더 이상 사용하지 않는 Next.js 내부 도메인 API(`/api/projects/*`, `/api/furnitures/*`, `/api/realtime`, `/api/ai/parse-floorplan`).

## 2026-03-12 변경 동기화 (Asset Generation Worker Migration)
Added:
- `POST /v1/assets/generate`와 `jobs.result` 기반 asset generation 비동기 계약.
- Railway worker가 TripoSR/Meshy 호출, GLB 저장, `assets` row 생성까지 담당하는 경계.

Updated:
- AssetPanel의 custom asset 생성 경로를 `Vercel route -> Railway API enqueue -> worker process -> /v1/jobs poll`로 전환.
- asset provider 키와 bucket 설정을 worker 전용 환경 변수로 이동.

Removed/Deprecated:
- Next.js `/api/assets/generate` 동기/폴링 혼합 처리 경로.

## 2026-03-13 변경 동기화 (Commercial 3D Map Derived Scene V2)
Added:
- worker가 `rooms`, `floors`, `ceilings`, `navGraph`, `cameraAnchors`를 geometry 기준으로 파생 생성하는 규칙.
- `docs/specs/3d-map-commercial-roadmap.md`를 3D 맵 상용화 기준 문서로 추가.

Updated:
- Walk mode 초기 진입점은 wall/door heuristic보다 revision-derived entrance anchor를 우선 사용.
- 한국 아파트형 컬러 채움 평면도 대응을 위해 worker multi-pass 전처리에 `filled_plan` 프로파일을 포함한다.

Removed/Deprecated:
- renderer 교체를 3D 맵 상용화의 주된 해결책으로 보는 접근.
- 외부 listing gallery URL을 서비스가 직접 크롤링해 catalog/benchmark source로 삼는 접근.

## 2026-03-13 변경 동기화 (Semantic Room Hints + OCR Dimension Upgrade)
Added:
- provider 출력 계약에 `semanticAnnotations.roomHints`, `semanticAnnotations.dimensionAnnotations`를 추가.
- worker room reconstruction이 wall loop 외에 semantic room hint polygon을 fallback 입력으로 사용할 수 있도록 확장.

Updated:
- scale 보정은 `scaleInfo.evidence` 단일 값뿐 아니라 다중 dimension annotation 합의값을 우선 반영한다.
- room type/label 결정은 형상 휴리스틱만이 아니라 한글/영문 room label annotation을 우선 priors로 사용한다.

Removed/Deprecated:
- room semantics를 area/exposure/adjacency 휴리스틱만으로 결정하는 해석.

## 2026-03-19 변경 동기화 (Accuracy Commercialization V2)
Added:
- PaddleOCR 기반 `roomHints/dimensionAnnotations` 외부 OCR lane.
- Roboflow CubiCasa / HF Dedicated Endpoint를 worker 오케스트레이터가 optional candidate로 흡수하는 외부 추론 경로.
- `conflict_score > 0.3`, `dimension_conflict > 0.35`, `scale_conflict > 0.35` fail-closed review gate.
- Railway intake/job/result 실경로를 사용하는 blind-set eval harness와 `korean_complex >= 20%` composition rule.

Updated:
- semantic/dimension signal을 단순 debug 메트릭에서 candidate score 및 review gate 핵심 신호로 승격.
- 상용화 정확도 작업의 우선순위를 `3D 확장`보다 `eval -> OCR -> structure parser -> conflict gate` 순으로 고정.

Removed/Deprecated:
- 폐기된 Next parse endpoint(`/api/ai/parse-floorplan`)를 eval 기본 경로로 사용하는 방식.

## 2026-04-08 변경 동기화 (Builder-First Studio Surface)
Added:
- 웹 진입 플로우에 `landing -> /studio/builder -> /project/[id]` builder-first 수동 방 생성 경로를 추가.
- `/v1/projects` + `/v1/projects/:id/versions`만으로 blank-room 프로젝트를 생성하는 frontend 계약을 추가.

Updated:
- 기본 제품 표면을 `도면 업로드 시작`에서 `빈 방 생성 후 편집 시작`으로 조정했다.
- `/project/[id]`는 worker result가 없더라도 `latestVersion`을 읽어 builder-authored room을 복원할 수 있어야 한다.

Removed/Deprecated:
- `New Project`의 기본 진입을 floorplan upload/intake modal로 두는 UX.

## 2026-04-08 변경 동기화 (Shared Viewer Shell Alignment)
Added:
- `/shared/[token]`에 top/walk 전환이 가능한 viewer-first 공유 surface를 추가.
- shared viewer도 editor와 동일하게 saved project version hydration 경로를 사용하도록 `latestVersion -> scene mapper` 기준을 추가.

Updated:
- 공유 링크는 raw `floor_plan/customization` 수동 조립보다 저장 버전 기준 scene 복원을 우선 사용한다.
- `edit` 권한 공유 링크도 현재 refactor 단계에서는 preview-first surface로 취급한다.

Removed/Deprecated:
- shared viewer가 `floor_plan.rooms + customization.furniture`만으로 독립 조립된다는 가정.

## 2026-04-08 변경 동기화 (Viewer-First Shared Surface)
Added:
- `/shared/[token]`가 top/walk 전환이 가능한 read-only viewer shell을 기본 surface로 제공한다.

Updated:
- 공유 링크는 편집 surface가 아니라 viewer surface를 우선 제공하고, 상세 메타/scene stats를 함께 노출한다.

Removed/Deprecated:
- 공유 링크를 단순 canvas-only walkthrough 화면으로 취급하는 UX.

## 2026-04-08 변경 동기화 (Shell Reuse + Share Permission Alignment)
Added:
- editor와 shared viewer가 동일한 mode toggle / metric grid 컴포넌트를 공유하는 shell 기준을 추가한다.

## 2026-04-09 변경 동기화 (PKCE Callback Stabilization)
Added:
- Supabase OAuth callback의 code exchange를 브라우저 client 경계에서 수행하는 운영 기준을 추가했다.

Updated:
- frontend auth 책임을 `server callback exchange`에서 `same-origin browser callback exchange` 중심으로 조정했다.

Removed/Deprecated:
- `/auth/callback` server route handler에서 PKCE code verifier를 기대하는 처리 경로.

## 2026-04-09 변경 동기화 (Editorial Home Surface + Callback Observer Flow)
Added:
- 홈 진입면에 warm editorial photo-first shell과 local curated imagery(`img1~img7`)를 사용하는 제품 기준을 추가했다.

Updated:
- `/auth/callback`은 수동 `exchangeCodeForSession` 호출이 아니라 browser client session 감시와 same-origin cookie storage를 전제로 동작한다.
- home/navbar의 시각 우선순위를 dark utility shell에서 premium furniture-editorial shell로 조정했다.

Removed/Deprecated:
- callback page가 브라우저 client 위에서 추가 수동 exchange를 한 번 더 수행하는 처리.

Updated:
- share modal은 현재 런타임 계약과 맞춰 새 링크를 preview-only viewer access로 안내하고, 기존 `edit` 링크는 preview fallback으로 표기한다.

Removed/Deprecated:
- 공유 권한 UI가 즉시 shared editor access를 제공하는 것처럼 보이는 문구.

## 2026-04-08 변경 동기화 (Builder-Only Editor Surface)
Added:
- editor와 shared viewer가 동일한 `SceneViewport` 렌더 surface를 공유하는 기준을 추가한다.
- top-view 좌측 패널은 category filter와 starter set이 있는 library shelf를 기본 자산 표면으로 사용한다.

Updated:
- `/project/[id]`의 기본 편집 surface는 builder-authored room shell 기준으로 동작하고, legacy floorplan import UI는 더 이상 메인 editor에서 노출하지 않는다.
- shared viewer의 `Walk` 토글은 editor와 같은 geometry/scale gate를 따른다.

Removed/Deprecated:
- 메인 editor launch surface에서 legacy upload/template recovery를 직접 노출하는 UX.

## 2026-04-08 변경 동기화 (Editor Shell State Isolation)
Added:
- editor/shared viewer가 route mount 시 explicit shell preset을 적용하고 unmount 시 기본 editor shell state로 복귀하는 기준을 추가한다.
- `/project/[id]`의 header, launch surface, inspector는 editor shell 컴포넌트로 분리 가능한 구조를 유지한다.

Updated:
- global `useEditorStore`는 `readOnly`, panel, transform state가 route 간에 암묵적으로 남지 않도록 preset/reset helper를 통해 다룬다.
- top view에서 walk mode로 벗어날 때는 stale panel/transform UI가 남지 않도록 shell state를 정리한다.

Removed/Deprecated:
- shared viewer와 editor가 전역 shell state를 부분적으로만 덮어쓰고 수동 setter로 복구하는 방식.

## 2026-04-08 변경 동기화 (Editor Save Session + History UX)
Added:
- editor route는 route-local autosave session을 사용해 `dirty`, `saving`, `lastSavedAt`, `saveError` 상태를 관리한다.
- scene history는 baseline snapshot과 committed snapshot append 방식으로 `undo/redo`를 지원하고, wall/floor finish도 history 범위에 포함한다.
- mobile top-editor controls는 library/inspector 토글과 undo/redo 액션을 별도 shell 컴포넌트로 제공한다.

Updated:
- 저장 UX는 manual save 버튼만이 아니라 autosave feedback badge와 mobile status text를 함께 제공해야 한다.
- asset drag/transform/hotkey 회전은 commit 시점에 history snapshot을 남겨 stale history gap이 생기지 않도록 한다.

Removed/Deprecated:
- snapshot 구조가 존재하지만 실제 editor mutation과 연결되지 않아 undo/redo가 사실상 비활성인 상태.

## 2026-04-08 변경 동기화 (Asset Library Productization)
Added:
- builder asset library의 단일 계약으로 `lib/builder/catalog.ts`와 `useAssetCatalog` 기반 정규화/카테고리/featured 계산 기준을 추가한다.
- top-view library shelf는 starter set, canonical category chips, spotlight pick, featured picks, placed-state badge를 포함한 제품형 카탈로그 표면을 사용한다.

Updated:
- `/project/[id]`는 page-local manifest parsing 대신 shared catalog hook을 사용하고, builder shelf를 단일 catalog surface로 사용한다.
- manifest category는 raw 문자열을 그대로 노출하지 않고 canonical category label로 정규화한다.

Removed/Deprecated:
- editor page와 retired legacy overlay panel이 서로 다른 catalog parsing 규칙을 갖는 구조.

## 2026-04-08 변경 동기화 (Catalog Metadata on Viewer Surfaces)
Added:
- catalog item은 `collection`과 `tone` 메타를 가지며, shared viewer는 saved scene의 배치 자산을 catalog lookup으로 매핑해 `Placed pieces`와 `Collections` 요약을 노출한다.
- editor inspector는 raw asset path 대신 catalog label/category/collection 메타를 우선 표시한다.

Updated:
- shared viewer summary는 단순 scene counts 외에도 catalog-aware asset summary를 함께 보여준다.
- custom/generated asset처럼 catalog lookup에 없는 항목은 `uncatalogued` count로만 처리하고 scene contract는 바꾸지 않는다.

Removed/Deprecated:
- viewer/inspector가 배치 자산을 항상 raw `assetId` 문자열로만 설명하는 UI.

## 2026-04-08 변경 동기화 (Project Summary Metadata + Variant Identity)
Added:
- scene asset은 선택적으로 `catalogItemId`를 저장하고, saved customization metadata에도 동일 키를 남겨 catalog variant identity를 복원할 수 있다.
- project는 `meta.assetSummary`에 top placed pieces, collections, primary tone/collection을 저장하고 studio card/share modal은 이를 우선 사용한다.
- project list/detail 응답은 `thumbnail_path`를 signed thumbnail URL로 해석해 `thumbnail` 필드를 내려준다.

Updated:
- studio project card와 share modal은 단순 프로젝트 이름만이 아니라 latest saved summary metadata를 함께 표시한다.
- `placed` 상태는 가능할 때 `catalogItemId` 기준으로 계산하고, 구버전 저장본만 `assetId` fallback을 사용한다.

Removed/Deprecated:
- variant가 같은 `assetId` 하나로만 식별되어 merch-level 구분이 불가능한 상태.

## 2026-04-08 변경 동기화 (Pinned Share Snapshot)
Added:
- shared link는 `shared_projects.project_version_id`에 고정된 saved version을 가리키고, `shared_projects.preview_meta`에 project name/description, version number, `assetSummary`를 저장한다.
- shared viewer는 pinned preview metadata가 있으면 live catalog lookup보다 이를 우선 소비해 `Placed pieces`와 `Collections` 요약을 안정적으로 유지한다.

Updated:
- share modal의 새 링크 생성 의미는 "현재 latest saved snapshot을 고정한 read-only viewer link"로 본다.
- `/shared/[token]`은 project 최신 버전 fallback 없이 pinned version만 복원해야 한다. `project_version_id`가 없거나 읽을 수 없으면 fail-closed 처리한다.

Removed/Deprecated:
- shared link가 항상 현재 latest project version과 현재 catalog 상태를 다시 읽는 느슨한 pointer 계약.

## 2026-04-08 변경 동기화 (Published Showcase Surface)
Added:
- `shared_projects.is_gallery_visible`와 `published_at`를 통해 pinned snapshot link를 public showcase surface에 노출하는 기준을 추가한다.
- public showcase는 `/gallery`에서 `shared_projects.project_version_id + preview_meta`를 읽어 `/shared/[token]`으로 deep-link하는 read-only archive로 동작한다.

Updated:
- gallery는 더 이상 mock editorial feed가 아니라 builder-first editor에서 발행한 permanent view-only snapshot 목록을 보여준다.
- `/community`는 gallery redirect가 아니라 pinned public snapshot을 큐레이션한 별도 community feed surface로 동작한다.
- showcase transport/configuration 실패는 ordinary empty state로 숨기지 않고 unavailable state로 드러낸다.

Removed/Deprecated:
- mock gallery cards와 fake community discussion을 제품 surface로 유지하는 상태.

## 2026-04-09 변경 동기화 (Community Feed + Legacy Compatibility Retirement)
Added:
- `/community`는 published pinned snapshot을 기반으로 featured room, recent circulation feed, archive picks를 렌더하는 실제 public surface가 된다.

Updated:
- landing 3D CTA와 새 프로젝트 생성 copy는 community feed와 builder-first 진입을 기준으로 맞춘다.
- old project 지원은 "계속 intake/upload surface를 노출"하는 방식이 아니라 "ops backfill로 versioned snapshot을 만들고 이후 saved version 경로로 연다"는 방식으로 유지한다.
- active web surface는 intake/catalog/upload/finalize helper를 더 이상 번들하지 않고, saved version 중심 경로를 기본으로 유지한다.

Removed/Deprecated:
- `/community -> /gallery` redirect.
- 사용자에게 노출되는 legacy `AssetPanel` / `job-polling` overlay 경로.
- web-side legacy intake helper module(`features/floorplan/upload.ts`).

## 2026-04-09 변경 동기화 (Latest Version Cutover + Legacy Backfill Ops)
Added:
- active web는 `GET /v1/projects/:projectId/versions/latest`로 latest saved version만 hydrate한다.
- `apps/api/scripts/backfill-legacy-project-versions.ts`와 `npm --workspace apps/api run backfill:legacy-project-versions -- --dry-run --limit <n>` 운영 절차를 추가한다.

Updated:
- `/project/[id]` bootstrap 순서는 `latest saved version -> empty builder launch`로 고정한다.
- legacy retirement의 마감 기준은 old project를 즉시 삭제하는 것이 아니라, backfill로 `project_versions`를 채운 뒤 active web의 compatibility bootstrap을 제거하는 것이다.
- backfill CLI는 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`가 주입된 ops 환경에서만 실행한다.

Removed/Deprecated:
- active editor가 `scene/latest` 하나에 latest saved version hydration과 legacy recovery를 함께 의존하는 구조.

## 2026-04-09 변경 동기화 (Production Backfill Complete + Web Bootstrap Retirement)
Added:
- `2026-04-09` 기준 Railway production `api` 환경에서 legacy backfill dry-run 결과 remaining candidate가 `0`임을 확인했다.

Updated:
- active web editor는 더 이상 `scene/latest`, layout revision, embedded metadata compatibility bootstrap을 사용하지 않는다.
- `GET /v1/projects/:projectId/scene/latest`는 ops/admin 검증용 legacy seam으로만 유지한다.
- `/project/[id]`는 `versions/latest` 읽기 실패를 builder empty state로 감추지 않고 명시적 workspace load failure 상태로 노출한다.

Removed/Deprecated:
- user-facing web bundle에 `LegacyCompatibilityBanner`와 `lib/api/legacy-project.ts`를 유지하는 구조.

## 2026-04-09 변경 동기화 (Showcase Read Path on Vercel Route Handler)
Added:
- `apps/web`에 public showcase read 전용 Vercel Route Handler(`/api/v1/showcase`)를 추가한다.
- route handler는 Railway `/v1/showcase`를 upstream으로 사용하면서 `revalidate=60` 캐시를 적용한다.

Updated:
- `/gallery`, `/community`는 direct client helper 대신 server-side showcase helper를 사용하고, page-level `revalidate=60`을 적용한다.
- public showcase traffic은 `browser -> vercel route cache -> railway showcase` 순서로 단순화한다.

Removed/Deprecated:
- public showcase read를 항상 `no-store`로 Railway API에 직접 요청하는 기준.

## 2026-04-09 변경 동기화 (Asset Anchor Model + Placement Constraint Slice)
Added:
- `SceneAsset`에 optional `anchorType`(`floor|wall|ceiling|furniture_surface|desk_surface|shelf_surface`)를 추가하고 save/restore 경로에서 metadata로 보존한다.
- top editor의 drag/transform은 anchorType 기준 제약을 적용한다. `wall`은 최근접 wall segment로 snap되고 `ceiling`/surface 계열은 Y축이 anchor 규칙을 따른다.

Updated:
- `catalogItemId`는 add/save/restore 전 구간에서 empty string을 `null`로 정규화해 variant identity가 흔들리지 않게 유지한다.
- inspector는 selected asset의 anchorType을 직접 변경할 수 있고, 변경 즉시 anchor 규칙으로 좌표/회전을 재정렬한다.

Removed/Deprecated:
- top editor에서 자산 배치를 항상 ground-plane free move로만 처리하는 기준.

## 2026-04-09 변경 동기화 (Viewer Product Hotspots Detail Rail)
Added:
- shared viewer 우측 rail에 개별 배치 자산 단위의 `Product hotspots` 리스트를 추가한다.
- hotspot 클릭 시 `selectedAssetId`가 바뀌고 viewport에서 선택 링으로 강조되며, 하단 `Selected detail` 카드에서 category/collection/anchor 정보를 노출한다.

Updated:
- shared viewer는 aggregate summary(`placed pieces`)만이 아니라 개별 product inspection flow를 함께 제공한다.
- viewer 기본 진입 시 첫 번째 배치 자산을 선택해 detail rail이 빈 상태로 시작하지 않게 한다.

Removed/Deprecated:
- shared viewer에서 배치 자산을 aggregate count로만 보여주고 개별 선택/상세 확인 경로가 없는 기준.

## 2026-04-09 변경 동기화 (Versions Latest Read on Vercel Route)
Added:
- `apps/web`에 auth 기반 `GET /api/v1/projects/:projectId/versions/latest` Route Handler를 추가한다.
- editor bootstrap client는 local route read를 우선 사용하고, 실패 시 기존 Railway `/v1/projects/:projectId/versions/latest`로 fallback한다.

Updated:
- `latest version` 조회 트래픽은 `browser -> vercel route -> supabase`를 우선 경로로 사용해 Railway API 의존을 줄인다.

Removed/Deprecated:
- editor bootstrap read를 Railway API 단일 경로로만 처리하는 기준.

## 2026-04-09 변경 동기화 (Lighting Persistence + Legacy Route Gating)
Added:
- scene 저장 계약에 `lighting`(ambient/hemisphere/directional/environment blur) 값을 포함하고 project version customization defaults로 저장/복원한다.
- API 서버는 `ENABLE_LEGACY_API_ROUTES=false` 기본값에서 intake/floorplan/jobs/revisions/scenes 라우트를 마운트하지 않는다.

Updated:
- editor inspector는 finish 조정과 함께 조명 슬라이더를 제공하며, 변경값은 autosave를 통해 버전 스냅샷에 남는다.
- surface-aware placement는 desk/shelf/furniture surface 앵커에서 주변 지지 가구 상판으로 스냅하는 규칙을 추가한다.

Removed/Deprecated:
- active editor 조명값이 런타임에서만 반영되고 저장본에는 남지 않는 계약.
- legacy floorplan-first 라우트를 API 기본 동작으로 항상 노출하는 기준.
