# 교사 게임 대시보드

> 학급에 배정한 **게임**의 실시간 현황 · 수행 결과 · 랭킹을 한 화면에서 본다.  
> 관련: [`content-system.md`](content-system.md) (배정·XP), [`activity-results.md`](activity-results.md) (기록), [`progression-system.md`](progression-system.md) (점수)  
> 코드: [`lib/game-dashboard.ts`](../lib/game-dashboard.ts), [`components/teacher/game-dashboard/`](../components/teacher/game-dashboard/)

---

## 1. 한 줄 요약

카탈로그에 `type: "game"` 으로 등록하고 플레이 페이지에 `PlayBreadcrumb` 만 두면, **교사 학급 → 게임 대시보드**가 자동으로 열린다. 게임마다 대시보드 UI를 새로 만들지 않는다.

---

## 2. 교사 진입

| 위치 | 동작 |
|------|------|
| `/teacher/classes/[classId]` 수업 콘텐츠 | 배정된 게임에 **게임 대시보드** |
| 같은 페이지 학습 결과 탭 | 게임 카드 → 대시보드 |
| `/teacher/classes/[classId]/games/[contentKey]` | 대시보드 본체 (3초 폴링) |
| `/teacher/classes/[classId]/results/[contentKey]` | 상세 기록 (문항별·판별). 게임이면 대시보드 링크 |

탐구(`inquiry`)는 기존 **수업 대시보드** (`/play/...?classId=`)를 쓴다. 시뮬레이션은 결과 보기만.

---

## 3. 화면에 나오는 것

| 영역 | 솔로 게임 | 1:1 대전 | 교사 세션 게임 |
|------|-----------|----------|----------------|
| LIVE 헤더 · KPI | 플레이 중 / 참여율 / 최고점 | 동일 + 승수 | 동일 + 세션 점수 |
| 실시간 현황 카드 | presence heartbeat | + 대기열 + 진행 중 대전 | + 열려 있는 세션 점수 |
| 학급 · 학교 · 전체 랭킹 | `pm_game_runs` 개인 최고 (학급은 승수/세션 최고) | 승수 | 세션 최고 점수 |
| 수행 결과 · 최근 기록 | 한 판 점수 · details | 승패 | 세션 점수 |

온라인 판정: `pm_game_presence.last_seen_at` 이 **20초 이내**. 학생 클라이언트가 5초마다 ping.

---

## 4. 자동 연결 (새 게임에 손대지 말 것)

1. [`lib/contents.ts`](../lib/contents.ts) `type: "game"`
2. `app/play/{contentKey}/page.tsx` 에 기존처럼 **`PlayBreadcrumb`** (모든 플레이 페이지에 이미 있음)
3. 종료 시 `submitGameRun({ contentKey, score, details })`

그러면:

- 학생 로그인 + 플레이 페이지 → `GamePresenceBeacon` 이 자동 ping (`pm_ping_game_presence`)
- 교사 대시보드 목록·라우트·폴링이 카탈로그 키만으로 동작
- 기록·랭킹은 기존 `pm_game_runs` / 교사 RLS

**하지 말 것:** 게임마다 대시보드 페이지를 복사하거나, 교사 UI에 콘텐츠 키를 하드코딩.

### 선택 — 더 풍부한 실시간 점수

자동 beacon 은 `phase: "playing"` 만 보낸다. 판 도중 점수를 보여 주려면:

```ts
import { useGamePresence } from "@/components/games/GamePresenceBeacon";

useGamePresence(CONTENT_KEY, { phase: "playing", liveScore: score });
```

### 1:1 대전 · 수업 세션

특수 라이브 블록은 기존 어댑터 키로만 켠다.

| 등록 | 파일 | 대시보드 추가 블록 |
|------|------|--------------------|
| `PVP_TABLE_BY_CONTENT` | [`lib/activity-result-schemas.ts`](../lib/activity-result-schemas.ts) | 진행 중 대전 · 매칭 대기 |
| `SESSION_GAME_BY_CONTENT` | 동일 | 열려 있는 주사위/상자 세션 |

새 PvP는 [`pvp-matchmaking.md`](pvp-matchmaking.md) 체크리스트 + 위 맵에 한 줄.

---

## 5. 데이터

| 객체 | 역할 |
|------|------|
| `pm_game_presence` | 학생·콘텐츠별 최근 ping (`phase`, `live_score`) |
| `pm_ping_game_presence` / `pm_leave_game_presence` | 학생 세션 토큰 RPC |
| `pm_teacher_list_game_presence` | 학급·콘텐츠 온라인 목록 (교사) |
| `pm_teacher_list_live_pvp` / `pm_teacher_list_pvp_queue` | 진행 중 대전 · 대기열 |
| `pm_teacher_list_live_session_players` | 주사위 합 · 상자 공 열린 세션 |

직접 테이블 SELECT 금지. 학생은 세션 RPC, 교사는 `auth.uid()` 소유 학급만.

---

## 6. 새 게임 체크리스트 (대시보드)

1. `type: "game"` 등록 + `PlayBreadcrumb` (자동 presence)
2. `submitGameRun` + `SUMMARY_LABELS` ([`activity-results.md`](activity-results.md))
3. (선택) `useGamePresence` 로 라이브 점수
4. (PvP) `PVP_TABLE_BY_CONTENT` / (세션) `SESSION_GAME_BY_CONTENT`
5. 학급에 담아두기 → **게임 대시보드**에서 현황·결과·랭킹 확인

---

## 7. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-08-31 | 초판: 학급 게임 대시보드, presence heartbeat, 솔로/PvP/세션 공통 UI |
| 2026-09-02 | 학급·학교·전체 랭킹을 한 화면에. 전체 랭킹은 타학교 이름 마스킹 |
