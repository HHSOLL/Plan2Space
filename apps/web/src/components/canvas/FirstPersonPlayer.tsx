"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PointerLockControls as PointerLockControlsImpl } from "three-stdlib";

type KeyState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
};

export function FirstPersonPlayer({
  enabled,
  controlsRef,
  height = 1.6,
  speed = 3
}: {
  enabled: boolean;
  controlsRef: React.RefObject<PointerLockControlsImpl | null>;
  height?: number;
  speed?: number;
}) {
  const { camera } = useThree();

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
    if (!moving) {
      camera.position.y = height;
      return;
    }

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

    const sprintMultiplier = keys.sprint ? 1.7 : 1;
    const v = speed * sprintMultiplier;
    camera.position.addScaledVector(dir, v * delta);
    camera.position.y = height;
  });

  return null;
}

