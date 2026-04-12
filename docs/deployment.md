# 배포 가이드 (공간 우선)

## 1) 운영 토폴로지

- Web: Vercel (`apps/web`)
- API: Railway (`apps/api`)
- Worker: Railway (`apps/worker`)
- DB/Auth/Storage: Supabase

메인 제품 경로는 `빌더 -> 에디터 -> 발행 -> 읽기 전용 뷰어`입니다.

## 2) 서비스 책임

### Web (`apps/web`)
- 룸 빌더/에디터/뷰어/갤러리/커뮤니티 렌더링
- same-origin `/api/v1/*` 호출

### API (`apps/api`)
- project/version/share/showcase CRUD
- public shared scene 조회

### Worker (`apps/worker`)
- 비동기 백그라운드 작업 처리
- asset generation job 처리

## 3) 배포 환경 변수 최소 세트

### Vercel (`apps/web`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAILWAY_API_URL`
- `NEXT_PUBLIC_APP_URL`

### Railway API (`apps/api`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS`

### Railway Worker (`apps/worker`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WORKER_CONCURRENCY`
- `WORKER_POLL_INTERVAL_MS`

## 4) 배포 후 검증

```bash
npm --workspace apps/web run qa:primary
E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict
```

Supabase 환경 변수가 있는 환경에서는:

```bash
npm --workspace apps/web run primary:e2e:room-flow:full
```

## 5) 레거시 운영 문서

호환/운영용 레거시 가이드는 아래로 분리했습니다.

- `docs/legacy/deployment-ops.md`
- `docs/legacy/ai-pipeline.md`
- `docs/legacy/master-guide-archive.md`
