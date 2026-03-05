"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Check, Loader2, Copy } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useProjectStore } from "../../lib/stores/useProjectStore";
import { useSceneStore } from "../../lib/stores/useSceneStore";
import { saveProject } from "../../lib/api/project";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FloorplanEditor } from "../editor/FloorplanEditor";
import { createUnknownScaleInfo, getScaleGateMessage, parseScaleInfo } from "../../lib/ai/scaleInfo";

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: () => void;
}

type AnalysisRecovery = {
    message: string;
    providerErrors: string[];
    errorCode?: string | null;
};

export function NewProjectModal({ isOpen, onClose, onCreated }: NewProjectModalProps) {
    const router = useRouter();
    const [name, setName] = useState("");
    const [image, setImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [step, setStep] = useState<"upload" | "edit">("upload");
    const [analysisRecovery, setAnalysisRecovery] = useState<AnalysisRecovery | null>(null);
    const [catalogApartmentName, setCatalogApartmentName] = useState("");
    const [catalogTypeName, setCatalogTypeName] = useState("");
    const [catalogRegion, setCatalogRegion] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { createProject } = useProjectStore();
    const {
        walls,
        openings,
        assets,
        scale,
        scaleInfo,
        wallMaterialIndex,
        floorMaterialIndex,
        setWalls,
        setOpenings,
        setScale,
        resetScene
    } = useSceneStore();

    useEffect(() => {
        if (!isOpen) return;
        resetScene();
        setStep("upload");
        setImage(null);
        setIsAnalyzing(false);
        setName("");
        setAnalysisRecovery(null);
        setCatalogApartmentName("");
        setCatalogTypeName("");
        setCatalogRegion("");
    }, [isOpen, resetScene]);

    const createPlaceholderFloorplanDataUrl = () => {
        if (typeof document === "undefined") return null;
        const width = 1280;
        const height = 900;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = "#f4f4f2";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "rgba(0,0,0,0.08)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += 64) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += 64) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.font = "600 18px sans-serif";
        ctx.fillText("Template-based floorplan (no source image)", 24, 42);
        return canvas.toDataURL("image/png");
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Image upload only (PNG/JPEG).");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            setImage(dataUrl);
            setIsAnalyzing(true);
            try {
                const response = await fetch("/api/ai/parse-floorplan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: "upload", base64: dataUrl, mimeType: file.type })
                });
                const data = await response.json().catch(() => null);
                if (!data || typeof data !== "object" || Array.isArray(data)) {
                    throw new Error("Invalid analysis response.");
                }
                const payload = data as {
                    walls?: any[];
                    openings?: any[];
                    scale?: number;
                    scaleInfo?: unknown;
                    metadata?: {
                        scale?: number;
                        scaleInfo?: unknown;
                    };
                    warning?: string;
                    recoverable?: boolean;
                    errorCode?: string;
                    details?: string;
                    error?: string;
                    errors?: string[];
                    providerErrors?: string[];
                    candidates?: Array<{ provider?: string; errors?: string[] }>;
                    providerOrder?: string[];
                    forceProvider?: string | null;
                };
                const debugErrors = Array.isArray(payload.errors)
                    ? payload.errors
                    : Array.isArray(payload.providerErrors)
                        ? payload.providerErrors
                        : [];
                if (!response.ok) {
                    const details = payload?.details || payload?.error || "AI analysis failed.";
                    if (response.status === 422 && payload?.recoverable) {
                        setWalls([]);
                        setOpenings([]);
                        setScale(1, createUnknownScaleInfo(1, details));
                        setAnalysisRecovery({
                            message: details,
                            providerErrors: debugErrors,
                            errorCode: payload.errorCode ?? null
                        });
                        setStep("edit");
                        toast.error("AI analysis failed. Continue in 2D manual correction mode.");
                        return;
                    }
                    throw new Error(details);
                }

                if (debugErrors.length > 0) {
                    const details = debugErrors.join(" | ");
                    console.error("[parse-floorplan] provider errors:", details);
                    if (payload.providerOrder || payload.forceProvider) {
                        console.error("[parse-floorplan] provider meta:", {
                            providerOrder: payload.providerOrder,
                            forceProvider: payload.forceProvider
                        });
                    }
                }
                if (payload.warning || debugErrors.length > 0) {
                    toast.error(payload.warning ?? debugErrors[0]);
                }
                setAnalysisRecovery(null);

                const nextWalls = Array.isArray(payload.walls) ? payload.walls : [];
                const nextOpenings = Array.isArray(payload.openings) ? payload.openings : [];
                const normalizedWalls = nextWalls.map((wall: any) => ({
                    id: wall.id,
                    start: wall.start,
                    end: wall.end,
                    thickness: wall.thickness,
                    height: typeof wall.height === "number" && wall.height > 0 ? wall.height : 2.8,
                    type: wall.type,
                    isPartOfBalcony: wall.isPartOfBalcony,
                    confidence: typeof wall.confidence === "number" ? wall.confidence : undefined
                }));
                setWalls(normalizedWalls as any);
                setOpenings(
                    nextOpenings.map((opening: any) => ({
                        id: opening.id,
                        wallId: opening.wallId,
                        type: opening.type,
                        offset: opening.offset,
                        width: opening.width,
                        height: opening.height,
                        isEntrance: opening.isEntrance,
                        detectConfidence: typeof opening.detectConfidence === "number" ? opening.detectConfidence : undefined,
                        attachConfidence: typeof opening.attachConfidence === "number" ? opening.attachConfidence : undefined,
                        typeConfidence: typeof opening.typeConfidence === "number" ? opening.typeConfidence : undefined
                    }))
                );
                const entrance = nextOpenings.find((opening: any) => opening.isEntrance);
                if (entrance?.id) {
                    useSceneStore.setState({ entranceId: entrance.id });
                }
                const normalizedScale =
                    typeof payload.metadata?.scale === "number" && payload.metadata.scale > 0
                        ? payload.metadata.scale
                        : typeof payload.scale === "number" && payload.scale > 0
                            ? payload.scale
                            : 1;
                const nextScaleInfo = parseScaleInfo(payload.metadata?.scaleInfo ?? payload.scaleInfo, normalizedScale);
                setScale(normalizedScale, nextScaleInfo);
                setStep("edit");
            } catch (error) {
                const message = error instanceof Error ? error.message : "AI analysis failed.";
                setWalls([]);
                setOpenings([]);
                setScale(1, createUnknownScaleInfo(1, message));
                setAnalysisRecovery({
                    message,
                    providerErrors: []
                });
                toast.error(message);
                setStep("edit");
            } finally {
                setIsAnalyzing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleCatalogLookup = async () => {
        if (!catalogApartmentName.trim() || !catalogTypeName.trim()) {
            toast.error("Apartment name and type are required.");
            return;
        }
        const placeholder = createPlaceholderFloorplanDataUrl();
        if (placeholder) {
            setImage(placeholder);
        }
        setIsAnalyzing(true);
        setStep("edit");
        setAnalysisRecovery(null);
        try {
            const response = await fetch("/api/ai/parse-floorplan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "catalog",
                    catalogQuery: {
                        apartmentName: catalogApartmentName.trim(),
                        typeName: catalogTypeName.trim(),
                        region: catalogRegion.trim() || undefined
                    }
                })
            });

            const data = await response.json().catch(() => null);
            if (!data || typeof data !== "object" || Array.isArray(data)) {
                throw new Error("Invalid catalog analysis response.");
            }
            const payload = data as {
                walls?: any[];
                openings?: any[];
                scale?: number;
                scaleInfo?: unknown;
                metadata?: {
                    scale?: number;
                    scaleInfo?: unknown;
                };
                recoverable?: boolean;
                errorCode?: string;
                details?: string;
                error?: string;
                errors?: string[];
                providerErrors?: string[];
            };
            const debugErrors = Array.isArray(payload.errors)
                ? payload.errors
                : Array.isArray(payload.providerErrors)
                    ? payload.providerErrors
                    : [];

            if (!response.ok) {
                const details = payload.details || payload.error || "Template lookup failed.";
                if (response.status === 422 && payload.recoverable) {
                    setWalls([]);
                    setOpenings([]);
                    setScale(1, createUnknownScaleInfo(1, details));
                    setAnalysisRecovery({
                        message: details,
                        providerErrors: debugErrors,
                        errorCode: payload.errorCode ?? null
                    });
                    toast.error("Template lookup failed. Continue in manual 2D correction mode.");
                    return;
                }
                throw new Error(details);
            }

            const nextWalls = Array.isArray(payload.walls) ? payload.walls : [];
            const nextOpenings = Array.isArray(payload.openings) ? payload.openings : [];
            setWalls(
                nextWalls.map((wall: any) => ({
                    id: wall.id,
                    start: wall.start,
                    end: wall.end,
                    thickness: wall.thickness,
                    height: typeof wall.height === "number" && wall.height > 0 ? wall.height : 2.8,
                    type: wall.type,
                    isPartOfBalcony: wall.isPartOfBalcony,
                    confidence: typeof wall.confidence === "number" ? wall.confidence : undefined
                })) as any
            );
            setOpenings(
                nextOpenings.map((opening: any) => ({
                    id: opening.id,
                    wallId: opening.wallId,
                    type: opening.type,
                    offset: opening.offset,
                    width: opening.width,
                    height: opening.height,
                    isEntrance: opening.isEntrance,
                    detectConfidence: typeof opening.detectConfidence === "number" ? opening.detectConfidence : undefined,
                    attachConfidence: typeof opening.attachConfidence === "number" ? opening.attachConfidence : undefined,
                    typeConfidence: typeof opening.typeConfidence === "number" ? opening.typeConfidence : undefined
                }))
            );
            const entrance = nextOpenings.find((opening: any) => opening.isEntrance);
            if (entrance?.id) {
                useSceneStore.setState({ entranceId: entrance.id });
            }
            const normalizedScale =
                typeof payload.metadata?.scale === "number" && payload.metadata.scale > 0
                    ? payload.metadata.scale
                    : typeof payload.scale === "number" && payload.scale > 0
                        ? payload.scale
                        : 1;
            const nextScaleInfo = parseScaleInfo(payload.metadata?.scaleInfo ?? payload.scaleInfo, normalizedScale);
            setScale(normalizedScale, nextScaleInfo);
            setAnalysisRecovery(null);
            toast.success("Template matched. Review and create the project.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Template lookup failed.";
            setWalls([]);
            setOpenings([]);
            setScale(1, createUnknownScaleInfo(1, message));
            setAnalysisRecovery({
                message,
                providerErrors: []
            });
            toast.error(message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleConfirm = async () => {
        if (!name.trim()) {
            toast.error("Project name is required.");
            return;
        }
        if (walls.length === 0) {
            toast.error("Add at least one wall before creating the project.");
            return;
        }
        const scaleGateMessage = getScaleGateMessage(scale, scaleInfo);
        if (scaleGateMessage) {
            toast.error(scaleGateMessage);
            return;
        }
        setIsAnalyzing(true);
        try {
            const project = await createProject({
                name: name.trim(),
                thumbnail: image || undefined,
                description: "AI topology verified",
                metadata: {
                    floorPlan: {
                        scale,
                        scaleInfo,
                        walls,
                        openings
                    }
                }
            });
            try {
                await saveProject(project.id, {
                    topology: {
                        scale,
                        scaleInfo,
                        walls,
                        openings
                    },
                    assets,
                    materials: {
                        wallIndex: wallMaterialIndex,
                        floorIndex: floorMaterialIndex
                    },
                    thumbnailDataUrl: image ?? null,
                    projectName: name.trim(),
                    projectDescription: "AI topology verified"
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Cloud save failed.";
                toast.error(message);
            }
            onCreated?.();
            onClose();
            router.push(`/project/${project.id}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create project.";
            toast.error(message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleCopyRecoveryErrors = async () => {
        if (!analysisRecovery) return;
        const lines = [
            analysisRecovery.message,
            ...(analysisRecovery.errorCode ? [`Code: ${analysisRecovery.errorCode}`] : []),
            ...(analysisRecovery.providerErrors.length > 0 ? ["", ...analysisRecovery.providerErrors] : [])
        ];
        try {
            await navigator.clipboard.writeText(lines.join("\n"));
            toast.success("Recovery details copied.");
        } catch {
            toast.error("Failed to copy recovery details.");
        }
    };

    const handleRetryAnalysis = async () => {
        if (!image || !image.startsWith("data:image/")) {
            toast.error("Re-upload the source image to retry analysis.");
            return;
        }
        const mimeMatch = image.match(/^data:(image\/(?:png|jpeg));base64,/);
        const mimeType = mimeMatch?.[1];
        setIsAnalyzing(true);
        try {
            const response = await fetch("/api/ai/parse-floorplan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "upload", base64: image, mimeType })
            });
            const data = await response.json().catch(() => null);
            if (!data || typeof data !== "object" || Array.isArray(data)) {
                throw new Error("Invalid analysis response.");
            }
            const payload = data as {
                walls?: any[];
                openings?: any[];
                scale?: number;
                scaleInfo?: unknown;
                metadata?: { scale?: number; scaleInfo?: unknown };
                recoverable?: boolean;
                errorCode?: string;
                details?: string;
                error?: string;
                errors?: string[];
                providerErrors?: string[];
            };
            const debugErrors = Array.isArray(payload.errors)
                ? payload.errors
                : Array.isArray(payload.providerErrors)
                    ? payload.providerErrors
                    : [];
            if (!response.ok) {
                const details = payload.details || payload.error || "AI analysis failed.";
                if (response.status === 422 && payload.recoverable) {
                    setWalls([]);
                    setOpenings([]);
                    setScale(1, createUnknownScaleInfo(1, details));
                    setAnalysisRecovery({
                        message: details,
                        providerErrors: debugErrors,
                        errorCode: payload.errorCode ?? null
                    });
                    toast.error("AI analysis failed. Continue in manual 2D correction mode.");
                    return;
                }
                throw new Error(details);
            }
            const nextWalls = Array.isArray(payload.walls) ? payload.walls : [];
            const nextOpenings = Array.isArray(payload.openings) ? payload.openings : [];
            setWalls(
                nextWalls.map((wall: any) => ({
                    id: wall.id,
                    start: wall.start,
                    end: wall.end,
                    thickness: wall.thickness,
                    height: typeof wall.height === "number" && wall.height > 0 ? wall.height : 2.8,
                    type: wall.type,
                    isPartOfBalcony: wall.isPartOfBalcony,
                    confidence: typeof wall.confidence === "number" ? wall.confidence : undefined
                })) as any
            );
            setOpenings(
                nextOpenings.map((opening: any) => ({
                    id: opening.id,
                    wallId: opening.wallId,
                    type: opening.type,
                    offset: opening.offset,
                    width: opening.width,
                    height: opening.height,
                    isEntrance: opening.isEntrance,
                    detectConfidence: typeof opening.detectConfidence === "number" ? opening.detectConfidence : undefined,
                    attachConfidence: typeof opening.attachConfidence === "number" ? opening.attachConfidence : undefined,
                    typeConfidence: typeof opening.typeConfidence === "number" ? opening.typeConfidence : undefined
                }))
            );
            const entrance = nextOpenings.find((opening: any) => opening.isEntrance);
            if (entrance?.id) {
                useSceneStore.setState({ entranceId: entrance.id });
            }
            const normalizedScale =
                typeof payload.metadata?.scale === "number" && payload.metadata.scale > 0
                    ? payload.metadata.scale
                    : typeof payload.scale === "number" && payload.scale > 0
                        ? payload.scale
                        : 1;
            const nextScaleInfo = parseScaleInfo(payload.metadata?.scaleInfo ?? payload.scaleInfo, normalizedScale);
            setScale(normalizedScale, nextScaleInfo);
            setAnalysisRecovery(null);
            toast.success("AI analysis retried successfully.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to retry AI analysis.";
            toast.error(message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleStartManual = () => {
        const message = analysisRecovery?.message ?? "Continue in manual 2D correction mode.";
        setWalls([]);
        setOpenings([]);
        setScale(1, createUnknownScaleInfo(1, message));
        setStep("edit");
        toast.message("Manual correction mode enabled.");
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-white/60 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.98 }}
                        className={`relative w-full bg-white rounded-t-2xl sm:rounded-sm border border-[#e5e5e0] shadow-2xl ${step === "edit" ? "max-w-6xl p-4 sm:p-6 md:p-8 h-[92vh] sm:h-[88vh] md:h-[85vh]" : "max-w-xl p-6 sm:p-10 md:p-16 max-h-[92vh] overflow-y-auto"}`}
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2 sm:p-3 hover:bg-black/5 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-[#999999]" />
                        </button>

                        {step === "upload" && (
                            <div className="space-y-8 sm:space-y-12">
                                <div className="space-y-4">
                                    <h2 className="text-3xl sm:text-4xl font-cormorant font-light tracking-tight">Initialize Studio</h2>
                                    <p className="text-[10px] text-[#999999] font-bold uppercase tracking-widest leading-relaxed">
                                        Upload your architectural drawing for spatial analysis.
                                    </p>
                                </div>

                                <div className="space-y-6 sm:space-y-8">
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#999999]">Project Identity</label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. Minimalist Urban Loft"
                                            className="w-full bg-[#f9f9f7] border border-[#e5e5e0] rounded-sm py-5 px-6 text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:border-black transition-all"
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#999999]">Blueprint Visualization</label>
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="relative aspect-video rounded-sm border-2 border-dashed border-[#e5e5e0] bg-[#f9f9f7] hover:bg-stone-50 transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center group"
                                        >
                                            {image ? (
                                                <>
                                                    <img
                                                        src={image}
                                                        alt="Uploaded blueprint preview"
                                                        className="absolute inset-0 w-full h-full object-cover opacity-60"
                                                    />
                                                    <div className="relative z-10 flex flex-col items-center gap-2 bg-white/80 backdrop-blur-sm p-4 rounded-sm border border-[#e5e5e0] shadow-sm">
                                                        <Check className="w-4 h-4 text-emerald-500" />
                                                        <span className="text-[9px] font-bold uppercase tracking-widest">Image Uploaded</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center gap-4 text-black/20 group-hover:text-black/40 transition-colors">
                                                    <div className="p-4 rounded-full border border-current">
                                                        <Upload className="w-5 h-5" />
                                                    </div>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">Drop blueprint here or click to browse</span>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 rounded-sm border border-[#e5e5e0] bg-[#fafaf8] p-4">
                                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8b8b84]">
                                            Template Catalog (Apartment + Type)
                                        </p>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <input
                                                value={catalogApartmentName}
                                                onChange={(event) => setCatalogApartmentName(event.target.value)}
                                                placeholder="Apartment name"
                                                className="w-full rounded-sm border border-[#e5e5e0] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] focus:outline-none focus:border-black"
                                            />
                                            <input
                                                value={catalogTypeName}
                                                onChange={(event) => setCatalogTypeName(event.target.value)}
                                                placeholder="Type (84A)"
                                                className="w-full rounded-sm border border-[#e5e5e0] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] focus:outline-none focus:border-black"
                                            />
                                            <input
                                                value={catalogRegion}
                                                onChange={(event) => setCatalogRegion(event.target.value)}
                                                placeholder="Region (optional)"
                                                className="w-full rounded-sm border border-[#e5e5e0] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] focus:outline-none focus:border-black"
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleCatalogLookup}
                                                disabled={isAnalyzing}
                                                className="rounded-sm border border-black px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-40"
                                            >
                                                Find Template
                                            </button>
                                        </div>
                                    </div>

                                    {isAnalyzing && (
                                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] text-[#999999]">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            SPATIAL ANALYSIS IN PROGRESS
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === "edit" && image && (
                            <div className="flex h-full flex-col gap-6">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <h2 className="text-2xl sm:text-3xl font-cormorant font-light tracking-tight">2D Plan Correction</h2>
                                        <p className="text-[10px] text-[#999999] font-bold uppercase tracking-widest">
                                            Adjust AI-detected walls before creating the project.
                                        </p>
                                    </div>
                                    <div className="flex w-full lg:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Project name"
                                            className="w-full sm:min-w-[240px] bg-[#f9f9f7] border border-[#e5e5e0] rounded-sm py-3 px-4 text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-black transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleConfirm}
                                            disabled={isAnalyzing}
                                            className="w-full sm:w-auto px-6 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-stone-800 transition-all disabled:opacity-50"
                                        >
                                            {isAnalyzing ? "CREATING..." : "CREATE PROJECT"}
                                        </button>
                                    </div>
                                </div>

                                {analysisRecovery && (
                                    <div className="rounded-sm border border-amber-300 bg-amber-50 p-4 text-[11px] text-amber-900">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="space-y-1">
                                                <p className="font-semibold uppercase tracking-[0.2em] text-[9px]">Recoverable AI Failure</p>
                                                <p>{analysisRecovery.message}</p>
                                                {analysisRecovery.errorCode && (
                                                    <p className="text-[10px] text-amber-800/80">
                                                        Code: {analysisRecovery.errorCode}
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-amber-800/80">
                                                    Continue by drawing walls manually and calibrating scale in the editor.
                                                </p>
                                            </div>
                                            <div className="flex w-full sm:w-auto flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleCopyRecoveryErrors}
                                                    className="inline-flex justify-center items-center gap-2 rounded-sm border border-amber-400 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900 hover:bg-amber-100 transition-colors"
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                    Copy Errors
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleRetryAnalysis}
                                                    className="inline-flex justify-center items-center rounded-sm border border-amber-400 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900 hover:bg-amber-100 transition-colors"
                                                >
                                                    Try AI Again
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleStartManual}
                                                    className="inline-flex justify-center items-center rounded-sm border border-amber-400 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900 hover:bg-amber-100 transition-colors"
                                                >
                                                    Start Manual
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex-1 overflow-hidden rounded-sm border border-[#e5e5e0]">
                                    <FloorplanEditor
                                        image={image}
                                        onConfirm={handleConfirm}
                                        confirmLabel="Create Project"
                                        showConfirmButton={false}
                                    />
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
