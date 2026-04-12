import { useEffect } from "react";
import { deriveBlankRoomShell } from "../../../lib/domain/room-shell";
import { useCameraStore, useShellStore } from "../../../lib/stores/scene-slices";
import { useEditorStore, type EditorViewMode } from "../../../lib/stores/useEditorStore";

type BuilderPreviewMode = Extract<EditorViewMode, "top" | "builder-preview">;

type UseBuilderSceneSyncInput = {
  previewMode: BuilderPreviewMode;
  derivedRoomShell: ReturnType<typeof deriveBlankRoomShell>;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
};

export function useBuilderSceneSync({
  previewMode,
  derivedRoomShell,
  wallMaterialIndex,
  floorMaterialIndex
}: UseBuilderSceneSyncInput) {
  const { setScene, resetScene } = useShellStore();
  const { setEntranceId } = useCameraStore();
  const applyShellPreset = useEditorStore((state) => state.applyShellPreset);
  const resetShellState = useEditorStore((state) => state.resetShellState);
  const setViewMode = useEditorStore((state) => state.setViewMode);

  useEffect(() => {
    applyShellPreset("viewer", {
      viewMode: "builder-preview"
    });

    return () => {
      resetShellState();
      resetScene();
    };
  }, [applyShellPreset, resetScene, resetShellState]);

  useEffect(() => {
    setViewMode(previewMode);
  }, [previewMode, setViewMode]);

  useEffect(() => {
    setScene({
      scale: derivedRoomShell.scale,
      scaleInfo: derivedRoomShell.scaleInfo,
      walls: derivedRoomShell.walls,
      openings: derivedRoomShell.openings,
      floors: derivedRoomShell.floors,
      ceilings: derivedRoomShell.ceilings,
      rooms: derivedRoomShell.rooms,
      cameraAnchors: derivedRoomShell.cameraAnchors,
      navGraph: derivedRoomShell.navGraph,
      assets: [],
      wallMaterialIndex,
      floorMaterialIndex,
      lighting: {
        ambientIntensity: 0.35,
        hemisphereIntensity: 0.4,
        directionalIntensity: 1.05,
        environmentBlur: 0.2
      }
    });

    setEntranceId(derivedRoomShell.entranceId);
  }, [derivedRoomShell, floorMaterialIndex, setEntranceId, setScene, wallMaterialIndex]);
}
