export type ParsedNumber = {
  value: number;
  num: number;
  den: number;
  nHint: number | null;
};

const MAX_N = 12;

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return a === 0 && b === 0 ? 1 : x || 1;
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

export function simplify(num: number, den: number): { num: number; den: number } {
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

/** Denominator of the fractional part inside [⌊x⌋, ⌊x⌋+1]. Null if integer. */
export function nHintFromRational(num: number, den: number): number | null {
  const { num: n, den: d } = simplify(num, den);
  const rem = ((n % d) + d) % d;
  if (rem === 0) return null;
  const reduced = d / gcd(rem, d);
  return reduced > MAX_N ? MAX_N : reduced;
}

export function nHintFromValue(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rat = valueToRational(value);
  if (!rat) return null;
  return nHintFromRational(rat.num, rat.den);
}

export function valueToRational(
  value: number,
  maxDen = 24,
): { num: number; den: number } | null {
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return { num: Math.round(value), den: 1 };
  }
  let bestDen = 1;
  let bestNum = Math.round(value);
  let bestErr = Math.abs(value - bestNum);
  for (let den = 1; den <= maxDen; den += 1) {
    const num = Math.round(value * den);
    const err = Math.abs(value - num / den);
    if (err < bestErr - 1e-12 || (err <= bestErr + 1e-12 && den < bestDen)) {
      bestErr = err;
      bestNum = num;
      bestDen = den;
    }
    if (err < 1e-9) break;
  }
  return simplify(bestNum, bestDen);
}

function normalizeInput(raw: string): string {
  return raw
    .trim()
    .replace(/[−–—]/g, "-")
    .replace(/＋/g, "+")
    .replace(/\s+/g, " ");
}

export function parseNumberLineValue(raw: string): ParsedNumber | null {
  const t = normalizeInput(raw);
  if (!t) return null;

  const mixed = t.match(/^([+-])?(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const sign = mixed[1] === "-" ? -1 : 1;
    const whole = Number(mixed[2]);
    const num = Number(mixed[3]);
    const den = Number(mixed[4]);
    if (den <= 0 || !Number.isInteger(num) || !Number.isInteger(den)) return null;
    const signed = simplify(sign * (whole * den + num), den);
    return toParsed(signed.num, signed.den);
  }

  const frac = t.match(/^([+-])?(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const sign = frac[1] === "-" ? -1 : 1;
    const num = Number(frac[2]);
    const den = Number(frac[3]);
    if (den <= 0 || !Number.isInteger(num) || !Number.isInteger(den)) return null;
    const signed = simplify(sign * num, den);
    return toParsed(signed.num, signed.den);
  }

  const dec = t.match(/^([+-])?(\d*)\.(\d+)$/);
  if (dec && (mixedHasDigits(dec[2], dec[3]))) {
    const sign = dec[1] === "-" ? -1 : 1;
    const intPart = dec[2] === "" ? 0 : Number(dec[2]);
    const fracPart = dec[3]!;
    const den = 10 ** fracPart.length;
    const signed = simplify(sign * (intPart * den + Number(fracPart)), den);
    return toParsed(signed.num, signed.den);
  }

  const int = t.match(/^([+-])?(\d+)$/);
  if (int) {
    const sign = int[1] === "-" ? -1 : 1;
    return toParsed(sign * Number(int[2]), 1);
  }

  return null;
}

function mixedHasDigits(intPart: string | undefined, fracPart: string): boolean {
  return (intPart != null && intPart.length > 0) || fracPart.length > 0;
}

function toParsed(num: number, den: number): ParsedNumber {
  return {
    value: num / den,
    num,
    den,
    nHint: nHintFromRational(num, den),
  };
}

export function isNearInteger(value: number, eps = 1e-8): boolean {
  return Number.isFinite(value) && Math.abs(value - Math.round(value)) < eps;
}

export function unitStart(value: number): number {
  return Math.floor(value + 1e-10);
}

export function formatTickLabel(value: number, plusOnPositive: boolean): string {
  if (!Number.isFinite(value)) return "";
  const rat = valueToRational(value);
  if (rat && rat.den === 1) {
    if (rat.num === 0) return "0";
    if (rat.num > 0 && plusOnPositive) return `+${rat.num}`;
    return String(rat.num);
  }
  const stacked = formatPointValue(value, "math");
  if (plusOnPositive && stacked && stacked[0] !== "-" && stacked !== "0") {
    return `+${stacked}`;
  }
  return stacked;
}

export function formatNice(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return String(Math.round(rounded));
  }
  return String(Math.round(rounded * 100) / 100);
}

export function formatPointValue(
  value: number,
  kind: "plain" | "math" = "plain",
): string {
  const rat = valueToRational(value);
  if (!rat) return formatNice(value);
  if (rat.den === 1) return formatTickLabel(rat.num, false);
  const sign = rat.num < 0 ? "-" : "";
  const absNum = Math.abs(rat.num);
  if (absNum > rat.den) {
    const whole = Math.floor(absNum / rat.den);
    const rem = absNum % rat.den;
    if (rem === 0) return `${sign}${whole}`;
    if (kind === "math") return `${sign}${whole}\\frac{${rem}}{${rat.den}}`;
    return `${sign}${whole} ${rem}/${rat.den}`;
  }
  if (kind === "math") return `${sign}\\frac{${absNum}}{${rat.den}}`;
  return `${sign}${absNum}/${rat.den}`;
}

export function inputLooksLikeFraction(raw: string): boolean {
  return normalizeInput(raw).includes("/");
}

export function inputLooksLikeDecimal(raw: string): boolean {
  const t = normalizeInput(raw);
  return t.includes(".") && !t.includes("/");
}

function fractionRawToMath(raw: string): string | null {
  const t = normalizeInput(raw);
  const mixed = t.match(/^([+-])?(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const sign = mixed[1] === "-" ? "-" : mixed[1] === "+" ? "+" : "";
    return `${sign}${mixed[2]}\\frac{${mixed[3]}}{${mixed[4]}}`;
  }
  const frac = t.match(/^([+-])?(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const sign = frac[1] === "-" ? "-" : frac[1] === "+" ? "+" : "";
    return `${sign}\\frac{${frac[2]}}{${frac[3]}}`;
  }
  return null;
}

/** Keep the teacher's writing: decimal stays decimal, `/` stays a fraction. */
export function formatPointLabel(
  inputRaw: string,
  value: number,
  kind: "plain" | "math" = "plain",
): string {
  const parsed = parseNumberLineValue(inputRaw);
  if (parsed && Math.abs(parsed.value - value) < 1e-8) {
    if (kind === "math" && inputLooksLikeFraction(inputRaw)) {
      return fractionRawToMath(inputRaw) ?? formatPointValue(value, "math");
    }
    return normalizeInput(inputRaw);
  }
  const rewritten = rewriteInputRaw(inputRaw, value);
  if (kind === "math" && inputLooksLikeFraction(rewritten)) {
    return fractionRawToMath(rewritten) ?? formatPointValue(value, "math");
  }
  return rewritten;
}

export function rewriteInputRaw(previousRaw: string, value: number): string {
  const parsed = parseNumberLineValue(previousRaw);
  if (parsed && Math.abs(parsed.value - value) < 1e-8) {
    return previousRaw.trim() || previousRaw;
  }
  const wantPlus = normalizeInput(previousRaw).startsWith("+");
  if (isNearInteger(value)) {
    const n = Math.round(value);
    if (n > 0 && wantPlus) return `+${n}`;
    return String(n);
  }
  if (inputLooksLikeFraction(previousRaw)) {
    const frac = formatPointValue(value, "plain");
    if (wantPlus && !frac.startsWith("-")) return `+${frac}`;
    return frac;
  }
  let s = formatNice(value);
  if (wantPlus && !s.startsWith("-") && s !== "0") return `+${s}`;
  return s;
}
