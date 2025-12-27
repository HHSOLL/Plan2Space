# 구현 로드맵 — plan2space

문서 목적: “AI 도면 분석 → 3D 생성 → 워크스루 + 커스터마이징”을 8주 내 완성하기 위한 단계별 목표와 완료 기준을 정의한다.

---

## Phase 1 — Core Engine (주 1-2)

**목표**: 3D 씬을 구성하고, Plan2D 데이터로 벽을 생성한다.

- Next.js 15 + R3F 프로젝트 세팅
- Supabase Auth/DB/Storage 기본 세팅
- 기본 3D 뷰어(바닥, 조명, 카메라)
- `generateWalls(plan2d)` 구현

**Exit Criteria**
- 샘플 Plan2D → 벽/바닥/천장 생성
- 기본 카메라/라이팅으로 안정적 렌더링

---

## Phase 2 — AI & 2D Editing (주 3-4)

**목표**: 도면 업로드 → AI 분석 → 2D 보정 → 3D 전환 파이프라인 완성

- Gemini 1.5 Vision 연동
- 2D 캔버스 보정 UI(벽/문/창 드래그/스냅)
- 도면 업로드 → 2D → 3D 연결

**Exit Criteria**
- 사용자 보정 후 3D 생성 완료
- 입력 오류 시 복구 UX 제공

---

## Phase 3 — Interaction & Physics (주 5-6)

**목표**: 몰입형 워크스루 경험 제공

- Rapier 충돌(벽/바닥)
- FPS 컨트롤러(WASD + PointerLock)
- 문 인터랙션 애니메이션

**Exit Criteria**
- 워크스루 모드 안정화(FPS, 충돌, 문 상호작용)

---

## Phase 4 — Decoration & Save (주 7-8)

**목표**: 커스터마이징과 저장/불러오기 완성

- 가구 드래그&드롭 배치
- TransformControls 연동
- 저장/불러오기(Supabase) + 스냅샷 업로드
- WebGPU 후처리(선택)

**Exit Criteria**
- 씬 저장/로드 가능
- 캡처 이미지 생성
