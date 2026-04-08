# Implementation Plan (Phases)

## Phase 0: Benchmark + Seed Catalog + Ops Foundation (진행)
목표: 상용화 착수를 위한 whitelist, benchmark, provenance, 최소 ops surface를 준비.

완료 조건:
- launch slice `12개 단지 whitelist` 확정.
- benchmark split에 `complex holdout + input channel slice` 반영.
- fixture source policy를 `partner_licensed | user_opt_in | manual_private`로 고정하고 외부 listing 자동 수집을 금지.
- blind set `100장` 기준과 `korean_complex >= 20%` 구성을 고정.
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
- revision-derived `rooms`, `floors`, `ceilings`, `navGraph`, `cameraAnchors`가 worker에서 생성되고 web scene state가 이를 보존한다.
- 한국 아파트형 컬러 채움 이미지에 대해 `filled_plan` 전처리 패스와 channel-level eval gate가 적용된다.
- PaddleOCR 기반 room/dimension OCR lane이 worker에 통합된다.
- Roboflow CubiCasa / HF Dedicated Endpoint baseline이 env-guarded candidate로 연결된다.
- `conflict_score > 0.3`, `dimension_conflict > 0.35`, `scale_conflict > 0.35` review gate가 적용된다.
- commercialization gate가 `roomTypeF1`, `dimensionValueAccuracy`, `scaleAgreement`, `reviewRate`, `medianCorrectionSeconds`를 포함한다.

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

## 2026-03-13 변경 동기화 (Commercial 3D Map Foundation)
Added:
- `docs/specs/3d-map-commercial-roadmap.md` 기준의 상용 3D 맵 생성 우선순위(`geometry reconstruction -> room semantics -> scene v2 -> frontend consumption`)를 추가.
- Phase 3 완료 조건에 `ceilings`, `cameraAnchors`, `navGraph` 보존을 추가.

Updated:
- 상용 수준 3D 맵 생성의 핵심 작업을 renderer 교체가 아니라 worker reconstruction/scene consumption 강화로 명시.
- benchmark 기준을 fixture 전체 평균뿐 아니라 input channel별 success/recoverable rate로 확장.

Removed/Deprecated:
- Babylon.js 또는 렌더러 교체를 현재 Phase 선행조건으로 보는 계획.
- 외부 listing gallery 이미지를 서비스가 직접 수집해 benchmark/catalog를 채우는 계획.

## 2026-03-13 변경 동기화 (Semantic Annotation Accuracy Pass)
Added:
- Phase 3 완료 조건에 `roomHints`, `dimensionAnnotations`를 이용한 room reconstruction/scale 보정 경로를 추가.
- 한국 아파트형 fixture 평가에서 room label 존재 케이스의 room type 분류 정확도와 dimension-derived scale 회귀 테스트를 포함한다.

Updated:
- room reconstruction 고도화 범위를 wall loop heuristic 개선만이 아니라 semantic annotation fallback까지 포함하도록 확장.

Removed/Deprecated:
- geometry reconstruction을 wall graph 단독 입력으로만 개선하려는 계획.

## 2026-03-19 변경 동기화 (Scale Contract Sanity Pass)
Added:
- Phase 3 회귀 기준에 `scaleInfo.evidence`와 최종 `scale(metersPerPixel)` 일치성 검증을 추가.

Updated:
- 2D -> 3D 진입 실패 분석 범위를 인식 정확도뿐 아니라 scale contract/unit mismatch까지 포함하도록 확장.

Removed/Deprecated:
- provider raw scale 값이 저장돼 있으면 별도 sanity check 없이 그대로 소비하는 기준.

## 2026-03-19 변경 동기화 (Accuracy Commercialization V2)
Added:
- Phase 0에 blind-set composition rule과 richer fixture manifest 완료 기준을 추가.
- Phase 3에 OCR lane, external structure parser baseline, conflict-gated review_required 완료 기준을 추가.

Updated:
- 정확도 상용화 우선순위를 `Eval -> CubiCasa baseline -> PaddleOCR -> conflict gate -> HF fallback` 순으로 고정.

Removed/Deprecated:
- deprecated Next parse endpoint 기반 eval을 기준선으로 유지하는 완료 조건.

## 2026-04-08 변경 동기화 (Builder-First Pivot Slice)
Added:
- 첫 전환 슬라이스로 `/studio/builder` blank-room 생성 화면과 builder-authored project version 로딩 경로를 추가.
- landing/studio/navbar의 기본 CTA를 builder-first 경로로 정렬하는 완료 기준을 추가.

Updated:
- Phase 2의 수동 복구/생성 범위를 `2D correction` 단독이 아니라 `blank-room builder -> editor 진입`까지 확장한다.
- Phase 4의 경험 완성 범위에 IKEA-style shell로 재구성된 landing/studio/editor 진입면을 포함한다.

Removed/Deprecated:
- 새 프로젝트 생성이 항상 intake upload 또는 catalog search에서 시작된다는 가정.

## 2026-04-08 변경 동기화 (Viewer / Share Slice)
Added:
- `/shared/[token]`에서 builder-origin 프로젝트도 동일하게 보이도록 `latest saved version -> shared viewer` 복원 경로를 추가.
- 공유 surface 완료 기준에 read-only top/walk toggle과 scene summary shell을 추가.

Updated:
- Phase 4의 경험 완성 범위에 shared token viewer를 IKEA-style read-only surface로 정리하는 작업을 포함한다.

Removed/Deprecated:
- shared page가 raw `floor_plan`과 `customization`만 따로 읽어 장면을 조립하는 구현 기준.

## 2026-04-08 변경 동기화 (Viewer-First Share Slice)
Added:
- shared project route에 top/walk 토글, scene stats, access summary를 포함한 read-only viewer shell 완료 기준을 추가.

Updated:
- Phase 4의 경험 완성 범위에 `/shared/[token]` viewer surface 정리와 share modal 문구 정합성을 포함한다.

Removed/Deprecated:
- shared route를 walk-only preview 하나로 고정하는 완료 기준.

## 2026-04-08 변경 동기화 (Shell Reuse + Permission UI Cleanup)
Added:
- Phase 4 완료 범위에 editor/shared viewer 공통 shell 컴포넌트(mode toggle, metric grid) 재사용을 추가한다.

Updated:
- share flow는 새 링크 생성 시 preview-only semantics를 기본으로 하고, 기존 `edit` permission row는 backward-compatible preview fallback으로 표기한다.

Removed/Deprecated:
- share modal이 실제보다 넓은 shared edit capability를 즉시 제공하는 UI 표기.

## 2026-04-08 변경 동기화 (Builder-Only Editor + Shared Viewport)
Added:
- Phase 4 완료 범위에 editor/shared viewer 공통 `SceneViewport` 재사용과 library shelf productization을 추가한다.

Updated:
- `/project/[id]`의 메인 surface는 builder-first editor shell만 남기고, legacy floorplan import UI는 studio 밖으로 밀어낸다.
- shared viewer의 mode toggle은 editor와 동일한 geometry/scale gate를 따른다.

Removed/Deprecated:
- 메인 editor launch 단계에서 legacy upload/template lookup을 계속 제공하는 완료 기준.

## 2026-04-08 변경 동기화 (Shell State Isolation + Chrome Extraction)
Added:
- Phase 4 완료 범위에 editor/shared viewer route별 shell preset/reset과 global store bleed 방지 작업을 추가한다.
- header/launch/inspector를 reusable editor shell 컴포넌트로 분리하는 정리 작업을 추가한다.

Updated:
- `/project/[id]`는 scene hydration뿐 아니라 shell state도 route mount 시 명시적으로 초기화해야 한다.
- shared viewer는 preview-only readOnly surface를 mount/unmount lifecycle에서 안전하게 적용해야 한다.

Removed/Deprecated:
- shared viewer/editor가 panel, transform, readOnly 상태를 ad hoc setter로만 맞추는 완료 기준.

## 2026-04-08 변경 동기화 (Autosave + History Product UX)
Added:
- Phase 4 완료 범위에 route-local autosave session, dirty/saving/saved 상태 badge, mobile save status 표면을 추가한다.
- Phase 4 완료 범위에 scene baseline snapshot과 committed mutation snapshot 기반 undo/redo UX를 추가한다.
- mobile top-editor controls 분리를 통해 library/inspector/undo/redo 조작을 독립 컴포넌트로 유지한다.

Updated:
- editor productization 범위는 단순 shell 정리에서 저장 피드백과 history 조작까지 포함하도록 확장한다.
- wall/floor finish, asset drag/transform, keyboard rotate도 editor history 범위에 포함한다.

Removed/Deprecated:
- save UX를 manual archive button 하나에만 의존하는 완료 기준.

## 2026-04-08 변경 동기화 (Asset Catalog Productization)
Added:
- Phase 4 완료 범위에 shared catalog contract, canonical category normalization, featured/starter shelf UX를 추가한다.
- builder editor와 legacy asset overlay가 동일한 manifest normalization을 사용하도록 정리 작업을 포함한다.

Updated:
- library shelf productization 범위는 단순 검색 리스트가 아니라 category chips, spotlight card, featured picks, placed-state feedback까지 포함한다.
- starter set selection은 manifest 순서에 의존하는 ad hoc page logic 대신 shared catalog helper를 기준으로 유지한다.

Removed/Deprecated:
- editor page 내부에 catalog fallback, fetch, filter, featured selection 로직이 직접 박혀 있는 완료 기준.

## 2026-04-08 변경 동기화 (Viewer Catalog Metadata Slice)
Added:
- Phase 4 완료 범위에 shared viewer sidebar의 catalog-aware `placed pieces / collections` summary를 추가한다.
- selected asset inspector가 catalog lookup을 통해 label/category/collection 메타를 노출하는 정리 작업을 추가한다.

Updated:
- viewer/share productization 범위는 scene stats만이 아니라 catalog metadata를 통한 asset storytelling까지 포함한다.
- uncatalogued generated assets는 scene 저장 계약을 건드리지 않고 viewer 메타 레이어에서만 fallback count로 다룬다.

Removed/Deprecated:
- shared viewer가 배치 자산에 대해 개수만 보여주고 어떤 종류의 가구가 있는지는 설명하지 않는 완료 기준.

## 2026-04-08 변경 동기화 (Project Summary Metadata Slice)
Added:
- Phase 4 완료 범위에 `project.meta.assetSummary` 저장과 studio/share surface 활용을 추가한다.
- catalog variant identity를 위해 saved furniture metadata에 optional `catalogItemId`를 보존하는 작업을 추가한다.

Updated:
- studio productization 범위는 project thumbnail만이 아니라 latest saved asset summary와 collection badges까지 포함한다.
- share modal은 링크 생성 폼만이 아니라 현재 project preview와 saved summary를 함께 보여주는 방향으로 확장한다.

Removed/Deprecated:
- studio/share surface가 latest saved scene metadata 없이 이름/설명만으로 구성되는 완료 기준.

## 2026-04-08 변경 동기화 (Pinned Share Snapshot Slice)
Added:
- Phase 4 완료 범위에 `shared_projects.project_version_id` 기반 pinned share snapshot과 `preview_meta` 저장을 추가한다.
- shared viewer는 pinned snapshot 메타가 존재할 때 latest project drift 없이 동일한 summary rail을 유지해야 한다.

Updated:
- share flow 완료 기준은 단순 링크 생성이 아니라 `create link -> later save -> old link still shows the original saved snapshot`까지 포함한다.
- viewer/share productization은 live latest pointer보다 saved snapshot pinning을 우선한다.

Removed/Deprecated:
- shared link가 항상 프로젝트의 최신 저장본을 따라가도 되는 완료 기준.

## 2026-04-08 변경 동기화 (Published Gallery Slice)
Added:
- Phase 4 완료 범위에 `shared_projects.is_gallery_visible`, `published_at` 기반 공개 showcase surface를 추가한다.
- `/gallery`는 mock 카드가 아니라 pinned share snapshot archive를 렌더하고 각 카드는 `/shared/[token]` viewer로 연결된다.

Updated:
- publish/community productization은 social feed보다 먼저 `permanent view-only snapshot -> gallery showcase` 루프를 닫는 방향으로 정리한다.
- share modal은 링크 생성뿐 아니라 gallery visibility 제어까지 담당한다.

Removed/Deprecated:
- gallery/community가 mock 콘텐츠로만 남아 있어도 publish loop가 완료된 것으로 보는 기준.

## 2026-04-09 변경 동기화 (Community Feed + Legacy Compatibility Retirement)
Added:
- Phase 5 완료 범위에 `/community` real feed를 추가한다. 이 feed는 published pinned snapshot을 featured room, recent circulation list, archive picks로 재구성한다.
- active web scope에서 더 이상 사용하지 않는 legacy `AssetPanel` / `job-polling` 경로 제거를 포함한다.

Updated:
- community productization은 더 이상 gallery redirect가 아니라 `share modal -> publish -> community feed + gallery archive -> shared viewer` 루프로 정의한다.
- legacy floorplan/intake retirement는 old project를 backfill로 versioned snapshot에 편입시키고, 새 생성/편집 표면에서는 upload/intake를 노출하지 않는 것으로 본다.
- active web bundle 정리 범위는 단순 UI copy 변경이 아니라 legacy intake helper 제거와 compatibility bootstrap 제거까지 포함한다.

Removed/Deprecated:
- `/community`를 gallery 임시 alias로 두는 완료 기준.
- compatibility migration CTA 없이 legacy room을 조용히 bootstrap만 하는 상태.

## 2026-04-09 변경 동기화 (Latest Version Cutover + Legacy Backfill)
Added:
- Phase 5 완료 범위에 `GET /v1/projects/:projectId/versions/latest` 기반 latest saved snapshot hydration을 추가한다.
- Phase 5 완료 범위에 `apps/api` legacy backfill CLI와 `project_versions` 초기 채우기 운영 절차를 추가한다.

Updated:
- `/project/[id]` bootstrap은 saved version read만 사용하고, version이 없으면 builder launch empty state로 머문다.
- legacy hard retirement 완료 기준은 UI 제거만이 아니라 old project를 saved version으로 이관할 수 있는 backfill 수단을 갖추는 것까지 포함한다.
- ops rollout 순서는 `dry-run backfill -> targeted backfill -> remaining candidates 0 확인 -> active web compatibility bootstrap 제거`로 유지한다.
- saved version read 자체가 실패한 경우 editor는 builder launch로 fail-open하지 않고 explicit workspace error state를 보여준다.

Removed/Deprecated:
- active editor bootstrap이 `scene/latest` 단일 응답에 latest version과 legacy payload를 함께 실어 나르는 완료 기준.

## 2026-04-09 변경 동기화 (Post-Backfill Web Cutover)
Added:
- Phase 5 완료 범위에 production backfill 검증 후 `/project/[id]`에서 legacy compatibility banner와 `lib/api/legacy-project.ts`를 제거하는 후속 컷오버를 추가한다.

Updated:
- active web path의 legacy retirement는 "fallback 유지"가 아니라 "ops seam만 남기고 editor bundle에서는 제거"로 본다.
- public publish loop 완료 기준에는 showcase transport failure를 empty archive로 숨기지 않는 unavailable state가 포함된다.

Removed/Deprecated:
- saved version candidate가 0이 된 뒤에도 active editor가 legacy bootstrap client를 계속 유지하는 완료 기준.
