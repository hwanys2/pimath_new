# 학생 레벨 · 경험치 · 캐릭터 육성 시스템

> 이후 **점수가 있는 게임(미니게임)** 은 이 문서를 따른다.  
> **시뮬레이션은 XP·포인트와 무관**하다 — [`content-system.md`](content-system.md) 참고.  
> 코드 단일 출처: [`lib/xp.ts`](../lib/xp.ts), [`lib/progression.ts`](../lib/progression.ts)

---

## 1. 한 줄 요약

학생은 **게임을** 클리어할수록 **XP → 레벨업 → 파이 외형 교체 → 장비 해금 → 동료 합류**를 얻는다.  
한 판의 점수가 곧 경험치이며, **목표 만점 ≈ 1000점**으로 설계한다.  
1000 이후에는 정답마다 **+1만** 올라 순위가 갈리도록 한다 (소프트 캡).  
시뮬레이션은 점수/XP를 주지 않는다.

---

## 2. 수치 프레임 (고정)

| 항목 | 값 |
|------|-----|
| 한 판 목표 만점 | **≈ 1000** (소프트 캡 임계) |
| 소프트 캡 | 점수 ≥ 1000이면 정답마다 **+1** (`applyScoreGain`) |
| 안티치트 상한 | **5000** / 판 (`SCORE_HARD_MAX`) |
| 점수 → XP | **1:1** (`scoreToXp`, hard max만 클램프) |
| 만렙 | **Lv.100** |
| 만렙 누적 XP | **500,000** |
| 곡선 지수 | **2.25** (초반 빠름 → 후반 완만) |

### 누적 XP 공식

```
cumulativeXp(L) = floor( 500_000 * ((L - 1) / 99) ^ 2.25 )
```

- Lv.1 = 0 XP  
- Lv.100 = 500,000 XP  

SQL: `pm_level_from_xp` / `pm_cumulative_xp_for_level` (동일 식).

### 샘플 임계값 (대략)

| 레벨 | 누적 XP | 비고 |
|------|---------|------|
| 2 | 매우 적음 | 첫 판으로도 상승 |
| 5 | ~수백 | 초원 해금 |
| 10 | — | 폼·아이템 연쇄 |
| 15 | — | 언덕 해금 |
| 30 | — | 별빛 해금 |
| 50 | 중반 | |
| 100 | 500,000 | 만렙 |

정확한 값은 `sampleLevelThresholds()` 참고.

---

## 3. 게임 제작 규칙 (필수) — 시뮬레이션 제외

> **시뮬레이션**(`type: "simulation"`, `awardsXp: false`)은 이 절을 적용하지 않는다.  
> XP API를 호출하지 말고, UI에도 점수를 노출하지 않는다.

**게임에만** 적용:

1. **한 판 목표 만점은 대략 1000점**.  
2. 점수 가산은 `applyScoreGain(current, gain)` — **현재 ≥ 1000이면 +1만**. 1000 미만은 기존 배점.  
3. 서버는 안티치트용 **hard max 5000**만 클램프. 그 안에서 점수=XP 1:1.  
4. 클리어 후 서버에서만 XP·랭킹 반영 — **정식 경로는 `submitGameRun`**.

```ts
import { submitGameRun } from "@/app/adventure/actions";
import { applyScoreGain } from "@/lib/xp";

score = applyScoreGain(score, pointsForThisCorrect);
await submitGameRun({ contentKey: "g1-u1-1-prime-hunt", score });
```

5. `contentKey`는 콘텐츠 카탈로그 `key`와 동일하게 쓴다 ([`content-system.md`](content-system.md)).  
6. XP·랭킹 기록은 **학생 세션 + 해당 콘텐츠가 학급에 배정·활성**일 때만 반영된다. 그 외(공개 링크·미배정·비활성)는 연습 모드.  
7. 같은 판 반복 클리어 시에도 (배정·활성이면) XP·기록이 누적된다 (연습 장려).  
8. `awardStudentXp`는 데모/연습용이다. **정식 게임 UI는 `submitGameRun`만** 호출한다.
9. **1:1 대전**이 있는 게임의 매칭·직전 상대 20초 재매칭 방지는 [`content-system.md`](content-system.md) §5.4를 따른다.

| 성과 | 권장 점수대 |
|------|-------------|
| 대충 참여 | 100–300 |
| 보통 클리어 | 400–700 |
| 잘함 | 750–900 |
| 목표 만점대 | 950–1000 |
| 극한 생존 | 1000+ (이후 +1씩) |

### 3.1 게임 랭킹 — 월드 · 학교 · 학급

배정·활성으로 제출된 기록(`pm_game_runs`)을 결과 화면에서 보여 준다.  
**모든 정식 게임**은 동일 UI(`GameRankingBoard`)와 RPC를 쓴다.

#### 스코프 (`p_scope`)

| 스코프 | `p_scope` | 범위 |
|--------|-----------|------|
| **월드** | `world` | 해당 `content_key`의 **모든** 학생 기록 |
| **학교** | `school` | 같은 교사(`pm_students.teacher_id`) 소속 **전 학급** |
| **학급** | `class` | 내 `class_id`만 |

> “학교” 전용 테이블은 없다. **교사(`teacher_id`) 단위**가 학교 스코프다.

#### 집계 (`p_mode`)

| 모드 | `p_mode` | 의미 |
|------|----------|------|
| **개인 최고** | `best` | 학생당 최고점 1행만 |
| **전체 기록** | `all` | 한 학생이 1·2·3등을 모두 차지할 수 있음 (판마다 행) |

- RPC: `pm_list_game_ranking(session, content_key, scope, mode)`
- UI: 1차 탭(월드/학교/학급) + 2차 토글(개인 최고/전체 기록). 탑3 포디움 + 리스트.
- 레거시 `pm_list_class_game_ranking`는 `scope='class'` 위임용으로만 유지한다.

### 3.2 어드벤처 누적 XP 랭킹

`/adventure` 프로필에서는 **누적 `total_xp`** 기준으로 월드·학교·학급 랭킹을 보여 준다.

| 구분 | 데이터 | UI |
|------|--------|-----|
| 게임 결과 | 해당 `content_key` 한 판 점수 | `GameRankingBoard` |
| 어드벤처 | 학생 `total_xp` / 레벨 | `AdventureXpRanking` |

- RPC: `pm_list_xp_ranking(session, scope)` — `world` / `school` / `class`
- 표시: 상위 3명 + 내 등수 ±1 (중복 제거). 순위 틈이 있으면 UI에서 `···`로 구분

---

## 4. 비주얼 보상 (레벨 숫자만 바꾸지 말 것)

### 4.1 파이 메이저 폼 — 5레벨마다 (20단계)

| 단계 | 레벨 | 칭호 | 이미지 |
|------|------|------|--------|
| 01 | 1–5 | 견습 파이 | `mascot-v2.png` |
| 02 | 6–10 | 새싹 파이 | `pi-stage-02.png` |
| 03 | 11–15 | 모험가 파이 | `pi-adventurer.png` |
| 04 | 16–20 | 탐험러너 파이 | `pi-stage-04.png` |
| 05 | 21–25 | 별빛 견습 | `pi-stage-05.png` |
| 06 | 26–30 | 탐험대장 파이 | `pi-captain.png` |
| 07 | 31–35 | 수식 수련생 | `pi-stage-07.png` |
| 08 | 36–40 | 좌표 항해사 | `pi-stage-08.png` |
| 09 | 41–45 | 수식 기사 파이 | `pi-knight.png` |
| 10 | 46–50 | 황금 모험가 | `pi-stage-10.png` |
| 11 | 51–55 | 함수의 수호자 | `pi-stage-11.png` |
| 12 | 56–60 | 정리의 전사 | `pi-stage-12.png` |
| 13 | 61–65 | 아크메이지 파이 | `pi-archmage.png` |
| 14 | 66–70 | 각도의 현자 | `pi-stage-14.png` |
| 15 | 71–75 | 확률의 도사 | `pi-stage-15.png` |
| 16 | 76–80 | 무한의 탐험가 | `pi-stage-16.png` |
| 17 | 81–85 | 별무리 마법사 | `pi-stage-17.png` |
| 18 | 86–90 | 황금 π 기사 | `pi-stage-18.png` |
| 19 | 91–95 | 천상의 계산사 | `pi-stage-19.png` |
| 20 | 96–100 | 전설 파이 | `pi-legend.png` |

### 4.2 장비·유물 (슬롯별 자동 장착)

슬롯: `pin` / `staff` / `cape` / `badge` / `aura`  
레벨에 맞는 최고 해금 아이템이 자동 장착된다 (`getEquippedCosmetics`).  
아이콘: `public/images/cosmetics/*.png` — 목록은 [`lib/progression.ts`](../lib/progression.ts) `COSMETICS`.

### 4.3 동료 해금

| 레벨 | 동료 |
|------|------|
| 1 | 파이 |
| 5 | 초원 |
| 15 | 언덕 |
| 30 | 별빛 |

---

## 5. 데이터 · API

| 객체 | 역할 |
|------|------|
| `pm_students.total_xp` / `level` / `active_avatar` | 진행 요약 |
| `pm_xp_events` | 지급 로그 |
| `pm_student_sessions` | opaque 세션 |
| `pm_award_student_xp` | XP 지급 (상한 50만) — 데모/`submit` 내부 |
| `pm_get_student_progress` / `pm_set_student_avatar` | 조회·아바타 |
| `pm_game_runs` | 학급·활성 게임 한 판 점수 |
| `pm_submit_game_run` | 배정·활성일 때 기록 + XP |
| `pm_list_game_ranking` | 랭킹 — scope `world`/`school`/`class` × mode `all`/`best` |
| `pm_list_class_game_ranking` | (레거시) class 스코프 위임 |
| `pm_list_xp_ranking` | 어드벤처 누적 XP 랭킹 (`world`/`school`/`class`) — 상위 3 + 내 등수 ±1 |

UI: `/adventure` (폼 도감 + 장비 + **누적 XP 랭킹**). 게임 결과 화면에서 콘텐츠별 월드·학교·학급 랭킹.

---

## 6. 안티치트 (최소)

- 점수는 Server Action에서만 확정 후 RPC  
- 세션 토큰 해시 검증, score **0–5000** hard 클램프 (소프트 캡은 클라이언트 가산 규칙)  
- XP·랭킹은 배정·활성(`pm_class_contents.is_active`) 검증 후에만 기록  

---

## 7. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-19 | 초판: 100만 XP / 6단계 파이 |
| 2026-07-19 | **v2**: 50만 XP · 지수 2.25 · 파이 20폼 · 장비 28종 |
| 2026-07-19 | 시뮬레이션은 XP 제외 · 게임만 이 문서 적용 ([`content-system.md`](content-system.md)) |
| 2026-07-19 | `submitGameRun` · 배정·활성만 XP · 학급 랭킹 `all`/`best` |
| 2026-07-19 | 랭킹 스코프 월드·학교·학급 · `pm_list_game_ranking` |
| 2026-07-19 | 점수 소프트 캡(1000 이후 +1) · 어드벤처 누적 XP 랭킹 |
| 2026-07-21 | 대전 게임 매칭 규칙 → [`content-system.md`](content-system.md) §5.4 참조 |
