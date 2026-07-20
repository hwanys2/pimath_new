/** Math helpers for square-pyramid volume via unit-cube staircases (중1 · 3.4). */

export const MIN_N = 2;
export const MAX_N = 30;
export const DEFAULT_N = 10;

export const TARGET_RATIO = 1 / 3;

export type ViewMode = "outer" | "inner" | "both";

export function clampN(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_N;
  return Math.min(MAX_N, Math.max(MIN_N, Math.round(n)));
}

/** Σ_{k=1}^{m} k² = m(m+1)(2m+1)/6 */
export function sumOfSquares(m: number): number {
  if (m <= 0) return 0;
  return (m * (m + 1) * (2 * m + 1)) / 6;
}

/** Outer (upper) staircase: n² + (n-1)² + … + 1² */
export function outerVolume(n: number): number {
  return sumOfSquares(n);
}

/** Inner (lower) staircase: (n-1)² + … + 1² (= 0² + … + (n-1)²) */
export function innerVolume(n: number): number {
  return sumOfSquares(n - 1);
}

export function cubeVolume(n: number): number {
  return n * n * n;
}

export function pyramidExactVolume(n: number): number {
  return cubeVolume(n) / 3;
}

export function outerRatio(n: number): number {
  const v = cubeVolume(n);
  return v === 0 ? 0 : outerVolume(n) / v;
}

export function innerRatio(n: number): number {
  const v = cubeVolume(n);
  return v === 0 ? 0 : innerVolume(n) / v;
}

/**
 * Layer side lengths from the base upward (index 0 = bottom).
 * Outer: n, n-1, …, 1
 * Inner: n-1, n-2, …, 1 (n-1 layers; no top 0×0 plate)
 */
export function outerLayerSides(n: number): number[] {
  return Array.from({ length: n }, (_, i) => n - i);
}

export function innerLayerSides(n: number): number[] {
  if (n <= 1) return [];
  return Array.from({ length: n - 1 }, (_, i) => n - 1 - i);
}

/**
 * Compact sum text, e.g. n=10 → "100 + 81 + … + 4 + 1"
 * Shows first two and last two terms when more than 4 terms.
 */
export function formatSquareSum(sides: number[]): string {
  if (sides.length === 0) return "0";
  const terms = sides.map((s) => String(s * s));
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

export type PyramidVolumeStats = {
  n: number;
  cube: number;
  outer: number;
  inner: number;
  exact: number;
  outerRatio: number;
  innerRatio: number;
  outerSides: number[];
  innerSides: number[];
  outerSumText: string;
  innerSumText: string;
};

export function computeStats(n: number): PyramidVolumeStats {
  const nn = clampN(n);
  const outerSides = outerLayerSides(nn);
  const innerSides = innerLayerSides(nn);
  return {
    n: nn,
    cube: cubeVolume(nn),
    outer: outerVolume(nn),
    inner: innerVolume(nn),
    exact: pyramidExactVolume(nn),
    outerRatio: outerRatio(nn),
    innerRatio: innerRatio(nn),
    outerSides,
    innerSides,
    outerSumText: formatSquareSum(outerSides),
    innerSumText: formatSquareSum(innerSides),
  };
}
