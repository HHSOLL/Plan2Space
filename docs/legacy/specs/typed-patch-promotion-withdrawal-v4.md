# Typed Patch + Promotion / Withdrawal Policy Spec v4

## Typed Patch Envelope
- `base_revision_id`
- `base_geometry_hash`
- `target_schema_version`
- `operations[]`

## Operation 필수 필드
- `op`
- `entityType`
- `entityId`
- `payload`

## 허용 operation
- wall add/update/delete
- opening add/update/delete
- room relabel
- room split
- room merge
- scale override
- entrance override

## 적용 규칙
1. precondition check
   - `base_revision_id` 존재
   - `base_geometry_hash` 일치
   - schema version 호환
2. patch apply
3. postcondition invariant check
4. 새 geometry hash 계산

## Rebase 규칙
- old base + patch -> intermediate
- new base에 replay
- stable ID mismatch 또는 invariant break 시 conflict
- conflict는 manual review로 전환

## Promotion 정책
- generated 결과는 기본적으로 `private_generated` 또는 `candidate`
- canonical auto-promotion 금지
- canonical 승격 조건:
  - provenance 검증
  - redaction 통과
  - consent 통과
  - ops review 통과

## Withdrawal 정책
- source asset 철회 시 `revision_source_links` 기준으로 영향 범위를 계산
- 승격 전 철회:
  - raw 삭제
  - candidate 폐기
- 승격 후 철회:
  - 새 reuse 차단
  - 관련 revision은 재검증 큐로 이동
  - 계속 사용 허용은 별도 승격 동의가 있는 경우만

## wrong reuse 정책
- negative feedback는 단순 로그가 아니라 state 전이 트리거
- auto-reuse 후 invalidation 발생 시:
  - project `reuse_invalidated`
  - remediation intake 생성
  - publish/export 차단
  - calibration 이벤트 적재
