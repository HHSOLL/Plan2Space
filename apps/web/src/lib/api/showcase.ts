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

function resolveBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_RAILWAY_API_URL;
  if (!baseUrl || baseUrl.trim().length === 0) {
    throw new Error("NEXT_PUBLIC_RAILWAY_API_URL is not configured.");
  }
  return baseUrl.replace(/\/$/, "");
}

export async function fetchShowcaseSnapshots(limit = 24): Promise<ShowcaseSnapshotItem[]> {
  const response = await fetch(`${resolveBaseUrl()}/v1/showcase?limit=${limit}`, {
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as { items?: ShowcaseSnapshot[] } | null;

  if (!response.ok) {
    throw new Error(`Showcase request failed (${response.status})`);
  }

  return (payload?.items ?? []).map((item) => ({
    ...item,
    previewMeta: getSharePreviewMeta(item.preview_meta)
  }));
}

function toShowcaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes("NEXT_PUBLIC_RAILWAY_API_URL")) {
    return "Showcase API is not configured for this environment.";
  }

  return "Showcase feed is unavailable right now.";
}

export async function fetchShowcaseSnapshotResult(limit = 24): Promise<{
  items: ShowcaseSnapshotItem[];
  error: string | null;
}> {
  try {
    const items = await fetchShowcaseSnapshots(limit);
    return { items, error: null };
  } catch (error) {
    return {
      items: [],
      error: toShowcaseErrorMessage(error)
    };
  }
}
