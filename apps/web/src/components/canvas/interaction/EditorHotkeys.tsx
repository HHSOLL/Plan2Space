"use client";

import { useEffect } from "react";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useSceneStore } from "../../../lib/stores/useSceneStore";

const ROTATE_STEP = Math.PI / 2;

export default function EditorHotkeys() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const selectedAssetId = useSceneStore((state) => state.selectedAssetId);
  const assets = useSceneStore((state) => state.assets);
  const updateFurniture = useSceneStore((state) => state.updateFurniture);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (viewMode !== "top") return;
      if (event.key.toLowerCase() === "g") {
        setTransformMode("translate");
      }
      if (event.key.toLowerCase() !== "r") return;
      if (!selectedAssetId) return;
      const asset = assets.find((item) => item.id === selectedAssetId);
      if (!asset) return;
      updateFurniture(selectedAssetId, {
        rotation: [asset.rotation[0], asset.rotation[1] + ROTATE_STEP, asset.rotation[2]]
      });
      setTransformMode("rotate");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [assets, selectedAssetId, setTransformMode, updateFurniture, viewMode]);

  return null;
}
