import { notFound } from "next/navigation";
import { normalizeSharePermission } from "../../../lib/share/permissions";
import { getSharePreviewMeta } from "../../../lib/share/preview";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { SharedProjectClient } from "./SharedProjectClient";

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

  if (!sharedProject.project_version_id) {
    notFound();
  }

  const project = sharedProject.projects;
  const previewMeta = getSharePreviewMeta(sharedProject.preview_meta);
  const { data: versionData, error: versionError } = await supabase
    .from("project_versions")
    .select("id, version, message, customization, floor_plan")
    .eq("id", sharedProject.project_version_id)
    .maybeSingle();

  if (versionError || !versionData) {
    notFound();
  }

  return (
    <SharedProjectClient
      projectName={previewMeta?.projectName ?? project.name}
      projectDescription={previewMeta?.projectDescription ?? project.description}
      latestVersion={versionData ? (versionData as Record<string, unknown>) : null}
      linkPermission={normalizeSharePermission(sharedProject.permissions)}
      expiresAt={sharedProject.expires_at}
      pinnedVersionNumber={
        previewMeta?.versionNumber ?? (typeof versionData.version === "number" ? versionData.version : null)
      }
      previewAssetSummary={previewMeta?.assetSummary ?? null}
    />
  );
}
