/** Math helpers for square-pyramid volume via staircases in a fixed cube (중1 · 3.4).
 *
 * Cube is always side 10 → volume 1000. Parameter n is the number of height layers.
 * Outer/inner volumes approach 1000/3 ≈ 333.333 as n grows.
 */

export const CUBE_SIDE = 10;
export const CUBE_VOLUME = CUBE_SIDE * CUBE_SIDE * CUBE_SIDE; // 1000
export const EXACT_PYRAMID = CUBE_VOLUME / 3; // ≈ 333.333…

export const MIN_N = 1;
export const CONTINUOUS_MAX_N = 30;
export const EXTENDED_N_VALUES = [100, 200, 500, 1000] as const;
export const N_STOPS: readonly number[] = [
  ...Array.from(
    { length: CONTINUOUS_MAX_N - MIN_N + 1 },
    (_, i) => MIN_N + i,
  ),
  ...EXTENDED_N_VALUES,
];
export const MAX_N = EXTENDED_N_VALUES[EXTENDED_N_VALUES.length - 1];
export const DEFAULT_N = 10;

export const TARGET_RATIO = 1 / 3;
export const TARGET_VOLUME = EXACT_PYRAMID;

export type ViewMode = "outer" | "inner" | "both";

/** Snap to the nearest allowed n (1..30 continuous, then 100/200/500/1000). */
export function snapN(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_N;
  const rounded = Math.round(raw);
  const exact = N_STOPS.indexOf(rounded);
  if (exact >= 0) return N_STOPS[exact];

  let best = N_STOPS[0];
  let bestDist = Math.abs(rounded - best);
  for (const stop of N_STOPS) {
    const dist = Math.abs(rounded - stop);
    if (dist < bestDist) {
      best = stop;
      bestDist = dist;
    }
  }
  return best;
}

/** @deprecated Use snapN — kept for call sites that still import clampN. */
export function clampN(n: number): number {
  return snapN(n);
}

export function nIndex(n: number): number {
  const snapped = snapN(n);
  const idx = N_STOPS.indexOf(snapped);
  return idx >= 0 ? idx : N_STOPS.indexOf(DEFAULT_N);
}

export function nFromIndex(i: number): number {
  const idx = Math.min(N_STOPS.length - 1, Math.max(0, Math.round(i)));
  return N_STOPS[idx];
}

/** Layer reveal interval (ms) for stack animation; caps total time at high n. */
export function stackLayerMs(n: number): number {
  const nn = snapN(n);
  if (nn <= CONTINUOUS_MAX_N) return 220;
  return Math.max(20, Math.floor(8000 / nn));
}

/** Σ_{k=1}^{m} k² = m(m+1)(2m+1)/6 */
export function sumOfSquares(m: number): number {
  if (m <= 0) return 0;
  return (m * (m + 1) * (2 * m + 1)) / 6;
}

/** Side length of one small cube when the big cube is split into n³ cells. */
export function cellSide(n: number): number {
  return CUBE_SIDE / n;
}

/** Volume of one small cube: (10/n)³ */
export function cellVolume(n: number): number {
  const s = cellSide(n);
  return s * s * s;
}

/**
 * Outer staircase volume in the fixed cube of volume 1000:
 * 1000 · Σk² / n³ = 1000 · (n+1)(2n+1) / (6n²)
 */
export function outerVolume(n: number): number {
  if (n <= 0) return 0;
  return (CUBE_VOLUME * sumOfSquares(n)) / (n * n * n);
}

/**
 * Inner staircase volume:
 * 1000 · Σ_{k=0}^{n-1} k² / n³ = 1000 · (n-1)(2n-1) / (6n²)
 */
export function innerVolume(n: number): number {
  if (n <= 1) return 0;
  return (CUBE_VOLUME * sumOfSquares(n - 1)) / (n * n * n);
}

export function outerRatio(n: number): number {
  return outerVolume(n) / CUBE_VOLUME;
}

export function innerRatio(n: number): number {
  return innerVolume(n) / CUBE_VOLUME;
}

/** Small-cube counts from the base upward (index 0 = bottom). Outer: n…1 */
export function outerLayerCounts(n: number): number[] {
  return Array.from({ length: n }, (_, i) => n - i);
}

/** Inner: (n-1)…1 */
export function innerLayerCounts(n: number): number[] {
  if (n <= 1) return [];
  return Array.from({ length: n - 1 }, (_, i) => n - 1 - i);
}

/**
 * Compact sum of squares of layer counts, e.g. n=10 → "100 + 81 + … + 4 + 1"
 */
export function formatSquareSum(counts: number[]): string {
  if (counts.length === 0) return "0";
  const terms = counts.map((s) => String(s * s));
  if (terms.length <= 4) return terms.join(" + ");
  return `${terms[0]} + ${terms[1]} + … + ${terms[terms.length - 2]} + ${terms[terms.length - 1]}`;
}

export function formatNum(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return "—";
  const fixed = n.toFixed(digits);
  return fixed.replace(/\.?0+$/, "");
}

export function formatRatio(r: number): string {
  return formatNum(r, 4);
}

export function formatVolume(v: number): string {
  // Prefer up to 3 decimals for volumes approaching 333.333
  return formatNum(v, 3);
}

/**
 * Human-readable sum explanation.
 * n=10: counts equal volume ("100 + 81 + … + 1 = 385")
 * else: count sum × (10/n)³ = volume
 */
export function formatVolumeSumText(
  counts: number[],
  volume: number,
  n: number,
): string {
  const sumExpr = formatSquareSum(counts);
  const blockCount = counts.reduce((a, c) => a + c * c, 0);
  if (n === 1) {
    return `나누지 않음 → 정육면체 전체 = ${formatVolume(volume)}`;
  }
  if (n === CUBE_SIDE) {
    return `${sumExpr} = ${formatVolume(volume)}`;
  }
  const cell = cellVolume(n);
  return `${sumExpr} = ${blockCount}칸 × (${CUBE_SIDE}/${n})³ = ${blockCount} × ${formatVolume(cell)} ≈ ${formatVolume(volume)}`;
}

/** Physical side length of outer layer i from base (0 = bottom). */
export function outerLayerSideLength(n: number, layerFromBase: number): number {
  const count = n - layerFromBase;
  return (count / n) * CUBE_SIDE;
}

/** Physical side length of inner layer i from base. 0 if empty. */
export function innerLayerSideLength(n: number, layerFromBase: number): number {
  const count = n - 1 - layerFromBase;
  if (count <= 0) return 0;
  return (count / n) * CUBE_SIDE;
}

export type PyramidVolumeStats = {
  n: number;
  cube: number;
  outer: number;
  inner: number;
  exact: number;
  outerRatio: number;
  innerRatio: number;
  outerCounts: number[];
  innerCounts: number[];
  outerBlockCount: number;
  innerBlockCount: number;
  outerSumText: string;
  innerSumText: string;
  cellSide: number;
  cellVolume: number;
};

export function computeStats(n: number): PyramidVolumeStats {
  const nn = snapN(n);
  const outerCounts = outerLayerCounts(nn);
  const innerCounts = innerLayerCounts(nn);
  const outer = outerVolume(nn);
  const inner = innerVolume(nn);
  const outerBlockCount = sumOfSquares(nn);
  const innerBlockCount = sumOfSquares(nn - 1);
  return {
    n: nn,
    cube: CUBE_VOLUME,
    outer,
    inner,
    exact: EXACT_PYRAMID,
    outerRatio: outer / CUBE_VOLUME,
    innerRatio: inner / CUBE_VOLUME,
    outerCounts,
    innerCounts,
    outerBlockCount,
    innerBlockCount,
    outerSumText: formatVolumeSumText(outerCounts, outer, nn),
    innerSumText: formatVolumeSumText(innerCounts, inner, nn),
    cellSide: cellSide(nn),
    cellVolume: cellVolume(nn),
  };
}
