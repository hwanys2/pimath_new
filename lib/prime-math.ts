/** Prime helpers for the 「소수 찾기」 mini-game. */

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  const limit = Math.floor(Math.sqrt(n));
  for (let i = 3; i <= limit; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

/** All primes p with p * p <= n (i.e. p <= floor(sqrt(n))). */
export function primesUpToSqrt(n: number): number[] {
  if (n < 2) return [];
  const limit = Math.floor(Math.sqrt(n));
  return primesUpTo(limit);
}

export function primesUpTo(limit: number): number[] {
  if (limit < 2) return [];
  const sieve = new Uint8Array(limit + 1);
  const primes: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (sieve[i]) continue;
    primes.push(i);
    for (let j = i * i; j <= limit; j += i) sieve[j] = 1;
  }
  return primes;
}

/** Odd integer in [lo, hi] inclusive. */
export function randomOddInRange(lo: number, hi: number): number {
  const low = Math.max(3, Math.ceil(lo) | 1); // force odd >= 3
  let high = Math.floor(hi);
  if (high % 2 === 0) high -= 1;
  if (high < low) return low;
  const steps = Math.floor((high - low) / 2);
  return low + 2 * Math.floor(Math.random() * (steps + 1));
}

export type NumberBand = {
  min: number;
  max: number;
};

/** Escalating bands by round index (1-based). */
export function bandForRound(round: number): NumberBand {
  if (round <= 4) return { min: 9, max: 49 };
  if (round <= 8) return { min: 51, max: 199 };
  if (round <= 13) return { min: 201, max: 999 };
  if (round <= 18) return { min: 1001, max: 4999 };
  if (round <= 23) return { min: 5001, max: 19999 };
  if (round <= 29) return { min: 20001, max: 79999 };
  return { min: 80001, max: 199999 };
}

/**
 * Pick an odd composite or prime for the round.
 * Early rounds lean composite (easier to disprove); later lean closer to 50/50.
 */
export function dealOddNumber(round: number, preferPrime?: boolean): number {
  const band = bandForRound(round);
  const wantPrime =
    preferPrime ??
    (round <= 6 ? Math.random() < 0.35 : Math.random() < 0.48);

  for (let attempt = 0; attempt < 80; attempt++) {
    const n = randomOddInRange(band.min, band.max);
    if (isPrime(n) === wantPrime) return n;
  }
  // Fallback: any odd in band
  return randomOddInRange(band.min, band.max);
}

/** Points for a correct answer on n with current streak (before this hit). */
export function pointsForCorrect(n: number, streakBefore: number): number {
  const base = Math.round(18 + 22 * Math.log10(Math.max(n, 10)));
  const streakBonus = Math.min(streakBefore, 8) * 4;
  return base + streakBonus;
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.round(score));
}

export { applyScoreGain, SCORE_SOFT_CAP, SCORE_HARD_MAX } from "@/lib/xp";

/** Bonus life round roughly every 7–10 questions after round 4. */
export function isBonusRound(round: number, lastBonusRound: number): boolean {
  if (round < 5) return false;
  if (lastBonusRound > 0 && round - lastBonusRound < 7) return false;
  // ~1/8 chance once eligible gap passed, or forced at gap 10
  if (lastBonusRound > 0 && round - lastBonusRound >= 10) return true;
  return Math.random() < 0.14;
}

export const START_LIVES = 3;
export const MAX_LIVES = 5;
/** Total divide attempts for one full run (not per round). */
export const MAX_TRIALS = 10;
export const TOTAL_DIVIDE_ATTEMPTS = MAX_TRIALS;
/** Seconds allowed to answer each round. */
export const ROUND_TIME_SEC = 10;
