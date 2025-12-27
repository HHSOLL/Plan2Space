# plan2space — Skills 우선 작업 가이드 (`AGENTS.md` 미러)

목적: 작업(이슈/기능/버그/리스크)을 시작할 때 **가장 적합한 역할(Agent)** 을 빠르게 선택하고, 관련 스펙/문서를 올바르게 참고하도록 한다.

참고:
- 스킬 목록/설명: `.codex/skills/*/SKILL.md`
- 역할별 상세 체크리스트(레거시): `docs/agents/README.md`
- 단일 진실 소스(PRD/스펙): `docs/prd.md`
- 페이즈/완료 기준: `docs/roadmap.md`

> 이 파일은 루트의 `AGENTS.md`와 동일한 내용을 유지한다. (사람이 읽기 쉬운 엔트리 포인트)

---

## 0) Skills 우선 사용 (신규)

작업 시작 시 **스킬을 먼저 선택**한다. 스킬은 자동 또는 명시적으로 호출할 수 있다.

- `plan2space-project-core`: 범위/로드맵/아키텍처 변경, 작업 시작 시 기준 확인
- `plan2space-studio-ux`: 스튜디오 UI/2D/3D/저장·불러오기 작업
- `plan2space-blueprint-ai`: 도면 분석 프롬프트/파싱/스키마 변경

---

## 1) Agent 선택 규칙(요약, 레거시)

- “무엇을 만들지/정책/AC”가 애매하면 → `Product Manager`
- “아키텍처/경계/데이터 정합성”이 핵심이면 → `Tech Lead`
- “API/DB/스토리지/보안”이 중심이면 → `Backend Engineer`
- “페이지/UX/상태관리/업로드”가 중심이면 → `Frontend Engineer`
- “도면→3D/렌더/WebGPU/자산 최적화/워크스루”면 → `Simulation-3D`
- “배포/관측/비용/운영”이면 → `DevOps-SRE`
- “보안/개인정보/위협모델”이면 → `Security-Privacy`
- “테스트 계획/E2E/릴리즈 게이트”면 → `QA`
- “도면 인식(ML)/텍스처 생성”이면 → `Data-Search-ML`

---

## 2) 작업 템플릿(권장)

- Primary Agent:
- Supporting Agents:
- 관련 문서(필수): `docs/prd.md`, `docs/roadmap.md`
- 관련 스킬(우선): `.codex/skills/*`
- 완료 정의(AC):
- 권한/보안 체크: `docs/rbac-acl.md`, `docs/security.md`
- 테스트/검증: `docs/qa-test-plan.md`
- 산출물(코드/문서/ADR):

---

## 3) 페이즈별 기본 담당(기본값)

> 실제 구현은 이 기본값을 따르되, 변경이 있으면 `docs/roadmap.md`에 업데이트한다.

- Phase 1(Core Engine): Simulation-3D + Frontend + QA
- Phase 2(AI & 2D Editing): Frontend + Data-Search-ML + Simulation-3D
- Phase 3(Interaction & Physics): Simulation-3D + Frontend
- Phase 4(Decoration & Save): Frontend + Backend + QA
