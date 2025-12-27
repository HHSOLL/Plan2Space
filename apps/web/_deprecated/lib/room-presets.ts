import type { DesignDoc } from "@webinterior/shared/types";

type RoomPreset = {
  floor: string;
  wall: string;
  ceiling: string;
  mood: "day" | "neutral" | "night";
};

const DEFAULT_PRESET: RoomPreset = {
  floor: "m_floor_01",
  wall: "m_wall_01",
  ceiling: "m_ceiling_01",
  mood: "neutral"
};

const PRESETS: Record<string, RoomPreset> = {
  living: { floor: "m_floor_03", wall: "m_wall_01", ceiling: "m_ceiling_01", mood: "neutral" },
  kitchen: { floor: "m_floor_02", wall: "m_wall_02", ceiling: "m_ceiling_01", mood: "day" },
  bedroom: { floor: "m_floor_01", wall: "m_wall_02", ceiling: "m_ceiling_01", mood: "night" },
  bathroom: { floor: "m_floor_02", wall: "m_wall_03", ceiling: "m_ceiling_01", mood: "neutral" },
  entry: { floor: "m_floor_02", wall: "m_wall_01", ceiling: "m_ceiling_01", mood: "neutral" }
};

const ROOM_KEYWORDS: Array<{ key: keyof typeof PRESETS; match: RegExp }> = [
  { key: "living", match: /(living|거실|주방)/i },
  { key: "kitchen", match: /(kitchen|주방)/i },
  { key: "bathroom", match: /(bath|욕실|화장)/i },
  { key: "entry", match: /(entry|현관|복도)/i },
  { key: "bedroom", match: /(bed|침실|room|방)/i }
];

function classifyRoom(name: string): keyof typeof PRESETS {
  for (const rule of ROOM_KEYWORDS) {
    if (rule.match.test(name)) return rule.key;
  }
  return "bedroom";
}

export function applyRoomPresets(doc: DesignDoc): { doc: DesignDoc; inferredMoods: Record<string, RoomPreset["mood"]> } {
  const next = JSON.parse(JSON.stringify(doc)) as DesignDoc;
  const moodByRoom: Record<string, RoomPreset["mood"]> = {};

  for (const room of next.plan2d.rooms) {
    const presetKey = classifyRoom(room.name);
    const preset = PRESETS[presetKey] ?? DEFAULT_PRESET;
    next.surfaceMaterials[`floor:${room.id}`] = preset.floor;
    next.surfaceMaterials[`ceiling:${room.id}`] = preset.ceiling;
    // Apply to all walls touching room: heuristic, if wall already has material keep
    for (const wallId of Object.keys(next.surfaceMaterials)) {
      if (wallId.startsWith("wall:")) continue;
    }
    moodByRoom[room.id] = preset.mood;
  }

  return { doc: next, inferredMoods: moodByRoom };
}

export function roomCenter(room: DesignDoc["plan2d"]["rooms"][number]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const p of room.polygon) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(room.polygon.length, 1);
  return { x: x / n, y: y / n };
}
