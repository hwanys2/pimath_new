import { formatMeasure } from "@/lib/diagrams/math-label";

/** Factor n = coeff² × radicand (radicand square-free). */
export function simplifySqrtInt(n: number): { coeff: number; radicand: number } {
  if (!Number.isFinite(n) || n < 0) return { coeff: 0, radicand: 0 };
  const intN = Math.round(n);
  if (intN === 0) return { coeff: 0, radicand: 0 };
  let coeff = 1;
  let r = intN;
  for (let p = 2; p * p <= r; p += 1) {
    while (r % (p * p) === 0) {
      coeff *= p;
      r = Math.floor(r / (p * p));
    }
  }
  return { coeff, radicand: r };
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y > 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

export function formatRadicalLength(
  coeff: number,
  radicand: number,
  unit: string,
  den = 1,
): string {
  const d = Math.max(1, Math.round(den));
  let core: string;
  if (d > 1) {
    if (radicand <= 1) {
      core = `$\\frac{${coeff}}{${d}}$`;
    } else if (coeff === 1) {
      core = `$\\frac{\\sqrt{${radicand}}}{${d}}$`;
    } else {
      core = `$\\frac{${coeff}\\sqrt{${radicand}}}{${d}}$`;
    }
  } else if (radicand <= 1) {
    core = String(coeff);
  } else if (coeff === 1) {
    core = `$\\sqrt{${radicand}}$`;
  } else {
    core = `$${coeff}\\sqrt{${radicand}}$`;
  }
  const u = unit.trim();
  return u ? `${core} ${u}` : core;
}

const SQUARE_FREE = [
  2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19, 21, 22, 23, 26, 29, 30, 31, 33, 34, 35,
];

/** Exact textbook radical (√n, k√n, or a√b / c) when the length matches closely. */
export function exactRadicalLabel(length: number, unit: string): string | null {
  if (!(length > 0) || !Number.isFinite(length)) return null;
  const sq = length * length;
  const intSq = Math.round(sq);
  if (intSq > 0 && Math.abs(sq - intSq) < 1e-3) {
    const { coeff, radicand } = simplifySqrtInt(intSq);
    if (coeff > 0 && radicand > 1) return formatRadicalLength(coeff, radicand, unit);
  }
  const eps = Math.max(1.5e-4, length * 1e-5);
  let best: { coeff: number; radicand: number; den: number; cost: number } | null = null;
  for (const rad of SQUARE_FREE) {
    const root = Math.sqrt(rad);
    for (let den = 1; den <= 24; den += 1) {
      const coeff = Math.round((length * den) / root);
      if (coeff < 1 || coeff > 60) continue;
      const approx = (coeff * root) / den;
      if (Math.abs(approx - length) > eps) continue;
      const g = gcdInt(coeff, den);
      const c = coeff / g;
      const d = den / g;
      const cost = d * 100 + c + rad;
      if (!best || cost < best.cost) best = { coeff: c, radicand: rad, den: d, cost };
    }
  }
  if (!best) return null;
  return formatRadicalLength(best.coeff, best.radicand, unit, best.den);
}

/** Label for hypotenuse √(left²+right²) as a simplified radical when exact. */
export function formatHypotenuseLabel(
  legLeft: number,
  legRight: number,
  unit: string,
  fallbackLength: number,
): string {
  const sumSq = legLeft * legLeft + legRight * legRight;
  const intSum = Math.round(sumSq);
  if (Math.abs(sumSq - intSum) > 1e-4) {
    return exactRadicalLabel(fallbackLength, unit) ?? formatMeasure(fallbackLength, unit);
  }
  const { coeff, radicand } = simplifySqrtInt(intSum);
  if (coeff <= 0) return formatMeasure(fallbackLength, unit);
  return formatRadicalLength(coeff, radicand, unit);
}
