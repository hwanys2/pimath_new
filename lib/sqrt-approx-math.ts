/** Math helpers for the irrational square root discovery simulation (중3 · 1. 제곱근과 실수). */

const ZERO = BigInt(0);
const TEN = BigInt(10);

export const TARGET_AREAS = [2, 3, 5, 8, 10, 12] as const;
export type TargetArea = (typeof TARGET_AREAS)[number];

export const MAX_DECIMAL_DIGITS = 10;
/** @deprecated Use MAX_DECIMAL_DIGITS */
export const MAX_DECIMAL_PLACES = MAX_DECIMAL_DIGITS;

export type DecimalValue = {
  /** Canonical string, e.g. "2.23" or "2" */
  raw: string;
  /** Scaled integer: value × 10^scale */
  scaled: bigint;
  scale: number;
};

export type Bracket = {
  low: DecimalValue;
  high: DecimalValue;
};

export type ConfirmRecord = {
  label: string;
  value: string;
  square: string;
};

export type ParseSideError =
  | "empty"
  | "invalid"
  | "non_positive"
  | "too_many_decimals";

export type ParseSideOutcome =
  | { ok: true; value: DecimalValue }
  | { ok: false; error: ParseSideError };

function stripLeadingZeros(s: string): string {
  return s.replace(/^0+(?=\d)/, "") || "0";
}

function formatScaled(scaled: bigint, scale: number): string {
  if (scale === 0) return scaled.toString();
  const factor = TEN ** BigInt(scale);
  const intPart = scaled / factor;
  const fracPart = (scaled % factor).toString().padStart(scale, "0");
  return `${intPart}.${fracPart}`;
}

/** Parse a positive finite decimal string into an exact scaled bigint. */
export function parseSideInput(raw: string): ParseSideOutcome {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: "empty" };

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, error: "invalid" };
  }

  const [intPart, fracPart = ""] = trimmed.split(".");
  if (fracPart.length > MAX_DECIMAL_DIGITS) {
    return { ok: false, error: "too_many_decimals" };
  }

  const intVal = BigInt(stripLeadingZeros(intPart));
  const fracVal = fracPart === "" ? ZERO : BigInt(fracPart);
  const scale = fracPart.length;
  const scaleFactor = TEN ** BigInt(scale);
  const scaled = intVal * scaleFactor + fracVal;

  if (scaled <= ZERO) return { ok: false, error: "non_positive" };

  const canonicalInt = stripLeadingZeros(intPart);
  const canonical =
    scale === 0 ? canonicalInt : `${canonicalInt}.${fracPart}`;

  return {
    ok: true,
    value: { raw: canonical, scaled, scale },
  };
}

export function parseSideErrorMessage(error: ParseSideError): string {
  switch (error) {
    case "empty":
      return "한 변의 길이를 입력해 주세요.";
    case "invalid":
      return "숫자만 입력할 수 있어요.";
    case "non_positive":
      return "0보다 큰 수를 입력해 주세요.";
    case "too_many_decimals":
      return `소수점 아래는 ${MAX_DECIMAL_DIGITS}자리까지 입력할 수 있어요.`;
  }
}

/** Integer value as DecimalValue. */
export function intToDecimal(n: number): DecimalValue {
  return {
    raw: String(n),
    scaled: BigInt(n),
    scale: 0,
  };
}

/** Compare two DecimalValues. Returns -1, 0, or 1. */
export function compareDecimal(a: DecimalValue, b: DecimalValue): number {
  const maxScale = Math.max(a.scale, b.scale);
  const factorA = TEN ** BigInt(maxScale - a.scale);
  const factorB = TEN ** BigInt(maxScale - b.scale);
  const scaledA = a.scaled * factorA;
  const scaledB = b.scaled * factorB;
  if (scaledA < scaledB) return -1;
  if (scaledA > scaledB) return 1;
  return 0;
}

/** True when low ≤ x ≤ high (closed interval). */
export function isValidGuess(
  guess: DecimalValue,
  low: DecimalValue,
  high: DecimalValue,
): boolean {
  return compareDecimal(guess, low) >= 0 && compareDecimal(guess, high) <= 0;
}

/** Square a side length; result has exactly 2× decimal places of the input. */
export function squareSide(side: DecimalValue): string {
  const resultScale = side.scale * 2;
  const squared = side.scaled * side.scaled;
  const intStr = squared.toString().padStart(resultScale + 1, "0");
  const wholeLen = intStr.length - resultScale;
  const whole = intStr.slice(0, wholeLen) || "0";
  const frac = intStr.slice(wholeLen).padEnd(resultScale, "0");
  if (resultScale === 0) return whole;
  return `${whole}.${frac}`;
}

/** Compare squared value (decimal string) to integer area. */
export function compareSquareToArea(
  squareStr: string,
  area: number,
): "lt" | "eq" | "gt" {
  const [whole, frac = ""] = squareStr.split(".");
  const squareScaled =
    BigInt(whole) * TEN ** BigInt(frac.length) + BigInt(frac || "0");
  const areaScaled = BigInt(area) * TEN ** BigInt(frac.length);
  if (squareScaled < areaScaled) return "lt";
  if (squareScaled > areaScaled) return "gt";
  return "eq";
}

/** Initial integer bracket: low² < area < high². */
export function getInitialBracket(area: number): Bracket {
  let low = 0;
  while (low * low < area) low++;
  low -= 1;
  const high = low + 1;
  return { low: intToDecimal(low), high: intToDecimal(high) };
}

/** Floor(√area) as DecimalValue. */
export function getCorrectIntegerPart(area: number): DecimalValue {
  let low = 0;
  while (low * low < area) low++;
  return intToDecimal(low - 1);
}

/** Add 10^{-scale} to value (next step at current decimal precision). */
export function incrementDecimal(value: DecimalValue): DecimalValue {
  const newScaled = value.scaled + BigInt(1);
  return {
    raw: formatScaled(newScaled, value.scale),
    scaled: newScaled,
    scale: value.scale,
  };
}

/** Bracket the student must reach before retrying a locked digit confirm. */
export function getRequiredBracket(
  confirmed: DecimalValue | null,
  area: number,
): Bracket {
  if (!confirmed) {
    return getInitialBracket(area);
  }
  if (confirmed.scale === 0) {
    const i = Number(confirmed.scaled);
    return { low: confirmed, high: intToDecimal(i + 1) };
  }
  return { low: confirmed, high: incrementDecimal(confirmed) };
}

export function bracketsMatch(a: Bracket, b: Bracket): boolean {
  return (
    compareDecimal(a.low, b.low) === 0 &&
    compareDecimal(a.high, b.high) === 0
  );
}

/**
 * True when explore bracket is a valid consecutive sub-interval inside required:
 * low² < area < high² and high = low + 10^{-scale} (e.g. [1.73, 1.74] within [1.7, 1.8]).
 */
export function isUnlockBracket(
  explore: Bracket,
  required: Bracket,
  area: number,
): boolean {
  if (
    !isValidGuess(explore.low, required.low, required.high) ||
    !isValidGuess(explore.high, required.low, required.high)
  ) {
    return false;
  }
  if (compareDecimal(explore.low, explore.high) >= 0) return false;
  if (explore.low.scale !== explore.high.scale) return false;

  if (compareSquareToArea(squareSide(explore.low), area) !== "lt") return false;
  if (compareSquareToArea(squareSide(explore.high), area) !== "gt") return false;

  const nextStep = incrementDecimal(explore.low);
  return compareDecimal(explore.high, nextStep) === 0;
}

/** Append one decimal digit to a confirmed prefix. */
export function appendDigit(
  confirmed: DecimalValue,
  digit: number,
): DecimalValue {
  const newRaw =
    confirmed.scale === 0
      ? `${confirmed.raw}.${digit}`
      : `${confirmed.raw}${digit}`;
  const parsed = parseSideInput(newRaw);
  if (!parsed.ok) throw new Error("appendDigit: invalid digit");
  return parsed.value;
}

/** Correct next decimal digit (0–9) for the current confirmed prefix. */
export function getCorrectNextDigit(
  confirmed: DecimalValue,
  area: number,
): number {
  let best = -1;
  for (let d = 0; d <= 9; d++) {
    const candidate = appendDigit(confirmed, d);
    if (compareSquareToArea(squareSide(candidate), area) === "lt") {
      best = d;
    }
  }
  return best;
}

/** Refine bracket after a valid probe guess. */
export function refineBracket(
  bracket: Bracket,
  guess: DecimalValue,
  area: number,
): Bracket {
  const sq = squareSide(guess);
  const cmp = compareSquareToArea(sq, area);
  if (cmp === "lt") {
    return { low: guess, high: bracket.high };
  }
  if (cmp === "gt") {
    return { low: bracket.low, high: guess };
  }
  return bracket;
}

/** Square an integer and return as string. */
export function squareInt(n: number): string {
  return String(n * n);
}

/** Numeric side length for SVG scaling (approximate, display only). */
export function sideToNumber(side: DecimalValue): number {
  if (side.scale === 0) return Number(side.scaled);
  const factor = 10 ** side.scale;
  return Number(side.scaled) / factor;
}

export function parseSideInputErrorMessage(error: ParseSideError): string {
  return parseSideErrorMessage(error);
}
