/** Math helpers for the repeating decimal simulation (중2 · 1. 유리수와 순환소수). */

const ZERO = BigInt(0);
const TEN = BigInt(10);

export const MAX_FRACTION_DIGITS = BigInt("1000000000");
export const DEFAULT_VISIBLE_DIGITS = 20;
export const DIGITS_STEP = 20;

export type RepeatingDecimalKind = "terminating" | "repeating";

export type RepeatingDecimalResult = {
  sign: 1 | -1;
  /** Reduced numerator (absolute). */
  numerator: bigint;
  /** Reduced denominator (positive). */
  denominator: bigint;
  integerPart: bigint;
  kind: RepeatingDecimalKind;
  /** Digits after the decimal point before the repeating cycle. */
  prePeriod: string;
  /** The repeating cycle digits. Empty for terminating decimals. */
  period: string;
  periodLength: number;
};

export type ParseFractionError =
  | "empty"
  | "invalid"
  | "zero_denominator"
  | "too_large";

export type ParseFractionOutcome =
  | { ok: true; result: RepeatingDecimalResult }
  | { ok: false; error: ParseFractionError };

export function gcd(a: bigint, b: bigint): bigint {
  let x = a < ZERO ? -a : a;
  let y = b < ZERO ? -b : b;
  while (y !== ZERO) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function parsePositiveBigInt(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

/** Analyze a/b as an exact decimal or repeating decimal. */
export function analyzeRepeatingDecimal(
  numeratorRaw: bigint,
  denominatorRaw: bigint,
): RepeatingDecimalResult {
  const sign: 1 | -1 = numeratorRaw < ZERO !== denominatorRaw < ZERO ? -1 : 1;
  let num = numeratorRaw < ZERO ? -numeratorRaw : numeratorRaw;
  let den = denominatorRaw < ZERO ? -denominatorRaw : denominatorRaw;

  const g = gcd(num, den);
  num /= g;
  den /= g;

  const integerPart = num / den;
  let remainder = num % den;

  if (remainder === ZERO) {
    return {
      sign,
      numerator: num,
      denominator: den,
      integerPart,
      kind: "terminating",
      prePeriod: "",
      period: "",
      periodLength: 0,
    };
  }

  const digits: string[] = [];
  const remainderIndex = new Map<string, number>();

  while (remainder !== ZERO) {
    const key = remainder.toString();
    if (remainderIndex.has(key)) {
      const start = remainderIndex.get(key)!;
      return {
        sign,
        numerator: num,
        denominator: den,
        integerPart,
        kind: "repeating",
        prePeriod: digits.slice(0, start).join(""),
        period: digits.slice(start).join(""),
        periodLength: digits.length - start,
      };
    }

    remainderIndex.set(key, digits.length);
    remainder *= TEN;
    const digit = remainder / den;
    remainder %= den;
    digits.push(digit.toString());
  }

  return {
    sign,
    numerator: num,
    denominator: den,
    integerPart,
    kind: "terminating",
    prePeriod: digits.join(""),
    period: "",
    periodLength: 0,
  };
}

/** Generate `count` digits after the decimal point. */
export function generateDecimalDigits(
  result: RepeatingDecimalResult,
  count: number,
): string {
  if (count <= 0) return "";

  if (result.kind === "terminating") {
    const all = result.prePeriod;
    return all.length >= count ? all.slice(0, count) : all;
  }

  const { prePeriod, period } = result;
  if (period.length === 0) return prePeriod.slice(0, count);

  if (count <= prePeriod.length) {
    return prePeriod.slice(0, count);
  }

  const out = prePeriod.split("");
  let remaining = count - prePeriod.length;
  let idx = 0;
  while (remaining > 0) {
    out.push(period[idx % period.length]!);
    idx += 1;
    remaining -= 1;
  }
  return out.join("");
}

export function parseFractionInputs(
  numeratorInput: string,
  denominatorInput: string,
): ParseFractionOutcome {
  const numParsed = parsePositiveBigInt(numeratorInput);
  const denParsed = parsePositiveBigInt(denominatorInput);

  if (numParsed == null || denParsed == null) {
    if (
      numeratorInput.trim() === "" &&
      denominatorInput.trim() === ""
    ) {
      return { ok: false, error: "empty" };
    }
    return { ok: false, error: "invalid" };
  }

  if (denParsed === ZERO) {
    return { ok: false, error: "zero_denominator" };
  }

  if (
    numParsed > MAX_FRACTION_DIGITS ||
    denParsed > MAX_FRACTION_DIGITS
  ) {
    return { ok: false, error: "too_large" };
  }

  return {
    ok: true,
    result: analyzeRepeatingDecimal(numParsed, denParsed),
  };
}

export function formatSignedIntegerPart(
  sign: 1 | -1,
  integerPart: bigint,
): string {
  const base = integerPart.toString();
  return sign < 0 && integerPart !== ZERO ? `-${base}` : base;
}

export function formatReducedFraction(result: RepeatingDecimalResult): string {
  const signPrefix = result.sign < 0 ? "-" : "";
  return `${signPrefix}${result.numerator}/${result.denominator}`;
}

/** Indices (0-based, after decimal) for Korean dot notation on cycle start/end. */
export function getCycleDotIndices(result: RepeatingDecimalResult): {
  start: number;
  end: number;
} | null {
  if (result.kind !== "repeating" || result.periodLength === 0) return null;
  const start = result.prePeriod.length;
  const end = start + result.periodLength - 1;
  return { start, end };
}

export function parseFractionErrorMessage(error: ParseFractionError): string {
  switch (error) {
    case "empty":
      return "분자와 분모에 자연수를 입력해 주세요.";
    case "invalid":
      return "분자와 분모는 0 이상의 정수만 입력할 수 있어요.";
    case "zero_denominator":
      return "분모는 0이 될 수 없어요.";
    case "too_large":
      return `분자·분모는 각각 ${MAX_FRACTION_DIGITS.toString()} 이하로 입력해 주세요.`;
  }
}
