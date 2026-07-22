/** Math helpers for the irrational square root discovery simulation (중3 · 1. 제곱근과 실수). */

const ZERO = BigInt(0);
const TEN = BigInt(10);

export const TARGET_AREAS = [2, 3, 5, 8, 10, 12] as const;
export type TargetArea = (typeof TARGET_AREAS)[number];

export const MAX_ITERATIONS = 10;
export const MAX_DECIMAL_PLACES = 10;

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

export type IterationRecord = {
  round: number;
  guess: DecimalValue;
  square: string;
  bracket: Bracket;
  squareVsArea: "lt" | "eq" | "gt";
};

export type ParseSideError = "empty" | "invalid" | "non_positive" | "too_many_decimals";

export type ParseSideOutcome =
  | { ok: true; value: DecimalValue }
  | { ok: false; error: ParseSideError };

function stripLeadingZeros(s: string): string {
  return s.replace(/^0+(?=\d)/, "") || "0";
}

/** Parse a positive finite decimal string into an exact scaled bigint. */
export function parseSideInput(raw: string): ParseSideOutcome {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: "empty" };

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, error: "invalid" };
  }

  const [intPart, fracPart = ""] = trimmed.split(".");
  if (fracPart.length > MAX_DECIMAL_PLACES) {
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
      return `소수점 아래는 ${MAX_DECIMAL_PLACES}자리까지 입력할 수 있어요.`;
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
  const squareScaled = BigInt(whole) * TEN ** BigInt(frac.length) + BigInt(frac || "0");
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

/** Refine bracket after a valid guess. */
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

/** Format a decimal string for display (no trailing-zero stripping). */
export function formatSquareDisplay(square: string): string {
  return square;
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
