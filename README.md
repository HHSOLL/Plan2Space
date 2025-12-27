# plan2space (WebInterior)

**AI 도면 분석 → 3D 생성 → 몰입형 워크스루**에 집중한 기술/UX 중심 프로젝트입니다.

## 주요 기능

- **도면 → 3D 자동 변환**: 이미지 업로드 후 AI가 구조 JSON 생성
- **2D 보정 UX**: 벽/문/창을 드래그로 수정
- **몰입형 워크스루**: WASD 이동 + 포인터 락
- **커스터마이징**: 벽/바닥 재질, 가구 배치
- **저장/불러오기**: 프로젝트 버전(`project_versions`) 기반 저장/복구

## 프로젝트 구조

```
webInterior/
├── apps/
│   └── web/          # Next.js 프론트엔드 (2D/3D 스튜디오)
├── packages/
│   └── shared/       # 공통 타입
├── types/            # Supabase DB 타입(Week 1)
├── schema.sql        # Supabase Postgres DDL (Week 1)
└── docs/             # PRD/로드맵/아키텍처
```

## 주요 라우트 (MVP)

- `GET /dashboard`: 프로젝트 목록 (SSR + RLS)
- `GET /projects/create`: 프로젝트 생성(이름 + 도면 업로드)
- `GET /projects/[id]`: R3F 에디터 + Save/Load

## 실행 (로컬 개발)

**요구사항**: Node.js >= 22

```bash
npm install
npm run dev:web
```

## Supabase 준비

1) Supabase SQL Editor에서 `schema.sql` 실행  
2) Supabase Storage 버킷 생성: `floor-plans`, `assets-glb` (필요 시 `project-thumbnails`)  
3) `.env.local`에 아래 환경 변수 설정

## 환경 변수

- `GEMINI_API_KEY` (미설정 시 mock 응답 사용)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 문서

- [PRD](docs/prd.md)
- [로드맵](docs/roadmap.md)
- [아키텍처](docs/architecture.md)
- [시뮬레이션 스펙](docs/simulation-spec.md)
- [Supabase 설정](docs/supabase-setup.md)

## Skills (Codex)

- `plan2space-project-core`: 범위/문서/로드맵 기준
- `plan2space-studio-ux`: 스튜디오 UI/2D/3D/저장 흐름
- `plan2space-blueprint-ai`: 도면 분석 프롬프트/파싱/스키마
