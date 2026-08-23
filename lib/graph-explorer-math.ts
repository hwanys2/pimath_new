/**
 * 그래프 탐구 도구용 안전한 수식 파서/평가기.
 * packages/pm-board/src/lib/board-math.ts 의 검증된 파서를 기반으로 함.
 * eval / Function 생성자 없음.
 *
 * 지원: + - * / ^ ( ), 단항 마이너스, 암시적 곱셈(2x, 3(x+1)),
 * 변수 x, 상수 pi/π/e, 함수 sin cos tan sqrt abs log(=log10) ln exp
 * floor ceil round.
 */

type TokenType = "num" | "name" | "op" | "lparen" | "rparen";
type Token = { type: TokenType; value: string };

const FUNCTIONS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  "π": Math.PI,
  e: Math.E,
};

function tokenize(input: string): Token[] | null {
  const src = input
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const num = src.slice(i, j);
      if ((num.match(/\./g) ?? []).length > 1) return null;
      tokens.push({ type: "num", value: num });
      i = j;
    } else if (/[a-zA-Zπ]/.test(ch)) {
      let j = i;
      while (j < src.length && /[a-zA-Zπ]/.test(src[j])) j++;
      let word = src.slice(i, j);
      // 이어 붙은 이름 분해: "xsinx" → x, sin, x
      while (word.length > 0) {
        let matched = "";
        for (const fn of Object.keys(FUNCTIONS)) {
          if (word.startsWith(fn) && fn.length > matched.length) matched = fn;
        }
        if (!matched && word.startsWith("pi")) matched = "pi";
        if (!matched && (word[0] === "x" || word[0] === "e" || word[0] === "π"))
          matched = word[0];
        if (!matched) return null;
        tokens.push({ type: "name", value: matched });
        word = word.slice(matched.length);
      }
      i = j;
    } else if ("+-*/^".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
    } else if (ch === "(") {
      tokens.push({ type: "lparen", value: "(" });
      i++;
    } else if (ch === ")") {
      tokens.push({ type: "rparen", value: ")" });
      i++;
    } else {
      return null;
    }
  }

  // 암시적 곱셈 삽입: (num|x|const|`)`) 다음에 (num|name|`(`)
  const out: Token[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (out.length > 0) {
      const prev = out[out.length - 1];
      const prevIsValue =
        prev.type === "num" ||
        prev.type === "rparen" ||
        (prev.type === "name" && !(prev.value in FUNCTIONS));
      const currStartsValue =
        t.type === "num" || t.type === "name" || t.type === "lparen";
      if (prevIsValue && currStartsValue) {
        out.push({ type: "op", value: "*" });
      }
    }
    out.push(t);
  }
  return out;
}

export type CompiledExpr = (x: number) => number;

/** 컴파일된 평가 함수를 반환. 유효하지 않으면 null. */
export function compileExpression(input: string): CompiledExpr | null {
  const tokens = tokenize(input);
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr(): CompiledExpr | null {
    let left: CompiledExpr | null = parseTerm();
    if (!left) return null;
    while (
      peek()?.type === "op" &&
      (peek().value === "+" || peek().value === "-")
    ) {
      const op = next().value;
      const right = parseTerm();
      if (!right) return null;
      const l: CompiledExpr = left;
      left = op === "+" ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
    }
    return left;
  }

  function parseTerm(): CompiledExpr | null {
    let left: CompiledExpr | null = parseUnary();
    if (!left) return null;
    while (
      peek()?.type === "op" &&
      (peek().value === "*" || peek().value === "/")
    ) {
      const op = next().value;
      const right = parseUnary();
      if (!right) return null;
      const l: CompiledExpr = left;
      left = op === "*" ? (x) => l(x) * right(x) : (x) => l(x) / right(x);
    }
    return left;
  }

  function parseUnary(): CompiledExpr | null {
    if (peek()?.type === "op" && peek().value === "-") {
      next();
      const inner = parseUnary();
      if (!inner) return null;
      return (x) => -inner(x);
    }
    if (peek()?.type === "op" && peek().value === "+") {
      next();
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower(): CompiledExpr | null {
    const base = parseAtom();
    if (!base) return null;
    if (peek()?.type === "op" && peek().value === "^") {
      next();
      const exp = parseUnary(); // 우결합, 2^-x 허용
      if (!exp) return null;
      return (x) => Math.pow(base(x), exp(x));
    }
    return base;
  }

  function parseAtom(): CompiledExpr | null {
    const t = peek();
    if (!t) return null;
    if (t.type === "num") {
      next();
      const v = parseFloat(t.value);
      if (!Number.isFinite(v)) return null;
      return () => v;
    }
    if (t.type === "name") {
      next();
      if (t.value === "x") return (x) => x;
      if (t.value in CONSTANTS) {
        const c = CONSTANTS[t.value];
        return () => c;
      }
      if (t.value in FUNCTIONS) {
        const fn = FUNCTIONS[t.value];
        if (peek()?.type !== "lparen") return null;
        next();
        const arg = parseExpr();
        if (!arg) return null;
        if (peek()?.type !== "rparen") return null;
        next();
        return (x) => fn(arg(x));
      }
      return null;
    }
    if (t.type === "lparen") {
      next();
      const inner = parseExpr();
      if (!inner) return null;
      if (peek()?.type !== "rparen") return null;
      next();
      return inner;
    }
    return null;
  }

  const compiled = parseExpr();
  if (!compiled || pos !== tokens.length) return null;
  return compiled;
}

/** `y=` / `f(x)=` 접두어 제거. */
export function normalizeGraphExpression(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^\s*y\s*=\s*/i, "");
  s = s.replace(/^\s*f\s*\(\s*x\s*\)\s*=\s*/i, "");
  return s.trim();
}

/**
 * 학생이 입력한 좌표값(예: "3", "-1.5", "3/2", "1/3") 하나를 숫자로 파싱.
 * 수식 파서를 재사용하므로 분수 입력도 자연스럽게 지원한다.
 * 변수 x가 들어간 입력은 거부.
 */
export function parseCoordinate(raw: string): number | null {
  const s = raw.trim();
  if (!s || s.length > 24) return null;
  if (/x/i.test(s)) return null;
  const fn = compileExpression(s);
  if (!fn) return null;
  const v = fn(0);
  return Number.isFinite(v) ? v : null;
}

export type PointCheck =
  | { status: "correct" }
  | { status: "wrong"; expected: number }
  | { status: "undefined_at_x" };

/** 순서쌍 (x, y)가 y = f(x)를 허용오차 내에서 만족하는지 판정. */
export function checkPoint(
  fn: CompiledExpr,
  x: number,
  y: number,
  tolerance: number,
): PointCheck {
  const expected = fn(x);
  if (!Number.isFinite(expected)) {
    return { status: "undefined_at_x" };
  }
  if (Math.abs(expected - y) <= tolerance + 1e-12) {
    return { status: "correct" };
  }
  return { status: "wrong", expected };
}

/** 좌표평면 표시용 숫자 포맷. */
export function formatCoord(v: number): string {
  if (Number.isInteger(v)) return String(v);
  const rounded = parseFloat(v.toPrecision(6));
  return String(rounded);
}
