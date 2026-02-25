"use client";

import { MapControls, OrthographicCamera, PerspectiveCamera, PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useSceneStore } from "../../../lib/stores/useSceneStore";
import { useMobileControlsStore } from "../../../lib/stores/useMobileControlsStore";

type MoveState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
};

const WALK_SPEED = 3.5;
const BODY_Y = 1;
const EYE_HEIGHT = 0.6;

function computeBounds(walls: { start: [number, number]; end: [number, number] }[], scale: number) {
  if (walls.length === 0) {
    return { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  walls.forEach((wall) => {
    [wall.start, wall.end].forEach(([x, z]) => {
      const scaledX = x * scale;
      const scaledZ = z * scale;
      minX = Math.min(minX, scaledX);
      maxX = Math.max(maxX, scaledX);
      minZ = Math.min(minZ, scaledZ);
      maxZ = Math.max(maxZ, scaledZ);
    });
  });

  return { minX, maxX, minZ, maxZ };
}

function WalkRig({
  initialPosition,
  isTouch
}: {
  initialPosition: [number, number, number];
  isTouch: boolean;
}) {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const pointerLockRef = useRef<any>(null);
  const moveState = useRef<MoveState>({ forward: false, backward: false, left: false, right: false });
  const { camera } = useThree();
  const resetLookDelta = useMobileControlsStore((state) => state.resetLookDelta);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);

  useEffect(() => {
    if (isTouch) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyW") moveState.current.forward = true;
      if (event.code === "KeyS") moveState.current.backward = true;
      if (event.code === "KeyA") moveState.current.left = true;
      if (event.code === "KeyD") moveState.current.right = true;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "KeyW") moveState.current.forward = false;
      if (event.code === "KeyS") moveState.current.backward = false;
      if (event.code === "KeyA") moveState.current.left = false;
      if (event.code === "KeyD") moveState.current.right = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isTouch]);

  useFrame(() => {
    if (!pointerLockRef.current?.isLocked && !isTouch) return;
    const body = bodyRef.current;
    if (!body) return;
    if (isTouch) {
      const { lookDelta } = useMobileControlsStore.getState();
      if (lookDelta.x !== 0 || lookDelta.y !== 0) {
        yawRef.current -= lookDelta.x * 0.002;
        pitchRef.current -= lookDelta.y * 0.002;
        pitchRef.current = Math.max(-1.2, Math.min(1.2, pitchRef.current));
        camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");
        resetLookDelta();
      }
    }
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    if (direction.lengthSq() === 0) return;
    direction.normalize();
    const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

    const movement = new THREE.Vector3();
    if (isTouch) {
      const { move } = useMobileControlsStore.getState();
      const forward = -move.y;
      const strafe = move.x;
      if (Math.abs(forward) > 0.01) movement.add(direction.clone().multiplyScalar(forward));
      if (Math.abs(strafe) > 0.01) movement.add(right.clone().multiplyScalar(strafe));
    } else {
      if (moveState.current.forward) movement.add(direction);
      if (moveState.current.backward) movement.sub(direction);
      if (moveState.current.left) movement.sub(right);
      if (moveState.current.right) movement.add(right);
    }

    const current = body.linvel();
    if (movement.lengthSq() > 0) {
      movement.normalize();
      body.setLinvel({ x: movement.x * WALK_SPEED, y: current.y, z: movement.z * WALK_SPEED }, true);
    } else {
      body.setLinvel({ x: 0, y: current.y, z: 0 }, true);
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={initialPosition}
      colliders={false}
      enabledRotations={[false, false, false]}
      linearDamping={0.85}
    >
      <CapsuleCollider args={[0.35, 0.6]} />
      <group position={[0, EYE_HEIGHT, 0]}>
        <PerspectiveCamera makeDefault fov={60} near={0.1} far={1000} />
        {!isTouch ? <PointerLockControls ref={pointerLockRef} /> : null}
      </group>
    </RigidBody>
  );
}

export default function CameraRig() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const isTransforming = useEditorStore((state) => state.isTransforming);
  const { walls, openings, entranceId, scale } = useSceneStore();
  const [isTouch, setIsTouch] = useState(false);

  const orthoRef = useRef<THREE.OrthographicCamera | null>(null);
  const bounds = useMemo(() => computeBounds(walls, scale), [walls, scale]);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const radius = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 1);
  const topHeight = Math.max(6, radius);
  const zoom = Math.max(30, 120 / radius);

  const initialPosition = useMemo((): [number, number, number] => {
    const entrance =
      (entranceId ? openings.find((o) => o.id === entranceId) : null) ??
      openings.find((o) => o.type === "door");
    if (entrance) {
      const wall = walls.find((w) => w.id === entrance.wallId);
      if (wall) {
        const dx = wall.end[0] - wall.start[0];
        const dz = wall.end[1] - wall.start[1];
        const length = Math.sqrt(dx * dx + dz * dz);
        const ratio = length > 0 ? entrance.offset / length : 0;
        return [
          (wall.start[0] + dx * ratio) * scale,
          BODY_Y,
          (wall.start[1] + dz * ratio) * scale
        ];
      }
    }
    return [centerX, BODY_Y, centerZ + radius * 0.4];
  }, [entranceId, openings, walls, scale, centerX, centerZ, radius]);

  useEffect(() => {
    const supportsTouch = typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0);
    setIsTouch(Boolean(supportsTouch));
  }, []);

  useEffect(() => {
    if (viewMode === "top" && orthoRef.current) {
      orthoRef.current.position.set(centerX, topHeight, centerZ);
      orthoRef.current.up.set(0, 0, -1);
      orthoRef.current.lookAt(centerX, 0, centerZ);
      orthoRef.current.updateProjectionMatrix();
    }
  }, [centerX, centerZ, topHeight, viewMode]);

  if (viewMode === "walk") {
    return <WalkRig initialPosition={initialPosition} isTouch={isTouch} />;
  }

  return (
    <>
      <OrthographicCamera ref={orthoRef} makeDefault zoom={zoom} near={0.1} far={2000} />
      <MapControls
        target={[centerX, 0, centerZ]}
        enabled={!isTransforming}
        enableRotate={false}
        enableDamping
        dampingFactor={0.1}
        maxPolarAngle={Math.PI / 2}
        minPolarAngle={0}
      />
    </>
  );
}
