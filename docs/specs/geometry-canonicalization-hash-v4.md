# Geometry Canonicalization + Hash Spec v4

## 목표
- stable ID
- deterministic hash
- typed patch replay/rebase 가능 상태 확보

## 단위와 좌표계
- canonical geometry 단위: `mm`
- source topology는 pixel 좌표를 가질 수 있으나 revision 저장 전 mm로 정규화
- orientation:
  - 기본 규칙은 `entrance-aligned`
  - entrance가 없으면 `input` orientation 유지

## geometry invariants
- self-intersection 금지
- opening은 정확히 하나의 wall에 부착
- room polygon은 closed polygon
- exterior shell closure 필수
- room adjacency는 geometry와 일관
- entrance는 wall/opening/room 컨텍스트에 연결

## stable ID 규칙
- wall/opening은 repair 이후 deterministic ordering 기준으로 ID를 유지/재생성 가능해야 함
- 현재 foundation 구현은 upstream topology ID를 우선 사용
- full production 단계에서는 canonicalized ordering 기반 deterministic ID로 승격

## canonicalization 단계
1. scale 적용 후 mm 변환
2. wall direction normalization
3. snap tolerance 적용
4. collinear merge
5. opening reprojection
6. entrance normalization
7. stable ordering
8. hash 계산

## hash 계층

### `topology_hash`
- 포함:
  - wall/opening connectivity
  - entrance class
  - exterior shell connectivity
  - room taxonomy
- 변경 시 variant 재검토

### `room_graph_hash`
- 포함:
  - room set
  - ordered room polygons
  - room adjacency
  - entrance-room relation
- 변경 시 기본적으로 variant 재검토

### `geometry_hash`
- 포함:
  - canonicalized mm 좌표
  - stable IDs
  - canonical orientation 반영 결과
- `topology_hash`, `room_graph_hash` 동일이고 `geometry_hash`만 변경되면 revision

## version 필드
- `geometry_schema_version`
- `repair_engine_version`
- `scene_builder_version`
- `derived_from_geometry_hash`

## 현재 foundation 구현 범위
- walls/openings/scale/entrance 중심 geometry 저장
- rooms/room adjacency/exterior shell은 placeholder 허용
- scene/nav/camera는 geometry 파생 산출물로만 저장
