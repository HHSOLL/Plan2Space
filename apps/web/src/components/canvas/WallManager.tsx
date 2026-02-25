"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { useSceneStore } from "../../lib/stores/useSceneStore";

type BuiltWall = {
  id: string;
  mesh: THREE.Mesh;
  dispose: () => void;
};

type BuiltFloor = {
  id: string;
  mesh: THREE.Mesh;
  dispose: () => void;
};

type TextureSet = {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
  roughnessMap: THREE.Texture;
};

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSolidTexture(color: THREE.ColorRepresentation) {
  const data = new Uint8Array(4);
  const c = new THREE.Color(color);
  data[0] = Math.round(c.r * 255);
  data[1] = Math.round(c.g * 255);
  data[2] = Math.round(c.b * 255);
  data[3] = 255;
  const texture = new THREE.DataTexture(data, 1, 1);
  texture.needsUpdate = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createCanvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, colorSpace?: THREE.ColorSpace) {
  if (typeof document === "undefined") {
    const fallback = createSolidTexture("#ffffff");
    if (colorSpace) fallback.colorSpace = colorSpace;
    return fallback;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = createSolidTexture("#ffffff");
    if (colorSpace) fallback.colorSpace = colorSpace;
    return fallback;
  }
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  if (colorSpace) texture.colorSpace = colorSpace;
  return texture;
}

function createWoodTextureSet(size = 512): TextureSet {
  const rand = mulberry32(13);
  const map = createCanvasTexture(
    size,
    (ctx, s) => {
      ctx.fillStyle = "#d9c8ae";
      ctx.fillRect(0, 0, s, s);

      const plankCount = 10;
      const plankW = s / plankCount;
      for (let i = 0; i < plankCount; i += 1) {
        const hueJitter = (rand() - 0.5) * 6;
        const lightJitter = (rand() - 0.5) * 10;
        ctx.fillStyle = `hsl(${30 + hueJitter}deg 35% ${78 + lightJitter}%)`;
        ctx.fillRect(i * plankW, 0, plankW + 1, s);

        ctx.strokeStyle = "rgba(98, 74, 52, 0.18)";
        ctx.lineWidth = 1;
        for (let g = 0; g < 14; g += 1) {
          const x = i * plankW + rand() * plankW;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.bezierCurveTo(x + (rand() - 0.5) * 18, s * 0.33, x + (rand() - 0.5) * 18, s * 0.66, x, s);
          ctx.stroke();
        }

        if (rand() > 0.72) {
          const cx = i * plankW + rand() * plankW;
          const cy = rand() * s;
          ctx.fillStyle = "rgba(92, 66, 45, 0.22)";
          ctx.beginPath();
          ctx.arc(cx, cy, 8 + rand() * 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = "rgba(50, 35, 25, 0.25)";
      ctx.lineWidth = 2;
      for (let i = 1; i < plankCount; i += 1) {
        const x = i * plankW;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, s);
        ctx.stroke();
      }

      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 1800; i += 1) {
        const x = rand() * s;
        const y = rand() * s;
        const r = rand() * 1.6;
        ctx.fillStyle = `rgba(255,255,255,${rand() * 0.35})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    THREE.SRGBColorSpace
  );

  const bumpMap = createCanvasTexture(size, (ctx, s) => {
    const randLocal = mulberry32(1309);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y += 1) {
      for (let x = 0; x < s; x += 1) {
        const i = (y * s + x) * 4;
        const n = (randLocal() * 0.6 + randLocal() * 0.4) * 255;
        img.data[i] = n;
        img.data[i + 1] = n;
        img.data[i + 2] = n;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    const plankCount = 10;
    const plankW = s / plankCount;
    for (let i = 1; i < plankCount; i += 1) {
      ctx.fillRect(i * plankW - 1, 0, 2, s);
    }
    ctx.globalCompositeOperation = "source-over";
  });

  const roughnessMap = createCanvasTexture(size, (ctx, s) => {
    const randLocal = mulberry32(721);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y += 1) {
      for (let x = 0; x < s; x += 1) {
        const i = (y * s + x) * 4;
        const n = (0.68 + (randLocal() - 0.5) * 0.22) * 255;
        img.data[i] = n;
        img.data[i + 1] = n;
        img.data[i + 2] = n;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  return { map, bumpMap, roughnessMap };
}

function createPlasterTextureSet(size = 512): TextureSet {
  const map = createCanvasTexture(
    size,
    (ctx, s) => {
      ctx.fillStyle = "#f3efe7";
      ctx.fillRect(0, 0, s, s);
      const rand = mulberry32(42);

      const img = ctx.createImageData(s, s);
      for (let y = 0; y < s; y += 1) {
        for (let x = 0; x < s; x += 1) {
          const i = (y * s + x) * 4;
          const n = (0.96 + (rand() - 0.5) * 0.06) * 255;
          img.data[i] = n;
          img.data[i + 1] = n;
          img.data[i + 2] = n;
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);

      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "rgba(210, 205, 195, 0.55)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 18; i += 1) {
        const y = rand() * s;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(s * 0.25, y + (rand() - 0.5) * 22, s * 0.75, y + (rand() - 0.5) * 22, s, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    THREE.SRGBColorSpace
  );

  const bumpMap = createCanvasTexture(size, (ctx, s) => {
    const rand = mulberry32(99);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y += 1) {
      for (let x = 0; x < s; x += 1) {
        const i = (y * s + x) * 4;
        const n = (0.5 + (rand() - 0.5) * 0.28) * 255;
        img.data[i] = n;
        img.data[i + 1] = n;
        img.data[i + 2] = n;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const roughnessMap = createCanvasTexture(size, (ctx, s) => {
    const rand = mulberry32(123);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y += 1) {
      for (let x = 0; x < s; x += 1) {
        const i = (y * s + x) * 4;
        const n = (0.84 + (rand() - 0.5) * 0.18) * 255;
        img.data[i] = n;
        img.data[i + 1] = n;
        img.data[i + 2] = n;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  return { map, bumpMap, roughnessMap };
}

function applyFloorUVs(geometry: THREE.BufferGeometry, metersPerTile = 1) {
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) return;

  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv[i * 2] = x / metersPerTile;
    uv[i * 2 + 1] = y / metersPerTile;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

function applyWallUVs(geometry: THREE.BufferGeometry, from: [number, number], to: [number, number], metersPerTile = 1) {
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) return;

  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  if (!Number.isFinite(length) || length < 1e-6) return;
  const dirX = dx / length;
  const dirZ = dz / length;

  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const along = (x - from[0]) * dirX + (z - from[1]) * dirZ;
    uv[i * 2] = along / metersPerTile;
    uv[i * 2 + 1] = y / metersPerTile;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

function createWallMesh(
  wallData: { id: string; start: [number, number]; end: [number, number]; thickness: number; height: number },
  openings: Array<{ id: string; wallId: string; type: "door" | "window"; offset: number; width: number; height: number; verticalOffset?: number; sillHeight?: number }>,
  wallMaterial: THREE.Material
): BuiltWall | null {
  const { start, end, thickness, height, id: wallId } = wallData;

  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  if (!Number.isFinite(length) || length < 0.001) return null;

  const angle = Math.atan2(dz, dx);
  const dirX = dx / length;
  const dirZ = dz / length;

  const geometriesToDispose = new Set<THREE.BufferGeometry>();

  const wallThickness = Number.isFinite(thickness) ? thickness : 0.2;
  const wallHeight = Number.isFinite(height) ? height : 2.7;

  const wallBrush = new Brush(new THREE.BoxGeometry(length, wallHeight, wallThickness), wallMaterial);
  geometriesToDispose.add(wallBrush.geometry);

  const midX = (start[0] + end[0]) / 2;
  const midZ = (start[1] + end[1]) / 2;
  wallBrush.position.set(midX, wallHeight / 2, midZ);
  wallBrush.rotation.set(0, angle, 0);
  wallBrush.updateMatrixWorld(true);

  let current: Brush = wallBrush;
  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  const wallOpenings = openings.filter((o) => o.wallId === wallId);
  for (const opening of wallOpenings) {
    const openingWidth = Math.max(0, opening.width);
    const openingHeight = Math.max(0, opening.height);
    if (openingWidth < 0.01 || openingHeight < 0.01) continue;

    const width = Math.min(openingWidth, length - opening.offset);
    if (width < 0.01) continue;

    const bottom = opening.type === "window" ? Math.max(0, opening.sillHeight ?? opening.verticalOffset ?? 0.8) : (opening.verticalOffset ?? 0);
    const usableHeight = Math.max(0, wallHeight - bottom);
    const holeHeight = Math.min(openingHeight, usableHeight);
    if (holeHeight < 0.01) continue;

    const centerDistance = opening.offset + width / 2;
    const centerX = start[0] + dirX * centerDistance;
    const centerZ = start[1] + dirZ * centerDistance;
    const centerY = bottom + holeHeight / 2;

    const depth = wallThickness + 0.06;
    const holeBrush = new Brush(new THREE.BoxGeometry(width, holeHeight, depth));
    geometriesToDispose.add(holeBrush.geometry);
    holeBrush.position.set(centerX, centerY, centerZ);
    holeBrush.rotation.set(0, angle, 0);
    holeBrush.updateMatrixWorld(true);

    current = evaluator.evaluate(current, holeBrush, SUBTRACTION);
    geometriesToDispose.add(current.geometry);
    current.material = wallMaterial;
    current.updateMatrixWorld(true);
  }

  const mesh = current as unknown as THREE.Mesh;
  if (mesh.geometry && (mesh.geometry as THREE.BufferGeometry).attributes?.position) {
    const g = mesh.geometry as THREE.BufferGeometry;
    applyWallUVs(g, start, end, 1);
    g.computeVertexNormals();
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return {
    id: wallId,
    mesh,
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
    }
  };
}

function createRoomFloorMesh(room: { id: string; outline: [number, number][]; materialId: string | null }, material: THREE.Material): BuiltFloor | null {
  const vertices = room.outline;
  if (!vertices || vertices.length < 3) return null;

  const points =
    vertices.length > 3 && vertices[0]![0] === vertices[vertices.length - 1]![0] && vertices[0]![1] === vertices[vertices.length - 1]![1]
      ? vertices.slice(0, -1)
      : vertices;
  if (points.length < 3) return null;

  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    const p = new THREE.Vector2(x, -z);
    if (index === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  });
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  applyFloorUVs(geometry, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  mesh.receiveShadow = true;

  return {
    id: room.id,
    mesh,
    dispose: () => {
      geometry.dispose();
    }
  };
}

export function WallManager() {
  const walls = useSceneStore((s) => s.walls);
  const openings = useSceneStore((s) => s.openings);
  const floors = useSceneStore((s) => s.floors);

  const wood = useMemo(() => createWoodTextureSet(512), []);
  const plaster = useMemo(() => createPlasterTextureSet(512), []);

  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#ffffff"),
        map: plaster.map,
        roughnessMap: plaster.roughnessMap,
        bumpMap: plaster.bumpMap,
        roughness: 0.86,
        bumpScale: 0.035,
        metalness: 0.02,
        side: THREE.DoubleSide
      }),
    [plaster.bumpMap, plaster.map, plaster.roughnessMap]
  );

  const floorMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        map: wood.map,
        roughnessMap: wood.roughnessMap,
        bumpMap: wood.bumpMap,
        roughness: 0.72,
        bumpScale: 0.04,
        metalness: 0.02,
        side: THREE.DoubleSide
      }),
    [wood.bumpMap, wood.map, wood.roughnessMap]
  );

  const builtFloors = useMemo(() => {
    if (!floors || floors.length === 0) return [] as BuiltFloor[];

    return floors
      .map((room) => {
        try {
          return createRoomFloorMesh(room, floorMaterial);
        } catch (error) {
          console.error("Failed to create room floor mesh:", error);
          return null;
        }
      })
      .filter(Boolean) as BuiltFloor[];
  }, [floorMaterial, floors]);

  const builtWalls = useMemo(() => {
    if (!walls || walls.length === 0) return [] as BuiltWall[];

    return walls
      .map((wallData) => {
        try {
          return createWallMesh(wallData, openings, wallMaterial);
        } catch (error) {
          console.error("Failed to create wall mesh:", error);
          return null;
        }
      })
      .filter(Boolean) as BuiltWall[];
  }, [openings, wallMaterial, walls]);

  useEffect(() => {
    return () => {
      for (const wall of builtWalls) wall.dispose();
    };
  }, [builtWalls]);

  useEffect(() => {
    return () => {
      for (const floor of builtFloors) floor.dispose();
    };
  }, [builtFloors]);

  useEffect(() => {
    return () => {
      wallMaterial.dispose();
    };
  }, [wallMaterial]);

  useEffect(() => {
    return () => {
      floorMaterial.dispose();
    };
  }, [floorMaterial]);

  useEffect(() => {
    return () => {
      wood.map.dispose();
      wood.bumpMap.dispose();
      wood.roughnessMap.dispose();
    };
  }, [wood]);

  useEffect(() => {
    return () => {
      plaster.map.dispose();
      plaster.bumpMap.dispose();
      plaster.roughnessMap.dispose();
    };
  }, [plaster]);

  if ((!builtWalls || builtWalls.length === 0) && (!builtFloors || builtFloors.length === 0)) {
    return (
      <>
        <mesh position={[0, 1.35, -15]} receiveShadow>
          <planeGeometry args={[30, 2.7]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>

        <mesh position={[-15, 1.35, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[30, 2.7]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>
      </>
    );
  }

  return (
    <>
      {builtFloors.map((floor) => (
        <primitive key={`floor-${floor.id}`} object={floor.mesh} />
      ))}
      {builtWalls.map((wall) => (
        <primitive key={wall.id} object={wall.mesh} castShadow receiveShadow />
      ))}
    </>
  );
}
