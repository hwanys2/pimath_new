/**
 * Math helpers & game logic for 「특수각 비트 탭」 (중3 · 3.1 삼각비).
 *
 * 특수각 0°, 30°, 45°, 60°, 90°의 삼각비 값을 훈련합니다.
 * (tan 90°는 값이 정의되지 않으므로 절대 출제되지 않습니다.)
 */

import { SCORE_HARD_MAX, applyScoreGain } from "@/lib/xp";

export const CONTENT_KEY = "g3-u3-1-trigo-beat";

export const START_LIVES = 3;
export const MAX_LIVES = 3;
export const FEVER_COMBO = 10;
export const FEVER_DURATION_SEC = 7;

export type TrigFn = "sin" | "cos" | "tan";
export type SpecialAngle = 0 | 30 | 45 | 60 | 90;

export type PadOption = {
  id: string;
  latex: string;
  display: string;
  numeric: number;
};

export const SIN_COS_PADS: PadOption[] = [
  { id: "0", latex: "0", display: "0", numeric: 0 },
  { id: "1/2", latex: "\\frac{1}{2}", display: "1/2", numeric: 0.5 },
  { id: "sqrt2/2", latex: "\\frac{\\sqrt{2}}{2}", display: "√2/2", numeric: 0.7071 },
  { id: "sqrt3/2", latex: "\\frac{\\sqrt{3}}{2}", display: "√3/2", numeric: 0.866 },
  { id: "1", latex: "1", display: "1", numeric: 1 },
];

export const TAN_PADS: PadOption[] = [
  { id: "0", latex: "0", display: "0", numeric: 0 },
  { id: "sqrt3/3", latex: "\\frac{\\sqrt{3}}{3}", display: "√3/3", numeric: 0.5774 },
  { id: "1", latex: "1", display: "1", numeric: 1 },
  { id: "sqrt3", latex: "\\sqrt{3}", display: "√3", numeric: 1.732 },
];

export type BeatProblem = {
  id: string;
  fn: TrigFn;
  angle: SpecialAngle;
  correctPadId: string;
  promptLatex: string;
  promptText: string;
  pads: PadOption[];
  timeLimitSec: number;
  phase: number;
  showGuideHint: boolean;
};

export type ProblemResultKind = "perfect" | "great" | "wrong" | "timeout";

export type ProblemLogItem = {
  i: number;
  fn: TrigFn;
  angle: SpecialAngle;
  result: ProblemResultKind;
  chosenPadId: string | null;
  correctPadId: string;
  timeSpentSec: number;
};

export function getExactTrigPadId(fn: TrigFn, angle: SpecialAngle): string {
  if (fn === "sin") {
    switch (angle) {
      case 0:
        return "0";
      case 30:
        return "1/2";
      case 45:
        return "sqrt2/2";
      case 60:
        return "sqrt3/2";
      case 90:
        return "1";
    }
  } else if (fn === "cos") {
    switch (angle) {
      case 0:
        return "1";
      case 30:
        return "sqrt3/2";
      case 45:
        return "sqrt2/2";
      case 60:
        return "1/2";
      case 90:
        return "0";
    }
  } else {
    // tan: 90°는 없음!
    switch (angle) {
      case 0:
        return "0";
      case 30:
        return "sqrt3/3";
      case 45:
        return "1";
      case 60:
        return "sqrt3";
      case 90:
        throw new Error("tan 90° is undefined and must never be generated");
    }
  }
}

/**
 * 단계별 출제 함수 및 제한 시간 곡선:
 * - Phase 1 (0 ~ 7 콤보): sin 훈련 (가이드 힌트 제공, 3.2초)
 * - Phase 2 (8 ~ 17 콤보): sin + cos 역방향 훈련 (2.6초 -> 2.0초)
 * - Phase 3 (18 ~ 29 콤보): tan 합류 (1.8초 -> 1.45초)
 * - Phase 4 (30 ~ 44 콤보): sin + cos + tan 카오스 믹스 (1.3초 -> 0.95초)
 * - Phase 5 (45+ 콤보): 서바이벌 하이퍼 스피드 (0.9초 -> 0.5초까지 점진적 가속)
 */
export function getPhaseInfo(combo: number): {
  phase: number;
  timeLimitSec: number;
  allowedFns: TrigFn[];
  showGuideHint: boolean;
} {
  if (combo < 8) {
    return {
      phase: 1,
      timeLimitSec: 3.2,
      allowedFns: ["sin"],
      showGuideHint: true,
    };
  }
  if (combo < 18) {
    const progress = (combo - 8) / 10;
    const timeLimitSec = Math.max(2.0, 2.6 - progress * 0.6);
    return {
      phase: 2,
      timeLimitSec: Number(timeLimitSec.toFixed(2)),
      allowedFns: ["sin", "cos"],
      showGuideHint: false,
    };
  }
  if (combo < 30) {
    const progress = (combo - 18) / 12;
    const timeLimitSec = Math.max(1.45, 1.8 - progress * 0.35);
    return {
      phase: 3,
      timeLimitSec: Number(timeLimitSec.toFixed(2)),
      allowedFns: ["tan", "tan", "sin", "cos"],
      showGuideHint: false,
    };
  }
  if (combo < 45) {
    const progress = (combo - 30) / 15;
    const timeLimitSec = Math.max(0.95, 1.3 - progress * 0.35);
    return {
      phase: 4,
      timeLimitSec: Number(timeLimitSec.toFixed(2)),
      allowedFns: ["sin", "cos", "tan"],
      showGuideHint: false,
    };
  }

  // Phase 5: 하이퍼 서바이벌 (0.9초에서 0.5초 한계까지 가속)
  const hyperOver = combo - 45;
  const timeLimitSec = Math.max(0.5, 0.9 - hyperOver * 0.02);
  return {
    phase: 5,
    timeLimitSec: Number(timeLimitSec.toFixed(2)),
    allowedFns: ["sin", "cos", "tan"],
    showGuideHint: false,
  };
}

const SIN_COS_ANGLES: SpecialAngle[] = [0, 30, 45, 60, 90];
const TAN_ANGLES: SpecialAngle[] = [0, 30, 45, 60]; // 90° 절대 제외!

export function generateBeatProblem(
  combo: number,
  lastProblem?: { fn: TrigFn; angle: SpecialAngle } | null,
): BeatProblem {
  const { phase, timeLimitSec, allowedFns, showGuideHint } = getPhaseInfo(combo);

  // 1. 함수 선택
  const candidates = allowedFns;
  const fn = candidates[Math.floor(Math.random() * candidates.length)]!;

  // 2. 각도 선택
  const anglePool = fn === "tan" ? TAN_ANGLES : SIN_COS_ANGLES;
  let angle: SpecialAngle;
  let attempts = 0;
  do {
    angle = anglePool[Math.floor(Math.random() * anglePool.length)]!;
    attempts++;
  } while (
    attempts < 8 &&
    lastProblem &&
    lastProblem.fn === fn &&
    lastProblem.angle === angle
  );

  const correctPadId = getExactTrigPadId(fn, angle);
  const pads = fn === "tan" ? TAN_PADS : SIN_COS_PADS;

  const fnSymbol = fn === "sin" ? "\\sin" : fn === "cos" ? "\\cos" : "\\tan";
  const promptLatex = `${fnSymbol} ${angle}^\\circ`;
  const promptText = `${fn} ${angle}°`;

  return {
    id: `${fn}-${angle}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fn,
    angle,
    correctPadId,
    promptLatex,
    promptText,
    pads,
    timeLimitSec,
    phase,
    showGuideHint,
  };
}

export function calcProblemScore(
  currentScore: number,
  remainingRatio: number,
  combo: number,
  isFever: boolean,
): { newScore: number; gained: number; verdict: "perfect" | "great" } {
  const base = 22;
  const isPerfect = remainingRatio >= 0.45;
  const speedBonus = isPerfect ? 12 : Math.round(remainingRatio * 10);
  const comboBonus = Math.min(Math.floor(combo * 1.5), 18);

  let totalGain = base + speedBonus + comboBonus;
  if (isFever) {
    totalGain = Math.round(totalGain * 1.4);
  }

  const newScore = applyScoreGain(currentScore, totalGain);
  return {
    newScore: Math.min(newScore, SCORE_HARD_MAX),
    gained: totalGain,
    verdict: isPerfect ? "perfect" : "great",
  };
}

export type TrigBeatSummary = {
  cleared: number;
  maxCombo: number;
  feverCount: number;
  accuracy: number;
  weakFn: string;
  totalTimeSec: number;
};

export function analyzeTrigPerformance(logs: ProblemLogItem[]): {
  summary: TrigBeatSummary;
  fnStats: Record<TrigFn, { total: number; correct: number; rate: number }>;
  feedbackMessage: string;
} {
  const total = logs.length;
  const hits = logs.filter((l) => l.result === "perfect" || l.result === "great");
  const cleared = hits.length;
  const accuracy = total > 0 ? Math.round((cleared / total) * 100) : 0;

  const fnStats: Record<TrigFn, { total: number; correct: number; rate: number }> = {
    sin: { total: 0, correct: 0, rate: 100 },
    cos: { total: 0, correct: 0, rate: 100 },
    tan: { total: 0, correct: 0, rate: 100 },
  };

  for (const log of logs) {
    fnStats[log.fn].total++;
    if (log.result === "perfect" || log.result === "great") {
      fnStats[log.fn].correct++;
    }
  }

  for (const fn of ["sin", "cos", "tan"] as TrigFn[]) {
    const s = fnStats[fn];
    s.rate = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 100;
  }

  let weakestFn: TrigFn = "sin";
  let minRate = 101;
  for (const fn of ["sin", "cos", "tan"] as TrigFn[]) {
    if (fnStats[fn].total >= 2 && fnStats[fn].rate < minRate) {
      minRate = fnStats[fn].rate;
      weakestFn = fn;
    }
  }

  let weakLabel = "없음 (마스터!)";
  let feedbackMessage = "특수각 삼각비를 완벽하게 마스터하셨습니다! 반사적으로 답이 나오는 수준입니다.";

  if (minRate < 85) {
    if (weakestFn === "tan") {
      weakLabel = "탄젠트 (tan)";
      feedbackMessage =
        "탄젠트(tan) 값이 아직 헷갈리시나요? tan 30°는 분모에 3이 있고(√3/3), 60°는 큰 값(√3)이라는 점을 기억하세요!";
    } else if (weakestFn === "cos") {
      weakLabel = "코사인 (cos)";
      feedbackMessage =
        "코사인(cos)은 사인의 반대입니다! 각도가 커질수록 1에서 0으로 작아진다는 크기 순서를 잊지 마세요.";
    } else {
      weakLabel = "사인 (sin)";
      feedbackMessage =
        "사인(sin)은 각도가 커질수록 0에서 1로 커집니다! 30°=1/2, 45°=√2/2, 60°=√3/2 순서를 복습해보세요.";
    }
  }

  return {
    summary: {
      cleared,
      maxCombo: 0,
      feverCount: 0,
      accuracy,
      weakFn: weakLabel,
      totalTimeSec: Math.round(logs.reduce((sum, l) => sum + l.timeSpentSec, 0)),
    },
    fnStats,
    feedbackMessage,
  };
}
