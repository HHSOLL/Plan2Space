import type { DesignDoc, QuantityTakeoff } from "@webinterior/shared/types";

function polygonArea(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeQuantityTakeoff(plan2d: DesignDoc["plan2d"], params: { projectId: string; designDocId: string; revision: number }): QuantityTakeoff {
  const rooms = plan2d.rooms.map((r) => ({ id: r.id, name: r.name, areaSqm: round2(polygonArea(r.polygon)) }));
  const floorAreaSqm = round2(rooms.reduce((sum, r) => sum + r.areaSqm, 0));
  const wallLengthM = round2(plan2d.walls.reduce((sum, w) => sum + dist(w.a, w.b), 0));
  const wallHeight = Number(plan2d.params.wallHeight ?? 0);
  const openingAreaSqm = round2(plan2d.openings.reduce((sum, o) => sum + o.width * o.height, 0));
  const openingCount = plan2d.openings.length;
  const wallAreaSqm = round2(Math.max(0, wallLengthM * wallHeight - openingAreaSqm));

  return {
    projectId: params.projectId,
    designDocId: params.designDocId,
    revision: params.revision,
    rooms,
    totals: { floorAreaSqm, wallLengthM, wallAreaSqm, openingCount, openingAreaSqm }
  };
}

