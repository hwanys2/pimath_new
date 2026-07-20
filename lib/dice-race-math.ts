/** Pure dice-sum race logic (client + server safe). */

export const SUM_MIN = 2;
export const SUM_MAX = 12;
export const WIN_THRESHOLD = 10;
export const POINTS_PER_HIT = 10;

export const SUMS = Array.from(
  { length: SUM_MAX - SUM_MIN + 1 },
  (_, i) => SUM_MIN + i,
);

export type SumCounts = Record<string, number>;

export function emptyCounts(): SumCounts {
  const counts: SumCounts = {};
  for (const s of SUMS) counts[String(s)] = 0;
  return counts;
}

export function parseCounts(raw: unknown): SumCounts {
  const base = emptyCounts();
  if (!raw || typeof raw !== "object") return base;
  for (const s of SUMS) {
    const v = (raw as Record<string, unknown>)[String(s)];
    if (typeof v === "number" && Number.isFinite(v)) {
      base[String(s)] = Math.max(0, Math.floor(v));
    }
  }
  return base;
}

export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollTwoDice(): { d1: number; d2: number; sum: number } {
  const d1 = rollDie();
  const d2 = rollDie();
  return { d1, d2, sum: d1 + d2 };
}

export function applyRoll(counts: SumCounts, sum: number): SumCounts {
  const key = String(sum);
  if (sum < SUM_MIN || sum > SUM_MAX) return counts;
  return { ...counts, [key]: (counts[key] ?? 0) + 1 };
}

export function countForSum(counts: SumCounts, sum: number): number {
  return counts[String(sum)] ?? 0;
}

export function isRoundOver(counts: SumCounts): boolean {
  return SUMS.some((s) => countForSum(counts, s) >= WIN_THRESHOLD);
}

export function winningSum(counts: SumCounts): number | null {
  for (const s of SUMS) {
    if (countForSum(counts, s) >= WIN_THRESHOLD) return s;
  }
  return null;
}

export function roundScoreFromHits(hits: number): number {
  return Math.max(0, hits) * POINTS_PER_HIT;
}
