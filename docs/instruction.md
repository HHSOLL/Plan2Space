# plan2space — 프로젝트 안내 및 기술스택

## 1) 프로젝트 개요

plan2space는 “도면 → 3D 자동 변환 + 몰입형 워크스루”에 집중한 기술/UX 중심 프로젝트다. 마켓플레이스/결제/실시간 협업 기능은 포함하지 않는다.

---

## 2) 리포 구조(권장)

```
webInterior/
├── apps/
│   └── web/          # Next.js (2D 보정 UI + 3D 씬)
├── packages/
│   └── shared/       # 공통 타입/스키마
└── docs/             # PRD/로드맵/아키텍처
```

---

## 3) 기술 스택(권장)

### 3.1 프론트엔드
- Next.js(App Router) + React + TypeScript
- Tailwind CSS
- 2D 편집: Canvas API(필요 시 Konva)
- 3D: Three.js + R3F
  - WebGPU 우선 + WebGL2 폴백
  - 최적화: Instancing, LOD, BVH

### 3.2 백엔드/저장
- Supabase (Auth + Postgres + Storage)
- Next.js API Route (AI 분석)

### 3.3 AI
- Google Gemini 1.5 Vision (AI Studio)

---

## 4) 환경 변수 (예시)

- `GEMINI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 5) 단일 진실 소스

- PRD: `docs/prd.md`
- 로드맵: `docs/roadmap.md`
- 시뮬 스펙: `docs/simulation-spec.md`
