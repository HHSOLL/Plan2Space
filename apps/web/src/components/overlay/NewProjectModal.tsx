"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Check, Loader2, Copy } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useSceneStore } from "../../lib/stores/useSceneStore";
import { saveProject } from "../../lib/api/project";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FloorplanEditor } from "../editor/FloorplanEditor";
import { createUnknownScaleInfo, getScaleGateMessage, parseScaleInfo } from "../../lib/ai/scaleInfo";
import {
    CatalogCandidate,
    completeIntakeReview,
    fetchLayoutRevision,
    finalizeIntakeProject,
    runCatalogIntakeFlow,
    runUploadIntakeFlow,
    selectIntakeCandidate
} from "../../features/floorplan/upload";
import { pollJobUntilTerminal } from "../../features/floorplan/job-polling";
import {
    buildSyntheticFloorplanPreview,
    mapFloorplanResultToScene,
    mapLayoutRevisionToScene,
    type MappedSceneResult
} from "../../features/floorplan/result-mapper";

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

type RecoverablePayload = {
    recoverable?: boolean;
    errorCode?: string;
    details?: string;
    error?: string;
    providerErrors?: string[];
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
    const [activeIntakeSessionId, setActiveIntakeSessionId] = useState<string | null>(null);
    const [reviewRequired, setReviewRequired] = useState(false);
    const [catalogCandidates, setCatalogCandidates] = useState<CatalogCandidate[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastUploadedFileRef = useRef<File | null>(null);
    const {
        walls,
        openings,
        floors,
        assets,
        scale,
        scaleInfo,
        wallMaterialIndex,
        floorMaterialIndex,
        setWalls,
        setOpenings,
        setFloors,
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
        setActiveIntakeSessionId(null);
        setReviewRequired(false);
        setCatalogCandidates([]);
        lastUploadedFileRef.current = null;
    }, [isOpen, resetScene]);

    const readFileAsDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file."));
            reader.readAsDataURL(file);
        });

    const resolveErrorPayload = (error: unknown): RecoverablePayload | null => {
        if (!error || typeof error !== "object" || !("payload" in error)) return null;
        const payload = (error as { payload?: unknown }).payload;
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
        return payload as RecoverablePayload;
    };

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

    const applyMappedScene = (mapped: MappedSceneResult, nextImage?: string | null) => {
        if (typeof nextImage === "string") {
            setImage(nextImage);
        }
        setWalls(mapped.walls);
        setOpenings(mapped.openings);
        setFloors(mapped.floors);
        const normalizedScale = typeof mapped.scale === "number" && mapped.scale > 0 ? mapped.scale : 1;
        const nextScaleInfo = parseScaleInfo(mapped.scaleInfo, normalizedScale);
        setScale(normalizedScale, nextScaleInfo);

        const entrance = mapped.openings.find((opening) => opening.isEntrance);
        if (entrance?.id) {
            useSceneStore.setState({ entranceId: entrance.id });
        }
    };

    const applyLayoutRevisionToEditor = async (layoutRevisionId: string) => {
        const revision = await fetchLayoutRevision(layoutRevisionId);
        const mapped = mapLayoutRevisionToScene(revision);
        const preview = buildSyntheticFloorplanPreview(mapped) ?? createPlaceholderFloorplanDataUrl();
        applyMappedScene(mapped, preview);
        setStep("edit");
        setAnalysisRecovery(null);
    };

    const runPipelineAnalysis = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            throw new Error("Image upload only (PNG/JPEG).");
        }

        const preview = await readFileAsDataUrl(file);
        setImage(preview);
        lastUploadedFileRef.current = file;
        setCatalogCandidates([]);

        const outcome = await runUploadIntakeFlow({
            file,
            apartmentName: catalogApartmentName,
            typeName: catalogTypeName,
            region: catalogRegion,
            pollJobUntilTerminal
        });

        setActiveIntakeSessionId(outcome.session.id);

        if (outcome.kind === "reused") {
            setReviewRequired(false);
            await applyLayoutRevisionToEditor(outcome.layoutRevisionId);
            return;
        }

        if (outcome.kind === "disambiguation_required") {
            setReviewRequired(false);
            setCatalogCandidates(outcome.candidates);
            toast.message("Verified layout candidates found. Select one to continue.");
            return;
        }

        setReviewRequired(outcome.reviewRequired);
        applyMappedScene(mapFloorplanResultToScene(outcome.result), preview);
        setAnalysisRecovery(null);
        setStep("edit");
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        try {
            await runPipelineAnalysis(file);
        } catch (error) {
            const payload = resolveErrorPayload(error);
            const message = payload?.details || payload?.error || (error instanceof Error ? error.message : "AI analysis failed.");
            setWalls([]);
            setOpenings([]);
            setFloors([]);
            setScale(1, createUnknownScaleInfo(1, message));
            setAnalysisRecovery({
                message,
                providerErrors: Array.isArray(payload?.providerErrors) ? payload.providerErrors : [],
                errorCode: payload?.errorCode ?? null
            });
            setStep("edit");
            toast.error(message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleCatalogLookup = async () => {
        if (!catalogApartmentName.trim() || !catalogTypeName.trim()) {
            toast.error("Apartment name and type are required.");
            return;
        }
        setIsAnalyzing(true);
        setCatalogCandidates([]);
        setAnalysisRecovery(null);
        try {
            const outcome = await runCatalogIntakeFlow({
                apartmentName: catalogApartmentName,
                typeName: catalogTypeName,
                region: catalogRegion
            });

            setActiveIntakeSessionId(outcome.session.id);

            if (outcome.kind === "reused") {
                setReviewRequired(false);
                await applyLayoutRevisionToEditor(outcome.layoutRevisionId);
                return;
            }

            setReviewRequired(false);
            setCatalogCandidates(outcome.candidates);
            const placeholder = createPlaceholderFloorplanDataUrl();
            if (placeholder) {
                setImage(placeholder);
            }
            toast.message("Multiple verified layouts matched. Select the right variant.");
        } catch (error) {
            const payload = resolveErrorPayload(error);
            const message = payload?.details || payload?.error || (error instanceof Error ? error.message : "Template lookup failed.");
            setWalls([]);
            setOpenings([]);
            setFloors([]);
            setScale(1, createUnknownScaleInfo(1, message));
            setAnalysisRecovery({
                message,
                providerErrors: Array.isArray(payload?.providerErrors) ? payload.providerErrors : [],
                errorCode: payload?.errorCode ?? null
            });
            toast.error(message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSelectCandidate = async (layoutRevisionId: string) => {
        if (!activeIntakeSessionId) {
            toast.error("Candidate selection session expired. Retry the search.");
            return;
        }

        setIsAnalyzing(true);
        try {
            await selectIntakeCandidate(activeIntakeSessionId, layoutRevisionId);
            setCatalogCandidates([]);
            setReviewRequired(false);
            await applyLayoutRevisionToEditor(layoutRevisionId);
            toast.success("Verified layout loaded.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to select layout candidate.";
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
        if (!activeIntakeSessionId) {
            toast.error("Initialize an intake session by uploading or selecting a verified layout.");
            return;
        }
        setIsAnalyzing(true);
        try {
            let resolvedSessionId = activeIntakeSessionId;
            if (reviewRequired) {
                const reviewed = await completeIntakeReview(activeIntakeSessionId);
                resolvedSessionId = reviewed.id;
                setActiveIntakeSessionId(reviewed.id);
                setReviewRequired(false);
            }
            const project = await finalizeIntakeProject(resolvedSessionId, {
                name: name.trim(),
                description: "AI topology verified"
            });
            const projectId = typeof project.id === "string" ? project.id : null;
            if (!projectId) {
                throw new Error("Finalized project id is missing.");
            }
            try {
                await saveProject(projectId, {
                    topology: {
                        scale,
                        scaleInfo,
                        walls,
                        openings,
                        floors
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
            router.push(`/project/${projectId}`);
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
        if (!lastUploadedFileRef.current) {
            toast.error("Re-upload the source image to retry analysis.");
            return;
        }
        setIsAnalyzing(true);
        try {
            await runPipelineAnalysis(lastUploadedFileRef.current);
            setAnalysisRecovery(null);
            toast.success("AI analysis retried successfully.");
        } catch (error) {
            const payload = resolveErrorPayload(error);
            const message = payload?.details || payload?.error || (error instanceof Error ? error.message : "Failed to retry AI analysis.");
            setAnalysisRecovery({
                message,
                providerErrors: Array.isArray(payload?.providerErrors) ? payload.providerErrors : [],
                errorCode: payload?.errorCode ?? null
            });
            toast.error(message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleStartManual = () => {
        const message = analysisRecovery?.message ?? "Continue in manual 2D correction mode.";
        setWalls([]);
        setOpenings([]);
        setFloors([]);
        setScale(1, createUnknownScaleInfo(1, message));
        setStep("edit");
        toast.message("Manual correction mode enabled.");
    };

    const handleClose = async () => {
        onClose();
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
                            onClick={() => void handleClose()}
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
                                        {catalogCandidates.length > 0 && (
                                            <div className="space-y-2 border-t border-[#e5e5e0] pt-4">
                                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8b8b84]">
                                                    Select Verified Layout
                                                </p>
                                                <div className="grid gap-2">
                                                    {catalogCandidates.map((candidate) => (
                                                        <button
                                                            key={candidate.layoutRevisionId ?? `${candidate.apartmentName}-${candidate.typeName}-${candidate.variantLabel ?? ""}`}
                                                            type="button"
                                                            onClick={() => void handleSelectCandidate(candidate.layoutRevisionId ?? "")}
                                                            disabled={isAnalyzing || !candidate.layoutRevisionId}
                                                            className="flex items-center justify-between rounded-sm border border-[#e5e5e0] bg-white px-4 py-3 text-left transition-colors hover:border-black disabled:opacity-40"
                                                        >
                                                            <div className="space-y-1">
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black">
                                                                    {candidate.apartmentName} {candidate.typeName}
                                                                </p>
                                                                <p className="text-[10px] text-[#6b6b64]">
                                                                    {[candidate.region, candidate.areaLabel, candidate.variantLabel].filter(Boolean).join(" • ")}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999999]">
                                                                    Match {(candidate.matchScore * 100).toFixed(0)}%
                                                                </p>
                                                                {candidate.verified && (
                                                                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-600">
                                                                        Verified
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
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
                                            {isAnalyzing ? "CREATING..." : reviewRequired ? "REVIEW & CREATE" : "CREATE PROJECT"}
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
