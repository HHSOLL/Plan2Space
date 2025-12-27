import * as THREE from 'three';
import vertexShader from '../shaders/baked/vertex.glsl';
import fragmentShader from '../shaders/baked/fragment.glsl';

export interface BakedMaterialUniforms {
    uBakedDayTexture: { value: THREE.Texture | null };
    uBakedNightTexture: { value: THREE.Texture | null };
    uBakedNeutralTexture: { value: THREE.Texture | null };
    uLightMapTexture: { value: THREE.Texture | null };

    uNightMix: { value: number };
    uNeutralMix: { value: number };

    uLightTvColor: { value: THREE.Color };
    uLightTvStrength: { value: number };
    uLightDeskColor: { value: THREE.Color };
    uLightDeskStrength: { value: number };
    uLightPcColor: { value: THREE.Color };
    uLightPcStrength: { value: number };
}

export default class BakedMaterial extends THREE.ShaderMaterial {
    declare uniforms: BakedMaterialUniforms;

    constructor() {
        super({
            uniforms: {
                uBakedDayTexture: { value: null },
                uBakedNightTexture: { value: null },
                uBakedNeutralTexture: { value: null },
                uLightMapTexture: { value: null },

                uNightMix: { value: 0 },
                uNeutralMix: { value: 0 },

                uLightTvColor: { value: new THREE.Color(0xff115e) },
                uLightTvStrength: { value: 1.0 },
                uLightDeskColor: { value: new THREE.Color(0xff6700) },
                uLightDeskStrength: { value: 1.0 },
                uLightPcColor: { value: new THREE.Color(0x0082ff) },
                uLightPcStrength: { value: 1.0 },
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
        });
    }

    setBakedTextures(day: THREE.Texture, night: THREE.Texture, neutral: THREE.Texture): void {
        this.uniforms.uBakedDayTexture.value = day;
        this.uniforms.uBakedNightTexture.value = night;
        this.uniforms.uBakedNeutralTexture.value = neutral;
    }

    setLightMap(texture: THREE.Texture): void {
        this.uniforms.uLightMapTexture.value = texture;
    }

    update(params: {
        nightMix?: number;
        neutralMix?: number;
        tvColor?: string;
        tvStrength?: number;
        deskColor?: string;
        deskStrength?: number;
        pcColor?: string;
        pcStrength?: number;
    }): void {
        if (params.nightMix !== undefined) this.uniforms.uNightMix.value = params.nightMix;
        if (params.neutralMix !== undefined) this.uniforms.uNeutralMix.value = params.neutralMix;

        if (params.tvColor) this.uniforms.uLightTvColor.value.set(params.tvColor);
        if (params.tvStrength !== undefined) this.uniforms.uLightTvStrength.value = params.tvStrength;

        if (params.deskColor) this.uniforms.uLightDeskColor.value.set(params.deskColor);
        if (params.deskStrength !== undefined) this.uniforms.uLightDeskStrength.value = params.deskStrength;

        if (params.pcColor) this.uniforms.uLightPcColor.value.set(params.pcColor);
        if (params.pcStrength !== undefined) this.uniforms.uLightPcStrength.value = params.pcStrength;
    }
}
