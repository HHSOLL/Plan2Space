# Auth Guide (Supabase OAuth)

Plan2Space는 **@supabase/ssr** 기반으로 쿠키 세션을 동기화합니다.
Google/Kakao OAuth는 `/auth/callback` 서버 라우트에서 세션을 교환합니다.

## 필수 환경 변수

`apps/web/.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Supabase 설정 순서

1) Supabase 프로젝트 생성
2) Authentication → URL Configuration
   - Site URL: `http://127.0.0.1:3100` (프로덕션 URL 추가)
   - Redirect URLs:
     - `http://127.0.0.1:3100/auth/callback`
     - `https://<your-domain>/auth/callback`
3) Authentication → Providers
   - Google / Kakao 활성화 후 Client ID/Secret 입력

## Google OAuth 설정

- Google Cloud Console에서 OAuth Client 생성
- **Authorized redirect URI**는 Supabase 콜백을 사용:
  - `https://<your-supabase-project>.supabase.co/auth/v1/callback`
- **Authorized JavaScript origins**:
  - `http://127.0.0.1:3100`
  - `https://<your-domain>`

## Kakao OAuth 설정

- Kakao Developers에서 앱 생성
- Redirect URI:
  - `https://<your-supabase-project>.supabase.co/auth/v1/callback`
- Kakao에서 받은 Client ID/Secret을 Supabase Provider 설정에 입력

## 콜백 라우트

- 서버 라우트: `apps/web/src/app/auth/callback/route.ts`
- 처리 흐름:
  1) `code` 수신
  2) `exchangeCodeForSession` 실행
  3) 쿠키 동기화 후 `?auth=success` 리다이렉트
  4) `Providers`에서 토스트 표시

## 흔한 오류 & 해결

### "PKCE code verifier not found"

- `@supabase/ssr` 사용 여부 확인
- OAuth 시작/콜백 모두 동일 도메인인지 확인
- `/auth/callback` 라우트 존재 확인
- 브라우저 쿠키 차단 여부 확인
- 캐시 정리 후 재시작:

```bash
rm -rf apps/web/.next
npm run dev:web
```
