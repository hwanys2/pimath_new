# Supabase 사용 규칙 (pimath 독립 프로젝트)

> 목표: **pimath 전용 Supabase** 로 Auth·데이터를 완전 분리한다.
> 과거에는 foreducator.com 과 프로젝트를 공유했으나, 이전 후에는 공유하지 않는다.
> 이전 절차: [`scripts/supabase-split/README.md`](../scripts/supabase-split/README.md), [`scripts/supabase-split/CUTOVER.md`](../scripts/supabase-split/CUTOVER.md).

---

## 0. 프로젝트 정보

| 단계 | 값 |
|------|----|
| (레거시 공유) Project ref | `jmgoqpqyrnoamfjngcmy` |
| (레거시) Project URL | `https://jmgoqpqyrnoamfjngcmy.supabase.co` |
| 독립 프로젝트 | `ldkteahouacxazcmijav` — `https://ldkteahouacxazcmijav.supabase.co` (see [`scripts/supabase-split/PROJECT.md`](../scripts/supabase-split/PROJECT.md)) |

- **레거시 공유 DB** 에서는 기존 foreducator 객체에 대한 `ALTER`/`DROP`/데이터 변경 금지.
- 스키마 변경(마이그레이션)을 **공유 DB** 에 적용할 때는 **반드시 사람 확인** 후.
- 독립 프로젝트에는 `scripts/supabase-split/bootstrap-new-project.sh` 로 마이그레이션을 적용한다.

---

## 1. `pm_` 접두사 규칙 (필수)

pimath 에서 **새로 만드는 모든 DB 객체**에는 `pm_` 접두사를 붙인다.

- 테이블 / 함수 / 뷰 / Storage bucket / 정책 이름

레거시 빈 `pimath_*` 테이블은 재사용·수정하지 않는다.

---

## 2. 독립 후 소유 범위

### pimath 전용

- `auth.users` (이식된 교사 UUID 유지)
- 모든 `pm_*` 테이블·RPC·Storage (`pm_forum` 등)
- `pm_profiles` — 닉네임/이메일 스냅샷
- `pm_schools` — 학교 검색 카탈로그
- `pm_notifications` — 포럼·그림도구 알림 (네비 벨: list / unread count / mark read)
- 학생: `pm_students` + 서명 쿠키 `pm_student_session` (**auth.users 미사용**)

### 더 이상 사용하지 않음

- `ensure_supabase_django_user`
- `auth_user` / `common_profile` / `auth_user_supabase_mapping`
- `school_schoolinfo` 직접 읽기
- `create_notification` (foreducator)

로그인 직후:

```ts
await supabase.rpc("pm_ensure_profile", {
  p_uid: user.id,
  p_email: user.email,
  p_nickname: …,
});
```

RLS는 **`auth.uid()`** 기준. 앱은 `auth_user` 등을 직접 쓰지 않는다.

---

## 3. 클라이언트 / 키 / 환경변수

```bash
PM_SUPABASE_URL=https://<PIMATH_REF>.supabase.co
PM_SUPABASE_ANON_KEY=eyJhbGci...   # anon (legacy JWT)
PM_SITE_URL=https://pimath.kr
PM_STUDENT_SESSION_SECRET=...
```

- 서버는 [`lib/supabase/env.ts`](../lib/supabase/env.ts) 로 `PM_*` 우선, `NEXT_PUBLIC_PM_*` 폴백.
- `service_role` 은 앱/클라이언트에 넣지 않는다. 이전 스크립트 전용.
- SSR: `@supabase/ssr` + `getAll`/`setAll` 만. 세션 검증은 `getClaims()` / `getUser()`.
- Next.js 16: **`proxy.ts`** (middleware 아님).

### 교사 / 학생

| 역할 | 인증 |
|------|------|
| 교사 | Supabase Auth (이메일/Google/Kakao) + `pm_ensure_profile` |
| 학생 | `pm_students` + `pm_student_session` |

---

## 4. Auth Redirect URL

- OAuth `redirectTo`: `<origin>/auth/callback` (쿼리 없이). post-login 경로는 `pm_auth_next` 쿠키.
- 비밀번호 재설정만 `?next=/reset-password`.
- 독립 프로젝트 **Site URL** = `https://pimath.kr`.
- Google/Kakao: cutover 시 **동일 Client ID/Secret** + 새 `https://<REF>.supabase.co/auth/v1/callback` 등록.

---

## 5. 절대 하지 말 것

- [ ] (공유 DB 잔존 시) foreducator 테이블/함수 `ALTER`/`DROP`/데이터 변경
- [ ] `pimath_*` 레거시 재사용
- [ ] JWT secret 을 foreducator 와 공유·복사
- [ ] `service_role` 클라이언트 노출
- [ ] 사람 확인 없이 공유 DB에 마이그레이션 적용
- [ ] cutover 직후 새 Google/Kakao 클라이언트 발급으로 identity 단절
