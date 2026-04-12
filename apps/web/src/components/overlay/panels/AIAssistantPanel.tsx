"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Action } from "@json-render/core";
import { JSONUIProvider, Renderer, useDataValue, type ComponentRenderProps } from "@json-render/react";
import { aiAssistantStub } from "../../../lib/ai-ui/stub";
import { constrainPlacementToAnchor } from "../../../lib/scene/anchors";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import {
  useAssetSelector,
  useSelectionSelector,
  useShellSelector
} from "../../../lib/stores/scene-slices";

const WALL_MATERIAL_COUNT = 3;
const FLOOR_MATERIAL_COUNT = 3;
const DEFAULT_ASSET = "/assets/models/WoodenChair_01/WoodenChair_01_1k.gltf";

type PanelProps = { title: string; subtitle?: string };
type SectionProps = { title: string };
type StatProps = { label: string; valuePath: string; suffix?: string };
type ActionButtonProps = { label: string; hint?: string; action: Action };

const Panel = ({ element, children }: ComponentRenderProps<PanelProps>) => (
  <div className="flex flex-col gap-5">
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/40">Assistant</div>
      <h3 className="mt-2 text-2xl font-light text-black">
        {element.props.title}
      </h3>
      {element.props.subtitle ? (
        <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-black/40 font-semibold">
          {element.props.subtitle}
        </p>
      ) : null}
    </div>
    <div className="flex flex-col gap-5">{children}</div>
  </div>
);

const Section = ({ element, children }: ComponentRenderProps<SectionProps>) => (
  <section className="rounded-2xl border border-black/10 bg-white/70 p-4 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.2)]">
    <div className="text-[9px] font-bold uppercase tracking-[0.32em] text-black/40">
      {element.props.title}
    </div>
    <div className="mt-3 flex flex-col gap-3">{children}</div>
  </section>
);

const Stat = ({ element }: ComponentRenderProps<StatProps>) => {
  const value = useDataValue<unknown>(element.props.valuePath);
  const suffix = element.props.suffix ?? "";
  const display =
    value === null || value === undefined || value === ""
      ? "--"
      : typeof value === "number"
        ? `${value.toFixed(2).replace(/\.00$/, "")}${suffix}`
        : `${String(value)}${suffix}`;

  return (
    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-black/50">
      <span>{element.props.label}</span>
      <span className="text-black">{display}</span>
    </div>
  );
};

const ActionButton = ({ element, onAction }: ComponentRenderProps<ActionButtonProps>) => (
  <button
    type="button"
    onClick={() => (onAction ? onAction(element.props.action) : undefined)}
    className="w-full rounded-full border border-black/20 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-black/70 transition-all hover:border-black hover:text-black"
  >
    <div className="flex flex-col gap-1">
      <span>{element.props.label}</span>
      {element.props.hint ? (
        <span className="text-[9px] font-medium tracking-[0.2em] text-black/40">{element.props.hint}</span>
      ) : null}
    </div>
  </button>
);

const registry = {
  Panel,
  Section,
  Stat,
  ActionButton
};

function computeBounds(walls: { start: [number, number]; end: [number, number] }[], scale: number) {
  if (walls.length === 0) return { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  walls.forEach((wall) => {
    [wall.start, wall.end].forEach(([x, z]) => {
      minX = Math.min(minX, x * scale);
      maxX = Math.max(maxX, x * scale);
      minZ = Math.min(minZ, z * scale);
      maxZ = Math.max(maxZ, z * scale);
    });
  });
  return { minX, maxX, minZ, maxZ };
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `asset-${Math.random().toString(36).slice(2, 10)}`;
}

export default function AIAssistantPanel() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const walls = useShellSelector((slice) => slice.walls);
  const ceilings = useShellSelector((slice) => slice.ceilings);
  const openings = useShellSelector((slice) => slice.openings);
  const scale = useShellSelector((slice) => slice.scale);
  const wallMaterialIndex = useShellSelector((slice) => slice.wallMaterialIndex);
  const floorMaterialIndex = useShellSelector((slice) => slice.floorMaterialIndex);
  const setWallMaterialIndex = useShellSelector((slice) => slice.setWallMaterialIndex);
  const setFloorMaterialIndex = useShellSelector((slice) => slice.setFloorMaterialIndex);
  const assets = useAssetSelector((slice) => slice.assets);
  const addFurniture = useAssetSelector((slice) => slice.addFurniture);
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const setSelectedAssetId = useSelectionSelector((slice) => slice.setSelectedAssetId);

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "a") setIsOpen((prev) => !prev);
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const center = useMemo(() => {
    const bounds = computeBounds(walls, scale);
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2
    };
  }, [scale, walls]);
  const anchorContext = useMemo(
    () => ({
      walls,
      ceilings,
      scale,
      sceneAssets: assets
    }),
    [assets, ceilings, scale, walls]
  );

  const data = useMemo(
    () => ({
      scene: {
        walls: walls.length,
        openings: openings.length,
        assets: assets.length,
        scale: Number.isFinite(scale) ? Number(scale.toFixed(2)) : 1
      },
      materials: {
        wallIndex: wallMaterialIndex + 1,
        floorIndex: floorMaterialIndex + 1
      },
      selection: {
        assetId: selectedAssetId ?? "none"
      }
    }),
    [assets.length, floorMaterialIndex, openings.length, scale, selectedAssetId, wallMaterialIndex, walls.length]
  );

  const dataKey = useMemo(
    () =>
      `${walls.length}-${openings.length}-${assets.length}-${scale}-${wallMaterialIndex}-${floorMaterialIndex}-${selectedAssetId ?? "none"}`,
    [walls.length, openings.length, assets.length, scale, wallMaterialIndex, floorMaterialIndex, selectedAssetId]
  );

  const actionHandlers = useMemo(
    () => ({
      next_wall_material: () =>
        setWallMaterialIndex((wallMaterialIndex + 1) % WALL_MATERIAL_COUNT),
      next_floor_material: () =>
        setFloorMaterialIndex((floorMaterialIndex + 1) % FLOOR_MATERIAL_COUNT),
      drop_chair: () => {
        const id = createId();
        const anchoredPlacement = constrainPlacementToAnchor(
          {
            position: [center.x, 0, center.z],
            rotation: [0, 0, 0],
            anchorType: "floor"
          },
          anchorContext
        );
        addFurniture({
          id,
          assetId: DEFAULT_ASSET,
          anchorType: anchoredPlacement.anchorType,
          position: anchoredPlacement.position,
          rotation: anchoredPlacement.rotation,
          scale: [1, 1, 1],
          materialId: null
        });
        setSelectedAssetId(id);
      }
    }),
    [
      addFurniture,
      anchorContext,
      center.x,
      center.z,
      floorMaterialIndex,
      setFloorMaterialIndex,
      setSelectedAssetId,
      setWallMaterialIndex,
      wallMaterialIndex
    ]
  );

  if (viewMode !== "top" && viewMode !== "walk") return null;

  return (
    <>
      <div className="fixed right-4 sm:right-10 bottom-4 sm:bottom-24 z-[110] pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-pressed={isOpen}
          className="flex items-center gap-2 sm:gap-3 rounded-full border border-white/10 bg-white/10 px-4 sm:px-5 py-2.5 sm:py-3 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.22em] sm:tracking-[0.3em] text-white/70 backdrop-blur-lg transition-all hover:text-white hover:bg-white/20"
        >
          <Sparkles className="h-4 w-4" />
          AI Panel
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="fixed left-3 right-3 sm:left-auto sm:right-10 bottom-16 sm:bottom-36 z-[120] sm:w-[360px] max-h-[74vh] sm:max-h-[70vh] overflow-hidden rounded-[20px] sm:rounded-[28px] bg-white/90 text-black shadow-2xl backdrop-blur-2xl border border-white/30 pointer-events-auto"
          >
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/50">
                Assistant (A)
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close AI assistant panel"
                className="rounded-full p-2 text-black/40 transition-colors hover:text-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              <JSONUIProvider key={dataKey} registry={registry} initialData={data} actionHandlers={actionHandlers}>
                <Renderer tree={aiAssistantStub} registry={registry} />
              </JSONUIProvider>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
