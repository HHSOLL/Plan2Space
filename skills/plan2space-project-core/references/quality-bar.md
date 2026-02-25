# Quality Bar and Guardrails

## Must-Haves
- Semantic parsing -> 2D correction -> procedural 3D generation.
- PBR materials + HDR environment + post-processing chain.
- Top view hides ceiling; walk mode shows ceiling.
- Save/load versions with stable JSON contracts.
- Watermark/컬러 도면 대응 전처리(그레이스케일/배경제거) 유지.

## Visual Targets
- Loading and landing match `new_guideline/` references.
- Glassmorphism UI overlays with readable contrast.

## Failure Conditions
- Direct AI-to-3D generation without 2D correction.
- Flat or plastic-looking materials (no PBR/HDRI).
- Walk mode passing through walls.
