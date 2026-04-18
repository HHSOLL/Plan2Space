"use client";

import { Environment as DreiEnvironment, ContactShadows } from "@react-three/drei";
import type { SceneRenderQuality } from "../../../lib/scene/render-quality";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useShellSelector } from "../../../lib/stores/scene-slices";

const DEFAULT_HDRI_PATH = "/assets/hdri/kiara_interior_1k.hdr";

export default function SceneEnvironment({ quality }: { quality: SceneRenderQuality }) {
  const viewMode = useEditorStore((state) => state.viewMode);
  const lighting = useShellSelector((slice) => slice.lighting);

  if (viewMode === "top") {
    return null;
  }

  return (
    <>
      <DreiEnvironment files={DEFAULT_HDRI_PATH} background={false} blur={lighting.environmentBlur} />
      {quality.enableContactShadows ? (
        <ContactShadows
          position={[0, -0.04, 0]}
          opacity={quality.contactShadowOpacity}
          scale={26}
          blur={quality.contactShadowBlur}
          far={10}
          resolution={quality.contactShadowResolution}
          color="#000000"
        />
      ) : null}
    </>
  );
}
