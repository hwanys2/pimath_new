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

- 환경변수도 `PM_` 접두사로 통일한다. Supabase → Vercel 연동이 만든 `PM_*` 변수를 그대로 사용한다.
- **현재 Supabase 접근은 전부 서버(서버 컴포넌트/액션/route/proxy)에서만** 일어나므로 `NEXT_PUBLIC_` 노출이 필요 없다. 서버는 `lib/supabase/env.ts` 로 **`PM_SUPABASE_URL` / `PM_SUPABASE_ANON_KEY` 를 우선** 읽고, 없으면 `NEXT_PUBLIC_PM_*` 로 폴백한다.
- **legacy anon JWT** (`eyJ...`, role=anon)를 쓴다. 빈 값이거나 다른 프로젝트 키면 `signInWithPassword` 가 실패할 수 있다. `service_role`/secret(`PM_SUPABASE_SERVICE_ROLE_KEY`, `PM_POSTGRES_*` 등)은 앱/클라이언트에서 사용하지 않는다.

```bash
# .env.local (커밋 금지 — .gitignore 처리됨). Vercel Production에도 동일 이름.
PM_SUPABASE_URL=https://jmgoqpqyrnoamfjngcmy.supabase.co
PM_SUPABASE_ANON_KEY=eyJhbGci...   # anon (legacy JWT) 키
# pimath 프로덕션 canonical origin (auth redirectTo / emailRedirectTo)
PM_SITE_URL=https://pimath.kr
# (선택) 대시보드 중복용 — 서버 폴백
# NEXT_PUBLIC_PM_SUPABASE_URL=...
# NEXT_PUBLIC_PM_SUPABASE_ANON_KEY=...
```

- 향후 **브라우저(클라이언트 컴포넌트)에서 Supabase가 필요**해지면 `NEXT_PUBLIC_PM_*` 를 브라우저에서도 사용한다 (`PM_` 만 붙은 값은 서버 전용).
- SSR: `@supabase/ssr` 사용. 쿠키 어댑터는 **`getAll`/`setAll` 만** 사용(개별 `get/set/remove` 금지).
- 세션 보호/검증은 서버에서 **`supabase.auth.getClaims()`** (또는 `getUser()`)로 하고, `getSession()` 결과는 신뢰하지 않는다.
- Next.js 16: `middleware.ts` 는 deprecated → **`proxy.ts`** 를 사용한다.

### 이메일 로그인 / 비밀번호 (foreducator와 동일)

- foreducator와 pimath 모두 **`supabase.auth.signInWithPassword`** 로 이메일 로그인한다. Django 비밀번호와는 별개다.
- 비밀번호 재설정: `resetPasswordForEmail` → 메일 링크 → `/auth/callback?next=/reset-password` → `updateUser({ password })`.
- 재설정한 Auth 비밀번호는 **양쪽 사이트에서 동일**하게 적용된다 (공유 `auth.users`).

### 교사 / 학생 이중 로그인 (pimath)

| 역할 | 인증 | 비고 |
|------|------|------|
| 교사 | 공유 Supabase Auth (이메일/Google/Kakao) | 기존 플로우 + `ensure_supabase_django_user` |
| 학생 | `pm_students` + 서명 쿠키 `pm_student_session` | **auth.users 미사용** — foreducator에 학생 계정 생기지 않음 |

학생 세션 서명 키:

```bash
PM_STUDENT_SESSION_SECRET=...  # 서버 전용, 긴 랜덤 문자열
```

관련 `pm_` 객체 (마이그레이션: `supabase/migrations/*_pm_classes_students.sql`):

| 객체 | 역할 |
|------|------|
| `pm_classes` | 교사 소유 학급 |
| `pm_students` | 학급 학생 (login_id 전역 unique, password_hash) |
| `pm_authenticate_student` | 학생 로그인 검증 RPC (anon 호출 가능) |
| `pm_create_student` / `pm_bulk_create_students` | 교사 소유 검증 후 해시 포함 생성 |
| `pm_set_student_password` / `pm_update_student` | 비밀번호·프로필 수정 |
| `pm_students.total_xp` / `level` / `active_avatar` | 학생 육성 진행 |
| `pm_xp_events` | XP 지급 로그 |
| `pm_student_sessions` | 학생 opaque 세션 (XP 인증) |
| `pm_award_student_xp` / `pm_get_student_progress` / `pm_set_student_avatar` | 육성 RPC (만렙 XP 50만) |
| `pm_class_contents` | 학급별 콘텐츠 담아두기·활성화 (`content_key`, `is_active`) |
| `pm_list_my_class_contents` | 학생 세션으로 자기 반 배정 목록 조회 |
| `pm_game_runs` | 배정·활성 게임의 한 판 점수 (랭킹용) |
| `pm_submit_game_run` | 학생 세션 + 배정·활성일 때만 기록 + XP |
| `pm_list_game_ranking` | 랭킹 — `world`(전체) / `school`(같은 teacher_id) / `class` × `all`/`best` |
| `pm_list_class_game_ranking` | (레거시) class 스코프 위임 |
| `pm_list_xp_ranking` | 어드벤처 누적 XP 랭킹 (`world`/`school`/`class`) — 상위 3 + 내 등수 ±1 |
| `pm_pvp_rematch_block` | 대전 게임 직전 상대 재매칭 방지 (게임별 20초 쿨다운) |
| `pm_pvp_record_rematch_block` | 대국 종료 시 양방향 블록 기록 (내부 헬퍼) |
| `pm_omok_*` / `pm_quad_*` / `pm_sq_*` | 1:1 대전 매칭·게임·랭킹 RPC (오목 / 사각형 / 정사각형) |

대전 매칭·자동 재매칭 구현 가이드: [`docs/pvp-matchmaking.md`](pvp-matchmaking.md).  
제품 규칙(스코프, 재매칭 20초 등): [`docs/content-system.md`](content-system.md) §5.4.
- 앱에서 학생 세션은 `lib/student-session.ts` (`jose` JWT 쿠키 + DB session token). 교사 식별은 계속 `getUser()`.
- 레벨/XP 규칙: [`docs/progression-system.md`](progression-system.md)
- 콘텐츠·배정·공개 링크: [`docs/content-system.md`](content-system.md)
- UI: `/login` 선택 → `/login/teacher` 또는 `/login/student`. 학급 관리: `/teacher`. 학생 모험: `/adventure`.

---

## 5. Auth Redirect URL

- Google/Kakao OAuth는 PKCE 플로우이며 **`redirectTo` 로 항상 pimath 콜백을 명시**한다: `<origin>/auth/callback`.
- 비밀번호 재설정도 같은 콜백을 쓴다: `<origin>/auth/callback?next=/reset-password`.
- `<origin>` 은 `lib/auth-origin.ts`의 `getAuthOrigin()`이 결정한다. **프로덕션에서는 `PM_SITE_URL`을 우선**하고, 없으면 request headers를 쓴다.
- Supabase 대시보드의 **Redirect URL allow list**에 pimath 콜백을 추가해야 한다.
  - 로컬: `http://localhost:3000/auth/callback`
  - 프로덕션: `https://pimath.kr/auth/callback`, `https://www.pimath.kr/auth/callback`
  - (선택) Vercel 기본 도메인: `https://pimath-new.vercel.app/auth/callback`
  - 비밀번호 재설정: 위 도메인 + `?next=/reset-password` 변형도 등록
- Site URL 은 foreducator 기본값일 수 있으므로, pimath는 `redirectTo`를 명시적으로 넘기고 allow list에 pimath 도메인을 등록해 foreducator 로 튕기지 않게 한다.

---

## 6. 절대 하지 말 것 (체크리스트)

- [ ] foreducator 테이블/함수/정책 `ALTER`/`DROP`/데이터 변경
- [ ] `pimath_*` 레거시 테이블 재사용
- [ ] `auth_user`/`common_profile`/매핑 테이블 직접 쓰기 (RPC만 사용)
- [ ] `handle_new_auth_user` 등 공유 트리거 수정
- [ ] `service_role`/secret 키 클라이언트 노출
- [ ] 사람 확인 없이 공유 DB에 마이그레이션 적용
