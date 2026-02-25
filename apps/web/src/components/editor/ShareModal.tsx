"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Link2, Trash2, X } from "lucide-react";
import { getSupabaseClient } from "../../lib/supabase/client";
import type { Database } from "../../../../../types/database";

type SharedProject = Database["public"]["Tables"]["shared_projects"]["Row"];

interface ShareModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

const generateToken = () =>
  Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);

export function ShareModal({ projectId, isOpen, onClose }: ShareModalProps) {
  const [shareType, setShareType] = useState<"temporary" | "permanent">("temporary");
  const [permissions, setPermissions] = useState<"view" | "edit">("view");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const queryClient = useQueryClient();

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

      const { data, error } = await supabase
        .from("shared_projects")
        .insert({
          project_id: projectId,
          token,
          permissions,
          expires_at: expiresAt,
          created_by: userId
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
                <h2 className="text-3xl font-outfit font-light">Collaborate Access</h2>
              </div>
              <button
                onClick={onClose}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                Permissions
                <select
                  value={permissions}
                  onChange={(event) => setPermissions(event.target.value as "view" | "edit")}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80"
                >
                  <option value="view">View Only</option>
                  <option value="edit">Can Edit</option>
                </select>
              </label>
            </div>

            <button
              onClick={handleCreateShare}
              disabled={createShareMutation.isPending}
              className="mt-6 w-full rounded-full border border-white/10 bg-white/90 px-6 py-4 text-[10px] font-bold uppercase tracking-[0.4em] text-black hover:bg-white disabled:opacity-50"
            >
              {createShareMutation.isPending ? "Creating..." : "Create Share Link"}
            </button>

            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">Active Links</div>
              <div className="mt-3 max-h-60 space-y-3 overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="text-xs text-white/50">Loading shared links...</div>
                ) : sharedLinks.length > 0 ? (
                  sharedLinks.map((link) => (
                    <div key={link.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center justify-between text-[11px] text-white/70">
                        <span>
                          {link.permissions === "view" ? "View Only" : "Can Edit"}
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
                  ))
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
