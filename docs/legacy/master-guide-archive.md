# Master Guide (Engineering Source of Truth)

이 문서는 Plan2Space의 엔지니어링 단일 기준 문서입니다.

## Primary Product Surface
- 메인 사용자 경로는 `room builder -> editor -> publish -> read-only viewer`다.
- active web route는 `/studio/builder`, `/project/[id]`, `/shared/[token]`, `/gallery`, `/community`다.
- gallery/community/shared는 동일한 read-only viewer 경험으로 수렴한다.
- viewer에서는 편집 affordance(이동/회전/삭제/저장/발행)를 노출하지 않는다.

## Legacy/Internal Surface
- `floorplan/intake/AI pipeline`은 메인 UX가 아니다.
- legacy 경로는 기존 프로젝트 호환과 운영 검증(ops) 용도로만 유지한다.
- legacy 상세 문서는 `docs/legacy/*`를 사용한다.

## Non-Negotiables
- Top view / Walk mode 두 모드 카메라 경험 보장.
- PBR + HDR + Post FX 시각 품질 기준 유지.
- 무거운 이미지 분석/기하/씬 생성 연산은 Vercel에서 실행하지 않음.
- builder/editor/viewer/gallery/community는 동일 디자인 시스템 토큰을 사용한다.
- 좌측 패널 + 우측 viewport 구조를 기본 레이아웃으로 유지한다(좌측 패널 400~440px).
- 레거시 intake 파이프라인은 메인 라우트에서 직접 노출하지 않는다.

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

Primary 데이터 흐름:
1. builder에서 room shell(모양/치수/문창/스타일) 생성
2. editor에서 자산 배치/변형/저장
3. share modal에서 발행 및 링크 생성
4. `/shared/[token]`, `/gallery`, `/community`에서 read-only viewer로 조회

Legacy 데이터 흐름(ops):
1. intake 세션 생성
2. worker 분석 + revision 생성
3. finalize 후 project pinning

## 책임 경계
- `apps/web`:
  - room builder/editor/viewer UI와 publish/share 표면 제공
  - Supabase 로그인 세션(access token) 획득
  - OAuth callback(`/auth/callback`)은 브라우저 Supabase client의 PKCE URL 감지와 cookie storage를 사용하고, callback page는 세션 감지만 수행한다.
  - recoverable auth 오류(`Invalid Refresh Token` 등) 발생 시 브라우저 세션을 정리하고 재로그인을 유도
- `apps/api`:
  - 사용자 인증 검증(Supabase JWT)
  - project/share/showcase 중심 API와 legacy intake compatibility API 제공
  - signed upload URL 발급
- `apps/worker`:
  - legacy intake 분석, geometry revision 생성, scene JSON 파생 생성
  - asset generation provider 호출 및 GLB 저장
  - 잡 상태 전이(queued/running/retrying/succeeded/failed/dead_letter)
  - intake 상태 전이(queued/analyzing/review_required/resolved_generated/failed)

## 핵심 API 기준 (Railway `/v1`)
- 기본 공개면(default)은 `health` + `assets/generate`(worker enqueue) 중심으로 유지한다.
- lightweight browse/read(`projects`, `catalog`, `showcase`)는 `ENABLE_LIGHTWEIGHT_API_ROUTES=true`일 때만 compatibility로 노출한다.
- legacy surface(`jobs`, `intake`, `floorplans`, `revisions`, `scenes`)는 `ENABLE_LEGACY_API_ROUTES=true`일 때만 노출한다.
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
- active builder-first web surface는 `projects`, `project versions(save/latest)`, `shared`, `showcase`를 Vercel Route Handler(`/api/v1/*`)로 우선 호출한다.
- 인증은 Supabase server session(cookie) 기준으로 route handler에서 검증하며, 브라우저에서 Railway access token을 직접 붙이는 경로를 줄인다.
- public showcase read surface(`gallery`, `community`)는 Vercel Route Handler(`/api/v1/showcase`)에서 60초 재검증 캐시를 사용한다.
- `GET /api/v1/projects/:projectId/versions/latest`는 active editor/viewer가 latest saved snapshot을 읽는 기본 경로다.
- `GET /api/v1/projects/:projectId/bootstrap`는 editor 초기 진입 시 `current/latest version -> revision pin fallback` 순서로 scene bootstrap을 제공한다.
- `GET /api/v1/projects/:projectId/versions`는 editor revision drawer/history 목록 조회의 기본 경로다.
- `GET /api/v1/catalog`는 editor shelf/shared viewer hotspot 매칭의 기본 browse 경로이며, web은 static manifest를 직접 읽지 않는다.
- `GET /api/v1/room-templates`는 builder wizard 템플릿/마감재 browse의 기본 경로다.
- `POST /api/v1/assets/generate`는 web route handler에서 session 인증 후 Railway worker enqueue endpoint(`/v1/assets/generate`)로 프록시한다.
- `GET /api/v1/jobs/:jobId`는 web route handler에서 owner-scoped job status를 읽는 기본 폴링 경로다.
- `GET /v1/projects/:projectId/scene/latest`는 archived room bootstrap과 ops 검증용 compatibility 경로로만 유지한다.
- 브라우저에서 Railway URL을 직접 호출하지 않고, heavy 경로도 반드시 web route handler(`/api/v1/*`)를 통해 접근한다.
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
- `docs/ai-pipeline.md` (legacy/index)
- `docs/3d-visual-engine.md`
- `docs/implementation-plan.md`
- `docs/user-action-guide.md`
- `docs/deployment.md`
- `docs/legacy/README.md`
- `docs/legacy/ai-pipeline.md`
- `docs/legacy/specs/db-schema-v4.md`
- `docs/legacy/specs/intake-job-state-machine-v4.md`
- `docs/legacy/specs/geometry-canonicalization-hash-v4.md`
- `docs/legacy/specs/typed-patch-promotion-withdrawal-v4.md`
- `docs/legacy/specs/3d-map-commercial-roadmap.md`

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
- AssetPanel의 custom asset 생성 경로를 `Vercel route -> Railway API enqueue -> worker process -> /api/v1/jobs poll`로 전환.
- asset provider 키와 bucket 설정을 worker 전용 환경 변수로 이동.

Removed/Deprecated:
- Next.js `/api/assets/generate` 동기/폴링 혼합 처리 경로.

## 2026-03-13 변경 동기화 (Commercial 3D Map Derived Scene V2)
Added:
- worker가 `rooms`, `floors`, `ceilings`, `navGraph`, `cameraAnchors`를 geometry 기준으로 파생 생성하는 규칙.
- `docs/legacy/specs/3d-map-commercial-roadmap.md`를 3D 맵 상용화 기준 문서로 추가.

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
- active web는 `GET /api/v1/projects/:projectId/versions/latest`로 latest saved version만 hydrate한다.
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
- route handler는 web server helper(Supabase query)를 통해 feed를 구성하고 `revalidate=60` 캐시를 적용한다.

Updated:
- `/gallery`, `/community`는 direct client helper 대신 server-side showcase helper를 사용하고, page-level `revalidate=60`을 적용한다.
- public showcase traffic은 `browser -> vercel route cache -> supabase` 순서로 단순화한다.

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
- editor bootstrap client는 local route read만 사용하고 Railway direct latest-version fallback을 두지 않는다.

Updated:
- `latest version` 조회 트래픽은 `browser -> vercel route -> supabase`를 우선 경로로 사용해 Railway API 의존을 줄인다.

Removed/Deprecated:
- editor bootstrap read를 Railway API 단일 경로로만 처리하는 기준.

## 2026-04-09 변경 동기화 (Lighting Persistence + Legacy Route Gating)
Added:
- scene 저장 계약에 `lighting`(ambient/hemisphere/directional/environment blur) 값을 포함하고 project version customization defaults로 저장/복원한다.
- API 서버는 `ENABLE_LEGACY_API_ROUTES=false` 기본값에서 jobs/intake/floorplan/revisions/scenes 라우트를 마운트하지 않는다.
- `/v1/jobs/:jobId`와 `/v1/jobs/:jobId/retry`는 legacy gate(`ENABLE_LEGACY_API_ROUTES`)에서 제어한다.

Updated:
- editor inspector는 finish 조정과 함께 조명 슬라이더를 제공하며, 변경값은 autosave를 통해 버전 스냅샷에 남는다.
- surface-aware placement는 desk/shelf/furniture surface 앵커에서 주변 지지 가구 상판으로 스냅하는 규칙을 추가한다.

Removed/Deprecated:
- active editor 조명값이 런타임에서만 반영되고 저장본에는 남지 않는 계약.
- legacy floorplan-first 라우트를 API 기본 동작으로 항상 노출하는 기준.

## 2026-04-10 변경 동기화 (Project CRUD + Version Save on Vercel Routes)
Added:
- `apps/web` Route Handler에 auth 기반 project CRUD 경로를 추가한다.
  - `GET/POST /api/v1/projects`
  - `GET/DELETE /api/v1/projects/:projectId`
- `POST /api/v1/projects/:projectId/versions` Route Handler를 추가해 editor/builder save path를 Vercel route + Supabase RPC(`create_project_version`)로 이전한다.
- 프로젝트 저장 server helper(`lib/server/project-versions.ts`)를 추가해 thumbnail 업로드, asset summary 메타 반영, version snapshot 생성 로직을 통합한다.

Updated:
- active save/read path는 `browser -> vercel route -> supabase`를 기본으로 사용하며, Railway API의 lightweight project CRUD 의존을 제거한다.
- `saveProject` client helper는 Railway `/v1/projects/:id/versions` 대신 local `/api/v1/projects/:id/versions`를 호출한다.

Removed/Deprecated:
- builder/editor의 기본 저장 루프가 Railway `/v1/projects/:projectId/versions`를 직접 호출하는 기준.

## 2026-04-10 변경 동기화 (Template/Catalog BFF + SceneDocument Adapter)
Added:
- `GET /api/v1/catalog`, `GET /api/v1/room-templates` Route Handler를 추가해 template/catalog browse를 Vercel stateless API로 제공한다.
- `lib/domain/scene-document.ts`를 추가해 `RoomShell`, `SceneDocument`, `SceneNode`, `MaterialOverride`, `LightInstance`, hotspot 타입을 web domain 계층으로 명시한다.

Updated:
- `useAssetCatalog`는 static manifest 직접 fetch 대신 `/api/v1/catalog`를 페이지네이션 누적으로 읽어 전체 카탈로그를 기준으로 shelf/search/hotspot 매칭을 수행한다.
- builder wizard는 `/api/v1/room-templates` 응답을 hydration하고, 선택 템플릿 기본 치수를 초기 동기화한다(실패 시 local constants fallback).
- editor/shared viewer bootstrap은 `features/floorplan/result-mapper` 직접 참조 대신 `SceneDocument` 어댑터(`mapProjectVersionToSceneDocument`)를 통해 scene state를 복원한다.

Removed/Deprecated:
- active builder/editor/viewer surface에서 `/assets/catalog/manifest.json`을 브라우저가 직접 source-of-truth로 읽는 기준.
- editor/shared route에서 floorplan mapper 타입을 직접 제품 도메인 타입으로 사용하는 기준.

## 2026-04-10 변경 동기화 (Showcase Archive Cursor Pagination Slice)
Added:
- `GET /api/v1/showcase` 계약에 `cursor`, `nextCursor`, `hasMore`를 추가하고, keyset 정렬(`published_at desc`, `id desc`) 기반 archive pagination을 도입한다.
- gallery/community는 URL query(`room`,`tone`,`density`,`cursor`) 기반으로 archive 페이지를 누적 로드할 수 있는 `Load more` 흐름을 사용한다.

Updated:
- public browsing source-of-truth는 `lib/server/showcase.ts` 단일 helper와 route contract로 통일한다.
- filter 조합은 latest-slice client filtering이 아니라 server helper의 cursor-aware 필터 경로를 통해 archive 전체를 탐색한다.
- showcase read 캐시는 기존과 동일하게 Vercel route `revalidate=60` + `s-maxage=60` 정책을 유지한다.

Removed/Deprecated:
- gallery/community 페이지에 Supabase query/thumbnail signing 로직을 중복 구현하는 기준.
- `latest 240` 고정 슬라이스를 archive browse의 임시 기본 동작으로 유지하는 기준.

## 2026-04-10 변경 동기화 (Surface Anchor Persistence Hardening Slice)
Added:
- `SceneAsset` 계약에 `supportAssetId`, `supportProfile`를 포함하고 editor save/load 경로(`customization.sceneDocument`, `customization.furniture`)에서 양방향 보존한다.
- surface anchor solver는 support asset yaw를 반영한 회전 footprint clamp를 사용하며, desk/shelf/furniture 표면 top 오프셋 기준으로 Y를 재계산한다.
- scene store는 support asset 변경 시 종속 asset을 재앵커링하고, support 삭제 시 참조를 정리한 뒤 재배치한다.

Updated:
- surface-aware placement는 단순 nearest-center + fixed Y 규칙이 아니라 `support profile -> rotated footprint -> anchor constraint` 순서로 계산한다.
- starter-set 및 drag/transform/inspector 수정은 동일한 anchor solver를 경유해 `supportAssetId`를 일관되게 갱신한다.
- support stickiness는 유지하되, 새로운 support 후보가 충분히 가까우면 자동으로 전환되도록 조정한다.

Removed/Deprecated:
- surface anchor가 support 회전을 무시한 axis-aligned clamp만 수행하는 기준.
- support가 이동/삭제되어도 종속 asset reference를 보정하지 않는 기준.

## 2026-04-10 변경 동기화 (Vercel/Railway Boundary Hardening)
Added:
- web/runtime 경계 회귀를 막기 위해 `npm run check:web-boundary` 정적 검증을 추가한다.
- Railway 수동 배포 컨텍스트에서 대용량 `apps/web/public`을 제외하도록 `.railwayignore` 규칙을 추가한다.
- API 게이트 ownership 고정을 위해 `apps/api/src/app.route-gates.test.ts`를 추가하고 flags 조합별 `401/404` 계약을 검증한다.

Updated:
- web route handler와 E2E/eval/smoke 스크립트는 `RAILWAY_API_URL` server env 단일 소스를 사용한다.
- `check:web-boundary`는 `NEXT_PUBLIC_RAILWAY_API_URL`, allowlist 외 `process.env.RAILWAY_API_URL`, hardcoded `*.railway.app` host를 모두 차단한다.
- 운영 환경 변수 템플릿은 `NEXT_PUBLIC_RAILWAY_API_URL` 없이 same-origin BFF 경로를 기본으로 유지한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 production/preview에서 snapshot upload/signing 및 owner-scope job read 보강 경로를 위해 필수로 둔다.

Removed/Deprecated:
- web runtime에서 `NEXT_PUBLIC_RAILWAY_API_URL` fallback을 참조하는 경계.

## 2026-04-10 변경 동기화 (Railway Jobs Gate Ownership Correction)
Added:
- `apps/api/src/app.route-gates.test.ts`에 `/v1/jobs/:jobId` gate ownership 검증(legacy gate 전용)을 추가한다.

Updated:
- Railway compatibility gate는 `projects/catalog/showcase`만 lightweight로 유지하고, `jobs`는 legacy gate에서만 노출한다.
- active web job status는 `GET /api/v1/jobs/:jobId` route handler를 canonical read path로 유지한다.

Removed/Deprecated:
- `/v1/jobs/:jobId`를 lightweight gate(`ENABLE_LIGHTWEIGHT_API_ROUTES`)에 포함하는 운영 기준.

## 2026-04-10 변경 동기화 (SceneDocument Canonicalization Hardening)
Added:
- `apps/web/src/lib/domain/legacy-floorplan-document.ts`를 추가해 floorplan-first 변환을 compatibility seam으로 분리한다.

Updated:
- `apps/web/src/lib/domain/scene-document.ts`는 `customization.sceneDocument` 중심 도메인 매핑 파일로 유지하고, legacy floorplan 변환은 별도 모듈로 위임한다.
- builder/editor/shared active path의 source-of-truth 설명은 `customization.sceneDocument` 우선, legacy fallback은 이관/호환 전용으로 제한한다.

Removed/Deprecated:
- SceneDocument 도메인 레이어가 floorplan/result mapper를 직접 import하는 구조.

## 2026-04-10 변경 동기화 (SceneDocument Save Contract Hardening Slice)
Added:
- editor/builder 저장 payload에 `roomShell`(`ceilings`, `rooms`, `cameraAnchors`, `navGraph`, `entranceId` 포함)을 추가해 save 시점에 파생 shell 데이터를 함께 전송한다.
- `types/database.ts`의 `CustomizationData`에 `sceneDocument` 타입을 명시해 web/server 계약에서 canonical 저장 위치를 고정한다.

Updated:
- `apps/web/src/lib/server/project-versions.ts`는 `roomShell` payload가 있으면 이를 우선 사용해 `customization.sceneDocument.roomShell`을 직렬화한다.
- `GET /api/v1/projects/:projectId/versions/latest` 내부 조회는 `projects.current_version_id`를 우선 사용하고, 없을 때만 최신 version fallback을 사용한다.
- `apps/web/src/lib/server/projects.ts`는 `current_version_id` 및 revision 관련 metadata(`source_layout_revision_id`, `resolution_state`, `created_from_intake_session_id`)를 project 응답에 노출한다.

Removed/Deprecated:
- 저장 시 `topology(scale/walls/openings/floors)`만 반영해 `SceneDocument.roomShell` 파생 필드를 비우는 기준.

## 2026-04-10 변경 동기화 (Shared Viewer Scene Envelope Slice)
Added:
- shared public payload에 `sceneBootstrap`(정규화된 `SceneDocument` + entrance/diagnostics)을 포함해 viewer 입력 계약을 명시한다.

Updated:
- `fetchPublicSceneByToken`는 raw version row를 그대로 넘기지 않고 서버에서 `mapProjectVersionToSceneDocument`를 먼저 수행해 정규화 결과를 전달한다.
- `SharedProjectClient`는 `latestVersion` row 의존을 제거하고 `sceneBootstrap`을 직접 사용한다.

Removed/Deprecated:
- shared viewer가 `customization/floor_plan` raw row를 클라이언트에서 다시 매핑하는 기준.

## 2026-04-10 변경 동기화 (Scene Store Derived Invalidation Slice)
Added:
- scene store에 topology 변경(`walls/openings/floors/scale`) 시 파생 필드(`ceilings`, `rooms`, `cameraAnchors`, `navGraph`)를 invalidation 하는 규칙을 추가한다.

Updated:
- `setScene`는 topology partial patch가 들어오고 파생 필드가 함께 오지 않으면 기존 파생값을 유지하지 않고 reset한다.
- entrance pointer(`entranceId`)는 openings 기준으로 재계산해 stale entrance 참조를 줄인다.

Removed/Deprecated:
- topology 변경 이후에도 이전 파생 결과를 그대로 유지해 저장 payload에 stale scene 파생값이 섞이는 기준.

## 2026-04-10 변경 동기화 (Project Bootstrap Revision Fallback Slice)
Added:
- `GET /api/v1/projects/:projectId/bootstrap` Route Handler를 추가해 editor bootstrap을 same-origin 단일 경로로 통합한다.
- route handler는 `latest/current version`이 없을 때 `source_layout_revision_id`를 사용해 `layout_revisions`에서 scene bootstrap을 구성한다.

Updated:
- `/project/[id]` editor 초기화는 `/versions/latest` 단독 조회 대신 `/bootstrap` 응답(`current_version -> latest_version -> revision_layout`)을 사용한다.
- revision fallback은 브라우저 직접 호출이 아니라 Vercel route + Supabase(service role) owner-scope 검증으로 처리한다.

Removed/Deprecated:
- saved version이 없으면 무조건 empty builder 상태로만 진입하는 bootstrap 기준.

## 2026-04-10 변경 동기화 (Viewer Product Inspection + Surface Anchor Safety Slice)
Added:
- shared read-only viewer viewport에 in-scene product marker(`ViewerProductHotspots`)를 추가해 장면에서 직접 제품을 선택할 수 있는 inspect 경로를 제공한다.
- shared product drawer에 selected product metadata 카드(`catalog/asset id`, `position`, `sku/vendor/material/variant/price`, `productUrl`)를 노출하는 규칙을 추가한다.

Updated:
- read-only 모드에서도 furniture mesh pointer selection을 허용해 “리스트 선택 전용”이 아닌 scene-first inspection 동작을 기본으로 한다.
- `desk_surface/shelf_surface/furniture_surface` 배치는 유효 support surface를 찾지 못하면 default 높이 고정 대신 바닥 높이(`y=0`)로 안전 클램프하고 anchor semantic은 유지한다.

Removed/Deprecated:
- support surface가 없는 상태에서도 surface-anchor 오브젝트를 공중 높이에 유지하는 배치 기준.
- shared viewer 제품 inspection을 우측 리스트 클릭으로만 제한하는 상호작용 기준.

## 2026-04-11 변경 동기화 (Builder Opening Authoring Stability Slice)
Added:
- builder Step 3 opening 정규화에 same-wall overlap 해소 규칙(최소 간격 + 과밀 시 폭 축소/제외)을 추가한다.
- builder shell 변경(템플릿/치수 변경) 시 기존 opening draft를 wall index 기반으로 remap해 편집 연속성을 유지한다.

Updated:
- Step 3의 door/window style preset은 기존 opening을 강제 덮어쓰는 글로벌 동기화가 아니라 “신규 opening 기본값” 기준으로 동작한다.
- shell geometry 변경 시 opening source-of-truth는 `baseScene defaults` 일괄 리셋이 아니라 `manual openingDraft remap -> normalize` 우선 경로를 사용한다.

Removed/Deprecated:
- preset 토글 변경만으로 사용자가 수동 편집한 opening 폭/개수를 즉시 재동기화(파괴적 overwrite)하는 기준.

## 2026-04-11 변경 동기화 (Public Viewer Product Inspection Polish Slice)
Added:
- shared viewer 우측 패널은 `Selected product`, `Hotspot list`, `Room mix` 3단 inspection 계층을 기본 구조로 사용한다.
- `ViewerProductHotspots`는 read-only top/walk 모드 모두에서 marker를 노출하고 번호 badge를 포함해 제품 탐색 연속성을 유지한다.

Updated:
- selected product 패널은 카테고리/컬렉션/anchor + vendor/material/variant/price + external product link 중심으로 구성한다.
- viewer 상단/카드 카피는 내부 구현 용어(`pinned builder snapshot`)보다 public showroom 톤으로 정리한다.

Removed/Deprecated:
- selected panel에 위치 좌표 같은 디버그성 필드를 기본 노출하는 기준.
- walk 모드에서 hotspot marker를 숨기는 기준.

## 2026-04-11 변경 동기화 (Boundary + Canonical Snapshot Alignment Slice)
Added:
- `lib/domain/room-shell.ts`를 추가해 builder topology로부터 `rooms`, `ceilings`, `cameraAnchors`, `navGraph`, `entranceId`를 일관 생성하는 canonical helper를 도입한다.
- share 생성 시 pinned version의 `sceneDocument.nodes` 기준으로 preview asset summary를 재계산해 viewer rail 메타를 버전 스코프로 고정한다.
- CI web job에 optional preview runtime smoke(`smoke:preview-runtime`)를 추가해 Vercel bundle의 Railway URL 비노출 경계를 지속 검증한다.

Updated:
- `createProjectShare`는 최신 version 번호 직접 조회가 아니라 `current_version_id` 우선 해석을 따르는 version resolver를 사용한다.
- builder save/preview scene는 empty 파생 필드 대신 `deriveBlankRoomShell` 결과를 사용해 walk spawn/inspection 품질을 안정화한다.
- `mapProjectVersionToSceneDocument`는 active path에서 `customization.sceneDocument` 단일 경로만 사용하고 legacy floorplan fallback 의존을 제거한다.
- top-level 운영 문서/템플릿(`README`, `.env.example`)은 boundary 검증 명령과 worker 필수 env를 명시해 운영 오차를 줄인다.

Removed/Deprecated:
- share pinning에서 `latest(version)` 기준으로 별도 선택되어 editor bootstrap 포인터와 불일치할 수 있는 기준.
- builder starter save에서 `rooms/ceilings/cameraAnchors/navGraph`를 빈 배열로 저장하는 기준.
- active scene 매핑 경로에서 `legacy-floorplan-document` fallback을 유지하는 기준.

## 2026-04-12 변경 동기화 (Room-First Primary Surface Clarification)
Added:
- Primary product surface를 `builder -> editor -> publish -> read-only viewer`로 문서 최상단에 고정했다.
- legacy 문서 인덱스(`docs/legacy/README.md`)와 legacy pipeline 링크를 관련 문서 목록에 추가했다.

Updated:
- 시스템 데이터 흐름 기준을 intake-first 설명에서 primary room-first 흐름 우선으로 재정렬했다.
- `apps/web`와 `apps/api` 책임 경계를 primary surface 우선, legacy compatibility 보조로 재정의했다.

Removed/Deprecated:
- floorplan/intake 파이프라인을 메인 UX 요구사항처럼 읽히게 하는 문서 구조.
