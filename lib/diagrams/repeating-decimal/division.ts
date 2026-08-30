import { analyzeRepeatingDecimal } from "@/lib/repeating-decimal-math";

const ZERO = BigInt(0);
const TEN = BigInt(10);

export const MAX_PERIOD_DIGITS = 30;
export const MAX_INPUT_VALUE = BigInt(999999);

export type CircleRole = "cycle-start" | "cycle-end" | "mid" | null;

export type LayoutDigit = {
  ch: string;
  place: number;
  gray: boolean;
  circle: CircleRole;
};

export type DivisionLayoutRow = {
  kind: "working" | "product";
  digits: LayoutDigit[];
  bar: boolean;
};

export type QuotientDigit = {
  ch: string;
  place: number;
  inPeriod: boolean;
  overdot: boolean;
};

export type LongDivisionError =
  | "empty"
  | "invalid"
  | "zero_divisor"
  | "too_large";

export type LongDivisionLayout = {
  divisor: string;
  dividend: string;
  integerPart: string;
  decimalDigits: string;
  prePeriod: string;
  period: string;
  periodLength: number;
  kind: "terminating" | "repeating" | "truncated";
  cycleRemainder: string | null;
  rows: DivisionLayoutRow[];
  quotient: QuotientDigit[];
  showEllipsis: boolean;
  showVerticalDots: boolean;
  canShowSame: boolean;
};

export type ParseDivisionOutcome =
  | { ok: true; layout: LongDivisionLayout }
  | { ok: false; error: LongDivisionError };

function parseNonNegInt(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

function placeDigits(
  n: bigint,
  rightPlace: number,
): LayoutDigit[] {
  const s = n.toString();
  return [...s].map((ch, i) => ({
    ch,
    place: rightPlace - (s.length - 1 - i),
    gray: false,
    circle: null as CircleRole,
  }));
}

function workingDigits(
  remainder: bigint,
  rightPlace: number,
  bringZero: boolean,
): LayoutDigit[] {
  const rem = placeDigits(remainder, bringZero ? rightPlace - 1 : rightPlace);
  if (!bringZero) return rem;
  return [
    ...rem,
    {
      ch: "0",
      place: rightPlace,
      gray: true,
      circle: null,
    },
  ];
}

function markInkCircle(digits: LayoutDigit[], role: CircleRole): LayoutDigit[] {
  if (!role) return digits;
  return digits.map((d) => (d.gray ? d : { ...d, circle: role }));
}

export function parseDivisionInputs(
  dividendInput: string,
  divisorInput: string,
): ParseDivisionOutcome {
  const dividend = parseNonNegInt(dividendInput);
  const divisor = parseNonNegInt(divisorInput);

  if (dividend == null || divisor == null) {
    if (dividendInput.trim() === "" && divisorInput.trim() === "") {
      return { ok: false, error: "empty" };
    }
    return { ok: false, error: "invalid" };
  }
  if (divisor === ZERO) return { ok: false, error: "zero_divisor" };
  if (dividend > MAX_INPUT_VALUE || divisor > MAX_INPUT_VALUE) {
    return { ok: false, error: "too_large" };
  }
  return { ok: true, layout: buildLongDivision(dividend, divisor) };
}

export function parseDivisionErrorMessage(error: LongDivisionError): string {
  switch (error) {
    case "empty":
      return "피제수와 제수에 0 이상의 정수를 입력해 주세요.";
    case "invalid":
      return "피제수와 제수는 0 이상의 정수만 입력할 수 있어요.";
    case "zero_divisor":
      return "제수는 0이 될 수 없어요.";
    case "too_large":
      return `피제수·제수는 각각 ${MAX_INPUT_VALUE.toString()} 이하로 입력해 주세요.`;
  }
}

/**
 * Build a place-aligned long-division figure for dividend ÷ divisor.
 * Repeating blocks longer than MAX_PERIOD_DIGITS are truncated.
 */
export function buildLongDivision(
  dividend: bigint,
  divisor: bigint,
  maxPeriod = MAX_PERIOD_DIGITS,
): LongDivisionLayout {
  const analysis = analyzeRepeatingDecimal(dividend, divisor);
  const truncated = analysis.kind === "repeating" && analysis.periodLength > maxPeriod;
  const periodShown = truncated
    ? analysis.period.slice(0, maxPeriod)
    : analysis.period;
  const decimalDigits = analysis.prePeriod + periodShown;
  const periodStartIndex = analysis.prePeriod.length;
  const completeCycle = analysis.kind === "repeating" && !truncated;

  const integerPart = analysis.integerPart.toString();
  const dividendStr = dividend.toString();

  const quotient: QuotientDigit[] = [];
  for (let i = 0; i < integerPart.length; i += 1) {
    quotient.push({
      ch: integerPart[i]!,
      place: i - (integerPart.length - 1),
      inPeriod: false,
      overdot: false,
    });
  }
  for (let i = 0; i < decimalDigits.length; i += 1) {
    const inPeriod = i >= periodStartIndex && analysis.kind === "repeating";
    const periodOffset = i - periodStartIndex;
    const overdot =
      inPeriod &&
      !truncated &&
      (periodOffset === 0 ||
        (periodShown.length > 1 && periodOffset === periodShown.length - 1));
    quotient.push({
      ch: decimalDigits[i]!,
      place: i + 1,
      inPeriod,
      overdot,
    });
  }

  const rows: DivisionLayoutRow[] = [];
  const dividendDigits = placeDigits(dividend, 0);
  const rem = dividend % divisor;
  const intQ = dividend / divisor;

  if (intQ > ZERO) {
    rows.push({ kind: "working", digits: dividendDigits, bar: false });
    rows.push({
      kind: "product",
      digits: placeDigits(intQ * divisor, 0),
      bar: true,
    });
  }

  if (decimalDigits.length === 0) {
    if (intQ === ZERO) {
      rows.push({ kind: "working", digits: dividendDigits, bar: false });
    }
    if (rem === ZERO && intQ > ZERO) {
      rows.push({
        kind: "working",
        digits: [{ ch: "0", place: 0, gray: false, circle: null }],
        bar: false,
      });
    }
  } else {
    let currentRem = rem;
    for (let i = 0; i < decimalDigits.length; i += 1) {
      const rightPlace = i + 1;
      const working = workingDigits(currentRem, rightPlace, true);
      const qDigit = Number(decimalDigits[i]!);
      const product = BigInt(qDigit) * divisor;
      rows.push({ kind: "working", digits: working, bar: false });
      rows.push({
        kind: "product",
        digits: placeDigits(product, rightPlace),
        bar: true,
      });
      currentRem = (currentRem * TEN) % divisor;
    }
    rows.push({
      kind: "working",
      digits: workingDigits(currentRem, decimalDigits.length, false),
      bar: false,
    });
  }

  const cycleRemainder = completeCycle
    ? remAfterInteger(dividend, divisor)
    : null;
  applyRemainderCircles(
    rows,
    cycleRemainder,
    completeCycle,
    truncated,
    intQ > ZERO,
  );

  return {
    divisor: divisor.toString(),
    dividend: dividendStr,
    integerPart,
    decimalDigits,
    prePeriod: analysis.prePeriod,
    period: periodShown,
    periodLength: analysis.periodLength,
    kind: truncated
      ? "truncated"
      : analysis.kind === "repeating"
        ? "repeating"
        : "terminating",
    cycleRemainder,
    rows,
    quotient,
    showEllipsis: analysis.kind === "repeating",
    showVerticalDots: analysis.kind === "repeating",
    canShowSame: completeCycle,
  };
}

function remAfterInteger(dividend: bigint, divisor: bigint): string {
  const analysis = analyzeRepeatingDecimal(dividend, divisor);
  if (analysis.kind !== "repeating" || analysis.periodLength === 0) return "";
  let rem = dividend % divisor;
  for (let i = 0; i < analysis.prePeriod.length; i += 1) {
    rem = (rem * TEN) % divisor;
  }
  return rem.toString();
}

function inkValue(digits: LayoutDigit[]): string {
  const ink = digits.filter((d) => !d.gray);
  if (ink.length === 0) return "";
  return ink.map((d) => d.ch).join("").replace(/^0+(?=\d)/, "") || "0";
}

function applyRemainderCircles(
  rows: DivisionLayoutRow[],
  cycleRemainder: string | null,
  completeCycle: boolean,
  truncated: boolean,
  skipFirstDividend: boolean,
): void {
  const workings = rows.filter((row) => row.kind === "working");
  if (workings.length === 0) return;

  const last = workings[workings.length - 1]!;
  const lastInk = inkValue(last.digits);
  const lastIsZero = lastInk === "0" || lastInk === "";
  const remainderRows = skipFirstDividend ? workings.slice(1) : workings;

  if (completeCycle && cycleRemainder) {
    let startMarked = false;
    for (const row of remainderRows) {
      if (row === last) continue;
      const ink = inkValue(row.digits);
      if (!startMarked && ink === cycleRemainder) {
        row.digits = markInkCircle(row.digits, "cycle-start");
        startMarked = true;
      } else if (ink !== "0") {
        row.digits = markInkCircle(row.digits, "mid");
      }
    }
    last.digits = markInkCircle(last.digits, "cycle-end");
    return;
  }

  for (const row of remainderRows) {
    if (row === last && lastIsZero) continue;
    const ink = inkValue(row.digits);
    if (ink === "0") continue;
    row.digits = markInkCircle(row.digits, "mid");
  }
}
