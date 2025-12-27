"use client";

import type { DesignDoc, MaterialSku } from "@webinterior/shared/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { computeQuantityTakeoff } from "../lib/qto";
import { deleteProject as deleteProjectRecord, fetchProjects, saveProject, type ProjectRecord } from "../lib/supabase/projects";
import { useSupabaseSession } from "../lib/supabase/use-session";
import { Plan3DViewer } from "./plan-3d-viewer";
import { BlueprintImportWizard } from "./blueprint-import-wizard";
import { AuthPanel } from "./auth-panel";

type QualityLevel = "low" | "medium" | "high";

export function SimulationStudio({ materials }: { materials: MaterialSku[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const requestedProjectId = searchParams.get("project");
  const { supabase, session } = useSupabaseSession();
  const user = session?.user ?? null;

  const [doc, setDoc] = useState<DesignDoc | null>(null);
  const [started, setStarted] = useState(false);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [quality, setQuality] = useState<QualityLevel>("high");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [moodPreset, setMoodPreset] = useState<"day" | "night" | "neutral">("day");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<{ type: "furniture" | "floor" | "wall"; id: string; name?: string; object: any } | null>(null);

  // Trigger for Plan3DViewer actions
  const [actionTrigger, setActionTrigger] = useState<{ type: "reset" | "screenshot" | "quality" | "mood" | "enterRoom"; value?: any } | null>(null);

  // Material Selections
  const floors = useMemo(() => materials.filter((m) => m.category === "floor"), [materials]);
  const walls = useMemo(() => materials.filter((m) => m.category === "wall"), [materials]);

  // Computed
  const qto = useMemo(() => (doc ? computeQuantityTakeoff(doc.plan2d, { projectId: "simulation", designDocId: doc.id, revision: doc.revision }) : null), [doc]);

  // Projects for saving
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("new");
  const [projectName, setProjectName] = useState<string>("New Project");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);
  const activeProjectName = selectedProject?.name ?? projectName;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const refreshProjects = useCallback(async () => {
    if (!supabase || !user) return;
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const data = await fetchProjects(supabase);
      setProjects(data);
    } catch (err) {
      console.error(err);
      setProjectsError("프로젝트 동기화에 실패했습니다.");
    } finally {
      setProjectsLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    if (!supabase || !user) {
      setProjects([]);
      setSelectedProjectId("new");
      setProjectName("New Project");
      return;
    }
    refreshProjects();
  }, [refreshProjects, supabase, user?.id]);

  useEffect(() => {
    if (projects.length === 0) return;
    if (selectedProjectId !== "new") return;

    const target = requestedProjectId ? projects.find((p) => p.id === requestedProjectId) : projects[0];
    if (!target) return;

    setSelectedProjectId(target.id);
    setProjectName(target.name);
    if (requestedProjectId) {
      setDoc(target.designDoc);
      setStarted(true);
      setSaveStatus("idle");
      setSaveError(null);
      setActionTrigger({ type: "reset", value: Date.now() });
    }
  }, [projects, requestedProjectId, selectedProjectId]);

  useEffect(() => {
    if (selectedProject) setProjectName(selectedProject.name);
  }, [selectedProject?.id]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT") return;
      switch (e.key.toLowerCase()) {
        case "r":
          setActionTrigger({ type: "reset", value: Date.now() });
          break;
        case "f":
          toggleFullscreen();
          break;
        case " ":
          e.preventDefault();
          toggleMood();
          break;
        case "p":
          setScreenshotUrl(null);
          setActionTrigger({ type: "screenshot", value: Date.now() });
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moodPreset]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  const toggleMood = () => {
    const nextFn = { day: "neutral", neutral: "night", night: "day" } as const;
    const next = nextFn[moodPreset] || "day";
    setMoodPreset(next as any);
    setActionTrigger({ type: "mood", value: next });
  };

  const saveToProject = useCallback(async () => {
    if (!doc) {
      setSaveError("도면을 먼저 업로드하세요.");
      setSaveStatus("error");
      return;
    }
    if (!supabase || !user) {
      setSaveError("로그인이 필요합니다.");
      setSaveStatus("error");
      return;
    }
    const name = projectName.trim() || "Untitled";
    setSaveStatus("idle");
    setSaveError(null);
    try {
      const saved = await saveProject({
        supabase,
        userId: user.id,
        projectId: selectedProjectId === "new" ? null : selectedProjectId,
        name,
        designDoc: doc,
        screenshotUrl
      });
      setProjects((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
      setSelectedProjectId(saved.id);
      setProjectName(saved.name);
      setSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
      setSaveError("저장에 실패했습니다.");
    }
  }, [doc, projectName, screenshotUrl, selectedProjectId, supabase, user]);

  const loadFromProject = useCallback(() => {
    if (!selectedProject) {
      setSaveError("불러올 프로젝트를 선택하세요.");
      setSaveStatus("error");
      return;
    }
    setDoc(selectedProject.designDoc);
    setStarted(true);
    setSaveStatus("idle");
    setSaveError(null);
    setActionTrigger({ type: "reset", value: Date.now() });
  }, [selectedProject]);

  const deleteProject = useCallback(async () => {
    if (!selectedProject || !supabase) return;
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      await deleteProjectRecord(supabase, selectedProject);
      setProjects((prev) => prev.filter((p) => p.id !== selectedProject.id));
      setSelectedProjectId("new");
      setProjectName("New Project");
      setSaveStatus("idle");
      setSaveError(null);
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
      setSaveError("삭제에 실패했습니다.");
    } finally {
      setProjectsLoading(false);
    }
  }, [selectedProject, supabase]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-stone-950 group select-none font-sans text-stone-200">
      {/* 1. Main Canvas */}
      <div className="absolute inset-0 z-0">
        {started && doc ? (
          <Plan3DViewer
            designDoc={doc}
            actionTrigger={actionTrigger}
            quality={quality}
            onScreenshot={(url) => setScreenshotUrl(url)}
            onSelect={setSelectedInfo}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-900 via-stone-950 to-black">
            <div className="text-center space-y-4">
              <div className="text-sm uppercase tracking-[0.3em] text-stone-500">Simulation Studio</div>
              <h2 className="text-3xl font-serif text-white">도면 업로드로 3D 스튜디오 시작</h2>
              <p className="text-sm text-stone-400 max-w-md mx-auto">도면을 올리면 Gemini가 구조를 분석하고, 3D 맵을 바로 걸어볼 수 있습니다.</p>
              <button
                onClick={() => setShowWizard(true)}
                className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black shadow-lg hover:bg-stone-200 transition"
              >
                도면 업로드하기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay with cinematic fade */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black text-white">
          <div className="flex flex-col items-center gap-6 animate-in fade-in duration-1000 zoom-in-95">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-stone-800 border-t-white" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg font-light tracking-[0.2em] text-white">SIMULATION STUDIO</span>
              <span className="text-[10px] font-medium tracking-widest text-stone-500 uppercase">Loading Environment Assets</span>
            </div>
          </div>
        </div>
      )}

      {/* Wizard Overlay */}
      {showWizard && (
        <BlueprintImportWizard
          onCancel={() => setShowWizard(false)}
          onComplete={(newDoc, mood) => {
            setDoc(newDoc);
            setStarted(true);
            setSaveStatus("idle");
            setSaveError(null);
            setShowWizard(false);
            if (mood) {
              setMoodPreset(mood);
              setActionTrigger({ type: "mood", value: mood });
            }
            setActionTrigger({ type: "reset", value: Date.now() });
          }}
        />
      )}

      {/* 2. Top Navigation / Header */}
      <div className={`absolute left-0 top-0 right-0 z-20 flex items-start justify-between p-6 transition-all duration-500 ${isFullscreen ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}>
        {/* Branding / Title */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-serif text-white drop-shadow-md">Studio</h1>
          {doc && qto && (
            <div className="flex items-center gap-2 text-[10px] bg-black/40 px-2 py-1 rounded backdrop-blur-md border border-white/10 w-fit">
              <span className="text-stone-400 uppercase tracking-wider">Project</span>
              <span className="font-semibold text-white">{activeProjectName || "Untitled"}</span>
              <span className="w-px h-3 bg-white/20" />
              <span className="text-stone-300">{qto.totals.floorAreaSqm.toFixed(1)}m²</span>
            </div>
          )}
        </div>

        {/* Top Right Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowWizard(true)}
            className="group flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 shadow-lg shadow-white/5 transition-all hover:bg-stone-200 hover:scale-105 active:scale-95"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 group-hover:bg-black">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-wide text-stone-900">도면 업로드</span>
          </button>
        </div>
      </div>

      {/* 3. Bottom HUD (Unified Toolbar) */}
      {started && doc && (
        <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 flex items-end gap-4">
          {/* View Controls */}
          <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-xl shadow-2xl">
            <TooltipButton label="Home View (R)" onClick={() => setActionTrigger({ type: "reset", value: Date.now() })} icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>} />
            <div className="w-px h-6 bg-white/10 mx-1" />
            <TooltipButton label={`Mood: ${moodPreset} (Space)`} active onClick={toggleMood} icon={
              moodPreset === "day" ? <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" x2="12" y1="1" y2="3" /><line x1="12" x2="12" y1="21" y2="23" /><line x1="4.22" x2="5.64" y1="4.22" y2="5.64" /><line x1="18.36" x2="19.78" y1="18.36" y2="19.78" /><line x1="1" x2="3" y1="12" y2="12" /><line x1="21" x2="23" y1="12" y2="12" /><line x1="4.22" x2="5.64" y1="19.78" y2="18.36" /><line x1="18.36" x2="19.78" y1="5.64" y2="4.22" /></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
            } />
            <TooltipButton label="Screenshot (P)" onClick={() => { setScreenshotUrl(null); setActionTrigger({ type: "screenshot", value: Date.now() }); }} icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>} />
            <div className="w-px h-6 bg-white/10 mx-1" />
            <TooltipButton label={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"} onClick={toggleFullscreen} icon={isFullscreen ? <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>} />
          </div>

          {/* Quality Selector */}
          <div className="flex items-center gap-0.5 rounded-2xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-xl shadow-2xl">
            {(["low", "medium", "high"] as const).map((q) => (
              <button
                key={q}
                onClick={() => { setQuality(q); setActionTrigger({ type: "quality", value: q }); }}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${quality === q ? "bg-white text-black shadow-sm" : "text-stone-400 hover:text-white hover:bg-white/10"}`}
              >
                {q}
              </button>
            ))}
          </div>

        </div>
      )}

      {/* 4. Right Side Properties Panel */}
      <div className={`absolute right-6 top-24 bottom-24 z-10 w-80 flex flex-col gap-3 transition-transform duration-500 ease-out ${isFullscreen ? "translate-x-[120%]" : "translate-x-0"}`}>

        {/* Selection Information & Editor */}
        <div className="flex-1 overflow-auto rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl shadow-2xl flex flex-col">
          {selectedInfo ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Selected {selectedInfo.type}</span>
                  <button onClick={() => setSelectedInfo(null)} className="ml-auto text-[10px] text-white/40 hover:text-white">Deselect</button>
                </div>
                <h3 className="font-serif text-2xl text-white">{selectedInfo.name || selectedInfo.id}</h3>
              </div>

              <div className="space-y-8">
                {/* Furniture Editor */}
                {selectedInfo.type === "furniture" && (
                  <div className="space-y-6">
                    <ControlGroup label="Transformation">
                      <div className="grid grid-cols-3 gap-2">
                        <button className="rounded-xl bg-white/5 p-3 text-[10px] font-bold uppercase text-stone-400 hover:bg-white/10 hover:text-white transition">Move</button>
                        <button className="rounded-xl bg-white/5 p-3 text-[10px] font-bold uppercase text-stone-400 hover:bg-white/10 hover:text-white transition">Rotate</button>
                        <button className="rounded-xl bg-red-500/20 p-3 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/40 transition">Delete</button>
                      </div>
                    </ControlGroup>

                    <ControlGroup label="Variants">
                      <div className="grid grid-cols-2 gap-2">
                        {["Modern Blue", "Classic Grey"].map((v) => (
                          <button key={v} className="rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10">
                            <div className="text-[10px] font-bold text-white">{v}</div>
                            <div className="text-[9px] text-stone-500">Premium Fabric</div>
                          </button>
                        ))}
                      </div>
                    </ControlGroup>
                  </div>
                )}

                {/* Floor Editor */}
                {selectedInfo.type === "floor" && (
                  <div className="space-y-6">
                    <ControlGroup label="Floor Material">
                      <div className="grid grid-cols-2 gap-3">
                        {floors.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => {
                              setDoc((prev) =>
                                prev
                                  ? { ...prev, surfaceMaterials: { ...prev.surfaceMaterials, [`floor:${selectedInfo.id}`]: f.id } }
                                  : prev
                              );
                            }}
                            className={`group relative aspect-square overflow-hidden rounded-2xl border-2 transition-all ${doc?.surfaceMaterials?.[`floor:${selectedInfo.id}`] === f.id ? "border-white shadow-lg shadow-white/10" : "border-transparent opacity-60 hover:opacity-100 hover:border-white/20"}`}
                          >
                            <img src={f.thumbnailUrl || "https://via.placeholder.com/100"} alt="" className="h-full w-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 backdrop-blur-sm">
                              <div className="text-[9px] font-bold text-white truncate">{f.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ControlGroup>

                    <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                      <div className="text-[10px] text-stone-500 uppercase font-bold mb-1">Room Area</div>
                      <div className="text-xl font-serif text-white">{(Math.random() * 10 + 5).toFixed(1)}m²</div>
                    </div>
                  </div>
                )}

                {/* Wall Editor */}
                {selectedInfo.type === "wall" && (
                  <div className="space-y-6">
                    <ControlGroup label="Wall Paint">
                      <div className="grid grid-cols-4 gap-2">
                        {walls.map((w) => (
                          <button
                            key={w.id}
                            onClick={() => {
                              setDoc((prev) =>
                                prev
                                  ? { ...prev, surfaceMaterials: { ...prev.surfaceMaterials, [`wall:${selectedInfo.id}:face:in`]: w.id } }
                                  : prev
                              );
                            }}
                            className={`aspect-square rounded-full border-2 transition-all p-0.5 ${doc?.surfaceMaterials?.[`wall:${selectedInfo.id}:face:in`] === w.id ? "border-white" : "border-transparent opacity-50 hover:opacity-100"}`}
                          >
                            <div className="w-full h-full rounded-full" style={{ backgroundColor: w.id === "m_wall_03" ? "#5b0f23" : w.id === "m_wall_02" ? "#e7d3c0" : "#f4f4f5" }} />
                          </button>
                        ))}
                      </div>
                    </ControlGroup>

                    <div className="pt-4 border-t border-white/5">
                      <button className="w-full rounded-xl bg-white/10 py-3 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/20 transition">Apply to all walls</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-full bg-white/5 p-6 text-3xl">🏠</div>
              <h3 className="font-serif text-lg text-white">Interactive Editor</h3>
              <p className="mt-2 text-xs text-stone-500 max-w-[200px] leading-relaxed">Click on a wall, floor or furniture to start customizing your space.</p>

              <div className="mt-10 w-full space-y-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-left transition hover:bg-white/10 cursor-pointer">
                  <div className="text-[10px] font-bold text-white/40">01</div>
                  <div className="text-[11px] font-medium text-stone-300">Auto-Apply Best Palette</div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-left transition hover:bg-white/10 cursor-pointer">
                  <div className="text-[10px] font-bold text-white/40">02</div>
                  <div className="text-[11px] font-medium text-stone-300">Export Design Spec (PDF)</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Room List Card (Small) */}
        <div className="max-h-48 flex-shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl flex flex-col">
          <div className="p-4 border-b border-white/5">
            <h3 className="font-serif text-sm text-white/90">Quick Navigation</h3>
          </div>
          <div className="overflow-y-auto p-2 space-y-1">
            {doc?.plan2d.rooms.map((room) => (
              <div key={room.id} className="group flex items-center justify-between rounded-xl px-3 py-2 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => {
                  let x = 0, y = 0;
                  room.polygon.forEach((p) => { x += p.x; y += p.y; });
                  x /= room.polygon.length;
                  y /= room.polygon.length;
                  setActionTrigger({ type: "enterRoom", value: { x, y } });
                }}
              >
                <div className="text-[11px] font-medium text-stone-400 group-hover:text-white">{room.name}</div>
                <div className="h-1.5 w-1.5 rounded-full bg-stone-700 group-hover:bg-white transition-colors" />
              </div>
            ))}
          </div>
        </div>

        {started && !supabase && (
          <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-4 text-xs text-amber-100">
            Supabase 환경 변수가 설정되지 않았습니다.
          </div>
        )}

        {started && supabase && !session && (
          <AuthPanel className="bg-white/95" />
        )}

        {started && session && (
          <div className="rounded-3xl border border-white/10 bg-black/50 backdrop-blur-xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-stone-500">저장/불러오기</div>
                <div className="text-sm text-white">{activeProjectName || "New Project"}</div>
              </div>
              {saveStatus === "saved" && <div className="text-[10px] text-emerald-400 font-bold">Saved</div>}
            </div>
            <div className="space-y-2">
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedProjectId(nextId);
                  if (nextId === "new") {
                    setProjectName("New Project");
                  } else {
                    const nextProject = projects.find((p) => p.id === nextId);
                    if (nextProject) setProjectName(nextProject.name);
                  }
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
              >
                <option value="new" className="bg-stone-900 text-stone-200">+ 새 프로젝트</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-stone-900 text-stone-200">{p.name}</option>
                ))}
              </select>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-stone-500"
                placeholder="프로젝트 이름"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={saveToProject}
                  className="rounded-xl bg-white text-black text-sm font-bold py-2.5 hover:bg-stone-200 transition"
                >
                  Save
                </button>
                <button
                  onClick={loadFromProject}
                  disabled={!selectedProject}
                  className="rounded-xl border border-white/20 text-white text-sm font-semibold py-2.5 hover:bg-white/10 transition disabled:opacity-40"
                >
                  Load
                </button>
              </div>
              {selectedProject ? (
                <button
                  onClick={deleteProject}
                  className="w-full rounded-xl border border-red-500/40 text-red-200 text-xs font-semibold py-2 hover:bg-red-500/10 transition"
                >
                  Delete
                </button>
              ) : null}
              {projectsLoading && <div className="text-[11px] text-stone-400">동기화 중...</div>}
              {projectsError && <div className="text-[11px] text-red-300">{projectsError}</div>}
              {saveError && <div className="text-[11px] text-red-300">{saveError}</div>}
            </div>
          </div>
        )}

      </div>

      {/* Screenshot Modal (if present) */}
      {screenshotUrl && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-10 animate-in fade-in zoom-in-95">
          <div className="relative max-w-4xl max-h-full overflow-hidden rounded-2xl border border-stone-700 bg-stone-900 shadow-2xl p-2">
            <img src={screenshotUrl} alt="Screenshot" className="rounded-xl w-full h-auto object-contain" />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
              <a href={screenshotUrl} download={`render-${Date.now()}.png`} className="rounded-full bg-white px-6 py-2 text-sm font-bold text-black shadow-xl hover:bg-stone-200">Download High-Res</a>
              <button onClick={() => setScreenshotUrl(null)} className="rounded-full bg-black/50 border border-white/20 px-6 py-2 text-sm font-medium text-white backdrop-blur hover:bg-black/70">Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// UI Helpers
function TooltipButton({ label, icon, onClick, active }: { label: string; icon: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`p-3 rounded-xl transition-all ${active ? "bg-white text-black" : "text-stone-400 hover:text-white hover:bg-white/10"}`}
      >
        {icon}
      </button>
      <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none border border-white/20">
        {label}
      </div>
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase font-bold tracking-wider text-stone-500">{label}</label>
      {children}
    </div>
  );
}
