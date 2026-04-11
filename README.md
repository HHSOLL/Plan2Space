# Plan2Space

Plan2Space는 **Builder → Editor → Publish → Viewer** 흐름을 중심으로 한 3D 룸/데스크 빌더입니다.
도면 기반 AI 파이프라인은 worker 중심의 보조 경로로 유지되며, 메인 UX는 직접 공간 생성/편집에 맞춰져 있습니다.

## 빠른 시작

요구사항: Node.js >= 20

```bash
npm install
npm run dev:web
```

- 로컬 서버: `http://127.0.0.1:3100`
- Next.js 앱 위치: `apps/web`

## 환경 변수 (apps/web/.env.local)

필수:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RAILWAY_API_URL` (Next.js Route Handler에서 Railway API 프록시에 필요)
- `SUPABASE_SERVICE_ROLE_KEY` (version snapshot upload/signing, owner-scope job 조회 안정화)

권장:
- `E2E_RAILWAY_API_URL` (실환경 e2e/eval 스크립트 전용 override)

선택:
- `FLOORPLAN_UPLOAD_BUCKET` (기본값: `floor-plans`)
- `NEXT_PUBLIC_DRACO_DECODER_PATH`
- 전처리/정규화 튜닝 값은 `docs/ai-pipeline.md` 참고

Worker/API 전용(provider) 환경 변수는 `apps/worker/.env.example`, `apps/api/.env.example`를 사용합니다.

## Supabase 초기 설정

1) Supabase SQL Editor에서 `schema.sql` 실행
2) Storage 버킷 생성: `floor-plans`, `assets-glb` (필요 시 `floorplan-cache`)
3) OAuth Provider 설정은 `docs/auth-guide.md` 참고

## 스크립트

```bash
npm run dev:web     # 앱 개발 서버
npm run type-check  # 타입 체크
npm run assets:download
npm run assets:draco
npm run check:web-boundary
npm --workspace apps/api run test:route-gates
npm --workspace apps/web run smoke:preview-runtime -- --url=<vercel-preview-url> --mode=must-not-embed --expected=<railway-api-url>
```

## 문서

- `docs/developer-handbook.md`
- `docs/file-role-index.md`
- `docs/auth-guide.md`
- `docs/asset-guide.md`
- `docs/ai-pipeline.md`
- `docs/floorplan-3d-flow.md`
- `docs/3d-engine.md`
- `docs/3d-visual-engine.md`
- `docs/master-guide.md`
- `docs/implementation-plan.md`
- `docs/user-action-guide.md`
- `docs/deployment.md`

## 캐시 문제 대응

빌드/로그인 관련 이슈가 있을 때:

```bash
rm -rf apps/web/.next
npm run dev:web
```
