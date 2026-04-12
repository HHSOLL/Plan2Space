"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Link2, Trash2, X } from "lucide-react";
import { getCatalogPreviewClasses, getProjectAssetSummary } from "../../lib/builder/catalog";
import { resolveShareCapabilities, type SharePermission } from "../../lib/share/permissions";
import { getSharePreviewMeta } from "../../lib/share/preview";
import { reportSceneError, reportSceneEvent } from "../../lib/telemetry/scene-events";
import type { Project } from "../../lib/stores/useProjectStore";
import type { Database } from "../../../../../types/database";

type SharedProject = Database["public"]["Tables"]["shared_projects"]["Row"];

interface ShareModalProps {
  projectId: string;
  project: Pick<Project, "name" | "description" | "thumbnail" | "metadata"> | null;
  isOpen: boolean;
  onClose: () => void;
}

async function requestJson<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include"
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const details = payload && typeof payload === "object" ? (payload as { error?: string }).error : null;
    throw new Error(details || `Request failed (${response.status})`);
  }

  return payload as T;
}

export function ShareModal({ projectId, project, isOpen, onClose }: ShareModalProps) {
  const [shareType, setShareType] = useState<"temporary" | "permanent">("temporary");
  const permissions: SharePermission = "view";
  const [publishToGallery, setPublishToGallery] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const assetSummary = getProjectAssetSummary(project?.metadata);
  const previewTheme = getCatalogPreviewClasses(assetSummary?.primaryTone ?? "sand");

  const { data: sharedLinks = [], isLoading } = useQuery<SharedProject[]>({
    queryKey: ["shared-links", projectId],
    queryFn: async () => {
      const payload = await requestJson<{ items: SharedProject[] }>(`/api/v1/projects/${projectId}/shares`, {
        method: "GET"
      });
      return payload.items ?? [];
    },
    enabled: isOpen
  });

  const canPublishToGallery = shareType === "permanent";

  useEffect(() => {
    if (!canPublishToGallery && publishToGallery) {
      setPublishToGallery(false);
    }
  }, [canPublishToGallery, publishToGallery]);

  const createShareMutation = useMutation({
    mutationFn: async () => {
      const payload = await requestJson<{ share: SharedProject }>(`/api/v1/projects/${projectId}/shares`, {
        method: "POST",
        body: JSON.stringify({
          shareType,
          permissions,
          publishToGallery
        })
      });
      return payload.share;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-links", projectId] });
      reportSceneEvent("share_link_created", { projectId, shareType, permissions, publishToGallery });
    },
    onError: (error) => {
      reportSceneError("share_link_create_failed", error, { projectId, shareType, permissions, publishToGallery });
    }
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, nextVisible }: { id: string; nextVisible: boolean }) => {
      const payload = await requestJson<{ share: SharedProject }>(`/api/v1/projects/${projectId}/shares/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isGalleryVisible: nextVisible
        })
      });
      return payload.share;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-links", projectId] });
      reportSceneEvent("share_link_visibility_updated", { projectId });
    },
    onError: (error, variables) => {
      reportSceneError("share_link_visibility_update_failed", error, {
        projectId,
        shareId: variables.id,
        nextVisible: variables.nextVisible
      });
    }
  });

  const deleteShareMutation = useMutation({
    mutationFn: async (id: string) => {
      await requestJson<{ id: string }>(`/api/v1/projects/${projectId}/shares/${id}`, {
        method: "DELETE"
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-links", projectId] });
      reportSceneEvent("share_link_deleted", { projectId });
    },
    onError: (error, shareId) => {
      reportSceneError("share_link_delete_failed", error, { projectId, shareId });
    }
  });

  const handleCreateShare = async () => {
    await createShareMutation.mutateAsync();
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedToken(token);
        setTimeout(() => setCopiedToken(null), 2000);
        reportSceneEvent("share_link_copied", { projectId, token });
      })
      .catch((error) => {
        reportSceneError("share_link_copy_failed", error, { projectId, token });
      });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="w-full max-w-lg rounded-[32px] border border-white/10 bg-white/10 p-8 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.4em] text-white/50">
                  <Link2 className="h-4 w-4" />
                  공유 링크
                </div>
                <h2 className="text-3xl font-outfit font-light">읽기 전용 공유 설정</h2>
              </div>
              <button
                onClick={onClose}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {project ? (
                <div className="sm:col-span-2 rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                    <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white/5">
                      {project.thumbnail ? (
                        <img src={project.thumbnail} alt={project.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className={`flex h-full min-h-[124px] flex-col justify-between p-4 ${previewTheme.surface}`}>
                          <div className={`inline-flex w-fit rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${previewTheme.chip}`}>
                            {assetSummary?.primaryCollection ?? "빌더 공간"}
                          </div>
                          <div className="text-lg font-medium">{project.name}</div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">최신 저장 스냅샷</div>
                      <div className="mt-3 text-base font-medium text-white">{project.name}</div>
                      {project.description ? (
                        <p className="mt-2 text-sm leading-6 text-white/55">{project.description}</p>
                      ) : null}
                      {assetSummary ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {assetSummary.collections.slice(0, 3).map((collection) => (
                            <span
                              key={collection.label}
                              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/65"
                            >
                              {collection.label} {collection.count}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="space-y-2 text-[10px] uppercase tracking-[0.3em] text-white/60">
                링크 유형
                <select
                  value={shareType}
                  onChange={(event) => setShareType(event.target.value as "temporary" | "permanent")}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80"
                >
                  <option value="temporary">임시 링크 (24시간)</option>
                  <option value="permanent">상시 링크</option>
                </select>
              </label>
              <div className="space-y-2 text-[10px] uppercase tracking-[0.3em] text-white/60">
                권한 모드
                <div className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
                  읽기 전용
                </div>
              </div>
              <label
                className={`sm:col-span-2 rounded-2xl border px-4 py-4 text-sm transition ${
                  canPublishToGallery
                    ? "border-white/10 bg-black/20 text-white/80"
                    : "border-white/8 bg-black/10 text-white/35"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={publishToGallery}
                    disabled={!canPublishToGallery}
                    onChange={(event) => setPublishToGallery(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">갤러리 게시</div>
                    <p className="mt-2 text-sm leading-6">
                      이 스냅샷을 공개 쇼케이스 아카이브에 노출합니다.
                    </p>
                    {!canPublishToGallery ? (
                      <p className="mt-2 text-xs leading-5 text-white/35">
                        갤러리 게시는 상시 + 읽기 전용 링크에서만 허용됩니다.
                      </p>
                    ) : null}
                  </div>
                </div>
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-200/10 px-4 py-3 text-xs leading-6 text-amber-50/85">
              새 링크는 생성 시점의 최신 저장 스냅샷에 고정되며, 공유 페이지는 항상 읽기 전용 뷰어로 열립니다.
            </div>

            <button
              onClick={handleCreateShare}
              disabled={createShareMutation.isPending}
              className="mt-6 w-full rounded-full border border-white/10 bg-white/90 px-6 py-4 text-[10px] font-bold uppercase tracking-[0.4em] text-black hover:bg-white disabled:opacity-50"
            >
              {createShareMutation.isPending ? "생성 중..." : "스냅샷 링크 만들기"}
            </button>

            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">활성 링크</div>
              <div className="mt-3 max-h-60 space-y-3 overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="text-xs text-white/50">공유 링크를 불러오는 중...</div>
                ) : sharedLinks.length > 0 ? (
                  sharedLinks.map((link) => {
                    const shareCapabilities = resolveShareCapabilities(link.permissions);
                    const previewMeta = getSharePreviewMeta(link.preview_meta);
                    const canPublishLink = !link.expires_at && shareCapabilities.permission === "view";
                    return (
                      <div key={link.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="flex items-center justify-between text-[11px] text-white/70">
                          <span>
                            {shareCapabilities.accessLabel}
                            {link.expires_at ? ` • 만료 ${new Date(link.expires_at).toLocaleDateString()}` : ""}
                          </span>
                          <button
                            onClick={() => deleteShareMutation.mutate(link.id)}
                            disabled={deleteShareMutation.isPending}
                            className="flex items-center gap-1 text-red-300 hover:text-red-200"
                          >
                            <Trash2 className="h-3 w-3" />
                            삭제
                          </button>
                        </div>
                        {previewMeta ? (
                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                            {previewMeta.versionNumber ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2">
                                스냅샷 v{previewMeta.versionNumber}
                              </span>
                            ) : null}
                            {previewMeta.assetSummary?.primaryCollection ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2">
                                {previewMeta.assetSummary.primaryCollection}
                              </span>
                            ) : null}
                            {link.is_gallery_visible ? (
                              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-emerald-100">
                                게시됨
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {canPublishLink ? (
                            <button
                              type="button"
                              onClick={() =>
                                togglePublishMutation.mutate({
                                  id: link.id,
                                  nextVisible: !link.is_gallery_visible
                                })
                              }
                              disabled={togglePublishMutation.isPending}
                            className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/[0.12] disabled:opacity-50"
                          >
                              {link.is_gallery_visible ? "갤러리에서 내리기" : "갤러리에 게시"}
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                              상시 읽기 전용 링크만 게시할 수 있습니다
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="text"
                            value={`${window.location.origin}/shared/${link.token}`}
                            readOnly
                            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/70"
                          />
                          <button
                            onClick={() => handleCopyLink(link.token)}
                            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-white/70 hover:bg-white/20"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedToken === link.token ? "복사됨" : "복사"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-white/50">생성된 공유 링크가 없습니다.</div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
