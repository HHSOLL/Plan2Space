# 시스템 아키텍처 — plan2space

문서 목적: “도면 → 3D” 파이프라인과 몰입형 UX를 중심으로 한 단순/명확한 구조를 정의한다. 마켓플레이스/프로젝트룸은 제외한다.

---

## 1) 고수준 구성

- **Web App (Next.js)**
  - 업로드/2D 보정/3D 뷰어/워크스루 UI
- **API Route (Next.js)**
  - Blueprint 분석 요청(Gemini 1.5 Vision)
- **Supabase (BaaS)**
  - Auth + Postgres + Storage (씬 저장/썸네일)
- **3D Runtime**
  - R3F + WebGL2 기본, WebGPU 옵션

---

## 2) 핵심 데이터 흐름

### 2.1 도면 업로드 → 3D 생성
1. 사용자 도면 업로드
2. API Route가 Gemini 1.5 Vision 호출
3. 표준 `Plan2D` JSON 반환
4. 2D 보정 UI에서 수정
5. 확정된 Plan2D로 3D 생성

### 2.2 저장/불러오기
1. 씬 상태(JSON) + 스냅샷 저장
2. Supabase Storage에 썸네일 저장
3. 프로젝트 목록에서 로드

---

## 3) 설계 원칙

- **자동화 + 보정**: 완전 자동화를 강제하지 않고, 보정 UX로 품질을 확보
- **폴백 우선**: WebGPU 실패 시 WebGL2로 즉시 전환
- **성능 예산**: LOD/인스턴싱/텍스처 압축 기본 적용
- **표준화**: 1 Unit = 1 Meter, 좌표/스케일 일관성 유지

---

## 4) 확장 고려

- 비동기 작업 분리(렌더/텍스처 생성) → 워커/큐로 확장
- AI 텍스처 생성(Stable Diffusion 등) 연결
- 협업/리뷰 기능은 후속 단계에서 도입
