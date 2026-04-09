"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, DoorOpen, Maximize2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AuthPopup } from "../../../components/overlay/AuthPopup";
import { createProjectDraft, saveProject } from "../../../lib/api/project";
import {
  buildBuilderScene,
  builderFloorFinishes,
  builderTemplates,
  builderWallFinishes,
  type BuilderTemplateId
} from "../../../lib/builder/templates";
import { useAuthStore } from "../../../lib/stores/useAuthStore";

function buildPreviewDataUrl(points: Array<[number, number]>, openings: { type: "door" | "window"; wallId: string }[]) {
  if (points.length === 0) {
    points = [
      [0, 0],
      [6, 0],
      [6, 4],
      [0, 4]
    ];
  }
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = 24;
  const width = 640;
  const height = 420;
  const scale = Math.min(
    (width - padding * 2) / Math.max(1, maxX - minX),
    (height - padding * 2) / Math.max(1, maxY - minY)
  );

  const toPoint = ([x, y]: [number, number]) => `${padding + (x - minX) * scale},${padding + (y - minY) * scale}`;
  const polyline = points.map(toPoint).join(" ");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" rx="28" fill="#f6f1e8" />
      <g opacity="0.25" stroke="#c7baa9">
        ${Array.from({ length: 10 })
          .map((_, index) => `<line x1="0" y1="${index * 42}" x2="${width}" y2="${index * 42}" />`)
          .join("")}
        ${Array.from({ length: 15 })
          .map((_, index) => `<line x1="${index * 42}" y1="0" x2="${index * 42}" y2="${height}" />`)
          .join("")}
      </g>
      <polygon points="${polyline}" fill="#fdfbf7" stroke="#181713" stroke-width="10" stroke-linejoin="round" />
      <g fill="#c96f3b">
        ${openings
          .map((opening, index) => `<circle cx="${72 + index * 28}" cy="${height - 42}" r="8" fill="${opening.type === "door" ? "#c96f3b" : "#6b8b9d"}" />`)
          .join("")}
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function StudioBuilderPage() {
  const router = useRouter();
  const { session } = useAuthStore();
  const isAuthenticated = Boolean(session?.user);

  const [projectName, setProjectName] = useState("Untitled Room");
  const [projectDescription, setProjectDescription] = useState("Builder-authored interior concept");
  const [templateId, setTemplateId] = useState<BuilderTemplateId>("rect-studio");
  const [width, setWidth] = useState(6.4);
  const [depth, setDepth] = useState(4.8);
  const [nookWidth, setNookWidth] = useState(2.8);
  const [nookDepth, setNookDepth] = useState(2.4);
  const [wallMaterialIndex, setWallMaterialIndex] = useState(0);
  const [floorMaterialIndex, setFloorMaterialIndex] = useState(0);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const activeTemplate = useMemo(
    () => builderTemplates.find((template) => template.id === templateId) ?? builderTemplates[0],
    [templateId]
  );

  const scene = useMemo(
    () =>
      buildBuilderScene({
        templateId,
        width,
        depth,
        nookWidth,
        nookDepth
      }),
    [depth, nookDepth, nookWidth, templateId, width]
  );

  const previewDataUrl = useMemo(
    () => buildPreviewDataUrl(scene.floors[0]?.outline ?? [], scene.openings.map(({ type, wallId }) => ({ type, wallId }))),
    [scene.floors, scene.openings]
  );

  const handleCreate = async () => {
    if (!isAuthenticated) {
      setIsAuthOpen(true);
      return;
    }

    if (!projectName.trim()) {
      toast.error("Project name is required.");
      return;
    }

    setIsCreating(true);
    try {
      const project = await createProjectDraft({
        name: projectName.trim(),
        description: projectDescription.trim() || "Builder-authored interior concept"
      });

      await saveProject(project.id, {
        topology: {
          scale: scene.scale,
          scaleInfo: scene.scaleInfo,
          walls: scene.walls,
          openings: scene.openings,
          floors: scene.floors
        },
        assets: [],
        materials: {
          wallIndex: wallMaterialIndex,
          floorIndex: floorMaterialIndex
        },
        lighting: {
          ambientIntensity: 0.35,
          hemisphereIntensity: 0.4,
          directionalIntensity: 1.05,
          environmentBlur: 0.2
        },
        thumbnailDataUrl: previewDataUrl,
        projectName: projectName.trim(),
        projectDescription: projectDescription.trim() || "Builder-authored interior concept",
        message: "Builder starter scene"
      });

      router.push(`/project/${project.id}?origin=builder`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create room.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#171411] pt-24 pb-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/studio")}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4d443b] transition hover:border-black/40 hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Studio
          </button>
          <div className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7a6f64]">
            Builder First
          </div>
        </div>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] bg-[#191512] p-8 text-[#f8f2ea] shadow-[0_32px_80px_rgba(0,0,0,0.22)] sm:p-10">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d8c3ae]">
              <Sparkles className="h-4 w-4" />
              <span>IKEA-style room builder</span>
            </div>
            <h1 className="mt-6 max-w-2xl font-cormorant text-5xl font-light leading-[1.02] sm:text-6xl">
              Start from a blank room, not a floorplan upload.
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-[#d8cec4]">
              This builder creates the first editable room shell immediately. Pick a footprint, set dimensions, choose
              finishes, and jump straight into the 3D editor.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {builderTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setTemplateId(template.id);
                    setWidth(template.defaultWidth);
                    setDepth(template.defaultDepth);
                    setNookWidth(template.defaultNookWidth ?? 2.8);
                    setNookDepth(template.defaultNookDepth ?? 2.4);
                  }}
                  className={`rounded-[28px] border p-5 text-left transition ${
                    templateId === template.id
                      ? "border-white/70 bg-white/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/30"
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d9b999]">
                    {template.eyebrow}
                  </div>
                  <div className="mt-3 text-2xl font-cormorant">{template.name}</div>
                  <p className="mt-3 text-xs leading-6 text-[#d6cbc1]">{template.description}</p>
                </button>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-black/10 bg-white/70 p-4 shadow-[0_24px_70px_rgba(68,52,34,0.12)] backdrop-blur"
          >
            <div className="overflow-hidden rounded-[24px] border border-black/10 bg-[#efe7db] p-4">
              <img src={previewDataUrl} alt="Builder preview" className="h-auto w-full rounded-[20px]" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-black/10 bg-[#faf7f1] p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#887a6d]">Footprint</div>
                <div className="mt-3 text-2xl font-cormorant">{width.toFixed(1)}m</div>
                <div className="text-xs text-[#6a6057]">width</div>
              </div>
              <div className="rounded-[24px] border border-black/10 bg-[#faf7f1] p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#887a6d]">Depth</div>
                <div className="mt-3 text-2xl font-cormorant">{depth.toFixed(1)}m</div>
                <div className="text-xs text-[#6a6057]">depth</div>
              </div>
              <div className="rounded-[24px] border border-black/10 bg-[#faf7f1] p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#887a6d]">Openings</div>
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#302821]">
                  <DoorOpen className="h-4 w-4" />
                  {scene.openings.length} placed
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-8 xl:grid-cols-[1fr_0.82fr]">
          <div className="rounded-[32px] border border-black/10 bg-white/75 p-6 shadow-[0_18px_44px_rgba(68,52,34,0.1)] backdrop-blur sm:p-8">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                    Project name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    className="mt-3 w-full rounded-[18px] border border-black/10 bg-[#fcfaf6] px-4 py-4 text-sm outline-none transition focus:border-black/40"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                    Description
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(event) => setProjectDescription(event.target.value)}
                    rows={4}
                    className="mt-3 w-full rounded-[18px] border border-black/10 bg-[#fcfaf6] px-4 py-4 text-sm outline-none transition focus:border-black/40"
                  />
                </div>

                <div className="space-y-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                    Wall finish
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {builderWallFinishes.map((finish) => (
                      <button
                        key={finish.id}
                        type="button"
                        onClick={() => setWallMaterialIndex(finish.id)}
                        className={`rounded-full border px-4 py-2 text-[11px] font-semibold transition ${
                          wallMaterialIndex === finish.id
                            ? "border-black bg-black text-white"
                            : "border-black/10 bg-[#fcfaf6] text-[#51483f] hover:border-black/30"
                        }`}
                      >
                        {finish.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                    Floor finish
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {builderFloorFinishes.map((finish) => (
                      <button
                        key={finish.id}
                        type="button"
                        onClick={() => setFloorMaterialIndex(finish.id)}
                        className={`rounded-full border px-4 py-2 text-[11px] font-semibold transition ${
                          floorMaterialIndex === finish.id
                            ? "border-black bg-black text-white"
                            : "border-black/10 bg-[#fcfaf6] text-[#51483f] hover:border-black/30"
                        }`}
                      >
                        {finish.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                    <span>Room width</span>
                    <span>{width.toFixed(1)} m</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={10}
                    step={0.2}
                    value={width}
                    onChange={(event) => setWidth(Number(event.target.value))}
                    className="mt-3 w-full"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                    <span>Room depth</span>
                    <span>{depth.toFixed(1)} m</span>
                  </div>
                  <input
                    type="range"
                    min={3.6}
                    max={8}
                    step={0.2}
                    value={depth}
                    onChange={(event) => setDepth(Number(event.target.value))}
                    className="mt-3 w-full"
                  />
                </div>

                {templateId === "corner-suite" && (
                  <>
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                        <span>Nook width</span>
                        <span>{nookWidth.toFixed(1)} m</span>
                      </div>
                      <input
                        type="range"
                        min={1.6}
                        max={4}
                        step={0.1}
                        value={nookWidth}
                        onChange={(event) => setNookWidth(Number(event.target.value))}
                        className="mt-3 w-full"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                        <span>Nook depth</span>
                        <span>{nookDepth.toFixed(1)} m</span>
                      </div>
                      <input
                        type="range"
                        min={1.4}
                        max={3.6}
                        step={0.1}
                        value={nookDepth}
                        onChange={(event) => setNookDepth(Number(event.target.value))}
                        className="mt-3 w-full"
                      />
                    </div>
                  </>
                )}

                <div className="rounded-[24px] bg-[#f8f3eb] p-5">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
                    <Maximize2 className="h-4 w-4" />
                    Next step
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[#51483f]">
                    After create, the room opens in the editor immediately. You can place assets, switch top/walk views,
                    and save versions without going through floorplan analysis.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] bg-[#221d19] p-8 text-[#f9f4ee] shadow-[0_28px_70px_rgba(0,0,0,0.2)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d6baa0]">
              Launch summary
            </div>
            <div className="mt-5 text-4xl font-cormorant font-light">{activeTemplate.name}</div>
            <p className="mt-4 text-sm leading-7 text-[#d7ccc2]">{activeTemplate.description}</p>

            <div className="mt-10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 text-sm">
                <span className="text-[#cab7a6]">Footprint</span>
                <span>{width.toFixed(1)}m × {depth.toFixed(1)}m</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4 text-sm">
                <span className="text-[#cab7a6]">Wall finish</span>
                <span>{builderWallFinishes[wallMaterialIndex]?.name}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4 text-sm">
                <span className="text-[#cab7a6]">Floor finish</span>
                <span>{builderFloorFinishes[floorMaterialIndex]?.name}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4 text-sm">
                <span className="text-[#cab7a6]">Openings</span>
                <span>{scene.openings.map((opening) => opening.type).join(" + ")}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isCreating}
              className="mt-10 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#f7e8d7] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.26em] text-[#201712] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Creating Room..." : "Create room and open editor"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
