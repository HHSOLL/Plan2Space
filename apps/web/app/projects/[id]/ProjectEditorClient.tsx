"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CustomizationData } from "../../../../../types/database";
import { EditorScene } from "../../../components/canvas/EditorScene";
import { SaveButton } from "../../../components/editor/SaveButton";
import { useProjectData } from "../../../hooks/useProjectData";

type ProjectEditorClientProps = {
  projectId: string;
  projectName: string;
  initialCustomization: CustomizationData | null;
  initialVersion: { id: string; version: number } | null;
};

export function ProjectEditorClient({ projectId, projectName, initialCustomization, initialVersion }: ProjectEditorClientProps) {
  useProjectData(initialCustomization);
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Project</div>
            <h1 className="truncate font-serif text-2xl text-stone-900">{projectName}</h1>
            <div className="mt-1 text-xs text-stone-500">
              {initialVersion ? `v${initialVersion.version}` : "No saved version yet"}
            </div>
          </div>
          <SaveButton projectId={projectId} />
        </div>
        <div className="h-[70vh] overflow-hidden rounded-3xl border border-stone-200 bg-black shadow-sm">
          <EditorScene />
        </div>
      </div>
    </QueryClientProvider>
  );
}
