/**
 * Allow only same-origin relative paths for post-login redirects.
 * Rejects protocol-relative (`//evil`) and embedded URLs.
 */
export function safeNextPath(
  raw: unknown,
  fallback = "/teacher",
): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://") || trimmed.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(trimmed)) return fallback;
  return trimmed;
}
