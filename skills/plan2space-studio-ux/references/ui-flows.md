# UI Flows and Checkpoints

## Entry Flow
- Loading screen -> Landing (keypad navigation) -> Auth popup -> Dashboard.

## Editor Flow
- Upload floorplan -> AI parse -> 2D correction -> Confirm -> 3D editor.
  - View mode progression: `2d-edit` → `top` → `walk`.

## Top View
- Orthographic camera.
- Ceiling hidden.
- Drag/drop placement and snapping.

## Walk Mode
- Perspective camera with pointer lock.
- Ceiling visible.
- WASD movement and click interactions.

## Visual Checkpoints
- Glassmorphism overlays with readable contrast.
- Subtle motion and transitions, not heavy animation spam.
