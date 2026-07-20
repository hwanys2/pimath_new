/** Math helpers for the 「각도 맞히기」 mini-game (중1 · 3.1). */

export const STEPS = [30, 10, 5, 1] as const;
export type AngleStep = (typeof STEPS)[number];

/** Correct answers needed to advance from 30 / 10 / 5° stages. Final stage is endless. */
export const CORRECTS_PER_STAGE = 5;
export const START_LIVES = 3;
export const MAX_LIVES = 3;
/** Allowed absolute error at the 1° stage only. */
export const FINAL_TOLERANCE = 1;
export const MIN_ANGLE = 1;
export const MAX_ANGLE = 180;

export function isAngleStep(n: number): n is AngleStep {
  return (STEPS as readonly number[]).includes(n);
}

export function nextStep(step: AngleStep): AngleStep | null {
  const i = STEPS.indexOf(step);
  if (i < 0 || i >= STEPS.length - 1) return null;
  return STEPS[i + 1]!;
}

export function stageIndex(step: AngleStep): number {
  return STEPS.indexOf(step);
}

/** Random multiple of `step` in [MIN_ANGLE, MAX_ANGLE] (0 excluded). */
export function dealAngle(step: AngleStep): number {
  const s = Math.max(1, Math.floor(step));
  const maxK = Math.floor(MAX_ANGLE / s);
  const minK = Math.max(1, Math.ceil(MIN_ANGLE / s));
  if (maxK < minK) return s;
  const k = minK + Math.floor(Math.random() * (maxK - minK + 1));
  return k * s;
}

export function isCorrect(
  guess: number,
  target: number,
  step: AngleStep,
): boolean {
  if (!Number.isFinite(guess) || !Number.isFinite(target)) return false;
  const g = Math.round(guess);
  const t = Math.round(target);
  if (step === 1) {
    return Math.abs(g - t) <= FINAL_TOLERANCE;
  }
  return g === t;
}

/**
 * Points for a correct answer. Tuned so clearing stages (~15) lands ~600,
 * then strong play at 1° approaches the soft cap (~1000).
 */
export function pointsForCorrect(
  step: AngleStep,
  streakBefore: number,
): number {
  const baseByStep: Record<AngleStep, number> = {
    30: 28,
    10: 40,
    5: 52,
    1: 65,
  };
  const streakBonus = Math.min(streakBefore, 8) * (step <= 5 ? 3 : 2);
  return baseByStep[step] + streakBonus;
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.round(score));
}

export { applyScoreGain, SCORE_SOFT_CAP, SCORE_HARD_MAX } from "@/lib/xp";
