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
  terms: FillableTerm[];
  /** length = terms.length - 1 */
  ops: Op[];
  rhs: FixedTerm[];
};

/** 오답 1회당 감점 */
export const WRONG_PENALTY = 15;
/** 정답 시 최소 점수 (포기 제외) */
export const MIN_CORRECT_SCORE = 40;
/** 정답 시 최대 점수 (무오답) */
export const MAX_CORRECT_SCORE = 100;

/** 기약분수 (부호는 num, den > 0) */
export type Rational = { num: number; den: number };

export type TermFill = {
  /** 계수 빈칸 — 음수·분수 허용. 없으면 null */
  coeff: Rational | null;
  /** 근호 안 — 양수(분수 가능), 음수 불가 */
  radicand: Rational | null;
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
export type RadicalMap = Map<number, Rational>;

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function simplifyRat(num: number, den: number): Rational {
  if (den < 0) {
    num = -num;
    den = -den;
  }
  if (num === 0) return { num: 0, den: 1 };
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

/** 정수 → 유리수 */
export function rat(num: number, den = 1): Rational {
  return simplifyRat(num, den);
}

export function ratsEqual(a: Rational, b: Rational): boolean {
  return a.num === b.num && a.den === b.den;
}

export function ratKey(r: Rational): string {
  return `${r.num}/${r.den}`;
}

function addRat(a: Rational, b: Rational): Rational {
  return simplifyRat(a.num * b.den + b.num * a.den, a.den * b.den);
}

function mulRat(a: Rational, b: Rational): Rational {
  return simplifyRat(a.num * b.num, a.den * b.den);
}

function negRat(a: Rational): Rational {
  return { num: -a.num, den: a.den };
}

function asRat(value: Rational | number): Rational {
  return typeof value === "number" ? simplifyRat(value, 1) : simplifyRat(value.num, value.den);
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
  coeff: Rational | number,
  radicand: Rational | number,
): RadicalMap {
  const next = cloneMap(map);
  const c = asRat(coeff);
  const r = asRat(radicand);
  if (c.num === 0) return next;
  // 근호 안은 양수만 (분모·분자 모두 양수인 기약분수)
  if (r.num <= 0 || r.den <= 0) return next;

  // coeff · √(p/q) = coeff · √(p·q) / q
  const under = r.num * r.den;
  const { multiplier, squareFree } = extractSquareFactors(under);
  const add = mulRat(c, simplifyRat(multiplier, r.den));
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
  const out = cloneMap(a);
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
  const out = emptyMap();
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

export function termToMap(
  coeff: Rational | number,
  radicand: Rational | number,
): RadicalMap {
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

/**
 * 유리수 파싱.
 * - allowNegative: 계수용 (−3, −1/2, 3/4 …)
 * - 근호 안: allowNegative=false → 양수만 (3, 1/2 …)
 * 0 · 0/n · 미완성(3/) 은 null
 */
export function parseRational(
  raw: string,
  opts: { allowNegative: boolean },
): Rational | null {
  const t = raw.trim().replace(/\s+/g, "");
  if (!t) return null;

  if (opts.allowNegative) {
    if (!/^-?\d+\/\d+$/.test(t) && !/^-?\d+$/.test(t)) return null;
  } else if (!/^\d+\/\d+$/.test(t) && !/^\d+$/.test(t)) {
    return null;
  }

  const neg = t.startsWith("-");
  if (neg && !opts.allowNegative) return null;
  const body = neg ? t.slice(1) : t;
  const parts = body.split("/");
  const numPart = parts[0]!;
  const denPart = parts[1];
  const num = Number(numPart);
  const den = denPart === undefined ? 1 : Number(denPart);
  if (!Number.isInteger(num) || !Number.isInteger(den) || den <= 0) return null;
  const signed = neg ? -num : num;
  if (signed === 0) return null;
  if (!opts.allowNegative && signed < 0) return null;
  return simplifyRat(signed, den);
}

/** @deprecated 양의 정수만 — parseRational 권장 */
export function parsePositiveInt(raw: string): number | null {
  const r = parseRational(raw, { allowNegative: false });
  if (!r || r.den !== 1 || r.num <= 0) return null;
  return r.num;
}

/** 입력 중 허용 문자만 남김 (계수: −와 /) */
export function sanitizeCoeffInput(raw: string): string {
  let s = raw.replace(/[^\d\-/]/g, "").slice(0, 10);
  // 맨 앞 −만 허용
  const hasNeg = s.startsWith("-");
  s = (hasNeg ? "-" : "") + s.replace(/-/g, "");
  // / 는 하나
  const slash = s.indexOf("/");
  if (slash !== -1) {
    s =
      s.slice(0, slash + 1) +
      s
        .slice(slash + 1)
        .replace(/\//g, "")
        .replace(/-/g, "");
  }
  return s;
}

/** 근호 안: 숫자와 / 만 (음수 불가) */
export function sanitizeRadicandInput(raw: string): string {
  let s = raw.replace(/[^\d/]/g, "").slice(0, 10);
  const slash = s.indexOf("/");
  if (slash !== -1) {
    s = s.slice(0, slash + 1) + s.slice(slash + 1).replace(/\//g, "");
  }
  return s;
}

/** 계수·근호에 채운 모든 유리수 (빈 칸 제외) */
export function collectFilledRationals(
  problem: RadicalProblem,
  fills: TermFill[],
): Rational[] {
  const nums: Rational[] = [];
  for (let i = 0; i < problem.terms.length; i++) {
    const term = problem.terms[i]!;
    const fill = fills[i];
    if (!fill) continue;
    if (term.hasCoeff && fill.coeff != null) nums.push(fill.coeff);
    if (fill.radicand != null) nums.push(fill.radicand);
  }
  return nums;
}

export function allDistinctRationals(nums: Rational[]): boolean {
  const keys = nums.map(ratKey);
  return new Set(keys).size === keys.length;
}

export function hasDuplicateAmongFills(
  problem: RadicalProblem,
  fills: TermFill[],
): boolean {
  return !allDistinctRationals(collectFilledRationals(problem, fills));
}

function fillsComplete(problem: RadicalProblem, fills: TermFill[]): boolean {
  if (fills.length !== problem.terms.length) return false;
  for (let i = 0; i < problem.terms.length; i++) {
    const term = problem.terms[i]!;
    const fill = fills[i]!;
    if (term.hasCoeff) {
      if (fill.coeff == null || fill.coeff.num === 0) return false;
    }
    if (fill.radicand == null || fill.radicand.num <= 0) return false;
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
  const nums = collectFilledRationals(problem, fills);
  if (
    nums.some(
      (n) =>
        !Number.isInteger(n.num) ||
        !Number.isInteger(n.den) ||
        n.den <= 0,
    )
  ) {
    return { ok: false, reason: "invalid" };
  }
  // 근호 안 음수 재확인
  for (let i = 0; i < problem.terms.length; i++) {
    const fill = fills[i]!;
    if (fill.radicand && fill.radicand.num < 0) {
      return { ok: false, reason: "invalid" };
    }
  }
  if (!allDistinctRationals(nums)) {
    return { ok: false, reason: "duplicate" };
  }

  const termMaps: RadicalMap[] = problem.terms.map((term, i) => {
    const fill = fills[i]!;
    const coeff = term.hasCoeff ? fill.coeff! : rat(1);
    return termToMap(coeff, fill.radicand!);
  });

  const lhs = evalExpression(termMaps, problem.ops);
  if (!lhs) return { ok: false, reason: "wrong" };
  const rhs = mapFromFixed(problem.rhs);
  if (!mapsEqual(lhs, rhs)) return { ok: false, reason: "wrong" };
  return { ok: true, reason: "ok" };
}

/**
 * 틀린 횟수에 따라 감점. 0회 → 100, 이후 회당 −15, 하한 40.
 * (포기하면 UI에서 0점 처리 — 이 함수는 정답 제출 시에만 사용)
 */
export function scoreForAttempts(wrongCount: number): number {
  const w = Math.max(0, Math.floor(wrongCount));
  return Math.max(
    MIN_CORRECT_SCORE,
    MAX_CORRECT_SCORE - w * WRONG_PENALTY,
  );
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
    terms: [{ hasCoeff: false }, { hasCoeff: false }, { hasCoeff: false }],
    ops: ["+", "-"],
    rhs: [{ coeff: 5, radicand: 2 }],
  },
  {
    id: "p2",
    terms: [{ hasCoeff: false }, { hasCoeff: false }, { hasCoeff: false }],
    ops: ["+", "-"],
    rhs: [{ coeff: 3, radicand: 3 }],
  },
  {
    id: "p3",
    terms: [{ hasCoeff: false }, { hasCoeff: false }, { hasCoeff: false }],
    ops: ["-", "+"],
    rhs: [{ coeff: 4, radicand: 5 }],
  },
  // 4–6: 계수 포함 가감
  {
    id: "p4",
    terms: [{ hasCoeff: true }, { hasCoeff: false }, { hasCoeff: true }],
    ops: ["+", "-"],
    rhs: [{ coeff: 5, radicand: 2 }],
  },
  {
    id: "p5",
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
    { coeff: null, radicand: rat(32) },
    { coeff: null, radicand: rat(18) },
    { coeff: null, radicand: rat(8) },
  ],
  // √48 + √3 − √12 = 3√3
  [
    { coeff: null, radicand: rat(48) },
    { coeff: null, radicand: rat(3) },
    { coeff: null, radicand: rat(12) },
  ],
  // √45 − √5 + √20 = 4√5
  [
    { coeff: null, radicand: rat(45) },
    { coeff: null, radicand: rat(5) },
    { coeff: null, radicand: rat(20) },
  ],
  // 3√8 + √50 − 2√18 = 5√2
  [
    { coeff: rat(3), radicand: rat(8) },
    { coeff: null, radicand: rat(50) },
    { coeff: rat(2), radicand: rat(18) },
  ],
  // 2√12 + √27 − 1√75 − √5 = 2√3 − √5
  [
    { coeff: rat(2), radicand: rat(12) },
    { coeff: null, radicand: rat(27) },
    { coeff: rat(1), radicand: rat(75) },
    { coeff: null, radicand: rat(5) },
  ],
  // 3√8 + √18 − 2√32 + √50 = 6√2
  [
    { coeff: rat(3), radicand: rat(8) },
    { coeff: null, radicand: rat(18) },
    { coeff: rat(2), radicand: rat(32) },
    { coeff: null, radicand: rat(50) },
  ],
  // 1√32 + √8 − 2√3 − √18 = 3√2 − 2√3
  [
    { coeff: rat(1), radicand: rat(32) },
    { coeff: null, radicand: rat(8) },
    { coeff: rat(2), radicand: rat(3) },
    { coeff: null, radicand: rat(18) },
  ],
  // 1√108 − √48 + 2√3 − √7 = 4√3 − √7
  [
    { coeff: rat(1), radicand: rat(108) },
    { coeff: null, radicand: rat(48) },
    { coeff: rat(2), radicand: rat(3) },
    { coeff: null, radicand: rat(7) },
  ],
  // 3√2 × √12 ÷ 1√4 − √54 ÷ √9 = 2√6
  [
    { coeff: rat(3), radicand: rat(2) },
    { coeff: null, radicand: rat(12) },
    { coeff: rat(1), radicand: rat(4) },
    { coeff: null, radicand: rat(54) },
    { coeff: null, radicand: rat(9) },
  ],
  // 4√8 × √18 ÷ 6√2 + √32 ÷ √16 = 5√2
  [
    { coeff: rat(4), radicand: rat(8) },
    { coeff: null, radicand: rat(18) },
    { coeff: rat(6), radicand: rat(2) },
    { coeff: null, radicand: rat(32) },
    { coeff: null, radicand: rat(16) },
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
