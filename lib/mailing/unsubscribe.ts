import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

function unsubscribeSecret(): string {
  const secret =
    process.env.PM_MAIL_UNSUBSCRIBE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.PM_STUDENT_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("[pm] Missing unsubscribe signing secret");
  }
  return secret;
}

export function signUnsubscribeToken(userId: string): string {
  const sig = createHmac("sha256", unsubscribeSecret())
    .update(userId)
    .digest("base64url");
  return `${userId}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [userId, sig] = parts;
  if (!userId || !sig) return null;
  try {
    const expected = createHmac("sha256", unsubscribeSecret())
      .update(userId)
      .digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return userId;
  } catch {
    return null;
  }
}

export function siteOrigin(): string {
  const configured = process.env.PM_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://www.pimath.kr";
}

export function unsubscribeUrlForUser(userId: string): string {
  const token = signUnsubscribeToken(userId);
  return `${siteOrigin()}/unsubscribe?token=${encodeURIComponent(token)}`;
}
