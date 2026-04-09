import { getSharePreviewMeta } from "../share/preview";

export type ShowcaseSnapshot = {
  id: string;
  token: string;
  project_id: string;
  project_version_id: string | null;
  preview_meta: unknown;
  published_at: string;
  thumbnail?: string;
};

export type ShowcaseSnapshotItem = ShowcaseSnapshot & {
  previewMeta: ReturnType<typeof getSharePreviewMeta>;
};

type ShowcasePayload = {
  items?: ShowcaseSnapshot[];
};

function resolveRailwayApiUrl() {
  const baseUrl = process.env.RAILWAY_API_URL ?? process.env.NEXT_PUBLIC_RAILWAY_API_URL;
  if (!baseUrl || baseUrl.trim().length === 0) {
    throw new Error("Showcase transport is not configured.");
  }
  return baseUrl.replace(/\/$/, "");
}

function clampLimit(limit: number) {
  return Math.min(Math.max(limit, 1), 60);
}

export async function fetchShowcaseSnapshotsViaRailway(limit = 24, revalidateSeconds = 60): Promise<ShowcaseSnapshotItem[]> {
  const normalizedLimit = clampLimit(limit);
  const response = await fetch(`${resolveRailwayApiUrl()}/v1/showcase?limit=${normalizedLimit}`, {
    next: { revalidate: revalidateSeconds }
  });

  const payload = (await response.json().catch(() => null)) as ShowcasePayload | null;

  if (!response.ok) {
    throw new Error(`Showcase request failed (${response.status})`);
  }

  return (payload?.items ?? []).map((item) => ({
    ...item,
    previewMeta: getSharePreviewMeta(item.preview_meta)
  }));
}

function toShowcaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes("configured")) {
    return "Showcase transport is not configured for this environment.";
  }
  return "Showcase feed is unavailable right now.";
}

export async function fetchShowcaseSnapshotResultServer(limit = 24): Promise<{
  items: ShowcaseSnapshotItem[];
  error: string | null;
}> {
  try {
    const items = await fetchShowcaseSnapshotsViaRailway(limit, 60);
    return { items, error: null };
  } catch (error) {
    return {
      items: [],
      error: toShowcaseErrorMessage(error)
    };
  }
}
