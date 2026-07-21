/**
 * Math helpers for the dice probability simulation (중2 · 4. 경우의 수와 확률).
 *
 * Two dice are supported:
 *  - fair   : 정육면체 주사위. 6면 모두 확률 1/6.
 *  - cuboid : 직육면체 주사위. 두 끝면(1, 6)은 각 0.1, 네 옆면(2, 3, 4, 5)은 각 0.2.
 *             (0.1 × 2 + 0.2 × 4 = 1.0)
 *
 * 목적: 시행 횟수가 늘어날수록 상대도수가 이론적 확률(수학적 확률)에 수렴함
 *       (큰 수의 법칙)을 눈으로 확인하는 시뮬레이션.
 *
 * 점수/XP 없음 — 순수하게 개념 탐구용입니다.
 */

export type DiceType = "fair" | "cuboid";

/** 주사위 눈: 1~6. */
export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

export const DIE_FACES: DieFace[] = [1, 2, 3, 4, 5, 6];

export type DiceDefinition = {
  type: DiceType;
  /** 화면 표시용 이름. */
  name: string;
  /** 간단한 설명. */
  description: string;
  /** 눈(1~6)별 이론적 확률. 합은 항상 1. */
  probabilities: Record<DieFace, number>;
};

const FAIR_P = 1 / 6;

export const DICE: Record<DiceType, DiceDefinition> = {
  fair: {
    type: "fair",
    name: "일반 주사위",
    description: "정육면체 주사위예요. 1부터 6까지 모든 눈이 나올 확률이 똑같이 1/6입니다.",
    probabilities: {
      1: FAIR_P,
      2: FAIR_P,
      3: FAIR_P,
      4: FAIR_P,
      5: FAIR_P,
      6: FAIR_P,
    },
  },
  cuboid: {
    type: "cuboid",
    name: "직육면체 주사위",
    description:
      "길쭉한 직육면체 주사위예요. 넓이가 좁은 두 끝면(1, 6)이 나올 확률은 각각 0.1, 넓은 네 옆면(2, 3, 4, 5)이 나올 확률은 각각 0.2입니다.",
    probabilities: {
      1: 0.1,
      2: 0.2,
      3: 0.2,
      4: 0.2,
      5: 0.2,
      6: 0.1,
    },
  },
};

/** 눈별 누적 도수(카운트). */
export type Tally = Record<DieFace, number>;

export function createTally(): Tally {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
}

/** 전체 시행 횟수 = 눈별 도수의 합. */
export function tallyTotal(tally: Tally): number {
  return DIE_FACES.reduce((sum, face) => sum + tally[face], 0);
}

/**
 * 주어진 주사위를 한 번 굴려 나온 눈(1~6)을 반환합니다.
 * 누적 확률 분포(CDF)를 이용한 가중 랜덤.
 */
export function rollDie(type: DiceType): DieFace {
  const probs = DICE[type].probabilities;
  const r = Math.random();
  let cumulative = 0;
  for (const face of DIE_FACES) {
    cumulative += probs[face];
    if (r < cumulative) return face;
  }
  // 부동소수점 오차 대비 — 마지막 눈 반환.
  return 6;
}

/**
 * 주사위를 count번 굴려 tally를 갱신하고, 관찰 대상(targetFace)이 나온 횟수를
 * 반환합니다. tally 객체는 제자리에서 수정됩니다.
 */
export function rollMany(
  type: DiceType,
  count: number,
  tally: Tally,
  targetFace: DieFace,
): number {
  let targetHits = 0;
  for (let i = 0; i < count; i += 1) {
    const face = rollDie(type);
    tally[face] += 1;
    if (face === targetFace) targetHits += 1;
  }
  return targetHits;
}

/** 특정 눈의 이론적(수학적) 확률. */
export function theoreticalProbability(type: DiceType, face: DieFace): number {
  return DICE[type].probabilities[face];
}

/** 특정 눈의 상대도수. 시행 횟수가 0이면 0을 반환합니다. */
export function relativeFrequency(tally: Tally, face: DieFace): number {
  const total = tallyTotal(tally);
  if (total === 0) return 0;
  return tally[face] / total;
}

/** 수렴 그래프의 한 점: 시행 횟수와 그때까지의 상대도수. */
export type ConvergencePoint = {
  trials: number;
  relFreq: number;
};

/** 수렴 그래프 데이터를 보관하는 상태. */
export type ConvergenceSeries = {
  points: ConvergencePoint[];
  /** 마지막으로 점을 기록한 시행 횟수. */
  lastRecordedTrials: number;
};

export const MAX_CONVERGENCE_POINTS = 240;

export function createConvergenceSeries(): ConvergenceSeries {
  return { points: [], lastRecordedTrials: 0 };
}

/**
 * 현재 상태를 수렴 그래프에 기록할지 결정하고, 필요하면 점을 추가합니다.
 *
 * 시행 초반에는 촘촘하게, 후반에는 듬성듬성 기록해서 점 개수를 일정 수준으로
 * 유지합니다(로그 스케일에 가까운 샘플링). 이렇게 하면 10,000번을 넘겨도
 * 그래프가 가벼우면서, 초반의 요동과 후반의 수렴을 모두 보여 줄 수 있어요.
 *
 * 새 객체를 반환합니다(React 상태 갱신 편의).
 */
export function recordConvergencePoint(
  series: ConvergenceSeries,
  totalTrials: number,
  relFreq: number,
): ConvergenceSeries {
  if (totalTrials <= 0) return series;

  const isFirstPoints = series.points.length < 30;
  // 초반 30점은 매 시행마다, 그 뒤로는 총 시행의 약 3% 간격으로 기록.
  const minGap = isFirstPoints ? 1 : Math.max(1, Math.floor(totalTrials * 0.03));

  if (
    series.points.length > 0 &&
    totalTrials - series.lastRecordedTrials < minGap &&
    // 항상 최신 지점은 갱신될 수 있도록 마지막 점은 교체.
    totalTrials !== series.lastRecordedTrials
  ) {
    // 간격이 좁으면 마지막 점만 최신값으로 교체(누적이 아니라 대체).
    const next = series.points.slice(0, -1);
    next.push({ trials: totalTrials, relFreq });
    return { points: next, lastRecordedTrials: totalTrials };
  }

  const next = [...series.points, { trials: totalTrials, relFreq }];
  // 점이 너무 많아지면 오래된 것부터 솎아 내 개수를 제한.
  if (next.length > MAX_CONVERGENCE_POINTS) {
    const decimated: ConvergencePoint[] = [];
    for (let i = 0; i < next.length; i += 2) {
      decimated.push(next[i]);
    }
    // 항상 마지막 점은 유지.
    if (decimated[decimated.length - 1] !== next[next.length - 1]) {
      decimated.push(next[next.length - 1]);
    }
    return { points: decimated, lastRecordedTrials: totalTrials };
  }

  return { points: next, lastRecordedTrials: totalTrials };
}

/** 소수를 백분율 문자열로 (예: 0.1667 -> "16.67%"). */
export function formatPercent(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** 확률을 보기 좋은 문자열로 (일반 주사위는 분수, 직육면체는 소수). */
export function formatProbability(type: DiceType, face: DieFace): string {
  if (type === "fair") return "1/6";
  return DICE[type].probabilities[face].toFixed(1);
}
