# 의견 게시판

> 수업 도구를 쓰다 불편한 점, 새 프로그램 제안, 사용 이야기를 남기는 **심플 게시판**.  
> 포에듀 소통공간(`tboard_*`)을 베끼지 않는다. pimath 전용 `pm_forum_*` 만 쓴다.  
> DB 객체 목록은 [`docs/supabase-pm-conventions.md`](supabase-pm-conventions.md)에도 한 줄로 적혀 있고, 제품 규칙은 여기가 맞다.

---

## 1. 한 줄 요약

도구 메뉴 **첫 항목**. 글·댓글·그림 첨부만 제공한다. 팔로우·쪽지·좋아요·조회수·고정글은 만들지 않는다.

---

## 2. 경로 · 메뉴

| 항목 | 값 |
|------|-----|
| 레지스트리 | [`lib/tools.ts`](../lib/tools.ts) `TOOLS[0]` (`key: "forum"`) |
| 목록 | `/tools/forum` |
| 글쓰기 | `/tools/forum/new` |
| 글 | `/tools/forum/{id}` |
| 수정 | `/tools/forum/{id}/edit` |

`/board` 는 전자칠판이므로 이 게시판 경로로 쓰지 않는다.

---

## 3. 권한

| 동작 | 누구 |
|------|------|
| 열람 | 로그인 없이 공개 |
| 글·댓글 작성 / 그림 첨부 | 교사 로그인 (공유 Supabase Auth). 미로그인 시 `/login/teacher?next=...` |
| 수정 | 작성자 본인 글만 |
| 삭제 | 작성자 본인, 또는 관리자(`hwanys2@naver.com`) |
| 학생 세션 | 게시판에 들어오면 모험으로 돌려 보낸다 (`shouldKeepStudentInAdventure`) |

학생 계정(`pm_students`)으로는 쓰지 않는다.

---

## 4. 글 종류

코드 카탈로그만 쓴다. DB에 카테고리 테이블을 두지 않는다.

| `category` | 표시 |
|------------|------|
| `issue` | 불편해요 |
| `idea` | 이런 거 있으면 좋겠어요 |
| `talk` | 이야기 |

제목 2–80자, 본문 1–4000자. 댓글 1–2000자.

---

## 5. 그림

설명용 **이미지만**. 일반 파일·리치는 없다.

| 규칙 | 내용 |
|------|------|
| 버킷 | `pm_forum` (public read) |
| 경로 | `{auth.uid()}/{uuid}.{jpg\|jpeg\|png\|webp\|gif}` |
| 글 | 최대 5장 |
| 댓글 | 최대 3장 |
| 용량 | 장당 4MB, jpeg/png/webp/gif |
| 업로드 | 서버 액션. 브라우저에서 Storage 클라이언트를 쓰지 않는다 |
| 표시 | 본문 아래 갤러리. 클릭하면 원본 탭 |

경로가 작성자 uid로 시작하지 않으면 RPC가 거절한다.

---

## 6. 저장 · RPC

| 객체 | 역할 |
|------|------|
| `pm_forum_posts` | 글 (`category`, `title`, `body`, `image_paths`) |
| `pm_forum_comments` | 댓글 (`post_id`, `body`, `image_paths`) |
| `pm_list_forum_posts` | 목록 (공개). `total_count` 포함 |
| `pm_get_forum_post` | 글 하나 (공개) |
| `pm_create_forum_post` / `pm_update_forum_post` / `pm_delete_forum_post` | 작성·수정·삭제 |
| `pm_list_forum_comments` | 댓글 목록 (공개) |
| `pm_create_forum_comment` / `pm_delete_forum_comment` | 댓글 작성·삭제 |

테이블 직접 INSERT/UPDATE/DELETE 는 막는다. 목록·단건·댓글 조회도 RPC만.

관리자 판별은 기존 `pm_is_diagram_admin()` 을 재사용한다 (같은 소유자 이메일). 그 함수를 ALTER 하지 않는다.

알림: 새 글·새 댓글만 기존 `create_notification` 으로 관리자(및 댓글이면 글 작성자) foreducator 알림. URL `https://www.pimath.kr/tools/forum/{id}`. 함수 정의는 건드리지 않는다.

속도 제한: 글 15초, 댓글 10초 (같은 사용자).

손대지 말 것: `tboard_*`, `create_notification`, `common_notification`, 레거시 `pimath_comment`.

---

## 7. 구현 파일

- 카탈로그·검증: [`lib/forum/`](../lib/forum/)
- 조회: [`lib/forum/queries.ts`](../lib/forum/queries.ts)
- 액션: [`app/tools/forum/actions.ts`](../app/tools/forum/actions.ts)
- UI: [`components/tools/forum/`](../components/tools/forum/)
- 마이그레이션: `supabase/migrations/20260901010000_pm_forum.sql`

---

## 8. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-09-01 | 초판. 도구 메뉴 첫 항목. 글·댓글·그림 첨부. |
