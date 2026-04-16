# AI Pipeline (Deskterior)

이 문서는 현재 제품에서 사용하는 AI 경계를 정의합니다.

## 현재 운영 경계
- 메인 제품 파이프라인은 **room builder -> deskterior 편집 -> 공유/커뮤니티 조회**입니다.
- 구조 인식 기반 floorplan 분석은 제품 경계에서 제거되었습니다.

## 활성 AI 경로
1. `POST /api/v1/assets/generate`로 이미지 기반 3D 자산 생성 job enqueue
2. worker가 `ASSET_GENERATION` job 처리
3. 생성된 GLB를 Supabase storage에 저장하고 자산 레코드 생성
4. 에디터에서 커스텀 자산으로 배치 가능

## 품질 규칙
- 생성 자산은 GLB 단일 포맷으로 저장한다.
- 생성 실패는 `retrying -> failed/dead_letter` 상태로 명확히 노출한다.
- 생성형 결과는 운영 카탈로그를 대체하지 않고 보조 입력으로 취급한다.
- 운영 카탈로그로 승격할 때는 물리 메타데이터(`dimensionsMm`, `finishColor`, `finishMaterial`, `detailNotes`, `scaleLocked`)를 채운다.

## 향후 확장(연구 트랙)
- 텍스트/무드 기반 데스크 배치 추천
- 커뮤니티 장면 임베딩 기반 유사 장면 추천
- Blender 자동 리토폴로지/LOD 제안

## 2026-04-14 변경 동기화 (Floorplan AI Retirement)
Added:
- 자산 생성 중심 AI 경로(`assets/generate` + worker)를 공식 계약으로 명시.

Updated:
- AI 문서를 deskterior 제품 맥락으로 재정의.

Removed/Deprecated:
- semantic parsing -> 2D correction -> procedural 3D floorplan 파이프라인.
- floorplan provider rollout/eval/blind gate 운영 기준.
