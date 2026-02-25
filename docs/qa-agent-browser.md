# Agent-Browser QA (E2E)

This guide runs the full flow with `agent-browser`:
login → new project → floorplan upload → 2D correction → 3D edit → walkthrough.

## Prerequisites
- Start the dev server yourself (do not run it via the agent):
  - `npm run dev:web`
- Ensure the QA test account exists in Supabase (email/password).
- Save the floorplan image to a local file path.

## Environment Variables
Set these before running the script:
```
BASE_URL=http://127.0.0.1:3100
TEST_EMAIL=qa@example.com
TEST_PASSWORD=your-password
FLOORPLAN_PATH=/absolute/path/to/blueprint.jpg
```

## Run
```
bash scripts/qa/agent-browser-e2e.sh
```

## Output
- Screenshot saved to `/tmp/plan2space-qa.png`.
- If any step fails, run `agent-browser snapshot -i` and update the selector in the script.
