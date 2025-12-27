export default /* glsl */`
uniform sampler2D uBakedDayTexture;
uniform sampler2D uBakedNightTexture;
uniform sampler2D uBakedNeutralTexture;
uniform sampler2D uLightMapTexture;

uniform float uNightMix;
uniform float uNeutralMix;

uniform vec3 uLightTvColor;
uniform float uLightTvStrength;

uniform vec3 uLightDeskColor;
uniform float uLightDeskStrength;

uniform vec3 uLightPcColor;
uniform float uLightPcStrength;

varying vec2 vUv;

// Blend Lighten Function
vec3 blendLighten(vec3 base, vec3 blend) {
    return max(blend, base);
}

// Blend Add Function
vec3 blendAdd(vec3 base, vec3 blend) {
    return min(base + blend, vec3(1.0));
}

void main() {
    vec3 bakedDayColor = texture2D(uBakedDayTexture, vUv).rgb;
    vec3 bakedNightColor = texture2D(uBakedNightTexture, vUv).rgb;
    vec3 bakedNeutralColor = texture2D(uBakedNeutralTexture, vUv).rgb;
    vec3 lightMapColor = texture2D(uLightMapTexture, vUv).rgb;

    // Mix Baked Textures
    vec3 bakedColor = mix(bakedDayColor, bakedNightColor, uNightMix);
    bakedColor = mix(bakedColor, bakedNeutralColor, uNeutralMix);

    // Light Map Channels (R=TV, G=Desk, B=PC)
    float lightTvStrength = lightMapColor.r * uLightTvStrength;
    float lightDeskStrength = lightMapColor.g * uLightDeskStrength;
    float lightPcStrength = lightMapColor.b * uLightPcStrength;

    vec3 lightTvColor = uLightTvColor * lightTvStrength;
    vec3 lightDeskColor = uLightDeskColor * lightDeskStrength;
    vec3 lightPcColor = uLightPcColor * lightPcStrength;

    // Apply Lights using Lighten/Add blend
    vec3 lightColor = blendLighten(bakedColor, lightTvColor);
    lightColor = blendLighten(lightColor, lightDeskColor);
    lightColor = blendLighten(lightColor, lightPcColor);

    gl_FragColor = vec4(lightColor, 1.0);
}
`;
