# 사용자 실행 가이드 (공간 우선)

이 문서는 현재 메인 제품 경로인 **룸 빌더 -> 에디터 -> 발행 -> 읽기 전용 뷰어** 운영 절차만 다룹니다.

## 1) 환경 변수 설정

### Web (`apps/web/.env.local`)
필수:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAILWAY_API_URL`
- `NEXT_PUBLIC_APP_URL` (`http://127.0.0.1:3100` 또는 배포 도메인)

권장:
- `E2E_ROOM_FLOW_BASE_URL`
- `E2E_ROOM_FLOW_STRICT`
- `E2E_ROOM_FLOW_PROJECT_ID`
- `E2E_ROOM_FLOW_SHARED_TOKEN`

### API (`apps/api/.env`)
필수:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS`

권장:
- `ENABLE_LIGHTWEIGHT_API_ROUTES=false`
- `ENABLE_LEGACY_API_ROUTES=false`

### Worker (`apps/worker/.env`)
메인 제품 기준 필수 항목:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WORKER_CONCURRENCY`
- `WORKER_POLL_INTERVAL_MS`

## 2) 신규 핵심 QA/E2E 순서

아래 10단계를 기본 회귀 기준으로 사용합니다.

1. 새 방 만들기
2. 치수 조정하기
3. 문/창문 추가하기
4. 스타일 선택 후 에디터 진입하기
5. 가구 추가하기
6. 가구 이동/회전하기
7. 저장/발행하기
8. 공유 토큰 열기
9. 읽기 전용 뷰어에서 제품 클릭하기
10. 갤러리/커뮤니티에서 동일 장면 열기

실행 명령:

```bash
npm --workspace apps/web run qa:primary
E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict
npm --workspace apps/web run primary:e2e:room-flow:full
```

`primary:e2e:room-flow:full`은 Supabase 환경 변수가 없는 환경에서는 실행되지 않습니다.

## 3) 배포 전 체크리스트

- 빌더/에디터/뷰어 공통 레이아웃이 유지되는지 확인
- 뷰어에 편집 affordance가 노출되지 않는지 확인
- 갤러리/커뮤니티 카드가 `/shared/[token]` 읽기 전용 뷰어로 이동하는지 확인
- 제품 클릭 시 정보 drawer가 열리고 최소 필드가 노출되는지 확인
  - 제품명
  - 카테고리
  - 브랜드
  - 가격
  - 옵션/규격
  - 원본 상품 링크

## 4) 레거시 운영 문서

과거 분석 파이프라인/운영 절차는 아래 문서로 분리합니다.

- `docs/legacy/user-action-guide-ops.md`
- `docs/legacy/ai-pipeline.md`
- `docs/legacy/provider-rollout.md`
