"use client";

import { useEffect, useState } from "react";
import { Environment as DreiEnvironment, ContactShadows } from "@react-three/drei";
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

export default function SceneEnvironment() {
  const lighting = useShellSelector((slice) => slice.lighting);
  const [environment, setEnvironment] = useState<EnvironmentSource>(FALLBACK_ENVIRONMENT);

  useEffect(() => {
    let active = true;
    fetch("/assets/hdri/manifest.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("HDRI manifest missing"))))
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? (data as HdriEntry[]) : [];
        if (list.length > 0 && list[0].path) {
          setEnvironment({ type: "file", value: list[0].path });
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
      <ContactShadows
        opacity={0.45}
        scale={24}
        blur={3.2}
        far={8}
        resolution={1024}
        color="#000000"
      />
    </>
  );
}
