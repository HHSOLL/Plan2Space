"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Link2, Trash2, X } from "lucide-react";
import { getCatalogPreviewClasses, getProjectAssetSummary } from "../../lib/builder/catalog";
import { resolveShareCapabilities, type SharePermission } from "../../lib/share/permissions";
import { buildSharePreviewMeta, getSharePreviewMeta } from "../../lib/share/preview";
import { getSupabaseClient } from "../../lib/supabase/client";
import type { Project } from "../../lib/stores/useProjectStore";
import type { Database } from "../../../../../types/database";

type SharedProject = Database["public"]["Tables"]["shared_projects"]["Row"];

interface ShareModalProps {
  projectId: string;
  project: Pick<Project, "name" | "description" | "thumbnail" | "metadata"> | null;
  isOpen: boolean;
  onClose: () => void;
}

const generateToken = () =>
  Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);

export function ShareModal({ projectId, project, isOpen, onClose }: ShareModalProps) {
  const [shareType, setShareType] = useState<"temporary" | "permanent">("temporary");
  const [permissions, setPermissions] = useState<SharePermission>("view");
  const [publishToGallery, setPublishToGallery] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const assetSummary = getProjectAssetSummary(project?.metadata);
  const previewTheme = getCatalogPreviewClasses(assetSummary?.primaryTone ?? "sand");

  const supabase = useMemo(() => getSupabaseClient(), []);

  const { data: sharedLinks = [], isLoading } = useQuery<SharedProject[]>({
    queryKey: ["shared-links", projectId],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from("shared_projects").select("*").eq("project_id", projectId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isOpen
  });

  const canPublishToGallery = shareType === "permanent" && permissions === "view";

  useEffect(() => {
    if (!canPublishToGallery && publishToGallery) {
      setPublishToGallery(false);
    }
  }, [canPublishToGallery, publishToGallery]);

  const createShareMutation = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const token = generateToken();
      const expiresAt =
        shareType === "temporary" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        throw new Error("User not authenticated.");
      }

      const { data: latestVersion, error: latestVersionError } = await supabase
        .from("project_versions")
        .select("id, version")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestVersionError) throw latestVersionError;
      if (!latestVersion?.id) {
        throw new Error("Save the room once before creating a snapshot link.");
      }

      const previewMeta = buildSharePreviewMeta({
        projectName: project?.name?.trim() || "Untitled Room",
        projectDescription: project?.description ?? null,
        versionNumber: typeof latestVersion.version === "number" ? latestVersion.version : null,
        assetSummary
      });

      const { data, error } = await supabase
        .from("shared_projects")
        .insert({
          project_id: projectId,
          project_version_id: latestVersion.id,
          token,
          permissions,
          expires_at: expiresAt,
          is_gallery_visible: canPublishToGallery && publishToGallery,
          published_at: canPublishToGallery && publishToGallery ? new Date().toISOString() : null,
          created_by: userId,
          preview_meta: previewMeta
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-links", projectId] });
    }
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, nextVisible }: { id: string; nextVisible: boolean }) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase
        .from("shared_projects")
        .update({
          is_gallery_visible: nextVisible,
          published_at: nextVisible ? new Date().toISOString() : null
        })
        .eq("id", id);
      if (error) throw error;
      return { id, nextVisible };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-links", projectId] });
    }
  });

  const deleteShareMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.from("shared_projects").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-links", projectId] });
    }
  });

  const handleCreateShare = async () => {
    await createShareMutation.mutateAsync();
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
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
                  Share Project
                </div>
                <h2 className="text-3xl font-outfit font-light">Viewer Access</h2>
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
                            {assetSummary?.primaryCollection ?? "Builder Room"}
                          </div>
                          <div className="text-lg font-medium">{project.name}</div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Latest saved snapshot</div>
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
                Share Type
                <select
                  value={shareType}
                  onChange={(event) => setShareType(event.target.value as "temporary" | "permanent")}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80"
                >
                  <option value="temporary">Temporary (24 hours)</option>
                  <option value="permanent">Permanent</option>
                </select>
              </label>
              <label className="space-y-2 text-[10px] uppercase tracking-[0.3em] text-white/60">
                Permission Mode
                <select
                  value={permissions}
                  onChange={(event) => setPermissions(event.target.value as SharePermission)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80"
                >
                  <option value="view">View Only</option>
                  <option value="edit" disabled>
                    Edit Access (Coming Soon)
                  </option>
                </select>
              </label>
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
                    <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">Publish to gallery</div>
                    <p className="mt-2 text-sm leading-6">
                      Show this pinned snapshot in the public showcase archive.
                    </p>
                    {!canPublishToGallery ? (
                      <p className="mt-2 text-xs leading-5 text-white/35">
                        Gallery publishing is only available for permanent, view-only links.
                      </p>
                    ) : null}
                  </div>
                </div>
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-200/10 px-4 py-3 text-xs leading-6 text-amber-50/85">
              New links are pinned to the latest saved snapshot at creation time. Edit-capable links remain visible for
              backward compatibility, but all links currently open in the read-only viewer shell.
            </div>

            <button
              onClick={handleCreateShare}
              disabled={createShareMutation.isPending}
              className="mt-6 w-full rounded-full border border-white/10 bg-white/90 px-6 py-4 text-[10px] font-bold uppercase tracking-[0.4em] text-black hover:bg-white disabled:opacity-50"
            >
              {createShareMutation.isPending ? "Creating..." : "Create Snapshot Link"}
            </button>

            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">Active Links</div>
              <div className="mt-3 max-h-60 space-y-3 overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="text-xs text-white/50">Loading shared links...</div>
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
                            {link.expires_at ? ` • Expires ${new Date(link.expires_at).toLocaleDateString()}` : ""}
                          </span>
                          <button
                            onClick={() => deleteShareMutation.mutate(link.id)}
                            disabled={deleteShareMutation.isPending}
                            className="flex items-center gap-1 text-red-300 hover:text-red-200"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        </div>
                        {previewMeta ? (
                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                            {previewMeta.versionNumber ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2">
                                Snapshot v{previewMeta.versionNumber}
                              </span>
                            ) : null}
                            {previewMeta.assetSummary?.primaryCollection ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2">
                                {previewMeta.assetSummary.primaryCollection}
                              </span>
                            ) : null}
                            {link.is_gallery_visible ? (
                              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-emerald-100">
                                Published
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
                              {link.is_gallery_visible ? "Remove from gallery" : "Publish to gallery"}
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                              Only permanent view links can be published
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
                            {copiedToken === link.token ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-white/50">No shared links yet.</div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
