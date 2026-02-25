"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useSceneStore } from "../../../lib/stores/useSceneStore";
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

function DoorLeaf({ door }: { door: DoorSpec }) {
  const registry = useInteractionRegistry();
  const rootRef = useRef<THREE.Group | null>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const openAngle = -Math.PI / 2;

  useEffect(() => {
    if (!pivotRef.current) return;
    gsap.to(pivotRef.current.rotation, {
      y: isOpen ? openAngle : 0,
      duration: 0.6,
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
    <group ref={rootRef} position={[door.position[0], door.bottomOffset, door.position[2]]} rotation={[0, door.angle, 0]}>
      <group ref={pivotRef}>
        <mesh ref={meshRef} position={[door.width / 2, door.height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[door.width, door.height, door.thickness]} />
          <meshStandardMaterial color="#c7b79f" roughness={0.55} metalness={0.05} />
        </mesh>
      </group>
    </group>
  );
}

export default function InteractiveDoors() {
  const walls = useSceneStore((state) => state.walls);
  const openings = useSceneStore((state) => state.openings);
  const scale = useSceneStore((state) => state.scale);

  const doors = useMemo(() => {
    return openings
      .filter((opening) => opening.type === "door")
      .map((opening) => {
        const wall = walls.find((item) => item.id === opening.wallId);
        if (!wall) return null;
        const dx = wall.end[0] - wall.start[0];
        const dz = wall.end[1] - wall.start[1];
        const length = Math.hypot(dx, dz);
        if (!Number.isFinite(length) || length <= 0) return null;
        const angle = Math.atan2(dz, dx);
        const ux = dx / length;
        const uz = dz / length;
        const width = Math.max(0.6, opening.width * scale);
        const height = Math.max(1.9, opening.height * scale);
        const thickness = Math.max(0.04, wall.thickness * scale * 0.35);
        const offset = Math.min(Math.max(0, opening.offset * scale), Math.max(0, length - width));
        const bottomOffset =
          typeof opening.verticalOffset === "number"
            ? opening.verticalOffset * scale
            : typeof opening.sillHeight === "number"
              ? opening.sillHeight * scale
              : 0;
        const position: [number, number, number] = [
          wall.start[0] * scale + ux * offset,
          0,
          wall.start[1] * scale + uz * offset
        ];
        return {
          id: opening.id,
          position,
          angle,
          width,
          height,
          thickness,
          bottomOffset
        } satisfies DoorSpec;
      })
      .filter((entry): entry is DoorSpec => Boolean(entry));
  }, [openings, scale, walls]);

  if (doors.length === 0) return null;

  return (
    <group>
      {doors.map((door) => (
        <DoorLeaf key={door.id} door={door} />
      ))}
    </group>
  );
}
