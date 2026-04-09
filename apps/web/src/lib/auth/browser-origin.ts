"use client";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);
const AUTH_QUERY_KEYS = ["code", "error", "error_description", "auth", "auth_message"];

function toUrl(value: string | undefined | null): URL | null {
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLoopback(url: URL) {
  return LOOPBACK_HOSTS.has(url.hostname);
}

export function resolveBrowserAppOrigin() {
  if (typeof window === "undefined") return null;
  return toUrl(window.location.origin)?.origin ?? null;
}

function hasAuthFlowParams(url: URL) {
  return AUTH_QUERY_KEYS.some((key) => url.searchParams.has(key));
}

export function resolveCanonicalBrowserHref(href: string) {
  const current = toUrl(href);
  const configured = toUrl(process.env.NEXT_PUBLIC_APP_URL);

  if (!current || !configured) return null;
  if (current.pathname === "/auth/callback" || hasAuthFlowParams(current)) return null;
  if (!isLoopback(current) || !isLoopback(configured) || current.origin === configured.origin) return null;

  const canonical = new URL(`${current.pathname}${current.search}${current.hash}`, configured.origin);
  return canonical.toString();
}

export function buildBrowserAuthRedirectUrl(nextPath?: string) {
  const origin = resolveBrowserAppOrigin();
  if (!origin) return undefined;
  const callbackUrl = new URL("/auth/callback", origin);
  if (nextPath && nextPath.startsWith("/")) {
    callbackUrl.searchParams.set("next", nextPath);
  }
  return callbackUrl.toString();
}
