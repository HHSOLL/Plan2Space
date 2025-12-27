import * as THREE from 'three';
import type { DesignDoc } from '@webinterior/shared/types';
import { makeWoodTexture, makeTileTexture } from '../materials/ProceduralTextures';
import WallBuilder from './WallBuilder';

export interface ApartmentConfig {
    designDoc: DesignDoc;
}

export default class Apartment {
    group: THREE.Group;
    designDoc: DesignDoc;

    // Meshes
    private floors: THREE.Group;
    private walls: THREE.Group;
    private objects: THREE.Group;
    doors: THREE.Group;
    private base: THREE.Mesh | null = null;

    // Materials and Textures
    private woodTex: THREE.Texture | null = null;
    private tileTex: THREE.Texture | null = null;
    private floorMaterials: Map<string, THREE.MeshStandardMaterial> = new Map();
    private wallMaterials: Map<string, THREE.MeshStandardMaterial> = new Map();

    // State
    colliders: THREE.Box3[] = [];
    doorStates: Array<{
        id: string;
        pivot: THREE.Group;
        panel: THREE.Mesh;
        baseY: number;
        current: number;
        target: number;
        open: number;
        box: THREE.Box3;
    }> = [];
    doorPanels: THREE.Mesh[] = [];

    // Helper to find door by mesh
    getDoorState(mesh: THREE.Object3D): { id: string; target: number; open: number } | undefined {
        return this.doorStates.find(d => d.panel === mesh);
    }

    toggleDoor(mesh: THREE.Object3D): void {
        const state = this.getDoorState(mesh);
        if (state) {
            const isClosed = Math.abs(state.target) < 0.01;
            state.target = isClosed ? state.open : 0;
        }
    }

    constructor(config: ApartmentConfig) {
        this.designDoc = config.designDoc;
        this.group = new THREE.Group();

        this.floors = new THREE.Group();
        this.walls = new THREE.Group();
        this.objects = new THREE.Group();
        this.doors = new THREE.Group();

        this.group.add(this.floors, this.walls, this.objects, this.doors);

        this.initTextures();
        this.build();
    }

    private initTextures(): void {
        this.woodTex = makeWoodTexture(4);
        this.tileTex = makeTileTexture(4);
    }

    build(): void {
        this.clear();
        const { plan2d } = this.designDoc;

        this.buildFloors(plan2d);
        this.buildWalls(plan2d);
        this.buildBase(plan2d);
    }

    update(dt: number): void {
        for (const d of this.doorStates) {
            d.current = THREE.MathUtils.damp(d.current, d.target, 10, dt);
            d.pivot.rotation.y = d.baseY + d.current;
        }
    }

    private clear(): void {
        this.floors.clear();
        this.walls.clear();
        this.doors.clear();
        if (this.base) {
            this.group.remove(this.base);
            this.base.geometry.dispose();
            if (Array.isArray(this.base.material)) {
                this.base.material.forEach((m) => m.dispose());
            } else {
                this.base.material.dispose();
            }
            this.base = null;
        }
        this.colliders = [];
        this.doorStates = [];
        this.doorPanels = [];
    }

    private buildFloors(plan2d: DesignDoc['plan2d']): void {
        for (const room of plan2d.rooms) {
            if (!room.polygon.length) continue;

            const shape = new THREE.Shape();
            shape.moveTo(room.polygon[0].x, room.polygon[0].y);
            for (let i = 1; i < room.polygon.length; i++) {
                shape.lineTo(room.polygon[i].x, room.polygon[i].y);
            }
            shape.lineTo(room.polygon[0].x, room.polygon[0].y);

            const geo = new THREE.ShapeGeometry(shape);
            geo.rotateX(-Math.PI / 2);

            const matId = this.designDoc.surfaceMaterials?.[`floor:${room.id}`];
            const mat = this.getFloorMaterial(matId);

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(0, 0.001, 0);
            mesh.receiveShadow = true;
            mesh.castShadow = false;

            // Metadata for selection
            mesh.userData = {
                type: 'floor',
                id: room.id,
                name: room.name
            };

            this.floors.add(mesh);
        }
    }

    private buildWalls(plan2d: DesignDoc['plan2d']): void {
        const wallHeight = plan2d.params.wallHeight;
        const wallThickness = plan2d.params.wallThickness;

        const wallOpenings = new Map<string, DesignDoc['plan2d']['openings']>();
        for (const o of plan2d.openings) {
            const list = wallOpenings.get(o.wallId) ?? [];
            list.push(o);
            wallOpenings.set(o.wallId, list);
        }

        for (const w of plan2d.walls) {
            const openings = wallOpenings.get(w.id) ?? [];
            const wallMatId = this.designDoc.surfaceMaterials?.[`wall:${w.id}:face:in`];
            const mat = this.getWallMaterial(wallMatId);

            const meshGroup = WallBuilder.build(
                w,
                openings,
                { height: wallHeight, thickness: wallThickness },
                mat
            );

            // Apply Edge to the main mesh (first child)
            const wallMesh = meshGroup.children[0] as THREE.Mesh;
            if (wallMesh) this.addEdges(wallMesh);

            // Apply edges to baseboards if any
            for (let i = 1; i < meshGroup.children.length; i++) {
                this.addEdges(meshGroup.children[i] as THREE.Mesh, 0x9ca3af, 0.5);
            }

            // Metadata for selection
            meshGroup.userData = {
                type: 'wall',
                id: w.id
            };
            // Propagate to children for raycasting
            meshGroup.traverse((c) => {
                c.userData = { type: 'wall', id: w.id };
            });

            this.walls.add(meshGroup);
            this.colliders.push(new THREE.Box3().setFromObject(meshGroup));

            const dx = w.b.x - w.a.x;
            const dy = w.b.y - w.a.y;
            const len = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            const unitX = dx / len;
            const unitZ = dy / len;

            for (const o of openings) {
                if (o.type === 'door') {
                    this.buildDoor(o, w, unitX, unitZ, angle, o.offset, o.offset + o.width, wallHeight);
                }
            }
        }
    }

    private buildBase(plan2d: DesignDoc['plan2d']): void {
        const pts: Array<{ x: number; y: number }> = [];
        for (const w of plan2d.walls) pts.push(w.a, w.b);
        for (const r of plan2d.rooms) pts.push(...r.polygon);
        if (pts.length === 0) return;

        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = Math.max(0.1, maxX - minX);
        const depth = Math.max(0.1, maxY - minY);

        const margin = Math.max(0.6, Math.min(width, depth) * 0.08);
        const thickness = 0.2;

        const geo = new THREE.BoxGeometry(width + margin * 2, thickness, depth + margin * 2);
        const mat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9, metalness: 0.0 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(minX + width / 2, -thickness / 2, minY + depth / 2);
        mesh.receiveShadow = true;
        mesh.castShadow = false;

        this.base = mesh;
        this.group.add(mesh);
    }

    private buildDoor(
        o: DesignDoc['plan2d']['openings'][number],
        w: DesignDoc['plan2d']['walls'][number],
        unitX: number,
        unitZ: number,
        angle: number,
        start: number,
        end: number,
        wallHeight: number
    ) {
        const doorHeight = Math.min(o.height ?? 2.1, wallHeight);
        const doorWidth = end - start;
        const hingeAtEnd = o.swing === 'right';
        const hingeOffset = hingeAtEnd ? end : start;
        const hx = w.a.x + unitX * hingeOffset;
        const hz = w.a.y + unitZ * hingeOffset;

        const pivot = new THREE.Group();
        pivot.position.set(hx, 0, hz);
        pivot.rotation.y = -angle;

        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth, doorHeight, 0.05),
            new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.85, metalness: 0.0 })
        );
        panel.position.set(hingeAtEnd ? -doorWidth / 2 : doorWidth / 2, doorHeight / 2, 0);
        panel.castShadow = true;
        panel.receiveShadow = true;

        this.addEdges(panel, 0x4b5563);

        pivot.add(panel);
        this.doors.add(pivot);

        const openAngle = hingeAtEnd ? -Math.PI / 2 : Math.PI / 2;
        this.doorStates.push({
            id: o.id,
            pivot,
            panel,
            baseY: angle,
            current: 0,
            target: 0,
            open: openAngle,
            box: new THREE.Box3()
        });
        this.doorPanels.push(panel);
    }

    private buildObjects(): void {
        if (!this.designDoc.objects) return;

        for (const obj of this.designDoc.objects) {
            const spec = this.getObjectSpec(obj.objectSkuId, obj.name);
            const [sx, sy, sz] = spec.size;
            const geo = new THREE.BoxGeometry(sx, sy, sz);
            const mat = new THREE.MeshStandardMaterial({
                color: spec.color,
                emissive: spec.emissive ? new THREE.Color(spec.emissive) : new THREE.Color(0x000000),
                emissiveIntensity: spec.emissive ? 0.35 : 0
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(obj.pos.x, sy / 2 + (obj.pos.y ?? 0), obj.pos.z);
            mesh.rotation.y = obj.rotY;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            this.addEdges(mesh);

            this.objects.add(mesh);
            if (spec.collidable !== false) {
                this.colliders.push(new THREE.Box3().setFromObject(mesh));
            }
        }
    }

    private getFloorMaterial(materialId?: string): THREE.MeshStandardMaterial {
        const key = materialId ?? 'default';
        if (this.floorMaterials.has(key)) return this.floorMaterials.get(key)!;

        const isTile = materialId === 'm_floor_02';
        const mat = new THREE.MeshStandardMaterial({
            color: isTile ? '#7b8794' : '#b77949',
            roughness: isTile ? 0.95 : 0.82,
            metalness: 0.0,
            map: isTile ? this.tileTex : this.woodTex
        });
        // @ts-ignore
        if (mat.map) mat.map.needsUpdate = true;

        this.floorMaterials.set(key, mat);
        return mat;
    }

    private getWallMaterial(materialId?: string): THREE.MeshStandardMaterial {
        const key = materialId ?? 'default';
        if (this.wallMaterials.has(key)) return this.wallMaterials.get(key)!;

        const color =
            materialId === 'm_wall_03' ? '#5b0f23' :
                materialId === 'm_wall_02' ? '#e7d3c0' : '#f4f4f5';

        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });
        this.wallMaterials.set(key, mat);
        return mat;
    }

    private getObjectSpec(
        objectSkuId: string,
        name: string
    ): { size: [number, number, number]; color: string; emissive?: string; collidable?: boolean } {
        const key = `${objectSkuId} ${name}`.toLowerCase();
        if (key.includes('sofa') || key.includes('소파')) return { size: [2.2, 0.85, 1.0], color: '#111827' };
        if (key.includes('table') || key.includes('테이블')) return { size: [1.2, 0.45, 0.7], color: '#9a6b43' };
        if (key.includes('desk') || key.includes('데스크')) return { size: [1.4, 0.75, 0.7], color: '#d4d4d8' };
        if (key.includes('tv')) return { size: [1.6, 0.9, 0.2], color: '#0b0b0f', emissive: '#ff115e' };
        if (key.includes('bed') || key.includes('침대')) return { size: [2.0, 0.55, 1.6], color: '#f4f4f5' };
        if (key.includes('rug') || key.includes('러그')) return { size: [2.2, 0.03, 1.5], color: '#0b0b0f', collidable: false };
        if (key.includes('plant') || key.includes('식물')) return { size: [0.45, 1.1, 0.45], color: '#16a34a' };
        if (key.includes('wardrobe') || key.includes('옷장')) return { size: [1.4, 2.2, 0.55], color: '#e5e7eb' };
        if (key.includes('island') || key.includes('아일랜드')) return { size: [2.0, 0.9, 0.9], color: '#e5e7eb' };
        if (key.includes('counter') || key.includes('싱크') || key.includes('주방')) return { size: [2.4, 0.9, 0.6], color: '#d4d4d8' };
        if (key.includes('cabinet') || key.includes('신발장')) return { size: [1.4, 1.3, 0.45], color: '#9ca3af' };
        if (key.includes('tub') || key.includes('욕조')) return { size: [1.6, 0.55, 0.75], color: '#f4f4f5' };
        if (key.includes('sink') || key.includes('세면대')) return { size: [0.55, 0.9, 0.45], color: '#f4f4f5' };
        if (key.includes('pc')) return { size: [0.4, 0.85, 0.6], color: '#111827', emissive: '#0082ff' };
        return { size: [1.0, 0.7, 1.0], color: '#a1a1aa' };
    }

    private addEdges(mesh: THREE.Mesh, color: number = 0x000000, opacity: number = 0.3): void {
        const edges = new THREE.EdgesGeometry(mesh.geometry, 15);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color, transparent: true, opacity })
        );
        mesh.add(line);
    }

    destroy(): void {
        this.woodTex?.dispose();
        this.tileTex?.dispose();
        this.floorMaterials.forEach(m => m.dispose());
        this.wallMaterials.forEach(m => m.dispose());
        this.floorMaterials.clear();
        this.wallMaterials.clear();
    }
}
