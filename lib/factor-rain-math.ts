/** Math helpers for the 「소인수분해 소나기」 mini-game. */

export const FACTOR_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19] as const;
export type FactorPrime = (typeof FACTOR_PRIMES)[number];

export const START_LIVES = 3;
export const MAX_LIVES = 3;
/** Simultaneous falling numbers (hard cap). */
export const MAX_ACTIVE = 4;
/** Playfield height in normalized units (0 = top, 100 = bottom miss line). */
export const FIELD_HEIGHT = 100;

export type Difficulty = {
  /** Fall speed in field-units per second. */
  fallSpeed: number;
  /** Seconds between spawn attempts. */
  spawnInterval: number;
  /** Min / max product of primes for spawned composites. */
  minValue: number;
  maxValue: number;
  /** Preferred factor-count range. */
  minFactors: number;
  maxFactors: number;
};

/**
 * Gentle difficulty curve from elapsed playtime (seconds) and clears.
 * Early game stays mostly ≤100; late-game caps keep playable for middle-schoolers.
 */
export function difficultyAt(elapsedSec: number, cleared: number): Difficulty {
  const t = Math.max(0, elapsedSec);
  const c = Math.max(0, cleared);
  const progress = Math.min(1, t / 300 + c / 90);

  const fallSpeed = 5.5 + progress * 6.5; // ~5.5 → ~12 units/s
  const spawnInterval = Math.max(1.85, 3.2 - progress * 1.0);
  const minValue = Math.round(4 + progress * 36);
  const maxValue = Math.round(55 + Math.pow(progress, 1.85) * 650);
  const minFactors = progress < 0.65 ? 2 : 3;
  const maxFactors = progress < 0.4 ? 3 : progress < 0.75 ? 4 : 5;

  return {
    fallSpeed: Math.min(12, fallSpeed),
    spawnInterval,
    minValue: Math.min(minValue, maxValue - 4),
    maxValue: Math.min(800, Math.max(maxValue, minValue + 10)),
    minFactors,
    maxFactors,
  };
}

function randomInt(lo: number, hi: number): number {
  const a = Math.ceil(lo);
  const b = Math.floor(hi);
  if (b <= a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

function pickPrime(pool: readonly number[]): number {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/**
 * Build a composite whose prime factors are all in FACTOR_PRIMES,
 * targeting [minValue, maxValue] and factor count range.
 */
export function dealComposite(diff: Difficulty): number {
  const { minValue, maxValue, minFactors, maxFactors } = diff;
  // Early: lean on smaller primes for mental math comfort.
  const earlyPool =
    maxValue <= 120
      ? ([2, 3, 5, 7] as const)
      : maxValue <= 450
        ? ([2, 3, 5, 7, 11, 13] as const)
        : FACTOR_PRIMES;

  for (let attempt = 0; attempt < 60; attempt++) {
    const factorCount = randomInt(minFactors, maxFactors);
    let n = 1;
    for (let i = 0; i < factorCount; i++) {
      const p = pickPrime(earlyPool);
      if (n * p > maxValue * 1.15) break;
      n *= p;
    }
    if (n < 4) continue;
    if (n >= minValue && n <= maxValue) return n;
    // Soft accept slightly below min if still composite.
    if (n >= 4 && n < minValue && n * 2 <= maxValue) {
      n *= pickPrime(earlyPool);
      if (n >= minValue && n <= maxValue) return n;
    }
  }

  // Guaranteed fallback: small easy composites.
  const fallbacks = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25, 27, 28, 30];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)]!;
}

/** Horizontal spawn percent (padding so chips aren't clipped). */
export function randomSpawnX(): number {
  return 8 + Math.random() * 84;
}

/**
 * Points for fully factoring a number down to 1.
 * Tuned so a solid ~3–5 min run lands near the soft cap.
 */
export function pointsForClear(
  original: number,
  factorSteps: number,
  streakBefore: number,
): number {
  const size = Math.round(8 + 10 * Math.log10(Math.max(original, 10)));
  const steps = Math.min(factorSteps, 6) * 4;
  const streakBonus = Math.min(streakBefore, 10) * 2;
  return size + steps + streakBonus;
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.round(score));
}

export { applyScoreGain, SCORE_SOFT_CAP, SCORE_HARD_MAX } from "@/lib/xp";
