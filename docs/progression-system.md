# 학생 레벨 · 경험치 · 캐릭터 육성 시스템

> 이후 **모든 시뮬레이션·미니게임**은 이 문서를 따른다.  
> 코드 단일 출처: [`lib/xp.ts`](../lib/xp.ts), [`lib/progression.ts`](../lib/progression.ts)

---

## 1. 한 줄 요약

학생은 과제를 클리어할수록 **XP → 레벨업 → 파이 성장 변신 → 동료 해금**을 얻는다.  
한 판의 점수가 곧 경험치이며, **만점 ≈ 1000점**을 목표로 콘텐츠를 설계한다.

---

## 2. 수치 프레임 (고정)

| 항목 | 값 |
|------|-----|
| 한 판 점수 | **0 ~ 1000** (정수) |
| 점수 → XP | **1:1** (`scoreToXp`가 클램프) |
| 만렙 | **Lv.100** |
| 만렙 누적 XP | **1,000,000** (만점 약 1000판) |
| 곡선 지수 | **2.4** (초반 빠름 → 후반 완만) |

### 누적 XP 공식

레벨 `L`(1…100)에 **도달하기 위해 필요한 누적 XP**:

```
cumulativeXp(L) = floor( 1_000_000 * ((L - 1) / 99) ^ 2.4 )
```

- Lv.1 = 0 XP  
- Lv.100 = 1,000,000 XP  

SQL에도 동일 식: `pm_level_from_xp(total_xp)`.

### 샘플 임계값 (대략)

| 레벨 | 누적 XP |
|------|---------|
| 2 | ~매우 적음 (첫 판으로도 상승 체감) |
| 5 | 초원 해금 |
| 10 | 모험가 파이 |
| 15 | 언덕 해금 |
| 25 | 탐험대장 파이 |
| 30 | 별빛 해금 |
| 50 | 중반 |
| 85 | 전설 파이 |
| 100 | 만렙 |

정확한 값은 `sampleLevelThresholds()` 또는 앱 `/adventure` UI를 본다.

---

## 3. 시뮬레이션 · 게임 제작 규칙 (필수)

1. **한 판 만점은 대략 1000점**이 되도록 난이도·채점을 맞춘다.  
2. 부분 점수도 허용한다 (0~1000). 보너스로 1000을 **넘기지 않는다**.  
3. 클리어 후 서버에서만 XP를 부여한다. 클라이언트 조작 점수를 신뢰하지 않는다.  
4. 호출:

```ts
import { awardStudentXp } from "@/app/adventure/actions";
// 또는 lib 래퍼
await awardStudentXp({ gameKey: "sim-fractions-1", score: earnedScore });
```

5. `gameKey`는 콘텐츠 고유 문자열 (예: `grade1-number-run`, `mid2-linear-lab`).  
6. 같은 판을 여러 번 해도 **매번 XP가 쌓인다** (연습 장려). 필요 시 콘텐츠별로 일일 캡은 나중에 추가.

### 난이도 가이드

| 성과 | 권장 점수대 |
|------|-------------|
| 대충 참여 | 100–300 |
| 보통 클리어 | 400–700 |
| 잘함 | 750–900 |
| 거의 만점 | 950–1000 |

---

## 4. 캐릭터 성장

### 파이 단계 (레벨 구간)

| ID | 레벨 | 칭호 | 이미지 |
|----|------|------|--------|
| `pi_apprentice` | 1–9 | 견습 파이 | `mascot-v2.png` |
| `pi_adventurer` | 10–24 | 모험가 파이 | `pi-adventurer.png` |
| `pi_captain` | 25–44 | 탐험대장 파이 | `pi-captain.png` |
| `pi_knight` | 45–64 | 수식 기사 파이 | `pi-knight.png` |
| `pi_archmage` | 65–84 | 아크메이지 파이 | `pi-archmage.png` |
| `pi_legend` | 85–100 | 전설 파이 | `pi-legend.png` |

상세 아트 규칙: [`character-style-guide.md`](./character-style-guide.md)

### 동료 해금

| 레벨 | 동료 | 이미지 |
|------|------|--------|
| 1 | 파이 (기본) | 단계별 |
| 5 | 초원 | `grade-1-v2.png` |
| 15 | 언덕 | `grade-2-v2.png` |
| 30 | 별빛 | `grade-3-v2.png` |

학생은 해금된 동료 중 **표시 아바타**를 고를 수 있다 (`active_avatar`).

---

## 5. 데이터 · API

| 객체 | 역할 |
|------|------|
| `pm_students.total_xp` / `level` / `active_avatar` | 진행 요약 |
| `pm_xp_events` | 지급 로그 |
| `pm_student_sessions` | 로그인 opaque 토큰 (XP 지급 인증) |
| `pm_award_student_xp(token, game_key, score)` | XP 지급 RPC |
| `pm_get_student_progress(token)` | 진행 조회 |
| `pm_set_student_avatar(token, avatar)` | 아바타 변경 |

학생은 Supabase Auth를 쓰지 않으므로, **세션 토큰**으로만 본인 XP를 올릴 수 있다.

UI: 학생 `/adventure`, 탑바 Lv 표시, 홈 “내 모험”.

---

## 6. 안티치트 (최소)

- 점수는 Server Action / Route에서만 확정 후 `pm_award_student_xp` 호출  
- RPC는 세션 토큰 해시 검증, score 0–1000 클램프  
- `password_hash`와 마찬가지로 토큰 평문은 DB에 저장하지 않음 (해시만)  
- 교사 RLS로는 학생 XP를 **읽기만** (임의 가산 불가 — 필요 시 별도 교사 RPC)

---

## 7. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-19 | 초판: 1000점 / Lv.100 / 100만 XP, 파이 단계 + 동료 해금 |
