/**
 * Single source of truth for student XP / level math.
 * Keep in sync with SQL function `pm_level_from_xp` in migrations.
 */

export const MAX_SCORE_PER_RUN = 1000;
export const MAX_LEVEL = 100;
export const MAX_TOTAL_XP = 500_000;
export const CURVE_EXPONENT = 2.25;

/** Clamp raw game score into the allowed band and map 1:1 to XP. */
export function scoreToXp(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(MAX_SCORE_PER_RUN, Math.round(score)));
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
