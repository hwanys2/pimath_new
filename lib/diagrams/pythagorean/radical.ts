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

export function formatRadicalLength(coeff: number, radicand: number, unit: string): string {
  let core: string;
  if (radicand <= 1) {
    core = String(coeff);
  } else if (coeff === 1) {
    core = `$\\sqrt{${radicand}}$`;
  } else {
    core = `$${coeff}\\sqrt{${radicand}}$`;
  }
  const u = unit.trim();
  return u ? `${core} ${u}` : core;
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
    return formatMeasure(fallbackLength, unit);
  }
  const { coeff, radicand } = simplifySqrtInt(intSum);
  if (coeff <= 0) return formatMeasure(fallbackLength, unit);
  return formatRadicalLength(coeff, radicand, unit);
}
