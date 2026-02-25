"use client";

import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSceneStore } from "../../lib/stores/useSceneStore";
import { saveProject } from "../../lib/api/project";
import { Save } from "lucide-react";

type SaveButtonProps = {
  projectId: string;
  message?: string;
  className?: string;
};

export function SaveButton({ projectId, message, className }: SaveButtonProps) {
  const lastClickAtRef = useRef(0);
  const sceneStore = useSceneStore();

  const mutation = useMutation({
    mutationFn: async () => {
      await saveProject(projectId, {
        topology: {
          scale: sceneStore.scale,
          scaleInfo: sceneStore.scaleInfo,
          walls: sceneStore.walls,
          openings: sceneStore.openings
        },
        assets: sceneStore.assets,
        materials: {
          wallIndex: sceneStore.wallMaterialIndex,
          floorIndex: sceneStore.floorMaterialIndex
        }
      });
      return { version: "ok" };
    },
    onSuccess: () => {
      toast.success("Design Archive Synchronized");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Synchronization failed.";
      toast.error(msg);
    }
  });

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={() => {
        const now = Date.now();
        if (now - lastClickAtRef.current < 800) return;
        lastClickAtRef.current = now;
        mutation.mutate();
      }}
      className={className || "flex items-center gap-3 px-8 py-4 bg-white text-black rounded-[24px] text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl hover:bg-white/90 transition-all disabled:opacity-50 active:scale-95"}
    >
      <Save className="w-4 h-4" />
      {mutation.isPending ? "Archiving..." : "Archive"}
    </button>
  );
}
