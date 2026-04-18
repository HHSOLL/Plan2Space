"use client";

import { useEffect, useState } from "react";
import { Environment as DreiEnvironment, ContactShadows } from "@react-three/drei";
import type { SceneRenderQuality } from "../../../lib/scene/render-quality";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useShellSelector } from "../../../lib/stores/scene-slices";

type HdriEntry = {
  id: string;
  label: string;
  path: string;
};

type EnvironmentSource =
  | { type: "file"; value: string }
  | { type: "preset"; value: "apartment" | "city" | "studio" };

const FALLBACK_ENVIRONMENT: EnvironmentSource = { type: "preset", value: "apartment" };
const HDRI_PREFERENCE_IDS = [
  "kiara_interior",
  "hotel_room",
  "photo_studio_loft_hall",
  "photo_studio_01",
  "small_empty_room_1"
] as const;

function pickPreferredEnvironment(list: HdriEntry[]): EnvironmentSource | null {
  for (const preferredId of HDRI_PREFERENCE_IDS) {
    const matched = list.find((entry) => entry.id === preferredId && typeof entry.path === "string" && entry.path.length > 0);
    if (matched) {
      return { type: "file", value: matched.path };
    }
  }

  const first = list.find((entry) => typeof entry.path === "string" && entry.path.length > 0);
  return first ? { type: "file", value: first.path } : null;
}

export default function SceneEnvironment({ quality }: { quality: SceneRenderQuality }) {
  const viewMode = useEditorStore((state) => state.viewMode);
  const lighting = useShellSelector((slice) => slice.lighting);
  const [environment, setEnvironment] = useState<EnvironmentSource>(FALLBACK_ENVIRONMENT);

  useEffect(() => {
    let active = true;
    fetch("/assets/hdri/manifest.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("HDRI manifest missing"))))
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? (data as HdriEntry[]) : [];
        const preferred = pickPreferredEnvironment(list);
        if (preferred) {
          setEnvironment(preferred);
        }
      })
      .catch(() => {
        if (active) setEnvironment(FALLBACK_ENVIRONMENT);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      {environment.type === "file" ? (
        <DreiEnvironment files={environment.value} background={false} blur={lighting.environmentBlur} />
      ) : (
        <DreiEnvironment
          preset={environment.value}
          background={false}
          blur={Math.max(0.05, lighting.environmentBlur + 0.15)}
        />
      )}
      {viewMode !== "top" && quality.enableContactShadows ? (
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
