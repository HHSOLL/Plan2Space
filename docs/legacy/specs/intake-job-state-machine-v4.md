# Intake / Job State Machine Spec v4

## Intake Session 상태
- `created`
- `uploading`
- `resolving`
- `disambiguation_required`
- `queued`
- `analyzing`
- `review_required`
- `resolved_reuse`
- `resolved_generated`
- `finalizing`
- `failed`
- `expired`

## 허용 흐름

### upload 경로
1. `created`
2. `uploading`
3. `resolving`
4. 아래 중 하나
   - `resolved_reuse`
   - `disambiguation_required`
   - `queued`
   - `failed`

### generated 경로
1. `queued`
2. `analyzing`
3. 아래 중 하나
   - `review_required`
   - `resolved_generated`
   - `failed`

### finalize 경로
1. `resolved_reuse | resolved_generated`
2. `finalizing`
3. project 확정 후 기존 resolved 상태 유지 + `finalized_project_id` 기록

## resolution 규칙
- `sha256 exact + verified revision`만 auto-reuse 허용
- catalog exact가 단일 후보면 auto-reuse 가능
- 다중 후보면 무조건 `disambiguation_required`
- 입력이 불완전하면 `failed`
- upload asset이 있고 reuse 미스면 `queued`

## review_required 진입 조건
- low-confidence generated result
- 신규 family/variant 초기 N건
- ops review mandatory 정책 대상

## finalize 규칙
- `POST /v1/intake-sessions/:id/finalize-project`
- exact-once 보장
- finalize 재호출은 기존 project 반환
- resolve/analyze/review 중 finalize 금지

## Job 상태
- `queued`
- `running`
- `retrying`
- `succeeded`
- `failed`
- `dead_letter`

## Job과 Intake의 관계
- `queued` job 생성 시 intake는 `queued`
- worker 시작 시 intake는 `analyzing`
- worker 성공 시:
  - revision 생성
  - intake는 `review_required` 또는 `resolved_generated`
- worker 실패 시 intake는 `failed`

## wrong reuse remediation
- 프로젝트에서 `reuse_invalidated` 발생 시:
  - project `resolution_state = reuse_invalidated`
  - remediation intake session 생성
  - 기존 project는 publish/export 차단
  - 새 resolution 완료 전까지 정상 상태 복귀 금지
