import { getProjectAssetSummary, type ProjectAssetSummary } from "../builder/catalog";

export type SharePreviewMeta = {
  projectName: string;
  projectDescription: string | null;
  versionNumber: number | null;
  assetSummary: ProjectAssetSummary | null;
};

export function buildSharePreviewMeta(input: SharePreviewMeta) {
  return {
    projectName: input.projectName,
    projectDescription: input.projectDescription ?? null,
    versionNumber: typeof input.versionNumber === "number" ? input.versionNumber : null,
    assetSummary: input.assetSummary ?? null
  };
}

export function getSharePreviewMeta(value: unknown): SharePreviewMeta | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const projectName = typeof record.projectName === "string" && record.projectName.trim().length > 0 ? record.projectName : null;
  const projectDescription =
    typeof record.projectDescription === "string"
      ? record.projectDescription
      : record.projectDescription === null
        ? null
        : null;
  const versionNumber = typeof record.versionNumber === "number" ? record.versionNumber : null;
  const assetSummary = getProjectAssetSummary({ assetSummary: record.assetSummary });

  if (!projectName && projectDescription === null && versionNumber === null && !assetSummary) {
    return null;
  }

  return {
    projectName: projectName ?? "Shared Room",
    projectDescription,
    versionNumber,
    assetSummary
  };
}
