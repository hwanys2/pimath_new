import { headers } from "next/headers";

/**
 * Canonical origin for auth redirects (OAuth, email confirm, password reset).
 * Prefer PM_SITE_URL in production; fall back to request headers.
 */
export async function getAuthOrigin(): Promise<string> {
  const configured = process.env.PM_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    throw new Error("[pm] Missing host header and PM_SITE_URL");
  }

  const protocol =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");

  return `${protocol}://${host}`;
}

export function getAuthCallbackUrl(origin: string, next?: string): string {
  const base = `${origin.replace(/\/$/, "")}/auth/callback`;
  if (!next) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}
