import type { Floor, Wall } from "../stores/useSceneStore";

const POINT_TOLERANCE = 1e-3;

function polygonArea(points: [number, number][]) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function pointsMatch(left: [number, number], right: [number, number], tolerance = POINT_TOLERANCE) {
  return Math.abs(left[0] - right[0]) <= tolerance && Math.abs(left[1] - right[1]) <= tolerance;
}

function resolvePrimaryOutline(floors: Floor[]) {
  return [...floors]
    .filter((floor) => Array.isArray(floor.outline) && floor.outline.length >= 3)
    .sort((left, right) => Math.abs(polygonArea(right.outline)) - Math.abs(polygonArea(left.outline)))[0]?.outline ?? [];
}

export function getWallPlaneOffset(wall: Wall, floors: Floor[], scale: number) {
  const rawDx = wall.end[0] - wall.start[0];
  const rawDy = wall.end[1] - wall.start[1];
  const rawLength = Math.hypot(rawDx, rawDy);
  if (!Number.isFinite(rawLength) || rawLength <= POINT_TOLERANCE) {
    return [0, 0] as const;
  }

  const outline = resolvePrimaryOutline(floors);
  const outlineArea = polygonArea(outline);
  const outlineSign = outlineArea >= 0 ? 1 : -1;

  let directionSign = 1;
  for (let index = 0; index < outline.length; index += 1) {
    const start = outline[index]!;
    const end = outline[(index + 1) % outline.length]!;
    if (pointsMatch(wall.start, start) && pointsMatch(wall.end, end)) {
      directionSign = 1;
      break;
    }
    if (pointsMatch(wall.start, end) && pointsMatch(wall.end, start)) {
      directionSign = -1;
      break;
    }
  }

  const normalX = (rawDy / rawLength) * outlineSign * directionSign;
  const normalY = (-rawDx / rawLength) * outlineSign * directionSign;
  const distance = Math.max(0.02, wall.thickness * scale) / 2;

  return [normalX * distance, normalY * distance] as const;
}
