/** Math helpers for the 「부호 슬라임 대소동」 mini-game (중1 · 1.2 정수와 유리수). */

import { gcd } from "@/lib/repeating-decimal-math";

export const START_HP = 3;
export const ROUND_LIMIT_START = 30;
export const ROUND_LIMIT_MIN = 3;
/** Max denominator for rational problem answers (middle-school friendly). */
export const MAX_ANSWER_DENOM = 24;

export type MathOp = "+" | "−" | "×" | "÷";

export type StageId =
  | "int_add"
  | "int_add_sub"
  | "rational_add_sub"
  | "int_mul"
  | "int_div"
  | "rational_mul_div";

export type StagePreset = {
  id: StageId;
  label: string;
  description: string;
};

export const STAGE_PRESETS: StagePreset[] = [
  {
    id: "int_add",
    label: "정수의 덧셈",
    description: "(+3) + (−5) 같은 정수 덧셈",
  },
  {
    id: "int_add_sub",
    label: "정수의 덧셈과 뺄셈",
    description: "덧셈·뺄셈이 섞인 정수 연산",
  },
  {
    id: "rational_add_sub",
    label: "유리수의 덧셈과 뺄셈",
    description: "분수끼리 더하고 빼기",
  },
  {
    id: "int_mul",
    label: "정수의 곱셈",
    description: "(−4) × (+6) 같은 정수 곱셈",
  },
  {
    id: "int_div",
    label: "정수의 나눗셈",
    description: "나누어떨어지는 정수 나눗셈",
  },
  {
    id: "rational_mul_div",
    label: "유리수의 곱셈과 나눗셈",
    description: "분수 곱셈·나눗셈",
  },
];

export const ALL_STAGE_IDS: StageId[] = STAGE_PRESETS.map((s) => s.id);

export const STAGES_STORAGE_KEY = "pm_sign_slime_stages";

export type Answer =
  | { kind: "int"; value: number }
  | { kind: "rational"; num: number; den: number };

export type Problem = {
  stageId: StageId;
  left: Answer;
  op: MathOp;
  right: Answer;
  /** Plain-text for a11y and status messages. */
  expression: string;
  answer: Answer;
  choices: Answer[];
};

export type Difficulty = {
  /** Slime scale 1.0 – 1.35 */
  slimeScale: number;
};

type Fraction = { num: number; den: number };

const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12] as const;

function randomInt(lo: number, hi: number): number {
  const a = Math.ceil(lo);
  const b = Math.floor(hi);
  if (b <= a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickStage(stages: StageId[]): StageId {
  return pick(stages.length > 0 ? stages : ALL_STAGE_IDS);
}

function intGcd(a: number, b: number): number {
  return Number(gcd(BigInt(Math.abs(a)), BigInt(Math.abs(b))));
}

export function simplifyRational(num: number, den: number): Answer {
  if (den === 0) return { kind: "int", value: 0 };
  let n = num;
  let d = den;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = intGcd(n, d);
  n /= g;
  d /= g;
  if (d === 1) return { kind: "int", value: n };
  return { kind: "rational", num: n, den: d };
}

function toFraction(a: Answer): Fraction {
  if (a.kind === "int") return { num: a.value, den: 1 };
  return { num: a.num, den: a.den };
}

function fromFraction(f: Fraction): Answer {
  return simplifyRational(f.num, f.den);
}

function addFrac(a: Fraction, b: Fraction): Answer {
  return fromFraction({
    num: a.num * b.den + b.num * a.den,
    den: a.den * b.den,
  });
}

function subFrac(a: Fraction, b: Fraction): Answer {
  return fromFraction({
    num: a.num * b.den - b.num * a.den,
    den: a.den * b.den,
  });
}

function mulFrac(a: Fraction, b: Fraction): Answer {
  return fromFraction({ num: a.num * b.num, den: a.den * b.den });
}

function divFrac(a: Fraction, b: Fraction): Answer {
  if (b.num === 0) return { kind: "int", value: 0 };
  return fromFraction({ num: a.num * b.den, den: a.den * b.num });
}

export function answersEqual(a: Answer, b: Answer): boolean {
  if (a.kind === "int" && b.kind === "int") return a.value === b.value;
  if (a.kind === "rational" && b.kind === "rational") {
    const sa = simplifyRational(a.num, a.den);
    const sb = simplifyRational(b.num, b.den);
    if (sa.kind === "int" && sb.kind === "int") return sa.value === sb.value;
    if (sa.kind === "rational" && sb.kind === "rational") {
      return sa.num === sb.num && sa.den === sb.den;
    }
    return false;
  }
  if (a.kind === "int" && b.kind === "rational") {
    const sb = simplifyRational(b.num, b.den);
    return sb.kind === "int" && sb.value === a.value;
  }
  if (a.kind === "rational" && b.kind === "int") {
    const sa = simplifyRational(a.num, a.den);
    return sa.kind === "int" && sa.value === b.value;
  }
  return false;
}

export function simplifyAnswer(a: Answer): Answer {
  if (a.kind === "int") return a;
  return simplifyRational(a.num, a.den);
}

function answerDenom(a: Answer): number {
  const s = simplifyAnswer(a);
  return s.kind === "rational" ? s.den : 1;
}

/** Korean textbook sign notation: (+3), (−5), (+1/2) */
export function formatOperand(a: Answer): string {
  const s = simplifyAnswer(a);
  if (s.kind === "int") {
    if (s.value > 0) return `(+${s.value})`;
    if (s.value < 0) return `(−${Math.abs(s.value)})`;
    return "(0)";
  }
  const sign = s.num >= 0 ? "+" : "−";
  const absNum = Math.abs(s.num);
  return `(${sign}${absNum}/${s.den})`;
}

export function formatAnswer(a: Answer): string {
  const s = simplifyAnswer(a);
  if (s.kind === "int") {
    if (s.value > 0) return `+${s.value}`;
    if (s.value < 0) return `−${Math.abs(s.value)}`;
    return "0";
  }
  const sign = s.num >= 0 ? "" : "−";
  return `${sign}${Math.abs(s.num)}/${s.den}`;
}

const OP_SYMBOL: Record<MathOp, string> = {
  "+": "+",
  "−": "−",
  "×": "×",
  "÷": "÷",
};

function makeProblem(
  stageId: StageId,
  left: Answer,
  op: MathOp,
  right: Answer,
  answer: Answer,
): Problem {
  return {
    stageId,
    left,
    op,
    right,
    expression: `${formatOperand(left)} ${OP_SYMBOL[op]} ${formatOperand(right)}`,
    answer,
    choices: buildChoices(answer),
  };
}

function intAnswer(n: number): Answer {
  return { kind: "int", value: n };
}

function fracAnswer(num: number, den: number): Answer {
  return simplifyRational(num, den);
}

function randomNonZeroInt(lo: number, hi: number): number {
  let n = randomInt(lo, hi);
  let guard = 0;
  while (n === 0 && guard++ < 20) n = randomInt(lo, hi);
  return n === 0 ? 1 : n;
}

/** Reduced proper/improper fraction with small denominators. */
function randomFraction(): Answer {
  for (let attempt = 0; attempt < 40; attempt++) {
    const den = pick(DENOMINATORS);
    const num = randomNonZeroInt(-den * 2, den * 2);
    const f = simplifyRational(num, den);
    if (f.kind === "rational" && intGcd(Math.abs(f.num), f.den) === 1) {
      return f;
    }
  }
  return fracAnswer(1, 2);
}

function addAnswers(a: Answer, b: Answer): Answer {
  return addFrac(toFraction(a), toFraction(b));
}

function subAnswers(a: Answer, b: Answer): Answer {
  return subFrac(toFraction(a), toFraction(b));
}

function mulAnswers(a: Answer, b: Answer): Answer {
  return mulFrac(toFraction(a), toFraction(b));
}

function divAnswers(a: Answer, b: Answer): Answer {
  return divFrac(toFraction(a), toFraction(b));
}

function isAcceptableRationalAnswer(answer: Answer): boolean {
  return answerDenom(answer) <= MAX_ANSWER_DENOM;
}

function dealIntAdd(): Problem {
  const left = intAnswer(randomInt(-20, 20));
  const right = intAnswer(randomInt(-20, 20));
  return makeProblem("int_add", left, "+", right, addAnswers(left, right));
}

function dealIntAddSub(): Problem {
  const left = intAnswer(randomInt(-20, 20));
  const right = intAnswer(randomInt(-20, 20));
  const op: MathOp = Math.random() < 0.5 ? "+" : "−";
  const answer = op === "+" ? addAnswers(left, right) : subAnswers(left, right);
  return makeProblem("int_add_sub", left, op, right, answer);
}

function dealRationalAddSub(): Problem {
  for (let attempt = 0; attempt < 50; attempt++) {
    const left = randomFraction();
    const right = randomFraction();
    const op: MathOp = Math.random() < 0.5 ? "+" : "−";
    const answer = op === "+" ? addAnswers(left, right) : subAnswers(left, right);
    if (isAcceptableRationalAnswer(answer)) {
      return makeProblem("rational_add_sub", left, op, right, answer);
    }
  }
  const left = fracAnswer(1, 2);
  const right = fracAnswer(1, 3);
  return makeProblem("rational_add_sub", left, "+", right, addAnswers(left, right));
}

function dealIntMul(): Problem {
  const left = intAnswer(randomInt(-12, 12));
  const right = intAnswer(randomInt(-12, 12));
  return makeProblem("int_mul", left, "×", right, mulAnswers(left, right));
}

function dealIntDiv(): Problem {
  const divisor = randomNonZeroInt(-12, 12);
  const quotient = randomInt(-12, 12);
  const dividend = divisor * quotient;
  const left = intAnswer(dividend);
  const right = intAnswer(divisor);
  return makeProblem("int_div", left, "÷", right, intAnswer(quotient));
}

function dealRationalMulDiv(): Problem {
  for (let attempt = 0; attempt < 50; attempt++) {
    const left = randomFraction();
    const right = randomFraction();
    const op: MathOp = Math.random() < 0.5 ? "×" : "÷";
    const answer = op === "×" ? mulAnswers(left, right) : divAnswers(left, right);
    if (isAcceptableRationalAnswer(answer)) {
      return makeProblem("rational_mul_div", left, op, right, answer);
    }
  }
  const left = fracAnswer(2, 3);
  const right = fracAnswer(3, 4);
  return makeProblem("rational_mul_div", left, "×", right, mulAnswers(left, right));
}

const DEALERS: Record<StageId, () => Problem> = {
  int_add: dealIntAdd,
  int_add_sub: dealIntAddSub,
  rational_add_sub: dealRationalAddSub,
  int_mul: dealIntMul,
  int_div: dealIntDiv,
  rational_mul_div: dealRationalMulDiv,
};

export function dealProblem(stages: StageId[]): Problem {
  const stage = pickStage(stages);
  return DEALERS[stage]();
}

function mutateAnswer(
  answer: Answer,
  kind: "off_by_one" | "flip_sign" | "swap_frac" | "add_denom",
): Answer | null {
  const s = simplifyAnswer(answer);
  if (kind === "off_by_one") {
    if (s.kind === "int") return intAnswer(s.value + (Math.random() < 0.5 ? 1 : -1));
    return fracAnswer(s.num + (Math.random() < 0.5 ? 1 : -1), s.den);
  }
  if (kind === "flip_sign") {
    if (s.kind === "int") return intAnswer(-s.value);
    return fracAnswer(-s.num, s.den);
  }
  if (kind === "swap_frac" && s.kind === "rational" && s.num !== s.den) {
    return fracAnswer(s.den, s.num);
  }
  if (kind === "add_denom" && s.kind === "rational") {
    return fracAnswer(s.num, s.den + 1);
  }
  if (s.kind === "int") return intAnswer(s.value + 2);
  return fracAnswer(s.num + 1, s.den);
}

export function buildChoices(answer: Answer): Answer[] {
  const correct = simplifyAnswer(answer);
  const pool: Answer[] = [correct];
  const mutators: Array<"off_by_one" | "flip_sign" | "swap_frac" | "add_denom"> = [
    "off_by_one",
    "flip_sign",
    "swap_frac",
    "add_denom",
  ];

  for (const m of mutators) {
    const candidate = mutateAnswer(correct, m);
    if (!candidate) continue;
    const simplified = simplifyAnswer(candidate);
    if (pool.some((p) => answersEqual(p, simplified))) continue;
    pool.push(simplified);
    if (pool.length >= 4) break;
  }

  let offset = 1;
  while (pool.length < 4) {
    const extra =
      correct.kind === "int"
        ? intAnswer(correct.value + offset)
        : fracAnswer(correct.num + offset, correct.den);
    offset += 1;
    if (!pool.some((p) => answersEqual(p, extra))) pool.push(simplifyAnswer(extra));
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return pool.slice(0, 4);
}

export function findCorrectIndex(choices: Answer[], answer: Answer): number {
  return choices.findIndex((c) => answersEqual(c, answer));
}

const BASE_POINTS: Record<StageId, number> = {
  int_add: 28,
  int_add_sub: 30,
  rational_add_sub: 38,
  int_mul: 32,
  int_div: 34,
  rational_mul_div: 42,
};

/** clearedBefore = number of correct answers before this round. */
export function roundLimitSec(clearedBefore: number): number {
  let limit = ROUND_LIMIT_START;
  let n = Math.max(0, clearedBefore);
  const p1 = Math.min(n, 10);
  limit -= p1;
  n -= p1;
  const p2 = Math.min(n, 20);
  limit -= p2 * 0.5;
  n -= p2;
  limit -= n * 0.1;
  return Math.max(ROUND_LIMIT_MIN, Math.round(limit * 10) / 10);
}

/** Bonus 0–10 from remaining time ratio within the round limit. */
export function speedBonusFor(
  answerTimeSec: number,
  roundLimit: number,
): number {
  const limit = Math.max(ROUND_LIMIT_MIN, roundLimit);
  const t = Math.max(0, answerTimeSec);
  const remainingRatio = Math.max(0, Math.min(1, 1 - t / limit));
  if (remainingRatio >= 0.8) return 10;
  if (remainingRatio <= 0.2) return 0;
  return Math.round(((remainingRatio - 0.2) / 0.6) * 10);
}

export function pointsForCorrect(
  stageId: StageId,
  streakBefore: number,
  answerTimeSec: number,
  roundLimit: number,
): number {
  const base = BASE_POINTS[stageId];
  const streakBonus = Math.min(streakBefore, 12) * 2;
  const speedBonus = speedBonusFor(answerTimeSec, roundLimit);
  return base + streakBonus + speedBonus;
}

export function difficultyAt(cleared: number): Difficulty {
  const c = Math.max(0, cleared);
  const progress = Math.min(1, c / 55);
  const slimeScale = 1 + progress * 0.35;
  return { slimeScale };
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.round(score));
}

export function parseStoredStages(raw: string | null): StageId[] {
  if (!raw) return [...ALL_STAGE_IDS];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...ALL_STAGE_IDS];
    const valid = parsed.filter(
      (id): id is StageId =>
        typeof id === "string" && ALL_STAGE_IDS.includes(id as StageId),
    );
    return valid.length > 0 ? valid : [...ALL_STAGE_IDS];
  } catch {
    return [...ALL_STAGE_IDS];
  }
}

export { applyScoreGain, SCORE_SOFT_CAP, SCORE_HARD_MAX } from "@/lib/xp";
