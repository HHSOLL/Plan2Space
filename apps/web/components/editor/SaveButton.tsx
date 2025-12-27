"use client";

import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { packCustomization } from "../../hooks/useProjectData";
import { useDesignStore } from "../../store/useDesignStore";

type SaveButtonProps = {
  projectId: string;
  message?: string;
};

function getErrorFromJson(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : null;
}

export function SaveButton({ projectId, message }: SaveButtonProps) {
  const lastClickAtRef = useRef(0);

  const mutation = useMutation({
    mutationFn: async () => {
      const furniture = useDesignStore.getState().furniture;
      const customization = packCustomization(furniture);

      const res = await fetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ customization, message })
      });

      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const errorMessage = getErrorFromJson(json) ?? "Save failed.";
        throw new Error(errorMessage);
      }
      return json as { version: unknown };
    },
    onSuccess: () => {
      toast.success("Saved successfully");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Save failed.";
      toast.error(message);
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
      className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-40"
    >
      {mutation.isPending ? "Saving..." : "Save"}
    </button>
  );
}
