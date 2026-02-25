import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { SharedProjectClient } from "./SharedProjectClient";
import type { CustomizationData, FloorPlanData } from "../../../../../../types/database";

interface SharedProjectPageProps {
  params: { token: string };
}

export default async function SharedProjectPage({ params }: SharedProjectPageProps) {
  const supabase = createSupabaseServerClient();

  const { data: sharedProject, error: shareError } = await supabase
    .from("shared_projects")
    .select("*, projects(*)")
    .eq("token", params.token)
    .maybeSingle();

  if (shareError || !sharedProject || !sharedProject.projects) {
    notFound();
  }

  if (sharedProject.expires_at && new Date(sharedProject.expires_at) < new Date()) {
    notFound();
  }

  const project = sharedProject.projects;

  const { data: versionData } = await supabase
    .from("project_versions")
    .select("customization, floor_plan")
    .eq("project_id", project.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const customization = (versionData?.customization ?? null) as CustomizationData | null;
  const floorPlan = (versionData?.floor_plan ?? null) as FloorPlanData | null;
  const initialFurniture = customization?.furniture ?? [];
  const isReadOnly = sharedProject.permissions === "view";

  return (
    <div className="min-h-screen bg-gray-900 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          {project.description ? <p className="mt-2 text-gray-400">{project.description}</p> : null}
        </div>

        {isReadOnly ? (
          <div className="rounded border border-yellow-700 bg-yellow-900/30 px-4 py-2 text-sm text-yellow-200">
            View-only mode. Editing is disabled.
          </div>
        ) : null}

        <SharedProjectClient initialFurniture={initialFurniture} floorPlan={floorPlan} readOnly={isReadOnly} />
      </div>
    </div>
  );
}
