import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

const SMTP_USER = process.env.AWS_SES_SMTP_USER;
const SMTP_PASS = process.env.AWS_SES_SMTP_PASS;
const SMTP_HOST =
  process.env.AWS_SES_SMTP_HOST || "email-smtp.ap-southeast-2.amazonaws.com";
const SMTP_PORT = 587;
export const FROM_ADDRESS = '"수학하는 즐거움" <noreply@pimath.kr>';
export const SEND_DELAY_MS = 150;

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildEmailHtml(
  mainContent: string,
  {
    unsubscribeLink = "#",
    subject = "수학하는 즐거움 소식",
  }: { unsubscribeLink?: string; subject?: string } = {},
): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3efe6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#3b2a1a;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f3efe6;">
<tr><td style="padding:24px 12px;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin:0 auto;background-color:#fffdf8;border-radius:16px;overflow:hidden;border:1px solid #e4d5c0;">
    <tr><td style="background:#6b4423;padding:28px 24px;text-align:center;">
      <a href="https://www.pimath.kr" target="_blank" style="text-decoration:none;color:#fff8e7;font-size:22px;font-weight:700;">수학하는 즐거움</a>
      <p style="margin:8px 0 0;color:#f0d9a8;font-size:13px;">Pleasure in Math</p>
    </td></tr>
    <tr><td style="padding:28px 24px;">
      ${mainContent}
    </td></tr>
    <tr><td style="background:#2f2116;padding:28px 24px;color:#f3efe6;">
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        운영: 박진환 (수학교사) · 문의 hwanys2@naver.com
      </p>
      <p style="margin:0 0 16px;">
        <a href="https://www.pimath.kr" style="color:#f0d9a8;margin-right:16px;">홈</a>
        <a href="https://www.pimath.kr/tools" style="color:#f0d9a8;margin-right:16px;">도구</a>
        <a href="https://www.pimath.kr/settings" style="color:#f0d9a8;">설정</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;">
        <a href="${unsubscribeLink}" style="color:#f0a8a8;">마케팅 메일 수신 거부</a>
      </p>
      <p style="margin:0;font-size:11px;color:#c4b19a;line-height:1.5;">
        필수 시스템 안내(계정·보안)는 설정에서 끌 수 없습니다.<br>
        © 수학하는 즐거움 (pimath.kr)
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function createMailTransporter(): Transporter {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error("AWS_SES_SMTP_USER and AWS_SES_SMTP_PASS must be configured");
  }
  // Supports classic SES SMTP (email-smtp.*) and Mail Manager SMTP
  // (*.mail-manager-smtp.amazonaws.com) via AWS_SES_SMTP_HOST.
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    requireTLS: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendOneEmail(
  transporter: Transporter,
  { to, subject, html }: { to: string; subject: string; html: string },
): Promise<void> {
  await transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });
}
