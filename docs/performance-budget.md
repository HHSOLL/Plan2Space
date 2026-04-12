# 성능 예산 (핵심 경로)

이 문서는 공간 우선 핵심 경로(`빌더 -> 에디터 -> 발행 -> 읽기 전용 뷰어`) 기준의 성능 예산과 측정 절차를 정의합니다.

## Scope

- `/studio/builder`
- `/project/[id]`
- `/shared/[token]`
- `/gallery`
- `/community`

## Budget (P2)

- 빌더 경로 셸 FCP p95: `<= 2.8s`
- 에디터 경로 셸 FCP p95: `<= 3.2s`
- Shared/Gallery/Community route shell FCP p95: `<= 2.5s`
- 연속 2회 진입 기준 heap 증가율: `<= 0.8%p`
- 에디터 상호작용 프레임 드롭:
  - 가구 선택/이동/회전 중 장시간(2초+) 지속 dropped frame 없음
- 읽기 전용 뷰어 상호작용 트리:
  - 에디터 전용 transform/delete 계층 미포함
- 동적 조명 예산:
  - 가구 기반 point light 활성 수 `<= 6`
  - 조명 자산 없는 장면에서 추가 light pass 없음

## Primary Contract Check

- 스크립트: `apps/web/scripts/e2e-primary-room-flow.ts`
- 목적: primary surface 접근성/라우트 계약 검증
- 실행:

```bash
npm --workspace apps/web run primary:e2e:room-flow
E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict
```

## Profiling Procedure

1. `npm --workspace apps/web run build`
2. `npm --workspace apps/web run start -- --hostname 127.0.0.1 --port 3100`
3. DevTools Performance로 각 경로 최초 진입 3회, 재진입 2회 측정
4. Web Vitals(FCP/LCP/INP)와 memory timeline을 함께 기록
5. 결과를 PR 코멘트 또는 release note에 아래 형식으로 첨부

```text
route: /project/[id]
FCP p95: 2.9s
heap growth (2nd load): +0.5%p
interaction note: drag/rotate 동안 눈에 띄는 frame drop 없음
```

## Guardrails

- heavy model은 lazy load를 기본으로 유지
- 읽기 전용 뷰어는 에디터보다 가벼운 interaction tree 유지
- 조명 제품은 카탈로그 힌트 기반으로만 동적 light를 켜고, 상한(6개)을 반드시 유지
- publish/share/public 뷰어 실패는 로깅 이벤트로 남겨 재현 가능해야 함
- 회귀가 budget 초과 시, 기능 추가보다 성능 회귀 원인 제거를 우선
