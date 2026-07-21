# 콘텐츠 · 단원 · 학급 배정 시스템

> 이후 **모든 시뮬레이션·게임**과 교사 배정 UI는 이 문서를 따른다.  
> 관련: [`progression-system.md`](progression-system.md) (XP), [`supabase-pm-conventions.md`](supabase-pm-conventions.md) (DB)  
> 코드 단일 출처: [`lib/curriculum.ts`](../lib/curriculum.ts), [`lib/contents.ts`](../lib/contents.ts)

---

## 1. 한 줄 요약

콘텐츠는 **코드 카탈로그**에 등록한다. 학급 배정·활성화만 DB(`pm_class_contents`)에 저장한다.  
시뮬레이션·게임 모두 **공개 URL로 바로 플레이**할 수 있고, **교사가 학급에 담아두어** 수업용으로도 쓸 수 있다.

---

## 2. 콘텐츠 타입

| 타입 | `ContentType` | XP / 포인트 | 설명 |
|------|---------------|-------------|------|
| **시뮬레이션** | `simulation` | **없음** | 개념 탐구·연습. 점수 없음. `awardStudentXp` 호출 금지 |
| **게임** | `game` | **있음** | 목표 ≈1000, 이후 +1 소프트 캡 → XP 1:1. [`progression-system.md`](progression-system.md) |

카탈로그 필드 `awardsXp`는 타입과 항상 일치한다 (`simulation` → `false`, `game` → `true`).

---

## 3. 커리큘럼 계층

```
학년 (중1 / 중2 / 중3)
  └─ 단원 (unit)     ← lib/curriculum.ts
       └─ 콘텐츠     ← lib/contents.ts (시뮬레이션·게임 0개 이상)
```

- 학년 id: `1 | 2 | 3` ([`lib/grades.ts`](../lib/grades.ts))
- 단원 id: 안정 문자열. 예) `g1-1-1` (중1 · 1.1 소인수분해), `g2-1` (중2 · 1. 유리수와 순환소수)
- 표시용 `code`: `"1.1"`, `"2.4"`, `"1"` 등
- UI: `/grade/[grade]` → 단원 목록, `/grade/[grade]/[unitId]` → 해당 단원 콘텐츠

단원 트리를 바꿀 때는 **코드만** 수정한다. DB에 단원 테이블은 두지 않는다.

---

## 4. 콘텐츠 키 (`contentKey`)

- 카탈로그·DB·URL이 공유하는 **불변** 식별자
- 형식 권장: `g{학년}-u{대단원}-{소단원}-{slug}`  
  예) `g1-u1-1-sieve-eratosthenes`
- 공개 플레이 경로: `/play/{contentKey}` (예: `/play/g1-u1-1-sieve-eratosthenes`)
- **키를 rename하지 말 것.** DB `pm_class_contents.content_key`에 문자열이 저장된다. 바꿔야 하면 데이터 마이그레이션이 필요하다.

```ts
type ContentMeta = {
  key: string;
  unitId: string;
  type: "simulation" | "game";
  title: string;
  href: string;      // /play/{key}
  awardsXp: boolean;
};
```

---

## 5. 이중 접근: 공개 링크 + 학급 배정

시뮬레이션·게임 **모두** 아래 두 경로를 지원한다.

### 5.1 공개 링크 (링크 공유)

- `/play/{contentKey}` 는 **로그인·배정 여부와 무관하게** 항상 열 수 있다.
- 교사가 수업 밖에서 링크를 공유하거나, 학생이 학년·단원 페이지에서 바로 들어가도 된다.
- 공개 플레이여도 **시뮬레이션은 XP 없음**.
- **게임**도 공개 URL로 연습할 수 있지만, XP·랭킹은 아래 §5.3 조건을 만족할 때만 반영된다.

### 5.2 학급 배정 (담아두기 · 활성화)

| 상태 | DB | 학생 “우리 반 콘텐츠” 목록 | 목록에서 플레이 |
|------|-----|---------------------------|-----------------|
| 미배정 | 행 없음 | 안 보임 | — |
| 배정 · 비활성 | `is_active = false` | 보임 (비활성) | **불가** |
| 배정 · 활성 | `is_active = true` | 보임 (활성) | **가능** |

- **담아두기**: 학급에 콘텐츠를 넣음 (`INSERT`). 기본 `is_active = false`
- **활성화 / 비활성화**: `is_active` 토글
- **빼기**: 학급에서 제거 (`DELETE`)

> **중요:** 목록에서 비활성인 콘텐츠라도 **공개 URL로는 여전히 플레이 가능**하다.  
> 배정·활성화는 “우리 반 수업 목록에서의 진입 통제”이지, URL 자체를 잠그는 것이 아니다.

```
공개 URL ──(항상)──▶ 플레이
교사 담아두기 ──▶ 학생 목록에 표시
      └─ 활성화 ──▶ 목록에서 플레이 버튼 활성 (+ 게임 XP/랭킹 가능)
      └─ 비활성 ──▶ 목록에만 보임 (URL은 여전히 열림 · 연습만)
```

### 5.3 게임 XP · 랭킹 (배정·활성일 때만)

| 상황 | 플레이 | XP | 랭킹 기록 |
|------|--------|----|-----------|
| 공개 링크 / 비로그인 | 가능 | 없음 | 없음 |
| 학생 로그인 + **미배정** | 가능 | 없음 | 없음 |
| 학생 로그인 + **배정·비활성** | 가능 (공개 URL) | 없음 | 없음 |
| 학생 로그인 + **배정·활성** | 가능 | **있음** (점수→XP 1:1) | **있음** |

- 정식 게임 종료 시 `submitGameRun({ contentKey, score })` 를 호출한다 ([`progression-system.md`](progression-system.md)).
- 서버는 학생 세션 + `pm_class_contents.is_active = true` 일 때만 `pm_game_runs` 기록과 XP를 반영한다.
- 그 외에는 **연습 모드**로 플레이만 되고 점수는 저장되지 않는다.
- 기록된 점수는 결과 화면에서 **월드 / 학교 / 학급** 랭킹으로 보여 준다 (집계: 개인 최고 · 전체 기록). 상세는 [`progression-system.md`](progression-system.md) §3.1.

### 5.4 대전 게임 (1:1 PvP) 매칭

일부 게임은 **컴퓨터전** 외에 **같은 반** 또는 **전체** 대기열로 1:1 대전을 지원한다.

| 콘텐츠 키 | 게임 |
|-----------|------|
| `g1-u2-3-ordered-pair-omok` | 순서쌍 오목 |
| `g2-u3-1-quadrilateral-maker` | 사각형 만들기 |
| `g3-u1-square-maker` | 정사각형 만들기 |

#### 매칭 흐름

1. 학생이 **같은 반과 대전** 또는 **다른 사람과 대전**을 선택하면 `pm_*_join_queue` RPC로 대기열에 들어간다.
2. `pm_*_try_match`가 같은 스코프(`class` / `global`)에서 대기 중인 **다른 플레이어**와 짝을 짓는다.
3. 매칭되면 게임이 생성되고, 양쪽 클라이언트는 `pm_*_poll`로 상태를 동기화한다.
4. 대기 중에는 `poll`이 주기적으로 `try_match`를 다시 시도한다.

- **같은 반**: `pm_students.class_id`가 같은 학생끼리만 매칭 (`scope = 'class'`).
- **전체**: 로그인·게스트 모두 전역 대기열 (`scope = 'global'`). 반 대기가 길면 **전체로 확대**할 수 있다.
- 대기 행은 **15초**마다 갱신(`updated_at`)되어야 매칭 후보가 된다. **2분** 이상 갱신 없으면 고스트로 취소된다.

#### 직전 상대 재매칭 방지 (20초)

대국이 끝난 직후 두 사람이 바로 다시 대기열에 들어가면 **같은 상대와 즉시 재매칭**되기 쉽다. 이를 막기 위해:

- 게임이 종료되면(`playing` → `black_win` / `white_win` / `draw`) **직전 상대와 20초간** 같은 게임에서 다시 매칭되지 않는다.
- 20초 안에 다른 대기자가 있으면 그 사람과 매칭된다.
- 20초가 지나도 다른 대기자가 없으면 **그때는 직전 상대와 다시 매칭될 수 있다** (소규모 반·한산한 시간대).

구현: 공유 테이블 `pm_pvp_rematch_block` + 게임별 `pm_*_games` 종료 트리거. 상세는 [`supabase-pm-conventions.md`](supabase-pm-conventions.md).

#### 대전 점수·랭킹

- 대전 게임도 §5.3과 동일하게 **학생 로그인 + 해당 콘텐츠 배정·활성**일 때만 누적 랭킹·XP에 반영된다.
- 오목·사각형 만들기·정사각형 만들기는 게임별 `pm_*_ratings` / `pm_*_apply_rating`을 쓴다 (단판 점수 규칙은 각 게임 구현 참고).

---

## 6. 데이터 모델

### 코드 (카탈로그)

| 모듈 | 역할 |
|------|------|
| `lib/curriculum.ts` | 학년별 단원 트리 |
| `lib/contents.ts` | 콘텐츠 메타 + 조회 헬퍼 |
| `lib/grades.ts` | 학년 테마·캐릭터 |

### DB (배정 · 게임 기록)

| 객체 | 역할 |
|------|------|
| `pm_class_contents` | 학급별 `content_key` + `is_active` |
| RLS | 교사는 자기 학급만 CRUD (`pm_classes.teacher_id = auth.uid()`) |
| `pm_list_my_class_contents(session)` | 학생 세션으로 자기 반 배정 목록 조회 |
| `pm_game_runs` | 학급·활성 배정 게임의 한 판 점수 기록 |
| `pm_submit_game_run` | 배정·활성일 때만 기록 + XP |
| `pm_list_game_ranking` | 월드·학교·학급 랭킹 (`world`/`school`/`class` × `all`/`best`) |

학생은 `auth.users`가 아니므로 테이블 직접 SELECT 대신 **세션 토큰 RPC**를 쓴다.

---

## 7. UX 요약

### 교사 — 학급 관리 (`/teacher/classes/[classId]`)

- “수업 콘텐츠”에서 카탈로그를 보고 담아두기 / 빼기 / 활성 토글
- **공개 링크 복사**로 학생·학부모에게 URL 공유

### 교사 — 콘텐츠·플레이 화면의 「배정」

단원 페이지(`/grade/...`)와 플레이 페이지(`/play/...`)에도 **배정** 버튼이 있다 (교사 로그인 시에만 표시).

1. 「배정」 클릭 → 내 학급 목록 (체크 = 이미 배정됨)  
2. 미배정 학급 클릭 → **담아두기 + 활성화**  
3. 배정된 학급 다시 클릭 → 확인 후 **배정 취소**  
4. 버튼에 배정 학급 수 표시 (예: `배정 · 1`)  

학생은 `/adventure` 「우리 반 콘텐츠」에서 바로 플레이할 수 있다.  
공개 URL은 배정과 무관하게 계속 열 수 있다.

### 학생 (`/adventure` 등)

- “우리 반 콘텐츠”: 배정된 항목만
- 활성 → 플레이, 비활성 → 잠금 표시
- 시뮬레이션: “연습 · 점수 없음”
- 게임: 배정·활성 시 XP·월드/학교/학급 랭킹, 아니면 “연습 모드” 안내

### 학년 탐험 (공개)

- `/grade/[n]` · `/grade/[n]/[unitId]` 에서 단원·콘텐츠 탐색 후 `/play/...` 진입
- 교사면 콘텐츠 카드에 「배정」이 함께 보임

---

## 8. 새 콘텐츠 추가 체크리스트

1. [`lib/contents.ts`](../lib/contents.ts)에 `ContentMeta` 등록 (`key` 확정 후 변경 금지)
2. `app/play/{contentKey}/` 페이지 + 컴포넌트 구현
3. `type === "simulation"` 이면 XP 호출 없음 / `game` 이면 [`progression-system.md`](progression-system.md) 준수
4. 공개 `/play/...` 가 로그인 없이 동작하는지 확인
5. 교사 담아두기 UI·콘텐츠 「배정」 버튼에 자동 노출되는지 확인 (카탈로그 기반)
6. (게임만) `submitGameRun({ contentKey: content.key, score })` — 배정·활성일 때만 XP·랭킹. 결과 UI는 `GameRankingBoard` (월드/학교/학급)

---

## 9. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-19 | 초판: 공개+배정 이중 접근, sim≠XP, 단원 트리, `pm_class_contents` |
| 2026-07-19 | 단원/플레이 「배정」→ 학급 선택(담아두기+활성화), 체 연출·완료·상한 1000 |
| 2026-07-19 | 배정 체크 표시 · 다시 클릭 시 확인 후 배정 취소 |
| 2026-07-19 | 게임 XP·랭킹은 학생+배정·활성만 · `pm_game_runs` / `submitGameRun` |
| 2026-07-19 | 랭킹 스코프 월드·학교·학급 · `pm_list_game_ranking` |
| 2026-07-19 | 점수 소프트 캡 · 어드벤처 누적 XP 랭킹 |
| 2026-07-21 | §5.4 대전 게임 1:1 매칭 · 직전 상대 20초 재매칭 방지 |
