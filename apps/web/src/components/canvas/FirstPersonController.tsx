"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PointerLockControls as PointerLockControlsImpl } from "three-stdlib";
import { useShellSelector } from "../../lib/stores/scene-slices";

type KeyState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
};

export function FirstPersonController({
  enabled,
  controlsRef,
  spawnNonce = 0,
  height = 1.6,
  speed = 3,
  sprintMultiplier = 1.7
}: {
  enabled: boolean;
  controlsRef: React.RefObject<PointerLockControlsImpl | null>;
  spawnNonce?: number;
  height?: number;
  speed?: number;
  sprintMultiplier?: number;
}) {
  const { camera } = useThree();
  const walls = useShellSelector((slice) => slice.walls);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);

  const keysRef = useRef<KeyState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false
  });

  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const fallVelocityRef = useRef(0);

  const spawnPoint = useMemo((): { x: number; z: number; hasRooms: boolean } => {
    if (floors.length === 0) {
      if (walls.length === 0) return { x: 0, z: 0, hasRooms: false };

      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const w of walls) {
        minX = Math.min(minX, w.start[0], w.end[0]);
        maxX = Math.max(maxX, w.start[0], w.end[0]);
        minZ = Math.min(minZ, w.start[1], w.end[1]);
        maxZ = Math.max(maxZ, w.start[1], w.end[1]);
      }
      if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
        return { x: 0, z: 0, hasRooms: false };
      }
      return { x: ((minX + maxX) / 2) * scale, z: ((minZ + maxZ) / 2) * scale, hasRooms: false };
    }

    const polygonArea = (points: [number, number][]) => {
      let sum = 0;
      for (let i = 0; i < points.length; i += 1) {
        const [x1, z1] = points[i]!;
        const [x2, z2] = points[(i + 1) % points.length]!;
        sum += x1 * z2 - x2 * z1;
      }
      return sum / 2;
    };

    const polygonCentroid = (points: [number, number][]) => {
      const a = polygonArea(points);
      if (!Number.isFinite(a) || Math.abs(a) < 1e-6) {
        const avg = points.reduce(
          (acc, p) => {
            acc.x += p[0];
            acc.z += p[1];
            return acc;
          },
          { x: 0, z: 0 }
        );
        return { x: avg.x / points.length, z: avg.z / points.length, area: 0 };
      }

      let cx = 0;
      let cz = 0;
      for (let i = 0; i < points.length; i += 1) {
        const [x1, z1] = points[i]!;
        const [x2, z2] = points[(i + 1) % points.length]!;
        const cross = x1 * z2 - x2 * z1;
        cx += (x1 + x2) * cross;
        cz += (z1 + z2) * cross;
      }
      const factor = 1 / (6 * a);
      return { x: cx * factor, z: cz * factor, area: Math.abs(a) };
    };

    let best = { x: 0, z: 0, area: -Infinity };
    for (const floor of floors) {
      const points = floor.outline;
      if (!points || points.length < 3) continue;

      const verts =
        points.length > 3 && points[0]![0] === points[points.length - 1]![0] && points[0]![1] === points[points.length - 1]![1]
          ? points.slice(0, -1)
          : points;

      if (verts.length < 3) continue;
      const centroid = polygonCentroid(verts);
      const area = centroid.area;
      if (area > best.area) {
        best = centroid;
      }
    }

    if (!Number.isFinite(best.area) || best.area < 0) return { x: 0, z: 0, hasRooms: false };
    if (!Number.isFinite(best.x) || !Number.isFinite(best.z)) return { x: 0, z: 0, hasRooms: false };
    return { x: best.x * scale, z: best.z * scale, hasRooms: true };
  }, [walls, floors, scale]);

  useEffect(() => {
    if (!enabled) return;
    const y = spawnPoint.hasRooms ? height : 5;
    camera.position.set(spawnPoint.x, y, spawnPoint.z);
    fallVelocityRef.current = 0;
  }, [camera, enabled, height, spawnNonce, spawnPoint.hasRooms, spawnPoint.x, spawnPoint.z]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "W") keysRef.current.forward = true;
      if (e.key === "s" || e.key === "S") keysRef.current.backward = true;
      if (e.key === "a" || e.key === "A") keysRef.current.left = true;
      if (e.key === "d" || e.key === "D") keysRef.current.right = true;
      if (e.key === "Shift") keysRef.current.sprint = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "W") keysRef.current.forward = false;
      if (e.key === "s" || e.key === "S") keysRef.current.backward = false;
      if (e.key === "a" || e.key === "A") keysRef.current.left = false;
      if (e.key === "d" || e.key === "D") keysRef.current.right = false;
      if (e.key === "Shift") keysRef.current.sprint = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame((_state, delta) => {
    if (!enabled) return;
    const controls = controlsRef.current;
    if (!controls?.isLocked) return;

    const keys = keysRef.current;
    const moving = keys.forward || keys.backward || keys.left || keys.right;
    const y = camera.position.y;
    if (y > height) {
      fallVelocityRef.current -= 18 * delta;
      camera.position.y = Math.max(height, y + fallVelocityRef.current * delta);
    } else {
      fallVelocityRef.current = 0;
      camera.position.y = height;
    }
    if (!moving) return;

    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() === 0) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }

    right.copy(forward).cross(up).normalize();

    dir.set(0, 0, 0);
    if (keys.forward) dir.add(forward);
    if (keys.backward) dir.sub(forward);
    if (keys.right) dir.add(right);
    if (keys.left) dir.sub(right);
    if (dir.lengthSq() > 0) dir.normalize();

    const v = speed * (keys.sprint ? sprintMultiplier : 1);
    camera.position.addScaledVector(dir, v * delta);
  });

  return null;
}
