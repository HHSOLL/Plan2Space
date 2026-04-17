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

function isPointOnSegment(point: [number, number], start: [number, number], end: [number, number], tolerance = POINT_TOLERANCE) {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
  if (Math.abs(cross) > tolerance) return false;
  const dot = (px - x1) * (x2 - x1) + (py - y1) * (y2 - y1);
  if (dot < -tolerance) return false;
  const squaredLength = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (dot - squaredLength > tolerance) return false;
  return true;
}

function isPointInsidePolygon(point: [number, number], polygon: [number, number][]) {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const start = polygon[index]!;
    const end = polygon[previous]!;

    if (isPointOnSegment(point, start, end)) {
      return true;
    }

    const [x1, y1] = start;
    const [x2, y2] = end;
    const intersects =
      y1 > point[1] !== y2 > point[1] &&
      point[0] < ((x2 - x1) * (point[1] - y1)) / (y2 - y1 + Number.EPSILON) + x1;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function polygonCentroid(points: [number, number][]) {
  if (points.length === 0) return [0, 0] as const;
  const twiceArea = polygonArea(points) * 2;
  if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) < POINT_TOLERANCE) {
    const fallback = points.reduce(
      (accumulator, point) => [accumulator[0] + point[0], accumulator[1] + point[1]] as [number, number],
      [0, 0] as [number, number]
    );
    return [fallback[0] / points.length, fallback[1] / points.length] as const;
  }

  let centroidX = 0;
  let centroidY = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index]!;
    const [x2, y2] = points[(index + 1) % points.length]!;
    const cross = x1 * y2 - x2 * y1;
    centroidX += (x1 + x2) * cross;
    centroidY += (y1 + y2) * cross;
  }

  return [centroidX / (3 * twiceArea), centroidY / (3 * twiceArea)] as const;
}

function resolvePrimaryOutline(floors: Floor[]) {
  return [...floors]
    .filter((floor) => Array.isArray(floor.outline) && floor.outline.length >= 3)
    .sort((left, right) => Math.abs(polygonArea(right.outline)) - Math.abs(polygonArea(left.outline)))[0]?.outline ?? [];
}

export function getWallPlaneOffset(wall: Wall, floors: Floor[], scale: number) {
  const resolvedScale = Number.isFinite(scale) && scale > POINT_TOLERANCE ? scale : 1;
  const rawDx = wall.end[0] - wall.start[0];
  const rawDy = wall.end[1] - wall.start[1];
  const rawLength = Math.hypot(rawDx, rawDy);
  if (!Number.isFinite(rawLength) || rawLength <= POINT_TOLERANCE) {
    return [0, 0] as const;
  }

  const outline = resolvePrimaryOutline(floors);
  if (outline.length < 3) {
    return [0, 0] as const;
  }
  const centroid = polygonCentroid(outline);

  const midpointX = (wall.start[0] + wall.end[0]) / 2;
  const midpointY = (wall.start[1] + wall.end[1]) / 2;
  const rawDistance = Math.max(0.02 / resolvedScale, wall.thickness) / 2;
  const rawSampleDistance = rawDistance + Math.max(POINT_TOLERANCE * 4, wall.thickness * 0.2);

  const candidateNormalA = [rawDy / rawLength, -rawDx / rawLength] as const;
  const candidateNormalB = [-candidateNormalA[0], -candidateNormalA[1]] as const;

  const candidates = [candidateNormalA, candidateNormalB].map((candidate) => {
    const sampleX = midpointX + candidate[0] * rawSampleDistance;
    const sampleY = midpointY + candidate[1] * rawSampleDistance;
    const distanceToCentroid = Math.hypot(sampleX - centroid[0], sampleY - centroid[1]);
    return {
      candidate,
      outside: !isPointInsidePolygon([sampleX, sampleY], outline),
      distanceToCentroid
    };
  });

  const outwardCandidate =
    candidates.find((entry) => entry.outside)?.candidate ??
    candidates.sort((left, right) => right.distanceToCentroid - left.distanceToCentroid)[0]?.candidate;

  if (!outwardCandidate) {
    return [0, 0] as const;
  }

  return [outwardCandidate[0] * rawDistance * resolvedScale, outwardCandidate[1] * rawDistance * resolvedScale] as const;
}
