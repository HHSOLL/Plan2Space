# DB Schema Spec v4

## 목적
- `intake_session-first`
- `layout_revisions` 단일 truth
- `geometry-first canonical truth`
- provenance / withdrawal / exact-once finalize 보장

## 핵심 테이블

### `intake_sessions`
- 업로드, 검색, 후보 선택, 분석 대기, 리뷰, 프로젝트 확정 전까지의 임시 상태
- 주요 필드:
  - `owner_id`
  - `input_kind`
  - `status`
  - `version`
  - `object_path`
  - `file_sha256`
  - `file_phash`
  - `selected_layout_revision_id`
  - `generated_floorplan_id`
  - `finalized_project_id`
  - `resolution_payload`

### `housing_complexes`
- 단지 메타데이터

### `layout_families`
- 사용자 검색용 `59/84A` 계층

### `layout_variants`
- 실제 구조가 다른 변형
- `candidate/private_generated` 단계에서는 미분류 가능하므로 revision이 variant에 반드시 연결되지는 않음

### `source_assets`
- 원본/제휴/seed/preview 자산
- privacy, consent, provenance, retention을 스키마 수준에서 관리

### `layout_revisions`
- 모든 결과의 단일 truth 모델
- `scope`:
  - `canonical`
  - `candidate`
  - `private_generated`
- `verification_status`:
  - `unverified`
  - `verified`
  - `rejected`
  - `blocked`
- lineage:
  - `parent_revision_id`
  - `supersedes_revision_id`
  - `promoted_from_revision_id`
  - `demoted_from_revision_id`
  - `created_from_intake_session_id`
- hash 계층:
  - `topology_hash`
  - `room_graph_hash`
  - `geometry_hash`

### `revision_source_links`
- revision과 source asset의 관계를 관리
- 필드:
  - `revision_id`
  - `source_asset_id`
  - `link_role`
  - `provenance_status`
  - `consent_basis`
  - `added_at`
  - `withdrawn_at`

### `catalog_search_index`
- denormalized search view
- canonical, verified, unblocked revision만 노출

### `floorplan_match_events`
- reuse/disambiguation/negative feedback audit

## 기존 테이블 변경

### `projects`
- 추가:
  - `source_layout_revision_id`
  - `resolution_state`
  - `created_from_intake_session_id`
- `created_from_intake_session_id`는 unique

### `floorplans`
- `project_id` nullable
- `intake_session_id` 추가
- 제약:
  - `project_id` 또는 `intake_session_id` 둘 중 하나는 반드시 존재
- 상태:
  - `queued`
  - `running`
  - `retrying`
  - `review_required`
  - `succeeded`
  - `failed`

## exact-once finalize
- RPC: `finalize_intake_session(...)`
- 보장:
  - 같은 `intake_session_id`는 하나의 project만 생성
  - 재호출 시 기존 project 반환
  - `created_from_intake_session_id` unique constraint로 중복 생성 차단
