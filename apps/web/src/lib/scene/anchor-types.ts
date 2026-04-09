export const SCENE_ANCHOR_TYPES = [
  "floor",
  "wall",
  "ceiling",
  "furniture_surface",
  "desk_surface",
  "shelf_surface"
] as const;

export type SceneAnchorType = (typeof SCENE_ANCHOR_TYPES)[number];

export function isSceneAnchorType(value: unknown): value is SceneAnchorType {
  return typeof value === "string" && SCENE_ANCHOR_TYPES.includes(value as SceneAnchorType);
}

export function normalizeSceneAnchorType(
  value: unknown,
  fallback: SceneAnchorType = "floor"
): SceneAnchorType {
  return isSceneAnchorType(value) ? value : fallback;
}
