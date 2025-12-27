/**
 * Environment - Lighting and Mood management
 */
import * as THREE from 'three';
import * as Utils from 'three/src/math/MathUtils.js';
import type Experience from '../Experience';
import type { DesignDoc } from '@webinterior/shared/types';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export interface MoodConfig {
    nightMix: number;
    neutralMix: number;
    lights: {
        tvColor: string;
        tvStrength: number;
        deskColor: string;
        deskStrength: number;
        pcColor: string;
        pcStrength: number;
    };
}

export default class Environment {
    private experience: Experience;
    private scene: THREE.Scene;
    private designDoc?: DesignDoc;

    // Lights
    private dayLight: THREE.DirectionalLight;
    private hemiLight: THREE.HemisphereLight;
    private ambientLight: THREE.AmbientLight;
    private roomLights: Array<{ light: THREE.PointLight; baseColor: THREE.Color; baseIntensity: number }> = [];

    // Accents
    private accentTv: THREE.PointLight;
    private accentDesk: THREE.PointLight;
    private accentPc: THREE.PointLight;

    constructor(experience: Experience) {
        this.experience = experience;
        this.scene = this.experience.scene;

        // Try to load environment, but don't crash if missing
        this.loadEnvironmentMap();

        // 1. Day Light (Sun) - High Quality Real-time Shadows
        this.dayLight = new THREE.DirectionalLight(0xffffff, 2.0);
        this.dayLight.castShadow = true;
        this.dayLight.shadow.mapSize.set(2048, 2048);
        this.dayLight.shadow.normalBias = 0.05;
        this.dayLight.shadow.bias = -0.0005; // Fix shadow acne

        // Ensure target is added to scene to avoid matrix update issues
        this.scene.add(this.dayLight.target);

        // 2. Hemisphere Light - Simulates Sky/Ground ambient bounce (GI approximation)
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x0b0b0f, 0.6);

        // 3. Ambient Light - Base fill
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);

        // Accents (Dynamic interactive lights)
        this.accentTv = new THREE.PointLight(0xff115e, 2.0, 10, 2);
        this.accentDesk = new THREE.PointLight(0xff6700, 1.4, 9, 2);
        this.accentPc = new THREE.PointLight(0x0082ff, 1.2, 9, 2);

        this.scene.add(this.dayLight, this.hemiLight, this.ambientLight);
        this.scene.add(this.accentTv, this.accentDesk, this.accentPc);
    }

    setDesignDoc(doc: DesignDoc, bounds: { width: number; height: number; maxX: number; maxY: number }): void {
        this.designDoc = doc;
        this.updateLightPositions(bounds);
        this.createRoomLights(doc);
    }

    private updateLightPositions(bounds: { width: number; height: number; maxX: number; maxY: number }): void {
        const { width, height, maxX, maxY } = bounds;
        const centerX = maxX - width / 2;
        const centerZ = maxY - height / 2;
        const size = Math.max(width, height);

        // Position Sun dynamically based on room size to always cast good shadows
        this.dayLight.position.set(centerX + size * 0.5, size * 1.5, centerZ + size * 0.5);
        this.dayLight.target.position.set(centerX, 0, centerZ);
        this.dayLight.target.updateMatrixWorld();

        // Adjust shadow camera to cover the apartment
        const d = size * 1.5;
        this.dayLight.shadow.camera.left = -d;
        this.dayLight.shadow.camera.right = d;
        this.dayLight.shadow.camera.top = d;
        this.dayLight.shadow.camera.bottom = -d;
        this.dayLight.shadow.camera.far = size * 4;
        this.dayLight.shadow.camera.near = 0.1;
        this.dayLight.shadow.camera.updateProjectionMatrix();

        // Position accents based on objects or defaults
        const findObj = (k: string) => this.designDoc?.objects?.find((o) => `${o.objectSkuId} ${o.name}`.toLowerCase().includes(k));

        const tvObj = findObj('tv');
        const deskObj = findObj('desk') || findObj('데스크');
        const pcObj = findObj('pc');

        if (tvObj) this.accentTv.position.set(tvObj.pos.x - 0.6, 1.65, tvObj.pos.z);
        else this.accentTv.position.set(centerX + width * 0.35, 1.65, centerZ + height * 0.05);

        if (deskObj) this.accentDesk.position.set(deskObj.pos.x, 1.3, deskObj.pos.z);
        else this.accentDesk.position.set(centerX - width * 0.15, 1.3, centerZ + height * 0.25);

        if (pcObj) this.accentPc.position.set(pcObj.pos.x, 1.05, pcObj.pos.z);
        else this.accentPc.position.set(centerX - width * 0.1, 1.05, centerZ + height * 0.1);
    }

    private createRoomLights(doc: DesignDoc): void {
        // Clear existing
        this.roomLights.forEach(rl => this.scene.remove(rl.light));
        this.roomLights = [];

        for (const room of doc.plan2d.rooms) {
            if (!room.polygon.length) continue;

            // Calculate center of room
            let x = 0, z = 0;
            for (const p of room.polygon) { x += p.x; z += p.y; }
            x /= room.polygon.length;
            z /= room.polygon.length;

            const name = room.name.toLowerCase();
            // Assign ambient room colors based on room type
            let color = '#a78bfa';
            let intensity = 0.4;

            if (name.includes('거실') || name.includes('living')) { color = '#ffdfca'; intensity = 0.6; }
            else if (name.includes('주방') || name.includes('kitchen')) { color = '#ffffff'; intensity = 0.5; }
            else if (name.includes('욕실') || name.includes('bath')) { color = '#e0f2fe'; intensity = 0.5; }
            else if (name.includes('현관') || name.includes('entry')) { color = '#fff7ed'; intensity = 0.4; }
            else if (name.includes('침실') || name.includes('bed')) { color = '#f3e8ff'; intensity = 0.4; }

            // Add a soft point light to fill the room shadows (Fake GI)
            const light = new THREE.PointLight(color, intensity, 8, 1);
            light.position.set(x, 2.2, z);

            this.scene.add(light);
            this.roomLights.push({ light, baseColor: new THREE.Color(color), baseIntensity: intensity });
        }
    }

    update(config: MoodConfig): void {
        const night = Utils.clamp(config.nightMix, 0, 1);
        const neutral = Utils.clamp(config.neutralMix, 0, 1);

        // Day vs Night Logic
        // Day: Strong Sun, Brighter Hemi
        // Night: Weak Sun (Moon), Darker Hemi, Stronger Accents

        // 1. Sun (DayLight)
        // Intensity drops at night
        const dayIntensity = THREE.MathUtils.lerp(1.5, 0.1, night);
        this.dayLight.intensity = dayIntensity;

        // Color shifts to blue-ish at night
        const dayColor = new THREE.Color(0xffffff);
        const nightColor = new THREE.Color(0xccccff);
        this.dayLight.color.lerpColors(dayColor, nightColor, night);

        // 2. Hemisphere (Ambient Fill)
        const hemiIntensity = THREE.MathUtils.lerp(0.6, 0.2, night);
        this.hemiLight.intensity = hemiIntensity;

        // 3. Ambient
        const ambIntensity = THREE.MathUtils.lerp(0.2, 0.05, night);
        this.ambientLight.intensity = ambIntensity;

        // 4. Room Lights (Turn on brighter at night)
        const roomBoost = night * 0.5; // Boost by 50% at night
        const neutralDim = neutral * 0.5; // Dim by 50% if neutral

        for (const rl of this.roomLights) {
            let i = rl.baseIntensity;
            i += roomBoost;
            i -= neutralDim;
            rl.light.intensity = Math.max(0, i);
        }

        // 5. Accents
        this.accentTv.color.set(config.lights.tvColor);
        this.accentTv.intensity = config.lights.tvStrength * (0.5 + 0.5 * night); // Pop more at night

        this.accentDesk.color.set(config.lights.deskColor);
        this.accentDesk.intensity = config.lights.deskStrength;

        this.accentPc.color.set(config.lights.pcColor);
        this.accentPc.intensity = config.lights.pcStrength;
    }

    private loadEnvironmentMap(): void {
        const renderer = this.experience.renderer.instance;
        // Skip if not a standard renderer or disposed
        if (!renderer || (renderer as any).disposed) return;

        const loader = new RGBELoader();
        const path = process.env.NEXT_PUBLIC_ENV_HDR;
        if (!path) {
            this.scene.background = new THREE.Color('#0b0b0f');
            return;
        }

        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();

        // Use a standard fetch check or just handle the error silently
        loader.load(
            path,
            (texture) => {
                const envMap = pmremGenerator.fromEquirectangular(texture).texture;
                this.scene.environment = envMap;
                this.scene.background = new THREE.Color('#0b0b0f');
                texture.dispose();
                pmremGenerator.dispose();
            },
            undefined,
            () => {
                // Silent catch for 404s
                pmremGenerator.dispose();
            }
        );
    }

    destroy(): void {
        this.roomLights.forEach(rl => this.scene.remove(rl.light));
        this.roomLights = [];
        this.scene.remove(this.dayLight, this.hemiLight, this.ambientLight);
        this.scene.remove(this.accentTv, this.accentDesk, this.accentPc);
        if (this.dayLight?.target) this.scene.remove(this.dayLight.target);

        if (this.scene.environment) {
            this.scene.environment.dispose();
        }
    }
}
