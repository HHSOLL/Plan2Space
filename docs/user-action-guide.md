# User Action Guide

이 문서는 코딩 에이전트가 대신할 수 없는 사용자 작업을 정리합니다.

## 1) 환경 변수 설정
서비스별로 분리해서 설정합니다.

### Vercel (`apps/web`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_RAILWAY_API_URL=
NEXT_PUBLIC_APP_URL=
```

### Railway API (`apps/api`)
```
API_PORT=4000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CORS_ORIGINS=
FLOORPLAN_UPLOAD_BUCKET=floor-plans
```

참고:
- Railway 런타임에서는 `PORT`가 자동 주입되며, API는 이를 우선 사용합니다.

### Railway Worker (`apps/worker`)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WORKER_CONCURRENCY=2
WORKER_POLL_INTERVAL_MS=1000

FLOORPLAN_PROVIDER_ORDER=anthropic,openai,snaptrude
FLOORPLAN_PROVIDER_TIMEOUT_MS=45000
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
SNAPTRUDE_API_URL=
SNAPTRUDE_API_KEY=
```

중요:
- AI/provider 키는 Vercel이 아니라 Railway Worker에만 둡니다.

## 2) Supabase 적용 작업
- `supabase/migrations/20260305_railway_floorplan_queue.sql` 실행
- 신규 테이블 확인:
  - `floorplans`
  - `jobs`
  - `floorplan_results`
- `claim_jobs` 함수/권한(service_role) 적용 확인

## 3) OAuth/도메인 점검
- Supabase Auth URL 설정에 실제 배포 도메인만 등록
- Railway API CORS에 Vercel 프로덕션/프리뷰 도메인 포함

## 4) 운영 확인 시나리오
1. 도면 업로드
2. 잡 생성 확인(`jobs` 상태: queued/running)
3. 완료 후 `floorplan_results` 생성 확인
4. 프론트에서 결과 폴링 후 2D/3D 진입 확인

## 5) 실패 복구 QA
- provider 미구성 시 `PROVIDER_NOT_CONFIGURED` 노출
- recoverable 실패 시 2D 보정 전환
- 복구 배너 액션(`Copy Errors`, `Try AI Again`, `Start Manual`) 동작

## 6) 모바일 QA
- 390/768/1024 폭에서 핵심 조작(업로드/보정/3D 진입) 가능 여부 점검

## 7) 키/보안
- 서비스 role 키/AI 키는 절대 클라이언트 번들에 노출하지 않음
- 로그 공유 시 키/토큰 마스킹 필수

## 8) 2026-03-05 변경 동기화 (Railway Immediate Cutover)
Added:
- 서비스별 환경 변수 분리 가이드(Vercel/API/Worker).
- Supabase queue 스키마 적용 절차.

Updated:
- 업로드/분석 검수 흐름을 job polling 기반으로 변경.

Removed/Deprecated:
- Vercel에 provider 키를 두는 방식.
