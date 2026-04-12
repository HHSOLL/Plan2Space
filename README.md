# Plan2Space

Plan2Space는 **빈 방을 만들고, 가구를 배치해 편집한 뒤, 발행하고, 동일한 읽기 전용 3D 뷰어로 공유하는 공간 우선 인테리어 제품**입니다.

## 핵심 사용자 흐름

1. `/studio/builder`에서 방 모양/치수/문창/스타일 설정
2. `/project/[id]` 에디터에서 가구 배치, 이동/회전, 저장
3. 공유 모달에서 링크 발행 및 갤러리 공개
4. `/shared/[token]`, `/gallery`, `/community`에서 동일한 읽기 전용 뷰어로 확인

## 레거시 경로 (내부/운영)

기존 분석 파이프라인은 메인 UX가 아니며 레거시 호환 경로로만 유지합니다.

- 레거시 문서: `docs/legacy/`
- 레거시 파이프라인 인덱스: `docs/legacy/ai-pipeline.md`

## 빠른 시작

요구사항: Node.js >= 20

```bash
npm install
npm run dev:web
```

- 로컬 서버: `http://127.0.0.1:3100`
- Next.js 앱 위치: `apps/web`

## 환경 변수 (`apps/web/.env.local`)

필수:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RAILWAY_API_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

권장:
- `E2E_RAILWAY_API_URL`
- `E2E_ROOM_FLOW_STRICT`
- `E2E_ROOM_FLOW_BASE_URL`
- `E2E_ROOM_FLOW_SHARED_TOKEN`
- `E2E_ROOM_FLOW_PROJECT_ID`

## 스크립트

```bash
npm run dev:web
npm --workspace apps/web run qa:primary
npm --workspace apps/web run primary:e2e:room-flow
npm --workspace apps/web run assets:sync:deskterior

# strict 모드(실패를 fail-fast로 처리)
E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict

# full flow (Supabase env 필요)
npm --workspace apps/web run primary:e2e:room-flow:full

# legacy namespace (보조 경로)
# 상세는 docs/legacy/README.md와 apps/web/package.json의 legacy:* 스크립트 참고
```

## 데스크테리어 자산 파이프라인 (Blender + OSS)

- Blender 원본: `assets/blender/deskterior/*.blend`
- 런타임 모델: `apps/web/public/assets/models/`
- 카탈로그 동기화: `npm --workspace apps/web run assets:sync:deskterior`
- 오픈소스 자산은 라이선스 명시(CC0 우선)된 항목만 사용

## 핵심 문서

- `docs/master-guide.md`
- `docs/implementation-plan.md`
- `docs/performance-budget.md`
- `docs/3d-visual-engine.md`
- `docs/user-action-guide.md`
- `docs/developer-handbook.md`
- `docs/legacy/README.md`

## 캐시 문제 대응

```bash
rm -rf apps/web/.next
npm run dev:web
```
