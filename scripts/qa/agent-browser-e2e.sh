#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3100}"
TEST_EMAIL="${TEST_EMAIL:?Set TEST_EMAIL for the QA account}"
TEST_PASSWORD="${TEST_PASSWORD:?Set TEST_PASSWORD for the QA account}"
FLOORPLAN_PATH="${FLOORPLAN_PATH:?Set FLOORPLAN_PATH to the blueprint image}"
SESSION_NAME="${SESSION_NAME:-qa-e2e-$(date +%s)}"
echo "Using agent-browser session: ${SESSION_NAME}"

ab() {
  agent-browser --session "${SESSION_NAME}" "$@"
}

ab open "${BASE_URL}/login"
ab wait "input[type=email]"
ab find role textbox fill --name "Email" "${TEST_EMAIL}"
ab find role textbox fill --name "Password" "${TEST_PASSWORD}"
ab find role button click --name "Sign in"
ab wait 1500

ab open "${BASE_URL}/studio"
ab find role button click --name "New Project"
ab find placeholder "e.g. Minimalist Urban Loft" fill "QA Blueprint Run"
ab upload "input[type=file]" "${FLOORPLAN_PATH}"

set +e
READY=0
for attempt in {1..6}; do
  ab wait --text "2D Plan Correction" && READY=1 && break
  sleep 10
done
set -e

if [ "$READY" -ne 1 ]; then
  echo "Timed out waiting for 2D Plan Correction step."
  exit 1
fi

ab find role button click --name "CREATE PROJECT"
ab wait 1000

set +e
NAV_READY=0
for attempt in {1..6}; do
  ab wait --url "**/project/**" && NAV_READY=1 && break
  sleep 10
done
set -e

if [ "$NAV_READY" -ne 1 ]; then
  echo "Timed out waiting for project route navigation."
fi

set +e
EDITOR_READY=0
for attempt in {1..12}; do
  ab wait --text "3D Edit" && EDITOR_READY=1 && break
  sleep 10
done
set -e

if [ "$EDITOR_READY" -ne 1 ]; then
  echo "Timed out waiting for editor controls."
  ab snapshot -i
  exit 1
fi

ab find role button click --name "3D Edit"

set +e
WALK_READY=0
for attempt in {1..12}; do
  ab find role button click --name "Walkthrough" && WALK_READY=1 && break
  ab find role button click --name "Walk Mode" && WALK_READY=1 && break
  sleep 5
done
set -e

if [ "$WALK_READY" -ne 1 ]; then
  echo "Timed out waiting for walkthrough mode control."
  ab snapshot -i
  exit 1
fi

ab screenshot "/tmp/plan2space-qa.png"
ab close
