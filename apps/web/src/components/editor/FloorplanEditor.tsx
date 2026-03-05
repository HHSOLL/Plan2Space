"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Image as KonvaImage, Group, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Check, RotateCcw, Plus, Trash2, DoorOpen, MousePointer2, Ruler } from "lucide-react";
import { useSceneStore } from "../../lib/stores/useSceneStore";
import { createDoorHeuristicScaleInfo, createUserMeasureScaleInfo } from "../../lib/ai/scaleInfo";

type ToolMode = "select" | "add-wall" | "add-opening" | "measure";

type DragTarget =
  | { kind: "wall-endpoint"; wallId: string; endpoint: "start" | "end" }
  | { kind: "opening"; openingId: string; grabOffset: number };

interface FloorplanEditorProps {
  image: string;
  onConfirm: () => void;
  confirmLabel?: string;
  showConfirmButton?: boolean;
}

const DEFAULT_WALL_THICKNESS = 12;
const DEFAULT_WALL_HEIGHT = 2.8;
const DEFAULT_DOOR_WIDTH = 90;
const DEFAULT_WINDOW_WIDTH = 120;
const DEFAULT_DOOR_HEIGHT = 210;
const DEFAULT_WINDOW_HEIGHT = 120;
const DEFAULT_DOOR_METERS = 0.9;
const SNAP_ENDPOINT_DISTANCE = 10;
const AXIS_SNAP_DISTANCE = 10;
const AXIS_SNAP_ANGLE_DEG = 8;

const AXIS_SNAP_ANGLE_RAD = (AXIS_SNAP_ANGLE_DEG * Math.PI) / 180;
const HIGH_CONFIDENCE = 0.8;
const MEDIUM_CONFIDENCE = 0.6;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeConfidence(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return clamp(value as number, 0, 1);
}

function getConfidenceColor(confidence: number) {
  if (confidence >= HIGH_CONFIDENCE) return "#22c55e";
  if (confidence >= MEDIUM_CONFIDENCE) return "#eab308";
  return "#ef4444";
}

function getOpeningConfidence(opening: {
  detectConfidence?: number;
  attachConfidence?: number;
  typeConfidence?: number;
}) {
  const detect = normalizeConfidence(opening.detectConfidence, 0.7);
  const attach = normalizeConfidence(opening.attachConfidence, 0.6);
  const type = normalizeConfidence(opening.typeConfidence, 0.7);
  return Math.min(detect, attach, type);
}

function toWallLocal(point: [number, number], wall: { start: [number, number]; end: [number, number] }) {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dy) || 1;
  const cos = dx / length;
  const sin = dy / length;
  const tx = point[0] - wall.start[0];
  const ty = point[1] - wall.start[1];
  const localX = tx * cos + ty * sin;
  const localY = -tx * sin + ty * cos;
  return { localX, localY, length, cos, sin };
}

export function FloorplanEditor({ image, onConfirm, confirmLabel, showConfirmButton = true }: FloorplanEditorProps) {
  const walls = useSceneStore((state) => state.walls);
  const openings = useSceneStore((state) => state.openings);
  const setWalls = useSceneStore((state) => state.setWalls);
  const setOpenings = useSceneStore((state) => state.setOpenings);
  const sceneScale = useSceneStore((state) => state.scale);
  const setSceneScale = useSceneStore((state) => state.setScale);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [activeTool, setActiveTool] = useState<ToolMode>("select");
  const [pendingWallStart, setPendingWallStart] = useState<[number, number] | null>(null);
  const [cursorPoint, setCursorPoint] = useState<[number, number] | null>(null);
  const [dragging, setDragging] = useState<DragTarget | null>(null);
  const [measureStart, setMeasureStart] = useState<[number, number] | null>(null);
  const [measureEnd, setMeasureEnd] = useState<[number, number] | null>(null);
  const [measureCursor, setMeasureCursor] = useState<[number, number] | null>(null);
  const [measureInput, setMeasureInput] = useState("3000");
  const [scaleMessage, setScaleMessage] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = image;
    img.onload = () => setImgObj(img);
  }, [image]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setStageSize({ width: rect.width, height: rect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (!imgObj || stageSize.width === 0 || stageSize.height === 0) return 1;
    return Math.min(stageSize.width / imgObj.width, stageSize.height / imgObj.height) * 0.9;
  }, [imgObj, stageSize]);

  const offset = useMemo(() => {
    if (!imgObj) return { x: 0, y: 0 };
    return {
      x: (stageSize.width - imgObj.width * scale) / 2,
      y: (stageSize.height - imgObj.height * scale) / 2
    };
  }, [imgObj, scale, stageSize.height, stageSize.width]);

  const toImagePoint = (event?: KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer || !imgObj) return null;
    const x = (pointer.x - offset.x) / scale;
    const y = (pointer.y - offset.y) / scale;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [clamp(x, 0, imgObj.width), clamp(y, 0, imgObj.height)] as [number, number];
  };

  const snapToEndpoints = (point: [number, number], ignore?: { wallId: string; endpoint: "start" | "end" }) => {
    let best: [number, number] | null = null;
    let minDistance = SNAP_ENDPOINT_DISTANCE;
    walls.forEach((wall) => {
      const candidates: Array<{ point: [number, number]; endpoint: "start" | "end" }> = [
        { point: wall.start, endpoint: "start" },
        { point: wall.end, endpoint: "end" }
      ];
      candidates.forEach((candidate) => {
        if (ignore && wall.id === ignore.wallId && candidate.endpoint === ignore.endpoint) return;
        const distance = Math.hypot(point[0] - candidate.point[0], point[1] - candidate.point[1]);
        if (distance < minDistance) {
          minDistance = distance;
          best = candidate.point;
        }
      });
    });
    return best ?? point;
  };

  const snapToAxis = (point: [number, number], anchor: [number, number]) => {
    let [x, y] = point;
    const dx = x - anchor[0];
    const dy = y - anchor[1];
    if (Math.abs(dx) <= AXIS_SNAP_DISTANCE) x = anchor[0];
    if (Math.abs(dy) <= AXIS_SNAP_DISTANCE) y = anchor[1];
    const angle = Math.abs(Math.atan2(dy, dx));
    if (angle <= AXIS_SNAP_ANGLE_RAD || Math.abs(angle - Math.PI) <= AXIS_SNAP_ANGLE_RAD) {
      y = anchor[1];
    }
    if (Math.abs(angle - Math.PI / 2) <= AXIS_SNAP_ANGLE_RAD) {
      x = anchor[0];
    }
    return [x, y] as [number, number];
  };

  const measurement = useMemo(() => {
    if (!measureStart) return null;
    const end = measureEnd ?? measureCursor;
    if (!end) return null;
    const dx = end[0] - measureStart[0];
    const dy = end[1] - measureStart[1];
    const distance = Math.hypot(dx, dy);
    return {
      start: measureStart,
      end,
      distance,
      labelPoint: [(measureStart[0] + end[0]) / 2, (measureStart[1] + end[1]) / 2] as [number, number]
    };
  }, [measureCursor, measureEnd, measureStart]);

  const applyScaleFromMeasurement = () => {
    if (!measurement) {
      setScaleMessage("Select two points to measure.");
      return;
    }
    const mmValue = Number(measureInput);
    if (!Number.isFinite(mmValue) || mmValue <= 0) {
      setScaleMessage("Enter a valid length in mm.");
      return;
    }
    const meters = mmValue / 1000;
    const nextScale = meters / measurement.distance;
    if (!Number.isFinite(nextScale) || nextScale <= 0) {
      setScaleMessage("Invalid scale computed. Check points and length.");
      return;
    }
    setSceneScale(
      nextScale,
      createUserMeasureScaleInfo({
        value: nextScale,
        mmValue,
        pxDistance: measurement.distance,
        p1: measurement.start,
        p2: measurement.end
      })
    );
    setScaleMessage(`Scale set: ${nextScale.toFixed(4)} m/px`);
  };

  const applyScaleFromDoors = () => {
    const doorCandidates = openings
      .filter((opening) => opening.type === "door" && opening.width > 10)
      .map((opening) => ({ id: opening.id, width: opening.width }));
    if (doorCandidates.length === 0) {
      setScaleMessage("No doors found for auto-scale.");
      return;
    }
    const doorWidths = doorCandidates.map((entry) => entry.width);
    const avgWidth = doorWidths.reduce((sum, value) => sum + value, 0) / doorWidths.length;
    const nextScale = DEFAULT_DOOR_METERS / avgWidth;
    if (!Number.isFinite(nextScale) || nextScale <= 0) {
      setScaleMessage("Auto-scale failed. Check door widths.");
      return;
    }
    setSceneScale(
      nextScale,
      createDoorHeuristicScaleInfo({
        value: nextScale,
        doorWidthAssumedMm: DEFAULT_DOOR_METERS * 1000,
        pxWidth: avgWidth,
        openingId: doorCandidates[0]?.id
      })
    );
    setScaleMessage(`Auto-scale: ${nextScale.toFixed(4)} m/px (low confidence, verify with measurement)`);
  };

  useEffect(() => {
    if (activeTool !== "measure") {
      setMeasureStart(null);
      setMeasureEnd(null);
      setMeasureCursor(null);
    }
  }, [activeTool]);

  const findClosestEndpoint = (point: [number, number]) => {
    let best: DragTarget | null = null;
    let minDistance = Number.POSITIVE_INFINITY;
    walls.forEach((wall) => {
      const startDist = Math.hypot(point[0] - wall.start[0], point[1] - wall.start[1]);
      if (startDist < minDistance) {
        minDistance = startDist;
        best = { kind: "wall-endpoint", wallId: wall.id, endpoint: "start" };
      }
      const endDist = Math.hypot(point[0] - wall.end[0], point[1] - wall.end[1]);
      if (endDist < minDistance) {
        minDistance = endDist;
        best = { kind: "wall-endpoint", wallId: wall.id, endpoint: "end" };
      }
    });
    return minDistance <= 12 ? best : null;
  };

  const findOpeningHit = (point: [number, number]) => {
    for (const opening of openings) {
      const wall = walls.find((candidate) => candidate.id === opening.wallId);
      if (!wall) continue;
      const { localX, localY } = toWallLocal(point, wall);
      const thickness = Math.max(6, Math.min(16, wall.thickness));
      const withinX = localX >= opening.offset && localX <= opening.offset + opening.width;
      const withinY = Math.abs(localY) <= thickness / 2 + 6;
      if (withinX && withinY) {
        return {
          kind: "opening",
          openingId: opening.id,
          grabOffset: clamp(localX - opening.offset, 0, opening.width)
        } satisfies DragTarget;
      }
    }
    return null;
  };

  const findClosestWall = (point: [number, number]) => {
    let best: { wallId: string; offset: number; length: number; distance: number } | null = null;
    walls.forEach((wall) => {
      const { localX, localY, length } = toWallLocal(point, wall);
      const clampedOffset = clamp(localX, 0, length);
      const distance = Math.abs(localY);
      if (!best || distance < best.distance) {
        best = { wallId: wall.id, offset: clampedOffset, length, distance };
      }
    });
    return best && best.distance <= 14 ? best : null;
  };

  const handlePointerDown = (event: KonvaEventObject<PointerEvent>) => {
    if (!imgObj) return;
    const point = toImagePoint(event);
    if (!point) return;

    if (activeTool === "measure") {
      if (!measureStart || measureEnd) {
        setMeasureStart(point);
        setMeasureEnd(null);
        setMeasureCursor(null);
        return;
      }
      setMeasureEnd(point);
      return;
    }

    if (activeTool === "add-wall") {
      if (!pendingWallStart) {
        setPendingWallStart(snapToEndpoints(point));
        return;
      }
      const [sx, sy] = pendingWallStart;
      const [ex, ey] = snapToAxis(snapToEndpoints(point), pendingWallStart);
      if (Math.hypot(ex - sx, ey - sy) < 4) {
        setPendingWallStart(null);
        return;
      }
      const id = `wall-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      setWalls([
        ...walls,
        {
          id,
          start: [sx, sy],
          end: [ex, ey],
          thickness: DEFAULT_WALL_THICKNESS,
          height: DEFAULT_WALL_HEIGHT,
          confidence: 1
        }
      ]);
      setPendingWallStart(null);
      return;
    }

    if (activeTool === "add-opening") {
      const wallHit = findClosestWall(point);
      if (!wallHit) return;
      const isWindow = Boolean(event.evt?.shiftKey);
      const width = isWindow ? DEFAULT_WINDOW_WIDTH : DEFAULT_DOOR_WIDTH;
      const height = isWindow ? DEFAULT_WINDOW_HEIGHT : DEFAULT_DOOR_HEIGHT;
      const rawOffset = clamp(wallHit.offset - width / 2, 0, Math.max(0, wallHit.length - width));
      const maxOffset = Math.max(0, wallHit.length - width);
      const offset =
        Math.abs(rawOffset) <= AXIS_SNAP_DISTANCE
          ? 0
          : Math.abs(maxOffset - rawOffset) <= AXIS_SNAP_DISTANCE
            ? maxOffset
            : rawOffset;
      const id = `open-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      setOpenings([
        ...openings,
        {
          id,
          wallId: wallHit.wallId,
          type: isWindow ? "window" : "door",
          offset,
          width,
          height,
          detectConfidence: 1,
          attachConfidence: 1,
          typeConfidence: 1
        }
      ]);
      return;
    }

    const hit = findOpeningHit(point) ?? findClosestEndpoint(point);
    if (hit) {
      setDragging(hit);
    }
  };

  const handlePointerMove = () => {
    if (!imgObj) return;
    const point = toImagePoint();
    if (!point) return;

    if (activeTool === "measure") {
      if (measureStart && !measureEnd) {
        setMeasureCursor(point);
      }
      return;
    }

    if (activeTool === "add-wall") {
      if (pendingWallStart) {
        const snapped = snapToAxis(snapToEndpoints(point), pendingWallStart);
        setCursorPoint(snapped);
      } else {
        setCursorPoint(point);
      }
      return;
    }

    if (!dragging) return;
    if (dragging.kind === "wall-endpoint") {
      const targetWall = walls.find((wall) => wall.id === dragging.wallId);
      if (!targetWall) return;
      const anchor = dragging.endpoint === "start" ? targetWall.end : targetWall.start;
      const snappedPoint = snapToAxis(
        snapToEndpoints(point, { wallId: dragging.wallId, endpoint: dragging.endpoint }),
        anchor
      );
      setWalls(
        walls.map((wall) =>
          wall.id === dragging.wallId
            ? {
                ...wall,
                [dragging.endpoint]: snappedPoint,
                confidence: Math.max(wall.confidence ?? 0, 0.9)
              }
            : wall
        )
      );
      return;
    }

    const opening = openings.find((item) => item.id === dragging.openingId);
    if (!opening) return;
    const wall = walls.find((candidate) => candidate.id === opening.wallId);
    if (!wall) return;
    const { localX, length } = toWallLocal(point, wall);
    const maxOffset = Math.max(0, length - opening.width);
    let nextOffset = clamp(localX - dragging.grabOffset, 0, maxOffset);
    if (Math.abs(nextOffset) <= AXIS_SNAP_DISTANCE) nextOffset = 0;
    if (Math.abs(maxOffset - nextOffset) <= AXIS_SNAP_DISTANCE) nextOffset = maxOffset;
    setOpenings(
      openings.map((item) =>
        item.id === opening.id
          ? {
              ...item,
              offset: nextOffset,
              attachConfidence: Math.max(item.attachConfidence ?? 0, 0.9)
            }
          : item
      )
    );
  };

  const handlePointerUp = () => {
    setDragging(null);
  };

  const wallLines = walls.map((wall) => ({
    id: wall.id,
    points: [wall.start[0], wall.start[1], wall.end[0], wall.end[1]],
    strokeWidth: wall.thickness,
    confidence: normalizeConfidence(wall.confidence, 1)
  }));

  const openingLines = openings
    .map((opening) => {
      const wall = walls.find((candidate) => candidate.id === opening.wallId);
      if (!wall) return null;
      const dx = wall.end[0] - wall.start[0];
      const dy = wall.end[1] - wall.start[1];
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      const startX = wall.start[0] + ux * opening.offset;
      const startY = wall.start[1] + uy * opening.offset;
      const endX = wall.start[0] + ux * (opening.offset + opening.width);
      const endY = wall.start[1] + uy * (opening.offset + opening.width);
      return {
        id: opening.id,
        type: opening.type,
        points: [startX, startY, endX, endY],
        thickness: wall.thickness + 2,
        confidence: getOpeningConfidence(opening)
      };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  const lowConfidenceWalls = wallLines.filter((line) => line.confidence < MEDIUM_CONFIDENCE).length;
  const lowConfidenceOpenings = openingLines.filter((line) => line.confidence < MEDIUM_CONFIDENCE).length;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0b] text-white">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-3 sm:p-4 lg:p-6 glass-dark border-b border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 lg:gap-6 min-w-0">
          <div className="space-y-1">
            <h3 className="text-lg font-outfit font-medium">Verify Floorplan</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em]">
              Adjust walls and openings before 3D generation
            </p>
          </div>
          <div className="hidden sm:block w-[1px] h-8 bg-white/10" />
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setActiveTool("select");
                setPendingWallStart(null);
              }}
              title="Select"
              className={`p-2.5 sm:p-3 rounded-xl transition-colors group shrink-0 ${activeTool === "select" ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              <MousePointer2 className="w-4 h-4 text-white/40 group-hover:text-white" />
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool((prev) => (prev === "add-wall" ? "select" : "add-wall"));
                setPendingWallStart(null);
              }}
              title="Add wall"
              className={`p-2.5 sm:p-3 rounded-xl transition-colors group shrink-0 ${activeTool === "add-wall" ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              <Plus className="w-4 h-4 text-white/40 group-hover:text-white" />
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool((prev) => (prev === "add-opening" ? "select" : "add-opening"));
                setPendingWallStart(null);
              }}
              title="Add opening (door/window)"
              className={`p-2.5 sm:p-3 rounded-xl transition-colors group shrink-0 ${activeTool === "add-opening" ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              <DoorOpen className="w-4 h-4 text-white/40 group-hover:text-white" />
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool((prev) => (prev === "measure" ? "select" : "measure"));
                setPendingWallStart(null);
              }}
              title="Measure and set scale"
              className={`p-2.5 sm:p-3 rounded-xl transition-colors group shrink-0 ${activeTool === "measure" ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              <Ruler className="w-4 h-4 text-white/40 group-hover:text-white" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (walls.length === 0) return;
                const nextWalls = walls.slice(0, -1);
                const wallIds = new Set(nextWalls.map((wall) => wall.id));
                setWalls(nextWalls);
                setOpenings(openings.filter((opening) => wallIds.has(opening.wallId)));
              }}
              title="Delete last wall"
              className="p-2.5 sm:p-3 rounded-xl hover:bg-white/5 transition-colors group shrink-0"
            >
              <Trash2 className="w-4 h-4 text-red-400 group-hover:text-red-300" />
            </button>
            <button
              type="button"
              onClick={() => {
                setWalls([]);
                setOpenings([]);
                setPendingWallStart(null);
                setActiveTool("select");
              }}
              title="Clear all"
              className="p-2.5 sm:p-3 rounded-xl hover:bg-white/5 transition-colors group shrink-0"
            >
              <RotateCcw className="w-4 h-4 text-white/40 group-hover:text-white" />
            </button>
          </div>
        </div>
        <div className="flex w-full lg:w-auto items-stretch sm:items-center gap-3 sm:gap-4 flex-col sm:flex-row">
          <div className="flex flex-col sm:items-end gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 sm:text-right">
              Scale: {sceneScale.toFixed(4)} m/px ({(sceneScale * 1000).toFixed(1)} mm/px)
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <input
                  type="number"
                  min="1"
                  value={measureInput}
                  onChange={(event) => setMeasureInput(event.target.value)}
                  className="w-24 sm:w-[120px] bg-transparent text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 outline-none"
                  placeholder="Length (mm)"
                />
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">mm</span>
              </div>
              <button
                type="button"
                onClick={applyScaleFromMeasurement}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/80 transition hover:text-white"
              >
                Set scale
              </button>
              <button
                type="button"
                onClick={applyScaleFromDoors}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60 transition hover:text-white"
              >
                Auto door
              </button>
            </div>
            {scaleMessage ? (
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 sm:text-right">{scaleMessage}</div>
            ) : null}
          </div>
          {showConfirmButton && (
            <button
              onClick={onConfirm}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#0a0a0b] font-bold text-xs uppercase tracking-[0.2em] rounded-xl hover:scale-105 transition-all"
            >
              <Check className="w-4 h-4" />
              {confirmLabel ?? "Confirm 3D Generation"}
            </button>
          )}
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <Layer>
            {imgObj && (
              <Group x={offset.x} y={offset.y} scale={{ x: scale, y: scale }}>
                <KonvaImage image={imgObj} opacity={0.55} />

                {measurement && (
                  <>
                    <Line
                      points={[measurement.start[0], measurement.start[1], measurement.end[0], measurement.end[1]]}
                      stroke="rgba(141, 214, 255, 0.8)"
                      strokeWidth={3}
                      lineCap="round"
                      listening={false}
                    />
                    <Text
                      x={measurement.labelPoint[0] + 8}
                      y={measurement.labelPoint[1] + 8}
                      text={`${measurement.distance.toFixed(1)} px`}
                      fontSize={12}
                      fill="rgba(141, 214, 255, 0.9)"
                    />
                  </>
                )}

                {wallLines.map((line) => (
                  <Line
                    key={line.id}
                    points={line.points}
                    stroke={getConfidenceColor(line.confidence)}
                    strokeWidth={line.strokeWidth}
                    lineCap="round"
                    lineJoin="round"
                    listening={false}
                  />
                ))}

                {openingLines.map((line) => (
                  <Line
                    key={line.id}
                    points={line.points}
                    stroke={getConfidenceColor(line.confidence)}
                    strokeWidth={line.thickness}
                    lineCap="round"
                    dash={line.type === "window" ? [10, 6] : undefined}
                    listening={false}
                  />
                ))}

                {walls.map((wall) => (
                  <React.Fragment key={`${wall.id}-handles`}>
                    <Circle x={wall.start[0]} y={wall.start[1]} radius={6} fill="#ffffff" listening={false} />
                    <Circle x={wall.end[0]} y={wall.end[1]} radius={6} fill="#ffffff" listening={false} />
                  </React.Fragment>
                ))}

                {activeTool === "add-wall" && pendingWallStart && cursorPoint && (
                  <Line
                    points={[pendingWallStart[0], pendingWallStart[1], cursorPoint[0], cursorPoint[1]]}
                    stroke="rgba(141, 214, 255, 0.9)"
                    strokeWidth={DEFAULT_WALL_THICKNESS}
                    dash={[8, 6]}
                    listening={false}
                  />
                )}
              </Group>
            )}
          </Layer>
        </Stage>

        <div className="absolute bottom-3 left-3 right-3 sm:bottom-8 sm:right-8 sm:left-auto sm:w-auto p-3 sm:p-4 glass-dark rounded-2xl pointer-events-none">
          <div className="flex items-center gap-3 text-[10px] text-white/60 tracking-widest uppercase">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            {activeTool === "add-wall" && "Click two points to add a wall"}
            {activeTool === "add-opening" && "Click wall to add door (Shift = window)"}
            {activeTool === "measure" && "Click two points to measure and set scale"}
            {activeTool === "select" &&
              (walls.length === 0 ? "No walls detected - use + to add" : "Drag endpoints or openings to refine")}
          </div>
          {activeTool === "select" && (lowConfidenceWalls > 0 || lowConfidenceOpenings > 0) && (
            <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-red-300/90">
              Low confidence: walls {lowConfidenceWalls}, openings {lowConfidenceOpenings}
            </div>
          )}
        </div>
        <div className="absolute bottom-20 left-3 right-3 sm:bottom-8 sm:left-8 sm:right-auto p-3 sm:p-4 glass-dark rounded-2xl pointer-events-none">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">Confidence</div>
          <div className="mt-2 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-white/60">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />High</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" />Medium</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />Low</span>
          </div>
        </div>
      </div>
    </div>
  );
}
