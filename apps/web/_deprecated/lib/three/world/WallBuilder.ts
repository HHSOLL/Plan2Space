/**
 * WallBuilder - Generates wall geometry with holes and corners
 */
import * as THREE from 'three';
import type { DesignDoc } from '@webinterior/shared/types';

type Wall = DesignDoc['plan2d']['walls'][number];
type Opening = DesignDoc['plan2d']['openings'][number];

export default class WallBuilder {
    static build(
        wall: Wall,
        openings: Opening[],
        params: { height: number; thickness: number },
        material: THREE.Material
    ): THREE.Group {
        const { height, thickness } = params;
        const group = new THREE.Group();

        // Calculate length
        const dx = wall.b.x - wall.a.x;
        const dy = wall.b.y - wall.a.y; // 'y' in 2D plan is 'z' in 3D
        const length = Math.hypot(dx, dy);

        // -- Wall Mesh --
        // Create Shape (Elevation view)
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(length, 0);
        shape.lineTo(length, height);
        shape.lineTo(0, height);
        shape.lineTo(0, 0);

        // Holes for openings
        for (const op of openings) {
            const hole = new THREE.Path();
            const hx = op.offset;
            // Default window sill height 0.9m, door 0m
            const hy = op.type === 'window' ? 0.9 : 0;
            const hw = op.width;
            const hh = op.height;

            hole.moveTo(hx, hy);
            hole.lineTo(hx + hw, hy);
            hole.lineTo(hx + hw, hy + hh);
            hole.lineTo(hx, hy + hh);
            hole.lineTo(hx, hy);

            shape.holes.push(hole);
        }

        // Extrude
        // Note: ExtrudeGeometry extrudes along Z axis by default.
        // We want to extrude "thickness".
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: thickness,
            bevelEnabled: false,
            steps: 1
        });

        // Center geometry on Z (thickness) to make rotation easier?
        // By default it extrudes 0 to depth.
        // We want the wall centerline to be at 0 if we rotate around center?
        // Usually blueprints lines are centerlines.
        geometry.translate(0, 0, -thickness / 2);

        // Create Mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // -- Baseboard (Molding) --
        // Generate baseboard only where there are no doors
        // Basic approach: Creating boxes for segments between doors
        // Sort openings by offset
        const sortedOpenings = [...openings].sort((a, b) => a.offset - b.offset);

        // Segments: 0 -> op1.start, op1.end -> op2.start, ...
        const segments: Array<{ start: number, end: number }> = [];
        let cursor = 0;

        for (const op of sortedOpenings) {
            // Only doors break the baseboard. Windows are above.
            if (op.type === 'door') {
                if (op.offset > cursor + 0.01) {
                    segments.push({ start: cursor, end: op.offset });
                }
                cursor = Math.max(cursor, op.offset + op.width);
            }
        }
        if (length > cursor + 0.01) {
            segments.push({ start: cursor, end: length });
        }

        const baseHeight = 0.1; // 10cm
        const baseDepth = 0.015; // 1.5cm stick out

        const baseMat = new THREE.MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.5 });

        for (const seg of segments) {
            const segLen = seg.end - seg.start;
            const baseGeo = new THREE.BoxGeometry(segLen, baseHeight, baseDepth);
            const baseMesh = new THREE.Mesh(baseGeo, baseMat);

            // Position along X axis
            baseMesh.position.set(
                seg.start + segLen / 2,
                baseHeight / 2,
                thickness / 2 + baseDepth / 2
            );
            // Add to group
            group.add(baseMesh);

            // Also add baseboard on the other side? (Interior/Exterior)
            // Usually we need double-sided or check wall normal.
            // Current assumption: "face:in" is one side via material.
            // But ExtrudeGeometry creates both sides.
            // Let's add inner baseboard too.
            const backMesh = baseMesh.clone();
            backMesh.position.z = -thickness / 2 - baseDepth / 2;
            group.add(backMesh);
        }

        // Positioning Group
        // Elevation shape is in X-Y plane.
        // In 3D:
        // X axis aligns with wall length.
        // Y axis aligns with wall height.
        // Z axis aligns with wall thickness (normal).

        // We need to place it in the scene.
        // Wall goes from A to B.
        // Angle:
        const angle = Math.atan2(dy, dx);

        group.position.set(wall.a.x, 0, wall.a.y);
        group.rotation.y = -angle; // Check rotation logic

        return group;
    }
}
