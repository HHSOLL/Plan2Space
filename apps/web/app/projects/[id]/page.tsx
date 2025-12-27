import { notFound, redirect } from "next/navigation";
import type { CustomizationData, Database } from "../../../../../types/database";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { ProjectEditorClient } from "./ProjectEditorClient";

export const dynamic = "force-dynamic";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type CurrentVersionRow = Pick<Database["public"]["Tables"]["project_versions"]["Row"], "id" | "version" | "customization">;
type ProjectWithCurrentVersion = Database["public"]["Tables"]["projects"]["Row"] & { current_version: CurrentVersionRow | null };

export default async function ProjectEditorPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  if (!isUuid(projectId)) notFound();

  const supabase = createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/auth");

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `
        id,
        name,
        current_version_id,
        current_version:project_versions!projects_current_version_id_fkey (
          id,
          version,
          customization
        )
      `
    )
    .eq("id", projectId)
    .single();

  if (error || !project) notFound();

  const current = (project as unknown as ProjectWithCurrentVersion).current_version;
  const initialCustomization = current?.customization ?? null;

  return (
    <ProjectEditorClient
      projectId={project.id}
      projectName={project.name}
      initialCustomization={initialCustomization}
      initialVersion={current ? { id: current.id, version: current.version } : null}
    />
  );
}
