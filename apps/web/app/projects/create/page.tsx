"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AuthPanel } from "../../../components/auth-panel";
import { useSupabaseSession } from "../../../lib/supabase/use-session";

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}

function prettySupabaseError(err: unknown): string {
  if (!err) return "요청에 실패했습니다.";
  if (err instanceof Error) {
    if (err.message.includes("row-level security")) {
      return "업로드 권한이 없습니다. Supabase Storage RLS 정책을 확인하세요.";
    }
    return err.message;
  }
  if (typeof err === "object" && !Array.isArray(err)) {
    const record = err as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message : null;
    if (message) {
      if (message.includes("row-level security")) {
        return "업로드 권한이 없습니다. Supabase Storage RLS 정책을 확인하세요.";
      }
      return message;
    }
  }
  if (typeof err === "string") return err;
  return "요청에 실패했습니다.";
}

type SubmitPhase = "idle" | "uploading" | "creating";

export default function CreateProjectPage() {
  const router = useRouter();
  const { supabase, session, loading } = useSupabaseSession();

  const [name, setName] = useState("New Project");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<SubmitPhase>("idle");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isSubmitting = phase !== "idle";
  const canSubmit = Boolean(supabase && session && !isSubmitting && name.trim().length > 0 && file);

  const onPickFile = (next: File | null) => {
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.type.startsWith("image/")) {
      toast.error("이미지 파일(PNG/JPG)을 업로드해 주세요.");
      return;
    }
    setFile(next);
  };

  const dropzoneLabel = useMemo(() => {
    if (isSubmitting) return phase === "uploading" ? "Uploading blueprint..." : "Creating project...";
    if (dragActive) return "Drop to upload";
    if (file) return "Replace blueprint";
    return "Drop your blueprint here";
  }, [dragActive, file, isSubmitting, phase]);

  const handleSubmit = async () => {
    if (!supabase || !session || !file) return;
    setPhase("uploading");

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("floor-plans").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });
      if (uploadError) throw uploadError;

      setPhase("creating");
      const { data: project, error: insertError } = await supabase
        .from("projects")
        .insert({
          owner_id: session.user.id,
          name: name.trim(),
          thumbnail_path: path,
          meta: {
            thumbnailBucket: "floor-plans",
            import: {
              sourceType: "image",
              sourcePath: path
            }
          }
        })
        .select("id")
        .single();

      if (insertError) {
        await supabase.storage.from("floor-plans").remove([path]).catch(() => null);
        throw insertError;
      }
      if (!project?.id) throw new Error("Project create failed.");

      toast.success("Project created");
      router.push(`/projects/${project.id}`);
    } catch (err) {
      toast.error(prettySupabaseError(err));
    } finally {
      setPhase("idle");
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-stone-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(120,113,108,0.22),transparent_55%)]" />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">Projects</div>
            <h1 className="mt-3 font-serif text-4xl text-stone-900">Create a new studio</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
              도면 이미지를 업로드하면 프로젝트가 생성되고, 바로 3D 편집 화면으로 이동합니다.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.34em] text-stone-500">
            Modern Atelier
          </div>
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-stone-200/80 bg-white/60 p-7 text-sm text-stone-600 shadow-[0_22px_70px_-55px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
              세션 확인 중...
            </div>
          </div>
        ) : null}

        {!loading && (!supabase || !session) ? (
          <div className="grid gap-6 md:grid-cols-[1fr_420px]">
            <div className="rounded-[28px] border border-stone-200/80 bg-white/60 p-8 shadow-[0_22px_70px_-55px_rgba(0,0,0,0.45)] backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">Access</div>
              <h2 className="mt-3 font-serif text-3xl text-stone-900">Sign in first</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">
                프로젝트 생성은 개인 폴더(Storage)에 도면을 업로드하므로, 인증이 필요합니다.
              </p>
              <div className="mt-8 grid gap-5 text-sm text-stone-600">
                <div className="rounded-2xl border border-stone-200/70 bg-white/50 px-5 py-4">
	                  <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">Tip</div>
	                  <div className="mt-2 leading-relaxed">
	                    Storage 정책은{" "}
	                    <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-700">
	                      floor-plans/&lt;auth.uid()&gt;/...
	                    </code>{" "}
	                    형태로 구성되어야 합니다. (루트의{" "}
	                    <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-700">fix_rls.sql</code>{" "}
	                    참고)
	                  </div>
	                </div>
	              </div>
	            </div>
            <AuthPanel />
          </div>
        ) : null}

        {!loading && supabase && session ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_480px]">
            <div className="rounded-[28px] border border-stone-200/80 bg-white/60 p-8 shadow-[0_22px_70px_-55px_rgba(0,0,0,0.45)] backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">Details</div>
              <h2 className="mt-3 font-serif text-3xl text-stone-900">Project setup</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">
                이름을 정하고, 도면 파일을 업로드하세요. (PNG/JPG)
              </p>

              <div className="mt-8 space-y-7">
                <div className="relative">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Project name"
                    className="peer w-full border-b border-stone-300 bg-transparent pb-2 pt-5 text-sm text-stone-900 outline-none transition-colors placeholder:text-transparent focus:border-stone-900"
                  />
                  <label className="pointer-events-none absolute left-0 top-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500 transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-medium peer-placeholder-shown:tracking-wide peer-placeholder-shown:text-stone-400 peer-focus:top-1 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:tracking-[0.32em] peer-focus:text-stone-600">
                    Project name
                  </label>
                </div>

                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">Blueprint</div>
                      <div className="mt-2 text-sm text-stone-600">Drag & drop 또는 클릭하여 업로드</div>
                    </div>
                    {file ? (
                      <div className="text-xs text-stone-500">
                        {file.name} · {formatBytes(file.size)}
                      </div>
                    ) : null}
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (isSubmitting) return;
                      fileInputRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if (isSubmitting) return;
                      if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (isSubmitting) return;
                      setDragActive(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (isSubmitting) return;
                      setDragActive(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragActive(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragActive(false);
                      if (isSubmitting) return;
                      const next = e.dataTransfer.files?.[0] ?? null;
                      onPickFile(next);
                    }}
                    className={[
                      "mt-4 group relative flex min-h-[220px] cursor-pointer items-center justify-center rounded-[28px] border border-dashed bg-white/60 px-6 py-10 text-center shadow-sm transition-all duration-300 outline-none",
                      dragActive ? "border-stone-900/50 bg-white" : "border-stone-300/70 hover:border-stone-500/70",
                      isSubmitting ? "opacity-70" : ""
                    ].join(" ")}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                    />

                    <div className="flex flex-col items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-stone-200 bg-white shadow-sm transition-transform duration-300 group-hover:scale-[1.02]">
                        {isSubmitting ? (
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
                        ) : (
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-6 w-6 text-stone-700"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          >
                            <path d="M12 3v10" />
                            <path d="M7 8l5-5 5 5" />
                            <path d="M5 14v5h14v-5" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="font-serif text-xl text-stone-900">{dropzoneLabel}</div>
                        <div className="mt-2 text-xs leading-relaxed text-stone-500">
                          {file ? "클릭하면 다른 도면으로 교체할 수 있습니다." : "PNG/JPG 권장 · 개인 폴더에 저장됩니다."}
                        </div>
                      </div>
                    </div>

                    {isSubmitting ? (
                      <div className="absolute inset-x-8 bottom-6 h-1 overflow-hidden rounded-full bg-stone-200">
                        <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-stone-900/70" />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-stone-500">
                    {phase === "idle" ? "Ready" : phase === "uploading" ? "Uploading..." : "Creating..."}
                  </div>
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                    className="inline-flex items-center justify-center gap-3 rounded-full bg-stone-900 px-7 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-stone-50 transition-all duration-300 hover:bg-stone-800 disabled:opacity-40"
                  >
                    <span className={isSubmitting ? "inline-flex items-center gap-3" : ""}>
                      {isSubmitting ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-400 border-t-stone-50" />
                          Creating...
                        </>
                      ) : (
                        "Create & Open"
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-stone-200/80 bg-white/60 p-8 shadow-[0_22px_70px_-55px_rgba(0,0,0,0.45)] backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">Preview</div>
              <h3 className="mt-3 font-serif text-2xl text-stone-900">Blueprint frame</h3>
              <p className="mt-2 text-sm text-stone-600">업로드된 도면이 프로젝트 카드 썸네일로도 사용됩니다.</p>

              <div className="mt-7 rounded-[28px] bg-stone-100 p-3 shadow-inner">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] border border-stone-200 bg-white shadow-[0_18px_60px_-40px_rgba(0,0,0,0.45)]">
                  {previewUrl ? (
                    <Image src={previewUrl} alt="Blueprint preview" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="text-center">
                        <div className="font-serif text-xl text-stone-800">No preview yet</div>
                        <div className="mt-2 text-xs text-stone-500">Upload a blueprint to see it here.</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {file ? (
                <div className="mt-5 text-xs text-stone-500">
                  {file.name} · {formatBytes(file.size)}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
