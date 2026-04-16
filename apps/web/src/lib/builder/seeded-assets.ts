import {
  findCatalogItemByAssetId,
  selectStarterSetItems,
  toCatalogProductSnapshot,
  type LibraryCatalogItem
} from "./catalog";
import type { DerivedRoomShell } from "../domain/room-shell";
import {
  constrainPlacementToAnchor,
  inferAnchorTypeForCatalogItem
} from "../scene/anchors";
import type { SceneAsset } from "../stores/useSceneStore";
import type { FurnishedRoomTemplateId, TemplateSeedPreset } from "./template-browser";

type SeedPresetConfig = {
  assetIds: string[];
  offsets: Array<[number, number]>;
};

const SEED_PRESETS: Record<Exclude<TemplateSeedPreset, "none">, SeedPresetConfig> = {
  partial: {
    assetIds: ["sofa-03", "round-table-01", "steel-shelf-03"],
    offsets: [
      [-1.3, 0.5],
      [0.2, 0.4],
      [1.8, -0.7]
    ]
  },
  full: {
    assetIds: ["sofa-03", "round-table-01", "steel-shelf-03", "ArmChair_01", "ornate-mirror-01"],
    offsets: [
      [-1.4, 0.6],
      [0.15, 0.4],
      [1.95, -0.8],
      [1.25, 1.2],
      [-2.1, -0.9]
    ]
  }
};

const FURNISHED_TEMPLATE_PRESETS: Record<FurnishedRoomTemplateId, SeedPresetConfig> = {
  "living-modern-lounge": {
    assetIds: ["sofa-03", "modern_coffee_table_01", "steel_frame_shelves_03", "side_table_01", "anthurium_botany_01"],
    offsets: [
      [-1.55, 0.55],
      [0.1, 0.25],
      [2.1, -0.8],
      [1.55, 0.95],
      [-2.05, -0.75]
    ]
  },
  "workspace-flex": {
    assetIds: ["SchoolDesk_01", "GreenChair_01", "steel_frame_shelves_03", "desk_lamp_arm_01"],
    offsets: [
      [-0.75, 0.2],
      [-0.2, 1.05],
      [2.15, -0.7],
      [0.1, 0.35]
    ]
  },
  "living-playful": {
    assetIds: ["Sofa_01", "coffee_table_round_01", "modern_wooden_cabinet", "GreenChair_01", "painted_wooden_stool"],
    offsets: [
      [-1.5, 0.55],
      [0.1, 0.3],
      [2.1, -0.7],
      [1.2, 1.1],
      [-2.05, -0.85]
    ]
  },
  "living-fresh": {
    assetIds: ["sofa_03", "round-table-01", "wooden_display_shelves_01"],
    offsets: [
      [-1.45, 0.55],
      [0.1, 0.35],
      [2.1, -0.75]
    ]
  },
  "kids-vintage": {
    assetIds: ["SchoolDesk_01", "SchoolChair_01", "wooden_bookshelf_worn", "vintage_wooden_drawer_01"],
    offsets: [
      [-0.9, 0.3],
      [-0.1, 1.05],
      [2.0, -0.8],
      [1.55, 0.9]
    ]
  },
  "bedroom-practical": {
    assetIds: ["gothic-bed-01", "ClassicNightstand_01", "modern_wooden_cabinet", "ornate-mirror-01", "painted_wooden_nightstand"],
    offsets: [
      [0, 0.15],
      [-1.95, 0.15],
      [2.2, -0.75],
      [-2.25, -0.9],
      [1.7, 0.95]
    ]
  },
  "bedroom-european": {
    assetIds: ["GothicBed_01", "painted_wooden_nightstand", "vintage_cabinet_01", "side_table_01"],
    offsets: [
      [0, 0.2],
      [-1.85, 0.2],
      [2.25, -0.75],
      [1.55, 0.95]
    ]
  },
  "bedroom-suite": {
    assetIds: ["gothic-bed-01", "modern_wooden_cabinet", "ornate-mirror-01", "ArmChair_01", "side_table_tall_01"],
    offsets: [
      [0, 0.15],
      [2.1, -0.75],
      [-2.2, -0.95],
      [1.3, 1.05],
      [-1.8, 0.85]
    ]
  }
};

function createAssetId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `seed-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveSeedItems(catalog: LibraryCatalogItem[], config: SeedPresetConfig) {
  const preferred = config.assetIds
    .map((id) => catalog.find((item) => item.id === id) ?? null)
    .filter((item): item is LibraryCatalogItem => item !== null);

  if (preferred.length >= 3) {
    return preferred;
  }

  const fallback = selectStarterSetItems(catalog, config.offsets.length);
  const merged = [...preferred];
  fallback.forEach((item) => {
    if (merged.some((existing) => existing.id === item.id)) return;
    merged.push(item);
  });
  return merged;
}

export function buildSeededSceneAssets(
  catalog: LibraryCatalogItem[],
  roomShell: DerivedRoomShell,
  preset: TemplateSeedPreset,
  furnishedTemplateId?: FurnishedRoomTemplateId | null
): SceneAsset[] {
  if (preset === "none") return [];

  const config = furnishedTemplateId ? FURNISHED_TEMPLATE_PRESETS[furnishedTemplateId] ?? SEED_PRESETS[preset] : SEED_PRESETS[preset];
  const selectedItems = resolveSeedItems(catalog, config).slice(0, config.offsets.length);
  const roomCenter = roomShell.rooms[0]?.center ?? [0, 0];
  const sceneAssets: SceneAsset[] = [];

  selectedItems.forEach((item, index) => {
    const [offsetX, offsetZ] = config.offsets[index] ?? [0, 0];
    const id = createAssetId();
    const supportProfile = item.supportProfile ?? null;
    const anchoredPlacement = constrainPlacementToAnchor(
      {
        position: [roomCenter[0] + offsetX, 0, roomCenter[1] + offsetZ],
        rotation: [0, 0, 0],
        anchorType: inferAnchorTypeForCatalogItem(item),
        supportAssetId: null
      },
      {
        walls: roomShell.walls,
        ceilings: roomShell.ceilings,
        scale: roomShell.scale,
        sceneAssets,
        activeAsset: {
          id,
          assetId: item.assetId,
          catalogItemId: item.id,
          product: toCatalogProductSnapshot(item),
          supportProfile,
          scale: item.scale
        }
      }
    );

    sceneAssets.push({
      id,
      assetId: item.assetId,
      catalogItemId: item.id,
      product: toCatalogProductSnapshot(item),
      anchorType: anchoredPlacement.anchorType,
      supportAssetId: anchoredPlacement.supportAssetId,
      supportProfile,
      position: anchoredPlacement.position,
      rotation: anchoredPlacement.rotation,
      scale: item.scale,
      materialId: null
    });
  });

  return sceneAssets;
}

export function buildSeedSummaryLabel(
  catalog: LibraryCatalogItem[],
  assets: SceneAsset[]
) {
  return assets
    .map((asset) => findCatalogItemByAssetId(catalog, asset.assetId)?.label ?? asset.assetId)
    .slice(0, 3)
    .join(", ");
}
