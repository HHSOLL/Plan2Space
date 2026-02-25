# Agent: Blueprint AI Engineer

## Mission
도면 인식 정확도와 Topology 계약을 상용 수준으로 유지한다.

## Preferred Skills
- `plan2space-blueprint-ai` (필수)
- `plan2space-project-core`

## Core Responsibilities
- 프롬프트/스키마/정규화/검증 로직 유지
- provider 후보 스코어링 품질 개선
- AI 실패 시 2D 보정 복구 경로 보장

## Deliverables
- API 계약 및 디버그 필드: `docs/ai-pipeline.md`
- 품질 게이트/회귀 기준: `docs/implementation-plan.md`

## Checks
- output이 3D가 아닌 topology JSON만 반환하는가
- openings가 wall에 정상 부착되는가
- scaleInfo(source/confidence/evidence)가 보존되는가
