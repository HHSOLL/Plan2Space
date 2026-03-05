import { getAccessToken } from "./auth";

function resolveBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_RAILWAY_API_URL;
  if (!baseUrl || baseUrl.trim().length === 0) {
    throw new Error("NEXT_PUBLIC_RAILWAY_API_URL is not configured.");
  }
  return baseUrl.replace(/\/$/, "");
}

export async function backendFetch<T>(path: string, init: RequestInit = {}, options: { auth?: boolean } = {}) {
  const baseUrl = resolveBaseUrl();
  const useAuth = options.auth ?? true;

  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (useAuth) {
    const token = await getAccessToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const details = payload && typeof payload === "object" ? (payload as any).details ?? (payload as any).error : null;
    const message = details || `API request failed (${response.status})`;
    const error = new Error(message) as Error & { status?: number; payload?: unknown };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}
