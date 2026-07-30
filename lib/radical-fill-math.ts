/**
 * 근호 빈칸 채우기 — 표준형 평가 · 채점 · 고정 10문제
 * contentKey: g3-u1-radical-fill
 */

import { applyScoreGain, SCORE_HARD_MAX, SCORE_SOFT_CAP } from "@/lib/xp";

export { applyScoreGain, SCORE_HARD_MAX, SCORE_SOFT_CAP };

export const CONTENT_KEY = "g3-u1-radical-fill";
export const PROBLEM_COUNT = 10;

export type Op = "+" | "-" | "*" | "/";

export type FillableTerm = {
  /** true면 계수 빈칸, false면 계수 1(표시 없음) */
  hasCoeff: boolean;
};

/** 우변 고정 항: coeff * √radicand (이미 단순화된 형태로 두는 것을 권장) */
export type FixedTerm = {
  coeff: number;
  radicand: number;
};

export type RadicalProblem = {
  id: string;
  /** soft limit 초 — 이 이상이면 정답이어도 50점 */
  timeLimitSec: number;
  terms: FillableTerm[];
  /** length = terms.length - 1 */
  ops: Op[];
  rhs: FixedTerm[];
};

export type TermFill = {
  coeff: number | null;
  radicand: number | null;
};

export type CheckReason =
  | "ok"
  | "incomplete"
  | "invalid"
  | "duplicate"
  | "wrong";

export type CheckResult = {
  ok: boolean;
  reason: CheckReason;
};

/** square-free radicand → rational coefficient (num/den) */
export type RadicalMap = Map<number, { num: number; den: number }>;

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function simplifyRat(num: number, den: number): { num: number; den: number } {
  if (den < 0) {
    num = -num;
    den = -den;
  }
  if (num === 0) return { num: 0, den: 1 };
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

function addRat(
  a: { num: number; den: number },
  b: { num: number; den: number },
): { num: number; den: number } {
  return simplifyRat(a.num * b.den + b.num * a.den, a.den * b.den);
}

function mulRat(
  a: { num: number; den: number },
  b: { num: number; den: number },
): { num: number; den: number } {
  return simplifyRat(a.num * b.num, a.den * b.den);
}

function negRat(a: { num: number; den: number }): { num: number; den: number } {
  return { num: -a.num, den: a.den };
}

/** n = multiplier² × squareFree */
export function extractSquareFactors(n: number): {
  multiplier: number;
  squareFree: number;
} {
  if (!Number.isInteger(n) || n <= 0) {
    return { multiplier: 1, squareFree: n };
  }
  let multiplier = 1;
  let squareFree = n;
  for (let p = 2; p * p <= squareFree; p++) {
    let exp = 0;
    while (squareFree % p === 0) {
      squareFree = Math.floor(squareFree / p);
      exp++;
    }
    const pairs = Math.floor(exp / 2);
    if (pairs > 0) multiplier *= p ** pairs;
    if (exp % 2 === 1) squareFree *= p;
  }
  return { multiplier, squareFree };
}

export function emptyMap(): RadicalMap {
  return new Map();
}

export function addTermToMap(
  map: RadicalMap,
  coeff: number,
  radicand: number,
): RadicalMap {
  const next = cloneMap(map);
  if (coeff === 0 || radicand === 0) return next;
  if (radicand < 0) {
    // 중3 범위 밖 — 빈 맵으로 실패 유도하지 않고 무시하지 않음; 호출 전 검증
    return next;
  }
  const { multiplier, squareFree } = extractSquareFactors(radicand);
  const add = simplifyRat(coeff * multiplier, 1);
  const prev = next.get(squareFree) ?? { num: 0, den: 1 };
  const sum = addRat(prev, add);
  if (sum.num === 0) next.delete(squareFree);
  else next.set(squareFree, sum);
  return next;
}

function cloneMap(map: RadicalMap): RadicalMap {
  const next: RadicalMap = new Map();
  for (const [k, v] of map) next.set(k, { ...v });
  return next;
}

export function addMaps(a: RadicalMap, b: RadicalMap): RadicalMap {
  let out = cloneMap(a);
  for (const [sf, rat] of b) {
    const prev = out.get(sf) ?? { num: 0, den: 1 };
    const sum = addRat(prev, rat);
    if (sum.num === 0) out.delete(sf);
    else out.set(sf, sum);
  }
  return out;
}

export function subMaps(a: RadicalMap, b: RadicalMap): RadicalMap {
  const negB = emptyMap();
  for (const [sf, rat] of b) negB.set(sf, negRat(rat));
  return addMaps(a, negB);
}

/** (Σ a_i √n_i)(Σ b_j √m_j) */
export function mulMaps(a: RadicalMap, b: RadicalMap): RadicalMap {
  let out = emptyMap();
  for (const [n, ar] of a) {
    for (const [m, br] of b) {
      const coeff = mulRat(ar, br);
      const product = n * m;
      const { multiplier, squareFree } = extractSquareFactors(product);
      const scaled = simplifyRat(coeff.num * multiplier, coeff.den);
      const prev = out.get(squareFree) ?? { num: 0, den: 1 };
      const sum = addRat(prev, scaled);
      if (sum.num === 0) out.delete(squareFree);
      else out.set(squareFree, sum);
    }
  }
  return out;
}

/** a / b  (b must be a single non-zero term for exact middle-school division; general: multiply by reciprocal of sum is hard — we support single-term divisor and general via rationalizing when |b|=1 term) */
export function divMaps(a: RadicalMap, b: RadicalMap): RadicalMap | null {
  if (b.size === 0) return null;
  if (b.size === 1) {
    const [[sf, br]] = [...b.entries()];
    if (br.num === 0) return null;
    const inv = simplifyRat(br.den, br.num);
    // 1/√sf = √sf / sf
    const invMap = emptyMap();
    if (sf === 1) {
      invMap.set(1, inv);
    } else {
      invMap.set(sf, simplifyRat(inv.num, inv.den * sf));
    }
    return mulMaps(a, invMap);
  }
  // 중3 문제에서는 제약이 한 항이므로 여기까지 오면 실패
  return null;
}

export function mapsEqual(a: RadicalMap, b: RadicalMap): boolean {
  if (a.size !== b.size) return false;
  for (const [sf, ar] of a) {
    const br = b.get(sf);
    if (!br) return false;
    if (ar.num !== br.num || ar.den !== br.den) return false;
  }
  return true;
}

export function mapFromFixed(terms: FixedTerm[]): RadicalMap {
  let map = emptyMap();
  for (const t of terms) {
    map = addTermToMap(map, t.coeff, t.radicand);
  }
  return map;
}

export function termToMap(coeff: number, radicand: number): RadicalMap {
  return addTermToMap(emptyMap(), coeff, radicand);
}

/**
 * * / 가 + - 보다 우선. 같은 우선순위는 왼쪽→오른쪽.
 */
export function evalExpression(
  termMaps: RadicalMap[],
  ops: Op[],
): RadicalMap | null {
  if (termMaps.length === 0) return emptyMap();
  if (ops.length !== termMaps.length - 1) return null;

  const values = termMaps.map(cloneMap);
  const opList = [...ops];

  // First pass: * and /
  let i = 0;
  while (i < opList.length) {
    const op = opList[i]!;
    if (op === "*" || op === "/") {
      const left = values[i]!;
      const right = values[i + 1]!;
      const merged =
        op === "*" ? mulMaps(left, right) : divMaps(left, right);
      if (!merged) return null;
      values.splice(i, 2, merged);
      opList.splice(i, 1);
    } else {
      i++;
    }
  }

  // Second pass: + and -
  let acc = values[0]!;
  for (let j = 0; j < opList.length; j++) {
    const op = opList[j]!;
    const right = values[j + 1]!;
    acc = op === "+" ? addMaps(acc, right) : subMaps(acc, right);
  }
  return acc;
}

export function parsePositiveInt(raw: string): number | null {
  const t = raw.trim();
  if (!t || !/^\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** 계수·근호에 채운 모든 양의 정수 (빈 칸 제외) */
export function collectFilledNumbers(
  problem: RadicalProblem,
  fills: TermFill[],
): number[] {
  const nums: number[] = [];
  for (let i = 0; i < problem.terms.length; i++) {
    const term = problem.terms[i]!;
    const fill = fills[i];
    if (!fill) continue;
    if (term.hasCoeff && fill.coeff != null) nums.push(fill.coeff);
    if (fill.radicand != null) nums.push(fill.radicand);
  }
  return nums;
}

export function allDistinct(nums: number[]): boolean {
  return new Set(nums).size === nums.length;
}

export function hasDuplicateAmongFills(
  problem: RadicalProblem,
  fills: TermFill[],
): boolean {
  const nums = collectFilledNumbers(problem, fills);
  return !allDistinct(nums);
}

function fillsComplete(problem: RadicalProblem, fills: TermFill[]): boolean {
  if (fills.length !== problem.terms.length) return false;
  for (let i = 0; i < problem.terms.length; i++) {
    const term = problem.terms[i]!;
    const fill = fills[i]!;
    if (term.hasCoeff) {
      if (fill.coeff == null || fill.coeff <= 0) return false;
    }
    if (fill.radicand == null || fill.radicand <= 0) return false;
  }
  return true;
}

export function checkAnswer(
  problem: RadicalProblem,
  fills: TermFill[],
): CheckResult {
  if (!fillsComplete(problem, fills)) {
    return { ok: false, reason: "incomplete" };
  }
  const nums = collectFilledNumbers(problem, fills);
  if (nums.some((n) => !Number.isInteger(n) || n <= 0)) {
    return { ok: false, reason: "invalid" };
  }
  if (!allDistinct(nums)) {
    return { ok: false, reason: "duplicate" };
  }

  const termMaps: RadicalMap[] = problem.terms.map((term, i) => {
    const fill = fills[i]!;
    const coeff = term.hasCoeff ? fill.coeff! : 1;
    return termToMap(coeff, fill.radicand!);
  });

  const lhs = evalExpression(termMaps, problem.ops);
  if (!lhs) return { ok: false, reason: "wrong" };
  const rhs = mapFromFixed(problem.rhs);
  if (!mapsEqual(lhs, rhs)) return { ok: false, reason: "wrong" };
  return { ok: true, reason: "ok" };
}

/**
 * 즉시 ≈100, t≥limit 이면 50. 그 사이 선형.
 */
export function scoreForTime(elapsedSec: number, limitSec: number): number {
  const limit = Math.max(1, limitSec);
  const t = Math.max(0, elapsedSec);
  const ratio = Math.max(0, Math.min(1, 1 - t / limit));
  return Math.round(50 + 50 * ratio);
}

export function opLabel(op: Op): string {
  switch (op) {
    case "+":
      return "+";
    case "-":
      return "−";
    case "*":
      return "×";
    case "/":
      return "÷";
  }
}

/** 우변 표시용 */
export function formatFixedRhs(rhs: FixedTerm[]): string {
  if (rhs.length === 0) return "0";
  return rhs
    .map((t, i) => {
      const absCoeff = Math.abs(t.coeff);
      const radical =
        t.radicand === 1
          ? absCoeff === 1
            ? "1"
            : String(absCoeff)
          : absCoeff === 1
            ? `√${t.radicand}`
            : `${absCoeff}√${t.radicand}`;
      if (i === 0) {
        return t.coeff < 0 ? `−${radical}` : radical;
      }
      return t.coeff < 0 ? ` − ${radical}` : ` + ${radical}`;
    })
    .join("");
}

export const PROBLEMS: RadicalProblem[] = [
  // 1–3: 단순 가감
  {
    id: "p1",
    timeLimitSec: 45,
    terms: [{ hasCoeff: false }, { hasCoeff: false }, { hasCoeff: false }],
    ops: ["+", "-"],
    rhs: [{ coeff: 5, radicand: 2 }],
  },
  {
    id: "p2",
    timeLimitSec: 45,
    terms: [{ hasCoeff: false }, { hasCoeff: false }, { hasCoeff: false }],
    ops: ["+", "-"],
    rhs: [{ coeff: 3, radicand: 3 }],
  },
  {
    id: "p3",
    timeLimitSec: 45,
    terms: [{ hasCoeff: false }, { hasCoeff: false }, { hasCoeff: false }],
    ops: ["-", "+"],
    rhs: [{ coeff: 4, radicand: 5 }],
  },
  // 4–6: 계수 포함 가감
  {
    id: "p4",
    timeLimitSec: 60,
    terms: [{ hasCoeff: true }, { hasCoeff: false }, { hasCoeff: true }],
    ops: ["+", "-"],
    rhs: [{ coeff: 5, radicand: 2 }],
  },
  {
    id: "p5",
    timeLimitSec: 60,
    terms: [
      { hasCoeff: true },
      { hasCoeff: false },
      { hasCoeff: true },
      { hasCoeff: false },
    ],
    ops: ["+", "-", "-"],
    rhs: [
      { coeff: 2, radicand: 3 },
      { coeff: -1, radicand: 5 },
    ],
  },
  {
    id: "p6",
    timeLimitSec: 60,
    terms: [
      { hasCoeff: true },
      { hasCoeff: false },
      { hasCoeff: true },
      { hasCoeff: false },
    ],
    ops: ["+", "-", "+"],
    rhs: [{ coeff: 6, radicand: 2 }],
  },
  // 7–8: 우변 두 항
  {
    id: "p7",
    timeLimitSec: 60,
    terms: [
      { hasCoeff: true },
      { hasCoeff: false },
      { hasCoeff: true },
      { hasCoeff: false },
    ],
    ops: ["+", "-", "-"],
    rhs: [
      { coeff: 3, radicand: 2 },
      { coeff: -2, radicand: 3 },
    ],
  },
  {
    id: "p8",
    timeLimitSec: 90,
    terms: [
      { hasCoeff: true },
      { hasCoeff: false },
      { hasCoeff: true },
      { hasCoeff: false },
    ],
    ops: ["-", "+", "-"],
    rhs: [
      { coeff: 4, radicand: 3 },
      { coeff: -1, radicand: 7 },
    ],
  },
  // 9–10: 곱·나눗셈 혼합
  {
    id: "p9",
    timeLimitSec: 90,
    terms: [
      { hasCoeff: true },
      { hasCoeff: false },
      { hasCoeff: true },
      { hasCoeff: false },
      { hasCoeff: false },
    ],
    ops: ["*", "/", "-", "/"],
    rhs: [{ coeff: 2, radicand: 6 }],
  },
  {
    id: "p10",
    timeLimitSec: 90,
    terms: [
      { hasCoeff: true },
      { hasCoeff: false },
      { hasCoeff: true },
      { hasCoeff: false },
      { hasCoeff: false },
    ],
    ops: ["*", "/", "+", "/"],
    rhs: [{ coeff: 5, radicand: 2 }],
  },
];

/** 테스트·내부용 예시 정답 (UI에 노출하지 않음) */
export const SAMPLE_FILLS: TermFill[][] = [
  // √32 + √18 − √8 = 5√2
  [
    { coeff: null, radicand: 32 },
    { coeff: null, radicand: 18 },
    { coeff: null, radicand: 8 },
  ],
  // √48 + √3 − √12 = 3√3
  [
    { coeff: null, radicand: 48 },
    { coeff: null, radicand: 3 },
    { coeff: null, radicand: 12 },
  ],
  // √45 − √5 + √20 = 4√5
  [
    { coeff: null, radicand: 45 },
    { coeff: null, radicand: 5 },
    { coeff: null, radicand: 20 },
  ],
  // 3√8 + √50 − 2√18 = 5√2
  [
    { coeff: 3, radicand: 8 },
    { coeff: null, radicand: 50 },
    { coeff: 2, radicand: 18 },
  ],
  // 2√12 + √27 − 1√75 − √5 = 2√3 − √5
  [
    { coeff: 2, radicand: 12 },
    { coeff: null, radicand: 27 },
    { coeff: 1, radicand: 75 },
    { coeff: null, radicand: 5 },
  ],
  // 3√8 + √18 − 2√32 + √50 = 6√2
  [
    { coeff: 3, radicand: 8 },
    { coeff: null, radicand: 18 },
    { coeff: 2, radicand: 32 },
    { coeff: null, radicand: 50 },
  ],
  // 1√32 + √8 − 2√3 − √18 = 3√2 − 2√3
  [
    { coeff: 1, radicand: 32 },
    { coeff: null, radicand: 8 },
    { coeff: 2, radicand: 3 },
    { coeff: null, radicand: 18 },
  ],
  // 1√108 − √48 + 2√3 − √7 = 4√3 − √7
  [
    { coeff: 1, radicand: 108 },
    { coeff: null, radicand: 48 },
    { coeff: 2, radicand: 3 },
    { coeff: null, radicand: 7 },
  ],
  // 3√2 × √12 ÷ 1√4 − √54 ÷ √9 = 2√6
  [
    { coeff: 3, radicand: 2 },
    { coeff: null, radicand: 12 },
    { coeff: 1, radicand: 4 },
    { coeff: null, radicand: 54 },
    { coeff: null, radicand: 9 },
  ],
  // 4√8 × √18 ÷ 6√2 + √32 ÷ √16 = 5√2
  [
    { coeff: 4, radicand: 8 },
    { coeff: null, radicand: 18 },
    { coeff: 6, radicand: 2 },
    { coeff: null, radicand: 32 },
    { coeff: null, radicand: 16 },
  ],
];

export function emptyFills(problem: RadicalProblem): TermFill[] {
  return problem.terms.map(() => ({
    coeff: null,
    radicand: null,
  }));
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(SCORE_HARD_MAX, Math.round(score)));
}
