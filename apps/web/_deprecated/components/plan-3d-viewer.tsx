"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DesignDoc } from "@webinterior/shared/types";
import Experience from "../lib/three/Experience";
import type { QualityLevel } from "../lib/three/utils/Performance";
import * as THREE from "three";

interface Plan3DViewerProps {
  designDoc: DesignDoc;
  className?: string;
  actionTrigger?: { type: "reset" | "screenshot" | "quality" | "mood" | "enterRoom"; value?: any } | null;
  quality?: QualityLevel;
  onScreenshot?: (dataUrl: string) => void;
  onSelect?: (selection: { type: 'furniture' | 'floor' | 'wall'; id: string; name?: string; object: any } | null) => void;
}

export function Plan3DViewer({ designDoc, className, actionTrigger, quality, onScreenshot, onSelect }: Plan3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const experienceRef = useRef<Experience | null>(null);

  // Experience State
  const [rendererBackend, setRendererBackend] = useState<"webgl" | "webgpu">("webgl");
  const [panelOpen, setPanelOpen] = useState(true);
  const [mode, setMode] = useState<"edit" | "walk">("edit");
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{ fps: number; mb: number } | null>(null);

  // Mood State
  const [nightMix, setNightMix] = useState(0.8);
  const [neutralMix, setNeutralMix] = useState(0);
  const [lights, setLights] = useState({
    tvColor: "#ff115e",
    tvStrength: 2.0,
    deskColor: "#ff6700",
    deskStrength: 1.4,
    pcColor: "#0082ff",
    pcStrength: 1.2
  });

  const presets = useMemo(
    () => ({
      night: { nightMix: 1, neutralMix: 0 },
      day: { nightMix: 0, neutralMix: 0 },
      neutral: { nightMix: 0, neutralMix: 1 }
    }),
    []
  );

  // Initialize Experience
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const experience = new Experience({
        targetElement: containerRef.current,
        debug: process.env.NODE_ENV === "development"
      });
      experienceRef.current = experience;

      const setupSelectionListeners = () => {
        if (!experience.transformController) return;

        experience.transformController.on('selected', (data: any) => {
          if (onSelect) {
            onSelect({
              type: data.type,
              id: data.userData.id,
              name: data.userData.name,
              object: data.object
            });
          }
        });

        experience.transformController.on('deselected', () => {
          if (onSelect) onSelect(null);
        });
      };

      // Event Listeners for UI updates
      experience.on('ready', () => setIsLoading(false));

      // Handle Async Initialization
      if (experience.isInitialized) {
        setupSelectionListeners();
      } else {
        experience.on('initialized', () => {
          setupSelectionListeners();
          // Load design doc if it was pending
          if (designDoc && experience.world) {
            experience.world.loadDesignDoc(designDoc);
          }
        });
      }

      // Setup Stats polling if in dev
      if (process.env.NODE_ENV === 'development') {
        const updateStats = setInterval(() => {
          const perf = (experience as any).performance;
          if (perf) {
            setStats({ fps: perf.fps, mb: perf.memoryUsage });
          }
        }, 500);
        return () => {
          clearInterval(updateStats);
          experience.destroy();
          experienceRef.current = null;
        };
      }

    } catch (err) {
      console.error("Failed to initialize 3D Experience:", err);
      setIsLoading(false);
    }

    return () => {
      if (experienceRef.current) {
        experienceRef.current.destroy();
        experienceRef.current = null;
      }
    };
  }, []);

  // Update Design Doc
  useEffect(() => {
    const exp = experienceRef.current;
    if (exp && exp.isInitialized && exp.world && designDoc) {
      exp.world.loadDesignDoc(designDoc);
    }
  }, [designDoc]);

  // External quality control
  useEffect(() => {
    const exp = experienceRef.current;
    if (!exp || !exp.isInitialized || !quality) return;
    exp.renderer.setQuality(quality);
    exp.performance.setQuality(quality);
  }, [quality]);

  // Action triggers (reset camera, screenshots, etc.)
  useEffect(() => {
    const exp = experienceRef.current;
    if (!actionTrigger || !exp || !exp.isInitialized) return;

    if (actionTrigger.type === "reset") {
      const walls = designDoc.plan2d.walls;
      if (walls.length > 0) {
        const xs = walls.flatMap((w) => [w.a.x, w.b.x]);
        const ys = walls.flatMap((w) => [w.a.y, w.b.y]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        const radius = Math.max(maxX - minX, maxY - minY, 6);
        exp.navigation.setMode("orbit");
        exp.navigation.setTarget(new THREE.Vector3(center.x, 2, center.y), radius);
        setMode("edit");
      }
    }

    if (actionTrigger.type === "quality" && actionTrigger.value) {
      exp.renderer.setQuality(actionTrigger.value as QualityLevel);
      exp.performance.setQuality(actionTrigger.value as QualityLevel);
    }
    if (actionTrigger.type === "screenshot") {
      const renderer = exp.renderer.instance;
      const dom = (renderer as any).domElement as HTMLCanvasElement | undefined;
      const url = dom?.toDataURL?.("image/png");
      if (url && onScreenshot) onScreenshot(url);
    }
    if (actionTrigger.type === "enterRoom" && actionTrigger.value) {
      const { x, y } = actionTrigger.value as { x: number; y: number };
      exp.navigation.setMode("walk");
      exp.navigation.camera.instance.position.set(x, 1.6, y + 0.1);
      exp.navigation.camera.instance.lookAt(new THREE.Vector3(x, 1.4, y));
      setMode("walk");
    }
    if (actionTrigger.type === "mood" && actionTrigger.value) {
      const preset = actionTrigger.value as "day" | "neutral" | "night";
      const moodConfig =
        preset === "night"
          ? { nightMix: 1, neutralMix: 0 }
          : preset === "day"
            ? { nightMix: 0, neutralMix: 0 }
            : { nightMix: 0, neutralMix: 1 };
      exp.world.updateMood({
        ...moodConfig,
        lights: {
          tvColor: "#ff115e",
          tvStrength: preset === "night" ? 2.4 : 0.3,
          deskColor: "#ff6700",
          deskStrength: preset === "day" ? 0.4 : 1.0,
          pcColor: "#0082ff",
          pcStrength: preset === "night" ? 1.5 : 0.2
        }
      });
    }
  }, [actionTrigger, designDoc, onScreenshot]);

  // Update Mood
  useEffect(() => {
    const exp = experienceRef.current;
    if (exp && exp.isInitialized && exp.world) {
      exp.world.updateMood({
        nightMix,
        neutralMix,
        lights
      });
    }
  }, [nightMix, neutralMix, lights]);

  // Update Interaction Mode
  useEffect(() => {
    const exp = experienceRef.current;
    if (exp && exp.isInitialized && exp.navigation) {
      // Map UI mode to Navigation mode
      const navMode = mode === 'edit' ? 'orbit' : 'walk';
      exp.navigation.setMode(navMode);
    }
  }, [mode]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-stone-900">3D Simulation</span>
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 uppercase tracking-wide">{rendererBackend}</span>
        </div>
        <div className="flex bg-stone-100 p-1 rounded-lg">
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${mode === "edit" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"}`}
            onClick={() => setMode("edit")}
          >
            Orbit
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${mode === "walk" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"}`}
            onClick={() => setMode("walk")}
          >
            Walk
          </button>
        </div>
      </div>

      <div className={`relative w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-900 shadow-inner flex-1 min-h-[400px] ${className || ''}`} ref={containerRef}>
        {/* Stats Overlay (Dev Mode) */}
        {stats && (
          <div className="pointer-events-none absolute left-3 top-3 z-30 flex flex-col items-start gap-1 rounded bg-black/50 p-2 text-[10px] font-mono text-green-400 backdrop-blur-sm">
            <div>FPS: {stats.fps}</div>
            <div>MEM: {stats.mb} MB</div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-stone-900">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-800 border-t-stone-200" />
              <div className="text-xs font-medium text-stone-500">Initializing 3D Engine...</div>
            </div>
          </div>
        )}

        {/* Helper UI Overlay */}
        {mode === "walk" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full border border-white/60" />
            <div className="absolute inset-x-3 top-3 rounded-lg bg-black/70 px-3 py-2 text-xs text-white text-center z-10">
              (개발중) WASD 이동 / 드래그 회전
            </div>
          </div>
        ) : null}

        {/* Mood Control Panel */}
        {panelOpen ? (
          <div className="absolute right-3 top-3 w-[280px] rounded-xl border border-white/10 bg-black/80 p-3 text-xs text-white backdrop-blur z-20 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-stone-100">Mood & Lighting</div>
              <button className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20 transition" onClick={() => setPanelOpen(false)}>
                Hide
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="flex-1 rounded-md border border-white/20 bg-white/5 py-1.5 hover:bg-white/10 transition"
                onClick={() => {
                  setNightMix(presets.night.nightMix);
                  setNeutralMix(presets.night.neutralMix);
                }}
              >
                Night
              </button>
              <button
                className="flex-1 rounded-md border border-white/20 bg-white/5 py-1.5 hover:bg-white/10 transition"
                onClick={() => {
                  setNightMix(presets.day.nightMix);
                  setNeutralMix(presets.day.neutralMix);
                }}
              >
                Day
              </button>
              <button
                className="flex-1 rounded-md border border-white/20 bg-white/5 py-1.5 hover:bg-white/10 transition"
                onClick={() => {
                  setNightMix(presets.neutral.nightMix);
                  setNeutralMix(presets.neutral.neutralMix);
                }}
              >
                Neutral
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-stone-400">Night Mix</span>
                  <span className="tabular-nums text-stone-300">{Math.round(nightMix * 100)}%</span>
                </div>
                <input
                  type="range"
                  className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-stone-200"
                  min={0} max={1} step={0.01}
                  value={nightMix}
                  onChange={(e) => setNightMix(Number(e.target.value))}
                />
              </label>

              <div className="border-t border-white/10 my-2" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>TV Light</span>
                  <input type="color" className="w-4 h-4 rounded bg-transparent border-none" value={lights.tvColor} onChange={(e) => setLights((p) => ({ ...p, tvColor: e.target.value }))} />
                </div>
                <input type="range" className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-stone-200" min={0} max={4} step={0.1} value={lights.tvStrength} onChange={(e) => setLights((p) => ({ ...p, tvStrength: Number(e.target.value) }))} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Desk Light</span>
                  <input type="color" className="w-4 h-4 rounded bg-transparent border-none" value={lights.deskColor} onChange={(e) => setLights((p) => ({ ...p, deskColor: e.target.value }))} />
                </div>
                <input type="range" className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-stone-200" min={0} max={4} step={0.1} value={lights.deskStrength} onChange={(e) => setLights((p) => ({ ...p, deskStrength: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
        ) : (
          <button
            className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-xs text-white backdrop-blur hover:bg-black/80 transition z-20"
            onClick={() => setPanelOpen(true)}
          >
            Adjust Mood
          </button>
        )}
      </div>
    </div>
  );
}
