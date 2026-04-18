import path from "node:path";
import { fileURLToPath } from "node:url";

export type CuratedManifestMetadataField =
  | "brand"
  | "externalUrl"
  | "description"
  | "category"
  | "options";

export type CuratedDeskteriorAsset = {
  key: string;
  manifestId: string;
  sourcePath: string;
  runtimePath: string;
  expectedAssetId: string;
  requiredMetadata: CuratedManifestMetadataField[];
  optionsHint?: string;
};

const scriptFile = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFile);
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "../..");
const publicRoot = path.join(appRoot, "public");

function runtimeAssetPath(assetKey: string) {
  return path.join(publicRoot, "assets", "models", assetKey, `${assetKey}.glb`);
}

function runtimeAssetId(assetKey: string) {
  return `/assets/models/${assetKey}/${assetKey}.glb`;
}

function sourceBlendPath(assetKey: string) {
  return path.join(repoRoot, "assets", "blender", "deskterior", `${assetKey}.blend`);
}

export const curatedDeskteriorAssets: CuratedDeskteriorAsset[] = [
  {
    key: "p2s_desk_oak",
    manifestId: "p2s_desk_oak_140",
    sourcePath: sourceBlendPath("p2s_desk_oak"),
    runtimePath: runtimeAssetPath("p2s_desk_oak"),
    expectedAssetId: runtimeAssetId("p2s_desk_oak"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"]
  },
  {
    key: "p2s_monitor_stand",
    manifestId: "p2s_monitor_stand_wood",
    sourcePath: sourceBlendPath("p2s_monitor_stand"),
    runtimePath: runtimeAssetPath("p2s_monitor_stand"),
    expectedAssetId: runtimeAssetId("p2s_monitor_stand"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"]
  },
  {
    key: "p2s_desk_lamp_glow",
    manifestId: "p2s_desk_lamp_glow",
    sourcePath: sourceBlendPath("p2s_desk_lamp_glow"),
    runtimePath: runtimeAssetPath("p2s_desk_lamp_glow"),
    expectedAssetId: runtimeAssetId("p2s_desk_lamp_glow"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
    optionsHint: "light-emitter"
  },
  {
    key: "p2s_ceramic_mug",
    manifestId: "p2s_ceramic_mug_sand",
    sourcePath: sourceBlendPath("p2s_ceramic_mug"),
    runtimePath: runtimeAssetPath("p2s_ceramic_mug"),
    expectedAssetId: runtimeAssetId("p2s_ceramic_mug"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"]
  },
  {
    key: "p2s_book_stack_warm",
    manifestId: "p2s_book_stack_warm",
    sourcePath: sourceBlendPath("p2s_book_stack_warm"),
    runtimePath: runtimeAssetPath("p2s_book_stack_warm"),
    expectedAssetId: runtimeAssetId("p2s_book_stack_warm"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"]
  },
  {
    key: "p2s_desk_tray_oak",
    manifestId: "p2s_desk_tray_oak",
    sourcePath: sourceBlendPath("p2s_desk_tray_oak"),
    runtimePath: runtimeAssetPath("p2s_desk_tray_oak"),
    expectedAssetId: runtimeAssetId("p2s_desk_tray_oak"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"]
  },
  {
    key: "p2s_compact_speaker",
    manifestId: "p2s_compact_speaker",
    sourcePath: sourceBlendPath("p2s_compact_speaker"),
    runtimePath: runtimeAssetPath("p2s_compact_speaker"),
    expectedAssetId: runtimeAssetId("p2s_compact_speaker"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"]
  },
  {
    key: "p2s_desk_planter_pilea",
    manifestId: "p2s_desk_planter_pilea",
    sourcePath: sourceBlendPath("p2s_desk_planter_pilea"),
    runtimePath: runtimeAssetPath("p2s_desk_planter_pilea"),
    expectedAssetId: runtimeAssetId("p2s_desk_planter_pilea"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"]
  }
];
