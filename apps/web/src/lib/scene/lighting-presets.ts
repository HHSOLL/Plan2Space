export type LightingSettingsSnapshot = {
  ambientIntensity: number;
  hemisphereIntensity: number;
  directionalIntensity: number;
  environmentBlur: number;
};

export type LightingPresetId = "home-reference" | "neutral-studio" | "soft-evening";

export type LightingPreset = {
  id: LightingPresetId;
  label: string;
  description: string;
  settings: LightingSettingsSnapshot;
};

export const HOME_REFERENCE_LIGHTING: LightingSettingsSnapshot = {
  ambientIntensity: 0.44,
  hemisphereIntensity: 0.54,
  directionalIntensity: 1.24,
  environmentBlur: 0.14
};

export const LIGHTING_PRESETS: LightingPreset[] = [
  {
    id: "home-reference",
    label: "Home Reference",
    description: "홈 레퍼런스 이미지 톤에 맞춘 기본 프리셋",
    settings: HOME_REFERENCE_LIGHTING
  },
  {
    id: "neutral-studio",
    label: "Neutral Studio",
    description: "재질 확인용 중립 조명",
    settings: {
      ambientIntensity: 0.34,
      hemisphereIntensity: 0.42,
      directionalIntensity: 1.02,
      environmentBlur: 0.1
    }
  },
  {
    id: "soft-evening",
    label: "Soft Evening",
    description: "대비를 낮춘 부드러운 저녁 톤",
    settings: {
      ambientIntensity: 0.46,
      hemisphereIntensity: 0.6,
      directionalIntensity: 0.86,
      environmentBlur: 0.24
    }
  }
];

const PRESET_MATCH_TOLERANCE = 0.02;

export function getLightingPreset(id: LightingPresetId) {
  return LIGHTING_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function inferLightingPresetId(
  lighting: LightingSettingsSnapshot
): LightingPresetId | null {
  for (const preset of LIGHTING_PRESETS) {
    const deltaAmbient = Math.abs(preset.settings.ambientIntensity - lighting.ambientIntensity);
    const deltaHemisphere = Math.abs(preset.settings.hemisphereIntensity - lighting.hemisphereIntensity);
    const deltaDirectional = Math.abs(preset.settings.directionalIntensity - lighting.directionalIntensity);
    const deltaBlur = Math.abs(preset.settings.environmentBlur - lighting.environmentBlur);
    if (
      deltaAmbient <= PRESET_MATCH_TOLERANCE &&
      deltaHemisphere <= PRESET_MATCH_TOLERANCE &&
      deltaDirectional <= PRESET_MATCH_TOLERANCE &&
      deltaBlur <= PRESET_MATCH_TOLERANCE
    ) {
      return preset.id;
    }
  }

  return null;
}
