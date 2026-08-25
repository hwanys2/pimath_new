# 학습 결과 시스템

> 학급에 배정한 콘텐츠의 **학생 활동 기록**과 **교사 조회 UI** 규칙.  
> 관련: [`content-system.md`](content-system.md) (배정), [`progression-system.md`](progression-system.md) (XP)  
> 코드: [`lib/activity-results.ts`](../lib/activity-results.ts), [`lib/activity-result-schemas.ts`](../lib/activity-result-schemas.ts)

---

## 1. 한 줄 요약

학생이 배정·활성 콘텐츠를 플레이하면 **공식 기록**이 DB에 쌓이고, 교사는 **내 학급 → 학급 상세 → 학습 결과**에서 학생별로 모아볼 수 있다.

---

## 2. 기록 게이트

[`content-system.md`](content-system.md) §5.3과 동일:

| 상황 | 기록 |
|------|------|
| 비로그인 / 미배정 / 비활성 | **연습 모드** — DB 기록 없음 (`game`·`simulation`) |
| `inquiry` 학생, 세션 없음 | 참여 불가 또는 대기 — 기록 없음 |
| `inquiry` 학생, 세션 종료 | `pm_inquiry_record_session_runs` (배정·활성 시) |
| 학생 로그인 + 배정·활성 | **공식 기록** |

---

## 3. `details` JSON 스키마 (v1)

게임·시뮬레이션 공통 envelope:

```ts
type ActivityDetailsV1 = {
  v: 1;
  summary: Record<string, string | number | boolean>; // 교사 목록용
  items?: Array<Record<string, unknown>>;              // 문항·라운드별
};
```

- `summary`: 교사 요약 표에 표시할 핵심 수치
- `items`: 펼쳐 보기 시 문항별 상세 (10~20개 수준, 원시 입력값 저장 금지)
- 스키마 등록: [`lib/activity-result-schemas.ts`](../lib/activity-result-schemas.ts) `SUMMARY_LABELS`

---

## 4. 제출 API

### 게임 (점수 있음)

```ts
await submitGameRun({
  contentKey: "g3-u1-radical-fill",
  score: 850,
  details: activityDetailsV1({ correctCount: 8, problemCount: 10, totalWrongs: 12 }, items),
});
```

- 서버: `pm_submit_game_run` → `pm_game_runs` + `pm_xp_events.meta`
- XP·랭킹 규칙은 [`progression-system.md`](progression-system.md) 그대로

### 시뮬레이션 (점수 없음)

```ts
await submitActivity({
  contentKey: "g1-u1-1-sieve-eratosthenes",
  status: "completed",
  details: activityDetailsV1({ primesFound: 25, explored: true }),
  durationSec: 120,
});
```

- 서버: `pm_submit_activity` → `pm_activity_sessions`
- `awardStudentXp` / `submitGameRun` 호출 **금지**

---

## 5. 저장소

| 콘텐츠 타입 | 테이블 | 제출 |
|-------------|--------|------|
| 솔로 게임 | `pm_game_runs` (+ `details`) | `submitGameRun` |
| 탐구 (`inquiry`) | `pm_inquiry_*` → 종료 시 `pm_game_runs` | `pm_inquiry_record_session_runs` (교사 종료 시) |
| PvP 게임 | `pm_omok_games` / `pm_quad_games` / `pm_sq_games` | 매치 종료 시 기존 RPC (어댑터로 조회) |
| 교사 세션 게임 | `pm_dice_race_*` / `pm_ball_box_*` | 기존 세션 RPC (어댑터로 조회) |
| 시뮬레이션 | `pm_activity_sessions` | `submitActivity` |

교사 조회 RPC:
- `pm_teacher_list_pvp_games(class_id, table)`
- `pm_teacher_list_session_players(class_id, game)`

---

## 6. 교사 UI

| 경로 | 내용 |
|------|------|
| `/teacher/classes/[classId]` | **학습 결과** 요약 (배정·활성 콘텐츠별 참여율) |
| `/teacher/classes/[classId]/results/[contentKey]` | 학생별 상세 (점수·문항·승패 등) |
| 수업 콘텐츠 관리 | 배정된 항목에 **결과 보기** 링크 |

미참여 학생은 **회색 "미참여"**로 표시.

---

## 7. 새 콘텐츠 체크리스트

1. [`lib/contents.ts`](../lib/contents.ts)에 등록
2. **게임** → 종료 시 `submitGameRun({ contentKey, score, details })`
3. **시뮬레이션** → 완료 시 `submitActivity({ contentKey, status: "completed", details })`
4. [`lib/activity-result-schemas.ts`](../lib/activity-result-schemas.ts)에 `SUMMARY_LABELS` 추가
5. [`components/teacher/ContentResultDetail.tsx`](../components/teacher/ContentResultDetail.tsx)에 상세 렌더러 등록 (필요 시)
6. 교사 UI에서 해당 `contentKey` 결과가 보이는지 확인

---

## 8. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-30 | 최초 도입 — `pm_game_runs.details`, `pm_activity_sessions`, 교사 학습 결과 UI |
| 2026-07-30 | 탐구 세션 종료 집계 — `pm_inquiry_record_session_runs` |
| 2026-08-17 | `g3-u3-1-tangent-intro` 세션 종료 집계 · SUMMARY_LABELS |
| 2026-08-18 | `g3-u3-1-sincos-intro` 세션 종료 집계 · SUMMARY_LABELS |
| 2026-08-24 | `g3-u3-1-tangent-intro` 5페이지 이름 붙이기 문항 집계 |
| 2026-08-25 | 세션 재준비 시 미집계 종료 버그 수정 · 결과 복구 RPC · 종료 전 점수 저장 |

