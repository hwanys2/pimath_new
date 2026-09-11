# pimath 관리자 메일링 (SES)

## 당신이 할 SES 세팅 (약 10–15분)

AWS 콘솔(foreducator와 같은 계정, 리전 `ap-southeast-2` 권장):

1. **SES → Identities → Create identity → Domain** → `pimath.kr`
2. 나온 **DKIM CNAME 3개**를 `pimath.kr` DNS에 추가
3. Identity가 **Verified** 될 때까지 대기
4. From: `"수학하는 즐거움" <noreply@pimath.kr>`

## Vercel Production env

| 변수 | 설명 |
|------|------|
| `AWS_SES_SMTP_USER` / `AWS_SES_SMTP_PASS` | foreducator와 동일 가능 |
| `AWS_SES_SMTP_HOST` | 선택, 기본 ap-southeast-2 |
| `CRON_SECRET` | cron + unsubscribe 서명 폴백 |
| `PM_SUPABASE_SERVICE_ROLE_KEY` | pimath 프로젝트 service_role |

Cron: `*/5 * * * *` → `/api/cron/process-mailing` (`vercel.json`).
