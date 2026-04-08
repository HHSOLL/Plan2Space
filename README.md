# Plan2Space

Plan2Space는 **도면 업로드 → AI 구조 파싱 → 2D 보정 → 절차적 3D 생성** 파이프라인으로
실내 공간을 빠르게 구성하고, 탑뷰/워크 모드를 전환하며 편집할 수 있는 스튜디오입니다.

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
- `NEXT_PUBLIC_RAILWAY_API_URL` (`/gallery`, `/community`, shared/showcase API 복원에 필요)

권장:
- `SUPABASE_SERVICE_ROLE_KEY` (캐시/서버 작업)
- `FLOORPLAN_PROVIDER_ORDER` (예: `snaptrude,anthropic,openai`)
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
- `ANTHROPIC_MODEL` / `OPENAI_MODEL`
- `SNAPTRUDE_API_URL` / `SNAPTRUDE_API_KEY`

선택:
- `FLOORPLAN_CACHE_BUCKET` (Supabase Storage 캐시)
- `ASSET_STORAGE_BUCKET` (기본값: `assets-glb`)
- `TRIPOSR_API_URL`, `TRIPOSR_API_KEY`, `TRIPOSR_STATUS_URL`
- `NEXT_PUBLIC_DRACO_DECODER_PATH`
- 전처리/정규화 튜닝 값은 `docs/ai-pipeline.md` 참고

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
