# 3D Map Commercial Roadmap

이 문서는 Plan2Space가 `사용자 입력 -> 상용 수준 3D 맵`에 도달하기 위해 필요한 실행 순서를 정의합니다.

## 목표
- 업로드된 도면 또는 verified layout revision에서 `walls/openings/rooms/entrance/roomAdjacency`를 안정적으로 복원한다.
- geometry를 기준 truth로 유지하고 `scene/nav/camera`는 파생 산출물로 생성한다.
- Top view / Walk mode가 worker 파생 결과를 직접 소비하도록 정렬한다.

## 우선순위
1. `geometry reconstruction`
2. `room semantics`
3. `scene v2 derived artifacts`
4. `frontend consumption`
5. `benchmark / whitelist coverage`
6. `catalog reuse dominance`

## Stage 1: Geometry Reconstruction
- snapped wall graph와 closed loop 복원을 기준 경로로 유지한다.
- room polygon, exterior shell, room adjacency를 모든 generated revision에 저장한다.
- geometry hash는 canonicalized geometry 결과만 기준으로 계산한다.

완료 조건:
- `layout_revisions.geometry_json.rooms`가 비어 있지 않다.
- `roomAdjacency`와 `entrance`가 geometry와 일관된다.
- `review_required` 결과에서도 2D editor가 room/floor context를 유지한다.

## Stage 2: Room Semantics
- room taxonomy는 아래 enum으로 고정한다.
  - `living_room`
  - `bedroom`
  - `kitchen`
  - `dining`
  - `bathroom`
  - `foyer`
  - `corridor`
  - `balcony`
  - `utility`
  - `pantry`
  - `dress_room`
  - `alpha_room`
  - `service_area`
  - `evacuation_space`
  - `other`
- v1은 보수적 분류를 사용하고, 확신이 낮으면 `other`로 남긴다.

완료 조건:
- room label / ceiling height / exterior-facing 여부가 revision에 저장된다.
- room graph hash에 room taxonomy와 adjacency가 포함된다.

## Stage 3: Scene V2 Derived Artifacts
- worker는 geometry에서 아래를 파생 생성한다.
  - `floors[]`
  - `ceilings[]`
  - `navGraph`
  - `cameraAnchors`
- `derived_scene_json`, `derived_nav_json`, `derived_camera_json`은 항상 `derived_from_geometry_hash`와 일치해야 한다.

완료 조건:
- Walk mode는 entrance anchor를 우선 사용한다.
- ceiling은 wall-height fallback보다 revision-derived ceiling zone을 우선 사용한다.

## Stage 4: Frontend Consumption
- 프론트는 revision/result에서 받은 `rooms/floors/ceilings/cameraAnchors/navGraph`를 버리지 않는다.
- 수동 fallback은 `geometry -> derived scene -> heuristic` 순서로만 허용한다.

완료 조건:
- `result-mapper`가 room metadata를 유지한다.
- `CameraRig`가 entrance/overview anchor를 우선 사용한다.
- synthetic preview가 room label을 보여준다.

## Stage 5: Commercial Quality Gates
- benchmark split:
  - complex holdout
  - mirror / balcony extension / option variants
  - input channel slices
- launch gate는 다음을 동시에 만족해야 한다.
  - whitelist verified coverage 충족
  - reuse path가 주력 경로
  - wrong reuse incident 낮음
  - manual correction 시간 통제 가능

## Non-Goals
- Babylon.js 전환
- renderer 교체
- Walk mode polish만을 위한 엔진 재작성
- scene을 canonical truth로 승격

## 2026-03-13 변경 동기화
Added:
- geometry-first 기준에서 `room semantics + scene v2 + frontend consumption` 우선순위를 명시.

Updated:
- 상용 3D 맵 생성의 핵심 병목을 renderer가 아니라 worker reconstruction으로 고정.

Removed/Deprecated:
- Babylon.js 전환이 상용 수준 3D map generation의 선행조건이라는 가정.
