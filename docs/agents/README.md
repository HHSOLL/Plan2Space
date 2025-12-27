# Agents (역할별 작업 가이드)

이 디렉토리는 plan2space를 “도면 → 3D + 몰입형 UX” 중심으로 구현하기 위해, 역할별로 **의사결정/산출물/체크리스트**를 정리한 문서 모음이다.

우선순위:
- 1순위: `.codex/skills/*` 스킬 사용
- 2순위: 이 문서(레거시 Agent 가이드)

## 사용 방법
- 작업 시작 시 “누가(어떤 Agent)가 맡을지”는 루트의 `AGENTS.md`를 기준으로 선택한다.
- 작업 시작 전 `docs/prd.md`를 기준으로 **범위/우선순위/성공 조건**을 확인한다.
- 기능 추가/변경이 생기면 PRD(또는 관련 스펙 문서)를 먼저 갱신한다.
- 저장/공유 기능 도입 시 **권한(RBAC/ACL)** 기준으로 설계한다.

## 역할 목록
- `docs/agents/product-manager.md`: 요구사항/플로우/수용 기준(AC) 정의
- `docs/agents/tech-lead.md`: 아키텍처/모듈화/품질 기준/ADR
- `docs/agents/frontend-engineer.md`: Next.js UI/상태/3D/2D 편집
- `docs/agents/backend-engineer.md`: API/DB/권한/도메인 로직
- `docs/agents/realtime-engineer.md`: WebSocket 이벤트/동시성/협업
- `docs/agents/simulation-3d.md`: 도면→3D 파이프라인/렌더/자산
- `docs/agents/devops-sre.md`: 배포/관측/스토리지/큐/운영
- `docs/agents/qa.md`: 테스트 전략/E2E/회귀/릴리즈 게이트
- `docs/agents/security-privacy.md`: 보안/개인정보/감사/위협모델
- `docs/agents/data-search-ml.md`: 검색/랭킹/추천/도면 인식(ML) 운영
