export type RoomTheme = {
  env: {
    exposure: number;
    hdr?: string;
  };
  lights: {
    ambient: number;
    sunIntensity: number;
    accent?: number;
  };
};

export const ROOM_THEMES: Record<string, RoomTheme> = {
  default: {
    env: { exposure: 1.0 },
    lights: { ambient: 0.35, sunIntensity: 1.1, accent: 0.3 }
  },
  living: {
    env: { exposure: 1.1 },
    lights: { ambient: 0.4, sunIntensity: 1.3, accent: 0.5 }
  },
  bedroom: {
    env: { exposure: 0.95 },
    lights: { ambient: 0.32, sunIntensity: 0.9, accent: 0.6 }
  },
  bathroom: {
    env: { exposure: 1.05 },
    lights: { ambient: 0.36, sunIntensity: 1.2, accent: 0.4 }
  },
  kitchen: {
    env: { exposure: 1.08 },
    lights: { ambient: 0.38, sunIntensity: 1.25, accent: 0.45 }
  }
};

export function pickThemeByRoomName(name: string): RoomTheme {
  const lower = name.toLowerCase();
  if (/(living|거실)/.test(lower)) return ROOM_THEMES.living;
  if (/(bed|침실|방)/.test(lower)) return ROOM_THEMES.bedroom;
  if (/(bath|욕실|화장)/.test(lower)) return ROOM_THEMES.bathroom;
  if (/(kitchen|주방)/.test(lower)) return ROOM_THEMES.kitchen;
  return ROOM_THEMES.default;
}
