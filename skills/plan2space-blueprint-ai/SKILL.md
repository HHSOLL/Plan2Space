---
name: plan2space-blueprint-ai
description: Floorplan analysis pipeline for plan2space, including prompt design, JSON schema, validation rules, and the 2D correction workflow. Use when working on AI parsing, floorplan ingestion, or topology data contracts.
---

# Plan2space Blueprint AI

## Workflow
1) Read `docs/ai-pipeline.md` and use its schema as the contract.
2) Keep AI output semantic (topology only), not 3D geometry.
3) Always route outputs through the 2D correction editor.
4) Validate walls/openings before procedural 3D generation.
5) If provider errors appear, surface actionable schema issues.

## Validation Rules
- Openings must be attached to a wall and within bounds.
- Drop noisy walls shorter than the minimum threshold.
- Surface errors clearly and fall back to manual edits.

## References
- `references/schema-and-prompt.md` for the JSON schema and prompt template.
