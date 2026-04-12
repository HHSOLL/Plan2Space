# 마스터 가이드 (엔지니어링 단일 기준)

이 문서는 Plan2Space의 현재 제품 기준을 정의합니다.

## 핵심 제품 정의
Plan2Space의 메인 제품은 **공간 우선 빌더/에디터/뷰어**입니다.

핵심 경로:
1. `/studio/builder`에서 빈 방 생성
2. `/project/[id]`에서 가구 배치/편집/저장
3. 공유 모달에서 링크 발행
4. `/shared/[token]`, `/gallery`, `/community`에서 동일한 읽기 전용 뷰어로 조회

## 제품 규칙
- 빌더/에디터/뷰어/갤러리/커뮤니티는 같은 디자인 시스템을 사용한다.
- 레이아웃 기본은 `상단 app bar + 좌측 패널 + 우측 viewport`다.
- 좌측 패널 폭은 400~440px(기본 420px)로 고정한다.
- 뷰어는 읽기 전용이며 편집 affordance를 노출하지 않는다.
- 제품 클릭 시 제품 정보를 확인할 수 있어야 한다.

## 아키텍처 경계
- Frontend: `apps/web` (active product surface)
- API: `apps/api` (project/share/showcase + compatibility endpoints)
- Worker: `apps/worker` (background jobs)
- Supabase: auth/storage/database
- Asset pipeline: `assets/blender/deskterior`(source) + `apps/web/public/assets/models`(runtime) + `apps/web/public/assets/catalog/manifest.json`(catalog)

## 활성 웹 계약
- `GET /api/v1/projects/:projectId/bootstrap`
- `GET /api/v1/projects/:projectId/versions/latest`
- `POST /api/v1/projects/:projectId/versions`
- `GET /api/v1/catalog`
- `GET /api/v1/showcase`
- `GET /api/v1/public-scenes/[token]`

## 레거시/내부 Surface
기존 분석 기반 파이프라인은 메인 UX가 아니며 호환/운영 경로로만 유지합니다.

- legacy 문서: `docs/legacy/README.md`
- pipeline 상세: `docs/legacy/ai-pipeline.md`
- 과거 master-guide 아카이브: `docs/legacy/master-guide-archive.md`

## 품질 게이트
- `npm --workspace apps/web run type-check`
- `npm --workspace apps/web run lint`
- `npm --workspace apps/web run build`

## 필수 참조 문서
- `docs/implementation-plan.md`
- `docs/3d-visual-engine.md`
- `docs/user-action-guide.md`
- `docs/deployment.md`

## 2026-04-12 변경 동기화 (Room-First Master Guide Reset)
Added:
- 공간 우선 canonical 제품 정의와 active web route 기준.
- legacy 문서 인덱스/아카이브 링크.

Updated:
- main engineering source를 기존 분석 파이프라인 중심에서 빌더/에디터/뷰어 중심으로 재정렬.

Removed/Deprecated:
- 기존 분석 파이프라인을 메인 제품 요구사항처럼 서술하던 master-guide 본문.

## 2026-04-13 변경 동기화 (Deskterior Asset Pipeline)
Added:
- Blender 기반 deskterior 제작 자산과 카탈로그 동기화 스크립트 기준.
- 조명 제품의 동적 광원(성능 상한 포함) 운영 기준.

Updated:
- 메인 편집 자산 소스를 생성형 파이프라인 단독 의존에서 `Blender + 오픈소스 + 보조 생성형` 하이브리드로 정렬.
