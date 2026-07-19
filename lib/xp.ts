/**
 * Single source of truth for student XP / level math.
 * Keep in sync with SQL function `pm_level_from_xp` in migrations.
 * Score soft-cap rules: docs/progression-system.md
 */

/** Target “full clear” band — at/above this, each correct adds only +1. */
export const SCORE_SOFT_CAP = 1000;
/** Anti-cheat hard ceiling per run (also DB CHECK). */
export const SCORE_HARD_MAX = 5000;
/** @deprecated Use SCORE_SOFT_CAP — kept for older call sites. */
export const MAX_SCORE_PER_RUN = SCORE_SOFT_CAP;

export const MAX_LEVEL = 100;
export const MAX_TOTAL_XP = 500_000;
export const CURVE_EXPONENT = 2.25;

/**
 * Apply points for one correct answer.
 * If current score is already ≥ soft cap, only +1 (keeps rankings meaningful).
 */
export function applyScoreGain(current: number, gain: number): number {
  const c = Math.max(0, Math.round(Number.isFinite(current) ? current : 0));
  const g = Math.max(0, Math.round(Number.isFinite(gain) ? gain : 0));
  const next = c >= SCORE_SOFT_CAP ? c + 1 : c + g;
  return Math.min(SCORE_HARD_MAX, next);
}

/** Clamp submitted run score for XP (hard max only). Maps 1:1 to XP. */
export function scoreToXp(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(SCORE_HARD_MAX, Math.round(score)));
}

/**
 * Cumulative XP required to *be* at `level` (level 1 = 0).
 * Soft curve: early levels are cheap, late levels cost much more.
 */
export function cumulativeXpForLevel(level: number): number {
  const L = Math.floor(level);
  if (L <= 1) return 0;
  if (L >= MAX_LEVEL) return MAX_TOTAL_XP;
  const t = (L - 1) / (MAX_LEVEL - 1);
  return Math.floor(MAX_TOTAL_XP * t ** CURVE_EXPONENT);
}

/** Largest level whose cumulative threshold is <= totalXp. */
export function levelFromTotalXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  if (xp >= MAX_TOTAL_XP) return MAX_LEVEL;

  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (cumulativeXpForLevel(mid) <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export type LevelProgress = {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForThisLevel: number;
  xpToNextLevel: number;
  /** 0–100 progress within current level (100 at max level). */
  percent: number;
  isMaxLevel: boolean;
};

export function xpProgressInLevel(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  const level = levelFromTotalXp(xp);
  const isMaxLevel = level >= MAX_LEVEL;
  const floorXp = cumulativeXpForLevel(level);
  const ceilingXp = isMaxLevel
    ? floorXp
    : cumulativeXpForLevel(level + 1);
  const xpForThisLevel = Math.max(1, ceilingXp - floorXp);
  const xpIntoLevel = isMaxLevel ? xpForThisLevel : Math.max(0, xp - floorXp);
  const xpToNextLevel = isMaxLevel ? 0 : Math.max(0, ceilingXp - xp);
  const percent = isMaxLevel
    ? 100
    : Math.min(100, Math.floor((xpIntoLevel / xpForThisLevel) * 100));

  return {
    level,
    totalXp: xp,
    xpIntoLevel,
    xpForThisLevel,
    xpToNextLevel,
    percent,
    isMaxLevel,
  };
}

export function xpToNextLevel(totalXp: number): number {
  return xpProgressInLevel(totalXp).xpToNextLevel;
}

/** Milestone table for docs / debugging (levels 1,2,5,10,…,100). */
export function sampleLevelThresholds(): { level: number; cumulativeXp: number }[] {
  const marks = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 85, 90, 95, 100];
  return marks.map((level) => ({
    level,
    cumulativeXp: cumulativeXpForLevel(level),
  }));
}
