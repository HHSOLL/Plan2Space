"use client";

import { useMemo, useState, useEffect } from "react";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useSceneStore } from "../../../lib/stores/useSceneStore";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Package, ArrowRight, Sparkles, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

type CatalogItem = {
  id: string;
  label: string;
  category: string;
  assetId: string;
  scale: [number, number, number];
  description: string;
};

const DEFAULT_CATALOG: CatalogItem[] = [
  {
    id: "chair",
    label: "Minimalist Chair",
    category: "Seating",
    assetId: "placeholder:chair",
    scale: [0.8, 0.8, 0.8] as [number, number, number],
    description: "Ergonomic design with clean lines."
  },
  {
    id: "sofa",
    label: "Velvet Sofa",
    category: "Seating",
    assetId: "/assets/models/sofa_03_2k.gltf/sofa_03_2k.gltf",
    scale: [1, 1, 1] as [number, number, number],
    description: "Premium velvet texture for luxury spaces."
  },
  {
    id: "table",
    label: "Oak Round Table",
    category: "Tables",
    assetId: "/assets/models/round_wooden_table_01_2k.gltf/round_wooden_table_01_2k.gltf",
    scale: [1, 1, 1] as [number, number, number],
    description: "Solid oak wood with natural finish."
  }
];

const DEFAULT_SCALE: [number, number, number] = [1, 1, 1];

function normalizeCatalog(input: unknown): CatalogItem[] {
  if (!Array.isArray(input)) return DEFAULT_CATALOG;
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const scale = Array.isArray(record.scale) && record.scale.length === 3
        ? (record.scale as [number, number, number])
        : DEFAULT_SCALE;
      if (typeof record.id !== "string" || typeof record.assetId !== "string") return null;
      return {
        id: record.id,
        label: typeof record.label === "string" ? record.label : record.id,
        category: typeof record.category === "string" ? record.category : "Misc",
        assetId: record.assetId,
        scale,
        description: typeof record.description === "string" ? record.description : ""
      } satisfies CatalogItem;
    })
    .filter((item): item is CatalogItem => Boolean(item));
}

function computeBounds(walls: { start: [number, number]; end: [number, number] }[], scale: number) {
  if (walls.length === 0) return { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
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

export default function AssetPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>(DEFAULT_CATALOG);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorFile, setGeneratorFile] = useState<File | null>(null);
  const [generatorPreview, setGeneratorPreview] = useState<string | null>(null);
  const [provider, setProvider] = useState<"triposr" | "meshy">("triposr");
  const addFurniture = useSceneStore((state) => state.addFurniture);
  const setSelectedAssetId = useSceneStore((state) => state.setSelectedAssetId);
  const walls = useSceneStore((state) => state.walls);
  const scale = useSceneStore((state) => state.scale);

  useEffect(() => {
    let active = true;
    fetch("/assets/catalog/manifest.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Asset catalog missing"))))
      .then((data) => {
        if (!active) return;
        const normalized = normalizeCatalog(data);
        if (normalized.length > 0) setCatalog(normalized);
      })
      .catch(() => {
        if (active) setCatalog(DEFAULT_CATALOG);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (generatorPreview && generatorPreview.startsWith("blob:")) {
        URL.revokeObjectURL(generatorPreview);
      }
    };
  }, [generatorPreview]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "i") setIsOpen(prev => !prev);
      if (e.key === "Escape") setIsOpen(false);
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

  const createId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `asset-${Math.random().toString(36).slice(2, 10)}`;
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const applyPreset = () => {
    const keywords = ["sofa", "table", "bed", "chair", "lamp", "cabinet", "desk", "tv", "rug", "plant"];
    const selected: CatalogItem[] = [];
    const remaining = catalog.filter((item) => !item.assetId.startsWith("placeholder:"));
    keywords.forEach((keyword) => {
      const found = remaining.find((item) => item.label.toLowerCase().includes(keyword));
      if (found && !selected.includes(found)) selected.push(found);
    });
    while (selected.length < 10 && remaining.length > 0) {
      const next = remaining.shift();
      if (next && !selected.includes(next)) selected.push(next);
    }

    const offsets = [
      [-2.2, -1.2],
      [0, -1.2],
      [2.2, -1.2],
      [-2.2, 0.8],
      [0, 0.8],
      [2.2, 0.8],
      [-2.2, 2.6],
      [0, 2.6],
      [2.2, 2.6],
      [4.4, 1.4]
    ];

    selected.slice(0, 10).forEach((item, index) => {
      const offset = offsets[index] ?? [0, 0];
      addFurniture({
        id: createId(),
        assetId: item.assetId,
        position: [center.x + offset[0], 0, center.z + offset[1]],
        rotation: [0, 0, 0],
        scale: item.scale,
        materialId: null
      });
    });
    toast.success("Korean apartment preset deployed.");
  };

  const handleGenerate = async () => {
    if (!generatorFile) {
      toast.error("Select an image first.");
      return;
    }
    setIsGenerating(true);
    try {
      const dataUrl = await fileToDataUrl(generatorFile);
      const response = await fetch("/api/assets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dataUrl,
          fileName: generatorFile.name,
          provider
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "Asset generation failed.");
      }

      let result = data;
      if (data.status === "processing" && data.jobId) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const poll = await fetch(`/api/assets/generate?jobId=${encodeURIComponent(data.jobId)}`);
          const pollData = await poll.json().catch(() => null);
          if (pollData?.status === "complete") {
            result = pollData;
            break;
          }
          if (pollData?.status !== "processing") {
            throw new Error(pollData?.error ?? "Asset generation failed.");
          }
        }
      }

      if (result?.status !== "complete") {
        throw new Error("Generation timed out. Try again.");
      }

      const asset = result.asset as { assetUrl: string; label: string; description: string; category: string };
      const item: CatalogItem = {
        id: asset.assetUrl ?? createId(),
        label: asset.label ?? "Generated Asset",
        category: asset.category ?? "Custom",
        assetId: asset.assetUrl,
        scale: [1, 1, 1],
        description: asset.description ?? "Generated via AI pipeline."
      };

      setCatalog((prev) => [item, ...prev]);
      const id = createId();
      addFurniture({
        id,
        assetId: item.assetId,
        position: [center.x, 0, center.z],
        rotation: [0, 0, 0],
        scale: item.scale,
        materialId: null
      });
      setSelectedAssetId(id);
      setIsGeneratorOpen(false);
      setGeneratorFile(null);
      setGeneratorPreview(null);
      toast.success("Custom asset deployed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Asset generation failed.";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-12 pointer-events-none bg-white/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="relative w-full max-w-5xl h-full max-h-[80vh] bg-white rounded-sm overflow-hidden pointer-events-auto border border-[#e5e5e0] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-12 flex items-center justify-between border-b border-[#e5e5e0]">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-[#f3f3f1] rounded-full">
                  <Package className="w-6 h-6 text-black/40" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-4xl font-cormorant font-light">Asset Catalog</h2>
                  <p className="text-[9px] text-[#999999] font-bold uppercase tracking-[0.4em]">Select components for spatial integration</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={applyPreset}
                  className="px-4 py-3 border border-[#e5e5e0] text-[9px] font-bold uppercase tracking-[0.3em] text-[#999999] hover:text-black hover:border-black transition-all flex items-center gap-2"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Preset
                </button>
                <button
                  onClick={() => setIsGeneratorOpen(true)}
                  className="px-4 py-3 border border-[#e5e5e0] text-[9px] font-bold uppercase tracking-[0.3em] text-[#999999] hover:text-black hover:border-black transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-4 hover:bg-black/5 rounded-full transition-colors group"
                >
                  <X className="w-6 h-6 text-[#999999] group-hover:text-black" />
                </button>
              </div>
            </div>

            {/* Catalog Grid */}
            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {catalog.map((item) => (
                  <motion.div
                    key={item.id}
                    className="arch-card group flex flex-col rounded-sm overflow-hidden"
                  >
                    <div className="aspect-[4/3] bg-[#f3f3f1] flex items-center justify-center relative overflow-hidden">
                      <Package className="w-12 h-12 text-black/5 group-hover:scale-110 transition-transform duration-700 font-light" />
                      <div className="absolute top-6 left-6 px-3 py-1 bg-white border border-[#e5e5e0] text-[8px] font-bold uppercase tracking-widest text-[#999999]">
                        {item.category}
                      </div>
                    </div>
                    <div className="p-8 space-y-8 flex-1 flex flex-col justify-between border-t border-[#e5e5e0]">
                      <div className="space-y-2">
                        <h3 className="text-xl font-cormorant font-light text-black">{item.label}</h3>
                        <p className="text-[10px] text-[#999999] font-medium uppercase tracking-[0.1em] line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const id = createId();
                          addFurniture({
                            id,
                            assetId: item.assetId,
                            position: [center.x, 0, center.z],
                            rotation: [0, 0, 0],
                            scale: item.scale,
                            materialId: null
                          });
                          setSelectedAssetId(id);
                          setIsOpen(false);
                          toast.success(`${item.label} initialized. Drag to place (R to rotate).`);
                        }}
                        className="w-full py-4 border border-[#1a1a1a] text-[9px] font-bold uppercase tracking-[0.3em] hover:bg-[#1a1a1a] hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        Deploy Asset
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 bg-[#fdfdfc] border-t border-[#e5e5e0] flex items-center justify-between">
              <div className="flex items-center gap-3 text-[9px] text-[#999999] font-bold uppercase tracking-[0.3em]">
                <Search className="w-3 h-3" />
                Index <span className="text-black mx-1">/</span> Search Library
              </div>
              <div className="text-[9px] text-[#999999] font-bold uppercase tracking-[0.3em]">
                {catalog.length} Components Available
              </div>
            </div>

            <AnimatePresence>
              {isGeneratorOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/70 backdrop-blur-md flex items-center justify-center p-10"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    className="w-full max-w-2xl bg-white rounded-sm border border-[#e5e5e0] shadow-2xl overflow-hidden"
                  >
                    <div className="p-8 flex items-center justify-between border-b border-[#e5e5e0]">
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-[0.4em] text-[#999999]">Custom Asset</div>
                        <h3 className="text-3xl font-cormorant font-light">Generate from Image</h3>
                      </div>
                      <button
                        onClick={() => setIsGeneratorOpen(false)}
                        className="p-3 hover:bg-black/5 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5 text-[#999999]" />
                      </button>
                    </div>
                    <div className="p-8 grid gap-6 md:grid-cols-[1.2fr_1fr]">
                      <label className="flex flex-col items-center justify-center rounded-sm border border-dashed border-[#e5e5e0] bg-[#f9f9f7] text-[#999999] text-[10px] uppercase tracking-[0.3em] h-48 cursor-pointer hover:bg-white transition">
                        {generatorPreview ? (
                          <img src={generatorPreview} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                          "Click to upload image"
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            setGeneratorFile(file);
                            if (generatorPreview && generatorPreview.startsWith("blob:")) {
                              URL.revokeObjectURL(generatorPreview);
                            }
                            if (file) {
                              const previewUrl = URL.createObjectURL(file);
                              setGeneratorPreview(previewUrl);
                            } else {
                              setGeneratorPreview(null);
                            }
                          }}
                        />
                      </label>
                      <div className="space-y-4">
                        <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#999999]">Provider</div>
                        <select
                          value={provider}
                          onChange={(event) => setProvider(event.target.value as "triposr" | "meshy")}
                          className="w-full border border-[#e5e5e0] bg-white px-4 py-3 text-xs uppercase tracking-[0.2em]"
                        >
                          <option value="triposr">TripoSR</option>
                          <option value="meshy">Meshy</option>
                        </select>
                        <button
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          className="w-full py-4 border border-[#1a1a1a] text-[9px] font-bold uppercase tracking-[0.3em] hover:bg-[#1a1a1a] hover:text-white transition-all disabled:opacity-50"
                        >
                          {isGenerating ? "Generating..." : "Generate Asset"}
                        </button>
                        <p className="text-[10px] text-[#999999] uppercase tracking-[0.2em]">
                          Requires API key configuration.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* Trigger Hint */}
      {!isOpen && (
        <div className="fixed bottom-12 right-12 z-[90] flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center bg-white border border-[#e5e5e0] rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm">i</div>
          <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-[#999999]">Inventory</span>
        </div>
      )}
    </AnimatePresence>
  );
}
