import type { ComponentProps } from "react";
import { Canvas } from "@react-three/fiber";
import { SceneViewport } from "./SceneViewport";

type ProjectEditorViewportProps = {
  gl?: ComponentProps<typeof Canvas>["gl"];
};

export function ProjectEditorViewport({ gl }: ProjectEditorViewportProps) {
  return (
    <SceneViewport
      className="rounded-none border-0 shadow-none"
      gl={gl}
      camera={{ fov: 40, position: [0, 10, 20] }}
      toneMappingExposure={1.14}
      chromeTone="light"
      interactionMode="editor"
    />
  );
}
