"use client";

import { useCallback, useState } from "react";
import { GeneratedPlan, NormalizedLayout, designDocFromNormalized, generateDesignFromImage } from "../lib/plan-from-image";
import { DesignDoc } from "@webinterior/shared/types";
import { Plan2DViewer } from "./plan-2d-viewer";
import { computeQuantityTakeoff } from "../lib/qto";

type WizardStep = "upload" | "analyzing" | "prompting" | "generating" | "review";

const SCANDINAVIAN_PROMPT = `Isometric 3D floor plan render, top-down isometric perspective of a compact modern apartment interior.
Exact match to the uploaded floor plan image.
Preserve all wall positions, room proportions, doors, and window placements exactly as shown.

Style: Scandinavian
- Bright Scandinavian interior design.
- Light oak herringbone wood flooring throughout living, dining, and bedroom areas.
- Clean white matte walls with warm neutral undertones.
- Natural materials, minimal decoration, calm and airy atmosphere.

Room Layout Analysis:
- Living room located at the top left,
- Kitchen and dining area at the top right,
- Bedroom at the lower left,
- Bathroom at the lower right.

Highly detailed, photorealistic architectural visualization, 8K resolution, Unreal Engine 5 style.`;

interface BlueprintImportWizardProps {
    onComplete: (designDoc: DesignDoc, mood?: "day" | "night" | "neutral") => void;
    onCancel: () => void;
}

export function BlueprintImportWizard({ onComplete, onCancel }: BlueprintImportWizardProps) {
    const [step, setStep] = useState<WizardStep>("upload");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [generated, setGenerated] = useState<GeneratedPlan | null>(null);
    const [error, setError] = useState<string | null>(null);

    // UI Effects State
    const [typewriterText, setTypewriterText] = useState("");
    const [genProgress, setGenProgress] = useState(0);

    const computeDocSize = (doc: DesignDoc) => {
        const xs: number[] = [];
        const ys: number[] = [];
        doc.plan2d.walls.forEach(w => {
            xs.push(w.a.x, w.b.x);
            ys.push(w.a.y, w.b.y);
        });
        if (xs.length === 0 || ys.length === 0) return { width: 0, height: 0 };
        return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    };

    const analyzeWithApi = async (file: File): Promise<GeneratedPlan> => {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/blueprint/analyze", { method: "POST", body: form });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Analyze failed (${res.status}): ${text}`);
        }
        const json = await res.json();
        if (!json.layout) throw new Error("Layout missing in response");
        const normalizeLayout = (input: Partial<NormalizedLayout>): NormalizedLayout => ({
            units: input.units ?? "mm",
            rooms: Array.isArray(input.rooms) ? input.rooms : [],
            walls: Array.isArray(input.walls) ? input.walls : [],
            doors: Array.isArray(input.doors) ? input.doors : [],
            windows: Array.isArray(input.windows) ? input.windows : [],
            openings: Array.isArray(input.openings) ? input.openings : [],
            metadata: input.metadata ?? {}
        });

        const layout = normalizeLayout(json.layout as Partial<NormalizedLayout>);
        const designDoc = designDocFromNormalized(layout, { projectId: "vision_plan" });

        if (designDoc.plan2d.rooms.length === 0 && designDoc.plan2d.walls.length > 0) {
            const pts = designDoc.plan2d.walls.flatMap((w) => [w.a, w.b]);
            const xs = pts.map((p) => p.x);
            const ys = pts.map((p) => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            designDoc.plan2d.rooms = [
                {
                    id: "room_main",
                    name: "Main Room",
                    polygon: [
                        { x: minX, y: minY },
                        { x: maxX, y: minY },
                        { x: maxX, y: maxY },
                        { x: minX, y: maxY }
                    ]
                }
            ];
        }

        if (designDoc.plan2d.walls.length === 0 && designDoc.plan2d.rooms.length === 0) {
            return generateDesignFromImage(file);
        }
        const size = computeDocSize(designDoc);
        return {
            designDoc,
            summary: {
                widthMeters: Number(size.width.toFixed(2)),
                heightMeters: Number(size.height.toFixed(2)),
                rooms: designDoc.plan2d.rooms.length,
                partitions: { vertical: layout.metadata?.verticalPartitions as number ?? 0, horizontal: layout.metadata?.horizontalPartitions as number ?? 0 }
            },
            analysis: {
                source: json.source,
                warning: json.warning
            }
        };
    };

    const buildAnalysisSummary = (plan: GeneratedPlan) => {
        const { designDoc, analysis } = plan;
        const qto = computeQuantityTakeoff(designDoc.plan2d, {
            projectId: designDoc.projectId,
            designDocId: designDoc.id,
            revision: designDoc.revision
        });
        const doors = designDoc.plan2d.openings.filter((o) => o.type === "door").length;
        const windows = designDoc.plan2d.openings.filter((o) => o.type === "window").length;
        const size = computeDocSize(designDoc);
        const roomNames = qto.rooms.map((r) => r.name).filter(Boolean);

        return {
            source: analysis?.source ?? "unknown",
            warning: analysis?.warning,
            rooms: qto.rooms.length,
            roomNames,
            widthMeters: size.width,
            heightMeters: size.height,
            areaSqm: qto.totals.floorAreaSqm,
            wallLengthM: qto.totals.wallLengthM,
            doors,
            windows,
            openings: qto.totals.openingCount
        };
    };

    const processImage = async (file: File) => {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setStep("analyzing");
        setError(null);

        try {
            // 1. Geometry Analysis via Gemini (backend API)
            const result = await analyzeWithApi(file);
            setGenerated(result);

            // 2. AI Prompt Generation stage
            setStep("prompting");
            let fullText = SCANDINAVIAN_PROMPT;
            for (let i = 0; i < fullText.length; i += 10) {
                setTypewriterText(fullText.slice(0, i));
                await new Promise(r => setTimeout(r, 10));
            }
            setTypewriterText(fullText);
            await new Promise(r => setTimeout(r, 1200));

            // 3. Draft Synthesis stage
            setStep("generating");
            for (let i = 0; i <= 100; i += 2) {
                setGenProgress(i);
                await new Promise(r => setTimeout(r, 30));
            }
            await new Promise(r => setTimeout(r, 800));

            // 4. Final Review
            setStep("review");
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to process blueprint. Please try a clearer image.");
            setStep("upload");
        }
    };

    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processImage(e.dataTransfer.files[0]);
        }
    }, []);

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processImage(e.target.files[0]);
        }
    };

    const analysisSummary = generated ? buildAnalysisSummary(generated) : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/90 backdrop-blur-xl p-4 animate-in fade-in duration-500">
            <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-stone-950 shadow-[0_0_100px_-20px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 px-8 py-6">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">AI Blueprint Pipeline</span>
                        </div>
                        <h2 className="font-serif text-2xl text-white">
                            {step === "upload" && "New Project"}
                            {step === "analyzing" && "Geometry Analysis"}
                            {step === "prompting" && "AI Structuring & Prompting"}
                            {step === "generating" && "Draft Synthesis"}
                            {step === "review" && "Review 3D Generation"}
                        </h2>
                    </div>
                    <button onClick={onCancel} className="rounded-full p-2 text-stone-500 hover:bg-white/5 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    {step === "upload" && (
                        <div
                            className="flex h-[400px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] transition-all hover:bg-white/[0.04] group"
                            onDrop={onDrop}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <div className="mb-6 relative">
                                <div className="absolute inset-0 animate-ping rounded-full bg-white/5" />
                                <div className="relative rounded-full bg-blue-500/10 p-6 text-blue-500 group-hover:scale-110 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                                </div>
                            </div>
                            <h3 className="text-xl font-medium text-white">Upload Architectural Blueprint</h3>
                            <p className="mt-2 text-sm text-stone-500">AI가 구조를 추출하고, 2D 보정을 준비합니다.</p>

                            <div className="mt-8 flex gap-4">
                                <label className="cursor-pointer rounded-2xl bg-white px-8 py-3 text-sm font-bold text-black shadow-lg hover:bg-stone-200 transition-all active:scale-95">
                                    Select Image
                                    <input type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
                                </label>
                                <button
                                    onClick={async () => {
                                        const response = await fetch('/assets/samples/blueprint.jpeg');
                                        const blob = await response.blob();
                                        const file = new File([blob], "sample_blueprint.jpeg", { type: "image/jpeg" });
                                        processImage(file);
                                    }}
                                    className="rounded-2xl border border-white/10 bg-white/5 px-8 py-3 text-sm font-bold text-white hover:bg-white/10 transition-all active:scale-95"
                                >
                                    Try Sample Blueprint
                                </button>
                            </div>
                            {error && <p className="mt-4 text-sm text-red-400 animate-pulse">{error}</p>}
                        </div>
                    )}

                    {step === "analyzing" && (
                        <div className="flex h-[400px] flex-col items-center justify-center text-center">
                            <div className="relative mb-8">
                                <div className="h-24 w-24 animate-spin rounded-full border-b-2 border-blue-500" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="h-16 w-16 animate-pulse rounded-full bg-blue-500/20" />
                                </div>
                            </div>
                            <h3 className="text-xl font-medium text-white">Analyzing Geometry...</h3>
                            <p className="mt-2 text-sm text-stone-500">Processing structural segments and room coordinates.</p>
                        </div>
                    )}

                    {step === "prompting" && (
                        <div className="bg-stone-900/50 rounded-2xl p-6 border border-white/5 font-mono text-xs leading-relaxed overflow-hidden h-[400px]">
                            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2 text-stone-400">
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="ml-2">ai_rendering_prompt.txt</span>
                            </div>
                            <div className="text-green-400 whitespace-pre-wrap animate-in fade-in duration-500">
                                {typewriterText}
                                <span className="inline-block w-2 h-4 bg-green-500 ml-1 animate-pulse align-middle" />
                            </div>
                        </div>
                    )}

                    {step === "generating" && (
                        <div className="flex h-[400px] flex-col items-center justify-center text-center">
                            <div className="w-full max-w-md bg-stone-900 rounded-full h-1 mb-8 overflow-hidden">
                                <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${genProgress}%` }} />
                            </div>
                            <div className="relative aspect-video w-full max-w-2xl rounded-3xl border border-white/10 overflow-hidden bg-black shadow-2xl">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/assets/ai/scandinavian_render.png"
                                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110"
                                    alt=""
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-white" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Draft synthesis engine ... {genProgress}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === "review" && generated && (
                        <div className="grid h-[500px] grid-cols-1 gap-8 lg:grid-cols-2">
                            <div className="flex flex-col gap-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">업로드된 도면</span>
                                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/10 bg-black group">
                                    <img
                                        src={previewUrl ?? "/assets/samples/blueprint.jpeg"}
                                        alt="Uploaded blueprint"
                                        className="h-full w-full object-contain bg-stone-950"
                                    />
                                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                        <span className="text-[9px] font-bold text-white uppercase tracking-wider">Layout Detected</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">분석 결과 (2D)</span>
                                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/10 bg-stone-900 shadow-2xl">
                                    <Plan2DViewer plan2d={generated.designDoc.plan2d} className="h-full w-full p-8" />
                                </div>
                                <div className="mt-auto grid grid-cols-3 gap-3 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] uppercase text-stone-500 font-bold">Rooms</span>
                                        <span className="text-sm font-medium text-white">{generated.summary.rooms} Detected</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] uppercase text-stone-500 font-bold">Area</span>
                                        <span className="text-sm font-medium text-white">{(generated.summary.widthMeters * generated.summary.heightMeters).toFixed(1)}m²</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] uppercase text-stone-500 font-bold">Mode</span>
                                        <span className="text-sm font-medium text-white">3D Walk Ready</span>
                                    </div>
                                </div>
                                {analysisSummary && (
                                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-stone-200">
                                        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-stone-500">
                                            <span>분석 요약</span>
                                            <span className="text-stone-400">source: {analysisSummary.source}</span>
                                        </div>
                                        {analysisSummary.warning && (
                                            <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[10px] text-amber-200">
                                                {analysisSummary.warning}
                                            </div>
                                        )}
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] uppercase text-stone-500">Rooms</span>
                                                <span className="text-sm font-medium text-white">{analysisSummary.rooms}개</span>
                                                {analysisSummary.roomNames.length > 0 && (
                                                    <span className="text-[10px] text-stone-400">
                                                        {analysisSummary.roomNames.slice(0, 4).join(", ")}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] uppercase text-stone-500">Area</span>
                                                <span className="text-sm font-medium text-white">{analysisSummary.areaSqm.toFixed(1)}㎡</span>
                                                <span className="text-[10px] text-stone-400">
                                                    {analysisSummary.widthMeters.toFixed(2)}m × {analysisSummary.heightMeters.toFixed(2)}m
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] uppercase text-stone-500">Walls</span>
                                                <span className="text-sm font-medium text-white">{analysisSummary.wallLengthM.toFixed(1)}m</span>
                                                <span className="text-[10px] text-stone-400">개구부 {analysisSummary.openings}개</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] uppercase text-stone-500">Doors / Windows</span>
                                                <span className="text-sm font-medium text-white">
                                                    문 {analysisSummary.doors} · 창 {analysisSummary.windows}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.02] px-8 py-6">
                    <div className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">
                        Powering high-fidelity interior simulations
                    </div>
                    <div className="flex items-center gap-4">
                        {step === "review" && (
                            <button
                                onClick={() => onComplete(generated!.designDoc, 'day')}
                                className="rounded-2xl bg-white px-10 py-3 text-sm font-bold text-black shadow-xl hover:bg-stone-200 active:scale-95 transition-all"
                            >
                                Enter Simulation Studio →
                            </button>
                        )}
                        {step === "upload" && (
                            <button
                                onClick={onCancel}
                                className="rounded-xl px-4 py-2 text-sm font-medium text-stone-500 hover:text-white"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
