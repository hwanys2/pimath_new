# Supabase 사용 규칙 (pimath ↔ foreducator 공유)

> 이 프로젝트(`수학하는 즐거움`, pimath)는 **foreducator.com 과 동일한 Supabase 프로젝트**를 공유한다.
> 아래 규칙은 이후 모든 작업에서 **항상 먼저 참고**하고, 절대 어기지 않는다.
> 목표: **로그인/계정은 공유하되, pimath 전용 데이터는 완전히 분리**해서 foreducator.com 에 영향을 주지 않는다.

---

## 0. 공유 프로젝트 정보

| 항목 | 값 |
|------|----|
| 조직 / 프로젝트 | Foreducator |
| Project ref | `jmgoqpqyrnoamfjngcmy` |
| Region | `ap-northeast-2` |
| Project URL | `https://jmgoqpqyrnoamfjngcmy.supabase.co` |

- 이 프로젝트에는 foreducator.com 의 **프로덕션 데이터**(수만 명의 유저, 시간표/게임/설문 등 수백 개 테이블)가 들어 있다.
- **파괴적인 작업 절대 금지**: 기존 테이블/함수/정책의 `ALTER`, `DROP`, `TRUNCATE`, 데이터 `DELETE`/`UPDATE` 금지.
- 스키마 변경(마이그레이션)은 **반드시 사람 확인을 받은 뒤에만** 적용한다.

---

## 1. `pm_` 접두사 규칙 (필수)

pimath 에서 **새로 만드는 모든 DB 객체**에는 `pm_` 접두사를 붙인다.

- 테이블: `pm_xxx`
- 함수/RPC: `pm_xxx`
- 뷰: `pm_xxx`
- Storage bucket: `pm_xxx`
- 트리거/정책 이름도 `pm_` 로 시작

이유: 공유 DB 안에서 pimath 소유 객체를 한눈에 구분하고, foreducator 객체와 이름이 절대 겹치지 않게 하기 위함.

> 주의: 예전에 만들어진 빈 `pimath_*` 테이블(`pimath_chapter`, `pimath_subchapter`, `pimath_comment`)이 존재한다.
> 이것들은 **레거시**이므로 재사용하지 말고 건드리지 않는다. 새 데이터는 `pm_` 로 새로 만든다.

---

## 2. 공유하는 것 vs 분리하는 것

### 공유 (건드리지 않고 그대로 사용)

- `auth.users` — Supabase Auth 계정 (이메일/비밀번호, Google, Kakao)
- `auth.identities`, 세션, 토큰
- 아래 3번의 계정 동기화 브릿지 RPC (foreducator 가 이미 쓰는 것)

### 분리 (pimath 전용, `pm_` 접두사)

- pimath 만의 학습/진행/게임 데이터는 전부 `pm_*` 테이블에 저장
- pimath 의 RLS 정책은 **`auth.uid()` (Supabase UUID)** 기준으로만 작성

---

## 3. 계정 동기화 (회원가입/로그인 시 필수)

foreducator 와 **동일한 계정**으로 쓰기 위해, 로그인/회원가입(이메일·Google·Kakao)으로 세션이 만들어진 직후 아래 RPC를 호출한다.

```ts
await supabase.rpc("ensure_supabase_django_user", {
  p_supabase_uid: user.id,
  p_email: user.email,
});
```

- 이 RPC는 **foreducator 가 이미 정의해 사용 중**인 함수다. (새로 만들지 않는다.)
- 동작:
  - 이메일이 기존 foreducator 계정과 같으면 → 그 계정에 매핑 (양쪽에서 **같은 아이디**)
  - 없으면 → `auth_user` + `common_profile` + `auth_user_supabase_mapping` + 기본 그룹을 생성 (foreducator 직접 가입과 동일한 결과)
- pimath 코드는 **`auth_user` / `common_profile` / 매핑 테이블을 직접 INSERT/UPDATE 하지 않는다.** 오직 이 RPC만 호출한다.

프로필(닉네임 등)은 이미 존재하는 **`common_profile`** 을 읽어서 사용한다. (별도 `pm_profiles` 를 만들지 않는다.)

관련 foreducator 객체 (참고용, 수정 금지):

| 객체 | 역할 |
|------|------|
| `auth_user` | 레거시(Django) 유저 |
| `common_profile` | 유저 프로필(닉네임/포인트 등) |
| `auth_user_supabase_mapping` | `auth.users.id` ↔ `auth_user.id` 매핑 |
| `django_user_id()` | 현재 세션의 Django user id 반환 (RLS에서 사용) |
| `ensure_supabase_django_user(uuid, text)` | 계정 동기화 브릿지 |
| `handle_new_auth_user()` | `auth.users` INSERT 트리거 (이메일 일치 시 자동 매핑) |

---

## 4. 클라이언트 / 키 / 환경변수

- 프론트엔드에서는 **publishable(anon) 키**만 사용한다. `service_role`/secret 키는 절대 클라이언트에 노출하지 않는다.
- Next.js 에서는 `NEXT_PUBLIC_` 접두사가 붙은 값이 브라우저로 전송됨을 유의.

```bash
# .env.local (커밋 금지 — .gitignore 처리됨)
NEXT_PUBLIC_SUPABASE_URL=https://jmgoqpqyrnoamfjngcmy.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

- SSR: `@supabase/ssr` 사용. 쿠키 어댑터는 **`getAll`/`setAll` 만** 사용(개별 `get/set/remove` 금지).
- 세션 보호/검증은 서버에서 **`supabase.auth.getClaims()`** (또는 `getUser()`)로 하고, `getSession()` 결과는 신뢰하지 않는다.
- Next.js 16: `middleware.ts` 는 deprecated → **`proxy.ts`** 를 사용한다.

---

## 5. Auth Redirect URL

- Google/Kakao OAuth는 PKCE 플로우이며 **`redirectTo` 로 항상 pimath 콜백을 명시**한다: `<origin>/auth/callback`.
- Supabase 대시보드의 **Redirect URL allow list**에 pimath 콜백을 추가해야 한다.
  - 로컬: `http://localhost:3000/auth/callback`
  - 프로덕션: `https://<pimath-domain>/auth/callback`
- Site URL 은 foreducator 기본값일 수 있으므로, pimath는 `redirectTo`를 명시적으로 넘겨 foreducator 로 튕기지 않게 한다.

---

## 6. 절대 하지 말 것 (체크리스트)

- [ ] foreducator 테이블/함수/정책 `ALTER`/`DROP`/데이터 변경
- [ ] `pimath_*` 레거시 테이블 재사용
- [ ] `auth_user`/`common_profile`/매핑 테이블 직접 쓰기 (RPC만 사용)
- [ ] `handle_new_auth_user` 등 공유 트리거 수정
- [ ] `service_role`/secret 키 클라이언트 노출
- [ ] 사람 확인 없이 공유 DB에 마이그레이션 적용
