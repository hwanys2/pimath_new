export const STUDENT_QR_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function isValidStudentQrToken(token: string): boolean {
  return STUDENT_QR_TOKEN_PATTERN.test(token);
}

export function normalizeStudentQrToken(raw: string): string {
  return raw.trim().toLowerCase();
}

export function getStudentQrLoginPath(token: string): string {
  return `/s/${token}`;
}

export function getStudentQrLoginUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${getStudentQrLoginPath(token)}`;
}

export function studentQrFileName(displayName: string): string {
  const safe = displayName.replace(/[^\w가-힣.-]+/g, "_").slice(0, 40);
  return `${safe || "student"}-qr.png`;
}
