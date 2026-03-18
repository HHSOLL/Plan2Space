"use client";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

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

  const current = toUrl(window.location.origin);
  const configured = toUrl(process.env.NEXT_PUBLIC_APP_URL);

  if (!current) return null;
  if (!configured) return current.origin;

  if (isLoopback(current) && isLoopback(configured) && current.origin !== configured.origin) {
    return configured.origin;
  }

  return current.origin;
}

export function resolveCanonicalBrowserHref(href: string) {
  const current = toUrl(href);
  const canonicalOrigin = resolveBrowserAppOrigin();

  if (!current || !canonicalOrigin) return null;
  if (current.origin === canonicalOrigin) return null;

  const canonical = new URL(`${current.pathname}${current.search}${current.hash}`, canonicalOrigin);
  return canonical.toString();
}

export function buildBrowserAuthRedirectUrl() {
  const origin = resolveBrowserAppOrigin();
  if (!origin) return undefined;
  return new URL("/auth/callback", origin).toString();
}
