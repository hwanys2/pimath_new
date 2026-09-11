export type MailAudience = "test" | "marketing" | "system";

export const MAIL_AUDIENCES: MailAudience[] = ["test", "marketing", "system"];

export function isMailAudience(value: unknown): value is MailAudience {
  return value === "test" || value === "marketing" || value === "system";
}

export const AUDIENCE_LABELS: Record<MailAudience, string> = {
  test: "테스트 (관리자만)",
  marketing: "소식·이벤트 수신 동의",
  system: "시스템 필수 안내 (전체)",
};
