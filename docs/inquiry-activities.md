# 탐구형 과제 (Inquiry) 시스템

> 데스모스 액티비티처럼 **교사가 페이지를 넘기면 학생도 함께 넘어가는** 수업용 콘텐츠 타입.  
> 관련: [`content-system.md`](content-system.md), [`activity-results.md`](activity-results.md)  
> 코드: [`lib/inquiry-types.ts`](../lib/inquiry-types.ts), [`lib/inquiry-session.ts`](../lib/inquiry-session.ts)

---

## 1. 한 줄 요약

`inquiry`(탐구) 타입은 **교사 주도 동기화 수업 전용**이다. 학생은 학급에 **배정·활성**되어 있고 교사가 세션을 **시작한 뒤에만** 참여한다. 비로그인·교사는 **미리보기(구경)** 만 가능하다.

---

## 2. 콘텐츠 타입 비교

| 타입 | 동기화 | 점수 | 설명 |
|------|--------|------|------|
| `simulation` | 없음 | 없음 | 개념 탐구 |
| `game` | 없음 | 즉시 제출 | 솔로/PvP 게임 |
| `inquiry` | **교사 주도** | 선택 (`inquiry.scoring`) | 수업 세션 전용 · 솔로 연습 없음 |

```ts
type InquiryMeta = {
  stepCount: number;
  grading: "auto" | "none";  // auto=정오답, none=자유 응답
  scoring?: boolean;         // 세션 종료 시 점수 산출
};
```

---

## 3. 세션 lifecycle

```
setup → live → closed
```

| 단계 | 교사 | 학생 |
|------|------|------|
| `setup` | 수업 준비 · 수업 시작 | 대기 화면 (세션 있을 때만 접속) |
| `live` | 이전/다음으로 step 이동 | 현재 step만 · **제출 후에도 수정·재제출 가능** · 다음 step은 교사 이동까지 대기 · **포기 없음** |
| `closed` | 수업 종료 · (선택) 점수 집계 | 종료 안내 |

---

## 4. 접근 규칙 (하이브리드 없음)

| 역할 | `/play/{contentKey}` 동작 |
|------|---------------------------|
| **교사** | 호스트 대시보드 (수업 준비·진행·종료) |
| **학생** | 배정·활성 + 교사 세션 `live`일 때만 풀이. 그 외 대기 또는 참여 불가 |
| **비로그인** | `InquirySpectatorView` — 문제 미리보기만 (제출·점수 없음) |

- 학생 **솔로 연습·`submitGameRun` 직접 제출 없음**
- 점수는 세션 종료 시 `pm_inquiry_record_session_runs`로만 반영 (배정·활성 시)

---

## 5. 교사 3탭 대시보드

| 탭 | 내용 | 프라이버시 |
|----|------|-----------|
| 문제 화면 | 학생과 동일 UI (읽기 전용) | 응답 숨김 |
| 접속 현황 | 학생 × 문항 O/X/· 그리드 + 온라인 | 입력값 숨김 |
| 학생 응답 | 문항별 상세 응답 | 탭 열 때만 노출 |

학급 상세 → 수업 콘텐츠 카드의 **수업 대시보드** 버튼으로 진입 (`?classId=`로 학급 미리 선택).

---

## 6. DB 스키마

| 테이블 | 역할 |
|--------|------|
| `pm_inquiry_sessions` | 세션 (phase, step_index, step_count) |
| `pm_inquiry_participants` | 참가자 + `last_seen_at` |
| `pm_inquiry_step_responses` | step별 `response` jsonb + `result` |

학급당 활성 세션 1개: `UNIQUE (class_id) WHERE phase <> 'closed'`

### 핵심 RPC

| RPC | 역할 |
|-----|------|
| `pm_inquiry_create_session` | 세션 생성 (`setup`) |
| `pm_inquiry_start` | `setup` → `live` |
| `pm_inquiry_advance_step` | step ±1 |
| `pm_inquiry_close` | `closed` |
| `pm_inquiry_join` | 학생 참가 |
| `pm_inquiry_submit_response` | step 응답 저장 |
| `pm_inquiry_poll` / `teacher_poll` | 1.2s 폴링 (학생 poll은 `step_response` 포함) |
| `pm_inquiry_list_responses` | 교사: 전체 응답 |
| `pm_inquiry_record_session_runs` | 세션 종료 시 `pm_game_runs` 일괄 기록 |

동기화는 **HTTP 폴링 1.2s** (Supabase Realtime 없음). [`pvp-matchmaking.md`](pvp-matchmaking.md)와 무관.

---

## 7. `response` / `result`

- `result`: `correct` | `wrong` | `neutral` | `null`
- `g3-u1-radical-fill` 예시:

```json
{ "fills": [{ "coeff": "3", "radicand": "2" }], "gaveUp": false, "wrongs": 1 }
```

채점은 서버 액션에서 [`lib/radical-fill-math.ts`](../lib/radical-fill-math.ts) `checkAnswer` 호출 후 RPC에 `result` 전달. 수업 중 학생 UI에는 **포기 버튼 없음**.

### 학생 workspace 복원 (새로고침·재접속)

학생 폴링(`pm_inquiry_poll`)은 현재 step의 **`myStepResult` + `myStepResponse`** 를 함께 반환한다. 클라이언트 [`InquiryStudentView`](../components/inquiry/InquiryStudentView.tsx)는 step 진입·새로고침 시:

1. 저장된 `response` jsonb가 있으면 [`lib/inquiry-workspace-restore.ts`](../lib/inquiry-workspace-restore.ts)로 입력값(workspace)을 복원한다.
2. step이 **실제로 바뀔 때만** 빈 상태로 초기화한다 (같은 step에서 새로고침하면 초기화하지 않음).
3. **제출 후에도** 입력·작도판 조작과 **재제출**이 가능하다 (`pm_inquiry_submit_response`는 upsert).

작도판(선분·길이 표시 등)은 세션 DB에 저장하지 않는다 — 새로고침 시 그려진 도형은 사라진다. 길이 라벨은 **이동** 도구로 겹침을 피할 수 있다.

새 탐구 콘텐츠 추가 시: `response` → workspace 역변환 함수를 `inquiry-workspace-restore.ts`에 등록하고, 제출 payload에 복원에 필요한 필드를 모두 포함할 것.

---

## 8. 점수 (`inquiry.scoring`)

`g3-u1-radical-fill`: `scoring: true` — 수업 종료 시 참가자별 집계 → `pm_inquiry_record_session_runs` → `pm_game_runs` + XP (배정·활성 시).

---

## 9. 새 탐구 콘텐츠 체크리스트

1. [`lib/contents.ts`](../lib/contents.ts) 등록 + `inquiry` 메타
2. step UI 컴포넌트 (`components/inquiry/...`)
3. 서버 액션 채점 분기 + `pm_inquiry_submit_response`
4. [`InquiryResponsePanel`](../components/inquiry/InquiryResponsePanel.tsx) 렌더러 등록
5. play page: 교사=대시보드, 학생=세션 대기/참여, 비로그인=미리보기
6. `inquiry-workspace-restore.ts`에 response→workspace 복원 등록
7. [`activity-results.md`](activity-results.md) — 세션 종료 집계 경로 문서화

---

## 10. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-30 | 최초 도입 — `g3-u1-radical-fill` 탐구 전환 |
| 2026-07-30 | 하이브리드 제거 — 학생 세션 전용, 비로그인 미리보기, 포기 버튼 제거 |
| 2026-08-17 | `g3-u3-1-tangent-intro` — 높이 재기 작도 탐구(3장면 + 탄젠트 표) |
| 2026-08-18 | `g3-u3-1-sincos-intro` — 빗변 작도 탐구(연·사다리·거치대 + 사인·코사인 표) |
| 2026-08-24 | 학생 workspace 새로고침 복원 · 제출 후 수정·재제출 · 작도판 길이 라벨 이동 도구 |
