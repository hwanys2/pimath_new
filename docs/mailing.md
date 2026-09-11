# pimath 관리자 메일링 (SES / Mail Manager)

## From

`"수학하는 즐거움" <noreply@pimath.kr>` — SES에서 `pimath.kr` 도메인 DKIM 인증 필요.

## SMTP (현재 A안: Mail Manager)

코드는 `AWS_SES_SMTP_HOST`를 그대로 사용합니다. 호스트를 안 넣으면 기본값이
`email-smtp.ap-southeast-2.amazonaws.com` (일반 SES SMTP)입니다.

Mail Manager 자격(`inp-…`)을 쓸 때는 **반드시** 표에 나온 엔드포인트를 HOST에 넣습니다.

| 변수 | 예시 |
|------|------|
| `AWS_SES_SMTP_USER` | `inp-…` |
| `AWS_SES_SMTP_PASS` | Mail Manager SMTP 암호 |
| `AWS_SES_SMTP_HOST` | `xxxx.jd2m.mail-manager-smtp.amazonaws.com` |
| `CRON_SECRET` | cron / unsubscribe 서명 |
| `PM_SUPABASE_SERVICE_ROLE_KEY` | pimath service_role |

일반 SES SMTP(`AKIA…`)를 쓸 때는 HOST를 비우거나
`email-smtp.ap-southeast-2.amazonaws.com` 으로 두면 됩니다. `inp-…` 사용자를
일반 SES 호스트에 넣으면 `535 Authentication Credentials Invalid`가 납니다.

Cron: `*/5 * * * *` → `/api/cron/process-mailing` (`vercel.json`).

## 발송 대상 (3종)

| 값 | 의미 |
|----|------|
| `test` | `hwanys2@naver.com` 관리자만 (테스트) |
| `marketing` | `mail_marketing_consent = true` |
| `system` | 이메일 있는 전체 교사 (필수 안내) |

관리자 UI(`/admin/mailing`)에서 라디오로 선택. 본문은 리치텍스트 ↔ HTML 전환 가능.
