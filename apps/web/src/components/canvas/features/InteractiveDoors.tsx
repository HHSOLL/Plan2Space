"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useShellSelector } from "../../../lib/stores/scene-slices";
import { getWallRenderPlacement } from "../../../lib/geometry/wall-placement";
import { useInteractionRegistry } from "../interaction/InteractionManager";

type DoorSpec = {
  id: string;
  position: [number, number, number];
  angle: number;
  width: number;
  height: number;
  thickness: number;
  bottomOffset: number;
};

type WindowSpec = {
  id: string;
  position: [number, number, number];
  angle: number;
  width: number;
  height: number;
  thickness: number;
  sillHeight: number;
};

function DoorLeaf({ door }: { door: DoorSpec }) {
  const registry = useInteractionRegistry();
  const rootRef = useRef<THREE.Group | null>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const openAngle = -Math.PI / 2.2;
  const frameThickness = Math.max(0.05, door.thickness * 0.8);
  const jambWidth = Math.max(0.06, door.width * 0.045);
  const headerHeight = Math.max(0.08, door.height * 0.05);

  useEffect(() => {
    if (!pivotRef.current) return;
    gsap.to(pivotRef.current.rotation, {
      y: isOpen ? openAngle : 0,
      duration: 0.55,
      ease: "power2.out"
    });
  }, [isOpen, openAngle]);

  useEffect(() => {
    const group = rootRef.current;
    if (!group) return;
    group.userData.interactive = true;
    group.userData.interactionLabel = "Door";
    group.userData.onInteract = () => setIsOpen((prev) => !prev);
    if (meshRef.current) {
      group.userData.highlightMesh = meshRef.current;
    }
    registry?.register(group);
    return () => registry?.unregister(group);
  }, [registry]);

  return (
    <group ref={rootRef} name={`door:${door.id}`} position={door.position} rotation={[0, door.angle, 0]}>
      <group position={[0, door.bottomOffset, 0]}>
        <mesh position={[door.width / 2, door.height + headerHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[door.width + jambWidth * 2, headerHeight, frameThickness]} />
          <meshStandardMaterial color="#f1ece4" roughness={0.72} />
        </mesh>
        <mesh position={[-jambWidth / 2, door.height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[jambWidth, door.height, frameThickness]} />
          <meshStandardMaterial color="#f1ece4" roughness={0.72} />
        </mesh>
        <mesh position={[door.width + jambWidth / 2, door.height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[jambWidth, door.height, frameThickness]} />
          <meshStandardMaterial color="#f1ece4" roughness={0.72} />
        </mesh>
        <group ref={pivotRef}>
          <mesh ref={meshRef} position={[door.width / 2, door.height / 2, frameThickness * 0.15]} castShadow receiveShadow>
            <boxGeometry args={[door.width, door.height, door.thickness]} />
            <meshStandardMaterial color="#d8c7b1" roughness={0.56} metalness={0.04} />
          </mesh>
          <mesh position={[door.width * 0.84, door.height / 2, door.thickness * 0.65]} castShadow receiveShadow>
            <sphereGeometry args={[Math.max(0.018, door.width * 0.018), 18, 18]} />
            <meshStandardMaterial color="#8d8f93" roughness={0.28} metalness={0.82} />
          </mesh>
          <mesh position={[door.width * 0.46, door.height * 0.62, door.thickness * 0.55]} castShadow receiveShadow>
            <boxGeometry args={[door.width * 0.48, door.height * 0.18, door.thickness * 0.12]} />
            <meshStandardMaterial color="#ccb99c" roughness={0.68} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function WindowFrame({ window }: { window: WindowSpec }) {
  const frameDepth = Math.max(0.05, window.thickness * 0.78);
  const frameWidth = Math.max(0.045, window.width * 0.04);
  const mullionWidth = Math.max(0.035, window.width * 0.03);

  return (
    <group name={`window:${window.id}`} position={window.position} rotation={[0, window.angle, 0]}>
      <group position={[0, window.sillHeight, 0]}>
        <mesh position={[window.width / 2, window.height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[window.width + frameWidth * 2, window.height + frameWidth * 2, frameDepth]} />
          <meshStandardMaterial color="#f1f2f4" roughness={0.42} metalness={0.08} />
        </mesh>
        <mesh position={[window.width / 2, window.height / 2, frameDepth * 0.18]} castShadow receiveShadow>
          <boxGeometry args={[window.width - frameWidth * 1.2, window.height - frameWidth * 1.2, frameDepth * 0.28]} />
          <meshStandardMaterial
            color="#d9ebf6"
            transparent
            opacity={0.44}
            roughness={0.08}
            metalness={0.1}
          />
        </mesh>
        <mesh position={[window.width / 2, window.height / 2, frameDepth * 0.22]} castShadow receiveShadow>
          <boxGeometry args={[mullionWidth, window.height - frameWidth, frameDepth * 0.34]} />
          <meshStandardMaterial color="#f7f8f9" roughness={0.36} metalness={0.06} />
        </mesh>
        <mesh position={[window.width / 2, window.height / 2, frameDepth * 0.22]} castShadow receiveShadow>
          <boxGeometry args={[window.width - frameWidth, mullionWidth, frameDepth * 0.34]} />
          <meshStandardMaterial color="#f7f8f9" roughness={0.36} metalness={0.06} />
        </mesh>
      </group>
    </group>
  );
}

export default function InteractiveDoors() {
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);

  const doorSpecs = useMemo(() => {
    return openings
      .filter((opening) => opening.type === "door")
      .map((opening) => {
        const wall = walls.find((item) => item.id === opening.wallId);
        if (!wall) return null;
        const placement = getWallRenderPlacement(wall, floors, scale);
        const length = placement.length;
        if (!Number.isFinite(length) || length <= 0) return null;
        const width = Math.max(0.72, opening.width * scale);
        const height = Math.max(1.95, opening.height * scale);
        const thickness = Math.max(0.045, wall.thickness * scale * 0.34);
        const offset = Math.min(Math.max(0, opening.offset * scale + placement.startInset), Math.max(0, length - width));
        const bottomOffset = typeof opening.verticalOffset === "number" ? opening.verticalOffset * scale : 0;
        const startX = placement.start[0] + placement.direction[0] * offset;
        const startZ = placement.start[1] + placement.direction[1] * offset;

        return {
          id: opening.id,
          position: [startX, 0, startZ] as [number, number, number],
          angle: -placement.angle,
          width,
          height,
          thickness,
          bottomOffset
        } satisfies DoorSpec;
      })
      .filter((entry): entry is DoorSpec => Boolean(entry));
  }, [floors, openings, scale, walls]);

  const windowSpecs = useMemo(() => {
    return openings
      .filter((opening) => opening.type === "window")
      .map((opening) => {
        const wall = walls.find((item) => item.id === opening.wallId);
        if (!wall) return null;
        const placement = getWallRenderPlacement(wall, floors, scale);
        const length = placement.length;
        if (!Number.isFinite(length) || length <= 0) return null;
        const width = Math.max(0.92, opening.width * scale);
        const height = Math.max(0.88, opening.height * scale);
        const thickness = Math.max(0.04, wall.thickness * scale * 0.45);
        const offset = Math.min(Math.max(0, opening.offset * scale + placement.startInset), Math.max(0, length - width));
        const sillHeight = typeof opening.sillHeight === "number" ? opening.sillHeight * scale : 0.9;
        const startX = placement.start[0] + placement.direction[0] * offset;
        const startZ = placement.start[1] + placement.direction[1] * offset;

        return {
          id: opening.id,
          position: [startX, 0, startZ] as [number, number, number],
          angle: -placement.angle,
          width,
          height,
          thickness,
          sillHeight
        } satisfies WindowSpec;
      })
      .filter((entry): entry is WindowSpec => Boolean(entry));
  }, [floors, openings, scale, walls]);

  if (doorSpecs.length === 0 && windowSpecs.length === 0) return null;

  return (
    <group>
      {doorSpecs.map((door) => (
        <DoorLeaf key={door.id} door={door} />
      ))}
      {windowSpecs.map((window) => (
        <WindowFrame key={window.id} window={window} />
      ))}
    </group>
  );
}
