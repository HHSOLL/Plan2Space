/**
 * Procedural placeholder textures for floors and walls
 * Extracted from plan-3d-viewer.tsx
 */
import * as THREE from 'three';

export function makeWoodTexture(anisotropy: number = 1): THREE.CanvasTexture | null {
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#b77949');
    grad.addColorStop(1, '#8b5a34');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const plankCount = 10;
    for (let i = 0; i < plankCount; i++) {
        const x = Math.floor((i / plankCount) * 512);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
        ctx.fillRect(x, 0, Math.ceil(512 / plankCount), 512);
    }

    for (let i = 0; i < 900; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const w = 20 + Math.random() * 120;
        ctx.strokeStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.05})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + Math.random() * 6 - 3);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2.5, 2.5);
    return tex;
}

export function makeTileTexture(anisotropy: number = 1): THREE.CanvasTexture | null {
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#6b7280';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 2500; i++) ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);

    const tile = 64;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 512; x += tile) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
    }
    for (let y = 0; y <= 512; y += tile) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
}
