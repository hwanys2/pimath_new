# 탐구형 과제 (Inquiry) 시스템

> 데스모스 액티비티처럼 **교사가 페이지를 넘기면 학생도 함께 넘어가는** 수업용 콘텐츠 타입.  
> 관련: [`content-system.md`](content-system.md), [`activity-results.md`](activity-results.md)  
> 코드: [`lib/inquiry-types.ts`](../lib/inquiry-types.ts), [`lib/inquiry-session.ts`](../lib/inquiry-session.ts)

---

## 1. 한 줄 요약

`inquiry`(탐구) 타입은 교사 주도 동기화 수업을 지원한다. 활성 세션이 없으면 기존처럼 **솔로 연습**, 세션이 있으면 학생은 **대기 → 동기화 플레이** (자율 넘김 불가).

---

## 2. 콘텐츠 타입 비교

| 타입 | 동기화 | 점수 | 설명 |
|------|--------|------|------|
| `simulation` | 없음 | 없음 | 개념 탐구 |
| `game` | 없음 | 즉시 제출 | 솔로/PvP 게임 |
| `inquiry` | **교사 주도** | 선택 (`inquiry.scoring`) | 수업 모드 + 연습 fallback |

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
| `setup` | 수업 준비 · 수업 시작 | 대기 화면 |
| `live` | 이전/다음으로 step 이동 | 현재 step만 · 제출 후 대기 |
| `closed` | 수업 종료 · (선택) 점수 집계 | 종료 안내 |

---

## 4. 하이브리드 모드

- **활성 세션 없음** → `RadicalFillQuiz` 등 솔로 연습 (`submitGameRun`)
- **활성 세션 있음** → `InquiryStudentView` 동기화 모드 (step별 `pm_inquiry_step_responses`)

---

## 5. 교사 3탭 대시보드

| 탭 | 내용 | 프라이버시 |
|----|------|-----------|
| 문제 화면 | 학생과 동일 UI (읽기 전용) | 응답 숨김 |
| 접속 현황 | 학생 × 문항 O/X/· 그리드 + 온라인 | 입력값 숨김 |
| 학생 응답 | 문항별 상세 응답 | 탭 열 때만 노출 |

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
| `pm_inquiry_poll` / `teacher_poll` | 1.2s 폴링 |
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

채점은 서버 액션에서 [`lib/radical-fill-math.ts`](../lib/radical-fill-math.ts) `checkAnswer` 호출 후 RPC에 `result` 전달.

---

## 8. 점수 (`inquiry.scoring`)

`g3-u1-radical-fill`: `scoring: true` — 수업 종료 시 참가자별 집계 → `pm_inquiry_record_session_runs` → `pm_game_runs` + XP (배정·활성 시).

---

## 9. 새 탐구 콘텐츠 체크리스트

1. [`lib/contents.ts`](../lib/contents.ts) 등록 + `inquiry` 메타
2. step UI 컴포넌트 (`components/inquiry/...`)
3. 서버 액션 채점 분기 + `pm_inquiry_submit_response`
4. [`InquiryResponsePanel`](../components/inquiry/InquiryResponsePanel.tsx) 렌더러 등록
5. 교사 대시보드에서 3탭 확인
6. [`activity-results.md`](activity-results.md) — 세션 종료 집계 경로 문서화

---

## 10. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-30 | 최초 도입 — `g3-u1-radical-fill` 탐구 전환 |
