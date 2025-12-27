"use client";

import type { DesignDoc } from "@webinterior/shared/types";

function planBounds(plan2d: DesignDoc["plan2d"]) {
  const pts: Array<{ x: number; y: number }> = [];
  for (const w of plan2d.walls) pts.push(w.a, w.b);
  for (const r of plan2d.rooms) for (const p of r.polygon) pts.push(p);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function roomCenter(room: DesignDoc["plan2d"]["rooms"][number]) {
  const pts = room.polygon;
  if (!pts.length) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

function hashIndex(id: string, mod: number) {
  let acc = 0;
  for (let i = 0; i < id.length; i++) acc = (acc + id.charCodeAt(i) * (i + 11)) % 9973;
  return acc % mod;
}

export type PlanPin = { id: string; x: number; y: number; label?: string; status?: "open" | "resolved"; variant?: "annotation" | "object" };

export function Plan2DViewer({
  plan2d,
  className,
  pins,
  onPlanClick
}: {
  plan2d: DesignDoc["plan2d"];
  className?: string;
  pins?: PlanPin[];
  onPlanClick?: (point: { x: number; y: number }) => void;
}) {
  const { minX, minY, maxY, width, height } = planBounds(plan2d);
  const pad = Math.max(0.35, Math.min(width, height) * 0.06);
  const viewBoxX = minX - pad;
  const viewBoxY = minY - pad;
  const viewBoxW = width + pad * 2;
  const viewBoxH = height + pad * 2;
  const viewBox = `${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`;
  const flipY = (y: number) => minY + maxY - y;

  const roomPalette = ["#e0f2fe", "#dcfce7", "#fef9c3", "#fae8ff", "#ffe4e6", "#ffedd5"];

  return (
    <div className={className}>
      <svg
        viewBox={viewBox}
        className={`h-full w-full rounded-xl bg-white ${onPlanClick ? "cursor-crosshair" : ""}`}
        role="img"
        aria-label="2D 도면"
        onClick={
          onPlanClick
            ? (e) => {
                const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                const relX = (e.clientX - rect.left) / Math.max(rect.width, 1);
                const relY = (e.clientY - rect.top) / Math.max(rect.height, 1);
                const svgX = viewBoxX + relX * viewBoxW;
                const svgY = viewBoxY + relY * viewBoxH;
                const planX = svgX;
                const planY = minY + maxY - svgY;
                onPlanClick({ x: planX, y: planY });
              }
            : undefined
        }
      >
        <rect x={minX - pad} y={minY - pad} width={width + pad * 2} height={height + pad * 2} fill="#ffffff" />

        <g opacity={0.8}>
          {plan2d.rooms.map((room) => {
            const pts = room.polygon.map((p) => `${p.x},${flipY(p.y)}`).join(" ");
            const fill = roomPalette[hashIndex(room.id, roomPalette.length)];
            return <polygon key={room.id} points={pts} fill={fill} stroke="#e4e4e7" strokeWidth={0.03} />;
          })}
        </g>

        <g>
          {plan2d.walls.map((w) => (
            <line
              key={w.id}
              x1={w.a.x}
              y1={flipY(w.a.y)}
              x2={w.b.x}
              y2={flipY(w.b.y)}
              stroke={w.locked ? "#111827" : "#3f3f46"}
              strokeOpacity={w.locked ? 0.9 : 0.55}
              strokeWidth={w.locked ? 0.09 : 0.065}
              strokeLinecap="round"
            />
          ))}
        </g>

        <g>
          {plan2d.openings.map((o) => {
            const wall = plan2d.walls.find((w) => w.id === o.wallId);
            if (!wall) return null;
            const dx = wall.b.x - wall.a.x;
            const dy = wall.b.y - wall.a.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-6) return null;
            const ux = dx / len;
            const uy = dy / len;
            const startX = wall.a.x + ux * o.offset;
            const startY = wall.a.y + uy * o.offset;
            const endX = startX + ux * o.width;
            const endY = startY + uy * o.width;

            const isDoor = o.type === "door";
            return (
              <line
                key={o.id}
                x1={startX}
                y1={flipY(startY)}
                x2={endX}
                y2={flipY(endY)}
                stroke={isDoor ? "#ef4444" : "#0ea5e9"}
                strokeOpacity={0.95}
                strokeWidth={0.14}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {pins && pins.length ? (
          <g>
            {pins.map((p) => {
              const isResolved = p.status === "resolved";
              const variant = p.variant ?? "annotation";
              const baseColor = variant === "object" ? "#0ea5e9" : "#ef4444";
              const resolvedColor = variant === "object" ? "#94a3b8" : "#a1a1aa";
              const pinColor = isResolved ? resolvedColor : baseColor;
              const cx = p.x;
              const cy = flipY(p.y);
              return (
                <g key={p.id}>
                  <circle cx={cx} cy={cy} r={0.18} fill={pinColor} opacity={0.9} />
                  <circle cx={cx} cy={cy} r={0.32} fill="none" stroke={pinColor} strokeOpacity={0.35} strokeWidth={0.05} />
                  {p.label ? (
                    <text x={cx + 0.25} y={cy - 0.2} fontSize={0.28} fill="#111827" opacity={0.85}>
                      {p.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        ) : null}

        <g>
          {plan2d.rooms.map((room) => {
            const c = roomCenter(room);
            return (
              <text
                key={room.id}
                x={c.x}
                y={flipY(c.y)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={0.35}
                fill="#111827"
                opacity={0.8}
              >
                {room.name}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
