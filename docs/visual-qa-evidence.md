# 시각 QA 증적 팩 (빌더/에디터/뷰어)

이 문서는 IKEA Kreativ 레퍼런스에 맞춘 축 2(community/template/뷰어 시각 품질) 검증용 캡처 기준입니다.

## 캡처 전제 조건

- 데스크톱 `1440px` 폭 캡처
- 로그인 계정 1개
- 빌더로 생성 후 저장된 프로젝트 1개 이상
- `view-only + permanent` 공유 링크 1개 이상
- 최소 3개 이상 카탈로그 자산이 배치된 shared scene 1개
- 만료 토큰 1개 (또는 fallback으로 `Snapshot unavailable` 상태)

## 필수 캡처 12장

1. `/studio/create`: 빌더 셸 route-parity (step rail + preview)
2. `/studio/builder` step 1: template 선택 + 우측 preview dominance
3. `/studio/builder` step 3: door/window authoring + wall target chips
4. `/studio/builder` step 4: finish swatches + summary + primary CTA
5. `/project/[id]` top view: 상단 chrome + 중심 viewport + 하단 view bar
6. `/project/[id]` walk mode: 탑뷰와 구분되는 몰입형 시점
7. `/project/[id]` 공유 모달: permanent/view-only/publish 흐름
8. `/shared/[token]` top view: 읽기 전용 헤더/메트릭/inspection rail
9. `/shared/[token]` walk mode: hotspot 선택 ↔ 상품 패널 연동
10. `/community`: featured + collection pulse + pinned feed 구조
11. `/gallery`: filter chips + 안정적인 카드 그리드/카운트
12. `/shared/[token-expired]`: branded 만료 링크 복구 상태

## Pass 기준

- 빌더: left panel + right preview 구성에서 정보 밀도/가독성 유지
- 에디터: 캔버스 우선 구조, chrome은 보조 역할
- 뷰어: 편집 도구 느낌 없이 명확한 읽기 전용 프레젠테이션
- 커뮤니티/갤러리: 단순 카드 나열이 아니라 큐레이션/탐색 구조 명확
- 실패 상태: 일반 에러 페이지가 아닌 제품 톤의 브랜드 상태 화면

## 저장 위치 권장

- `docs/evidence/visual-qa/<YYYY-MM-DD>/`
- 파일명 예시: `01-studio-create.png` … `12-shared-expired.png`

## 운영 메모

- 캡처 세트가 없으면 축 2 완료를 “코드 완료, 런타임 증적 대기”로 분류한다.
- 배포 검증 시에는 동일 체크리스트를 preview URL 기준으로 재실행한다.
- 자동 캡처 스크립트(`scripts/visual-qa.capture.spec.ts`)는 headless 안정성을 위해 `window.__PLAN2SPACE_DISABLE_LOADING_OVERLAY__ = true`를 주입한다.
- 로딩 오버레이 우회는 QA 캡처 전용이며, 제품 기본 동작(로딩 연출)은 변경하지 않는다.
