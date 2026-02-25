import type { UITree } from "@json-render/core";

export const aiAssistantStub: UITree = {
  root: "panel",
  elements: {
    panel: {
      key: "panel",
      type: "Panel",
      props: {
        title: "AI Studio Guidance",
        subtitle: "Live scene summary with quick actions."
      },
      children: ["scene", "materials", "actions", "selection"]
    },
    scene: {
      key: "scene",
      type: "Section",
      props: { title: "Scene Snapshot" },
      children: ["stat-walls", "stat-openings", "stat-assets", "stat-scale"]
    },
    "stat-walls": {
      key: "stat-walls",
      type: "Stat",
      props: { label: "Walls", valuePath: "/scene/walls" }
    },
    "stat-openings": {
      key: "stat-openings",
      type: "Stat",
      props: { label: "Openings", valuePath: "/scene/openings" }
    },
    "stat-assets": {
      key: "stat-assets",
      type: "Stat",
      props: { label: "Assets", valuePath: "/scene/assets" }
    },
    "stat-scale": {
      key: "stat-scale",
      type: "Stat",
      props: { label: "Scale", valuePath: "/scene/scale", suffix: "x" }
    },
    materials: {
      key: "materials",
      type: "Section",
      props: { title: "Material Tweaks" },
      children: ["stat-wall-mat", "stat-floor-mat", "action-wall-next", "action-floor-next"]
    },
    "stat-wall-mat": {
      key: "stat-wall-mat",
      type: "Stat",
      props: { label: "Wall Preset", valuePath: "/materials/wallIndex" }
    },
    "stat-floor-mat": {
      key: "stat-floor-mat",
      type: "Stat",
      props: { label: "Floor Preset", valuePath: "/materials/floorIndex" }
    },
    "action-wall-next": {
      key: "action-wall-next",
      type: "ActionButton",
      props: {
        label: "Cycle Wall Finish",
        hint: "Switch PBR wall surface",
        action: { name: "next_wall_material" }
      }
    },
    "action-floor-next": {
      key: "action-floor-next",
      type: "ActionButton",
      props: {
        label: "Cycle Floor Finish",
        hint: "Switch PBR floor surface",
        action: { name: "next_floor_material" }
      }
    },
    actions: {
      key: "actions",
      type: "Section",
      props: { title: "Quick Drops" },
      children: ["action-drop-chair"]
    },
    "action-drop-chair": {
      key: "action-drop-chair",
      type: "ActionButton",
      props: {
        label: "Drop Focus Chair",
        hint: "Spawn a chair at center",
        action: { name: "drop_chair" }
      }
    },
    selection: {
      key: "selection",
      type: "Section",
      props: { title: "Selection" },
      children: ["stat-selected"]
    },
    "stat-selected": {
      key: "stat-selected",
      type: "Stat",
      props: { label: "Active Asset", valuePath: "/selection/assetId" }
    }
  }
};
