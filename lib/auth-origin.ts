import { headers } from "next/headers";

const PIMATH_HOSTS = new Set(["pimath.kr", "www.pimath.kr"]);

/** Cloudflare Workers preview / default deploy host for this project. */
const CLOUDFLARE_AUTH_HOSTS = new Set(["pimath-new.hwanys2.workers.dev"]);

export function isAllowedAuthHost(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    PIMATH_HOSTS.has(hostname) ||
    CLOUDFLARE_AUTH_HOSTS.has(hostname)
  );
}

export function resolveAuthOrigin(input: {
  configured?: string | null;
  host?: string | null;
  protocol?: string | null;
  nodeEnv?: string;
}): string {
  const host = input.host?.split(",")[0]?.trim() ?? "";
  const protocol =
    input.protocol?.trim() ||
    (input.nodeEnv === "development" ? "http" : "https");

  if (host && isAllowedAuthHost(host)) {
    return `${protocol}://${host}`.replace(/\/$/, "");
  }

  const configured = input.configured?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  throw new Error("[pm] Missing host header and PM_SITE_URL");
}

/**
 * Canonical origin for auth redirects (OAuth, email confirm, password reset).
 * Prefer the request host when it is a pimath domain so PKCE cookies match
 * the callback (apex currently 308s to www). Fall back to PM_SITE_URL.
 */
export async function getAuthOrigin(): Promise<string> {
  const h = await headers();
  return resolveAuthOrigin({
    configured: process.env.PM_SITE_URL,
    host: h.get("x-forwarded-host") ?? h.get("host"),
    protocol: h.get("x-forwarded-proto"),
    nodeEnv: process.env.NODE_ENV,
  });
}

/**
 * Exact callback URL for Supabase `redirectTo`.
 * Do not put `next` on OAuth redirects — unmatched query strings fall back to
 * the shared project's Site URL (foreducator.com). Password-reset emails may
 * still pass `next` because that exact URL is allow-listed.
 */
export function getAuthCallbackUrl(origin: string, next?: string): string {
  const base = `${origin.replace(/\/$/, "")}/auth/callback`;
  if (!next) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}
