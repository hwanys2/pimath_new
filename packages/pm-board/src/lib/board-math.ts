/**
 * Tiny safe math expression parser/evaluator for the whiteboard
 * (function grapher + calculator). No eval, no Function constructor.
 *
 * Supports: + - * / ^ ( ), unary minus, implicit multiplication (2x, 3(x+1)),
 * variable x, constants pi/π/e, functions sin cos tan asin acos atan
 * sqrt abs log(=log10) ln exp floor ceil round.
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

function tokenize(
  input: string,
  options?: { allowParameterNames?: boolean },
): Token[] | null {
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
      // Greedily split concatenated names, e.g. "xsinx" → x, sin, x
      while (word.length > 0) {
        let matched = "";
        for (const fn of Object.keys(FUNCTIONS)) {
          if (word.startsWith(fn) && fn.length > matched.length) matched = fn;
        }
        if (!matched && word.startsWith("pi")) matched = "pi";
        if (
          !matched &&
          options?.allowParameterNames &&
          word.length >= 1 &&
          /^[a-zA-Z]$/.test(word[0])
        ) {
          matched = word[0];
        }
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

  // Insert implicit multiplication: (num|x|const|`)`) followed by (num|name|`(`)
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

/** Returns a compiled evaluator, or null if the expression is invalid. */
export function compileExpression(
  input: string,
  params?: Record<string, number>,
): CompiledExpr | null {
  const tokens = tokenize(input, {
    allowParameterNames: params !== undefined,
  });
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr(): CompiledExpr | null {
    let left: CompiledExpr | null = parseTerm();
    if (!left) return null;
    while (peek()?.type === "op" && (peek().value === "+" || peek().value === "-")) {
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
    while (peek()?.type === "op" && (peek().value === "*" || peek().value === "/")) {
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
      const exp = parseUnary(); // right-associative, allows 2^-x
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
      if (params && t.value in params) {
        const pv = params[t.value];
        return () => pv;
      }
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

/** Evaluate a constant expression (calculator). Returns null on error. */
export function evaluateExpression(input: string): number | null {
  const fn = compileExpression(input);
  if (!fn) return null;
  const v = fn(0);
  return Number.isFinite(v) ? v : null;
}

/** Format a number for calculator display. */
export function formatNumber(v: number): string {
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  const rounded = parseFloat(v.toPrecision(12));
  return String(rounded);
}

const RESERVED_NAMES = new Set([
  "x",
  "e",
  "pi",
  "π",
  ...Object.keys(FUNCTIONS),
]);

/** Parameter letters in an expression (for sliders), excluding x and constants. */
export function listParameters(input: string): string[] {
  const tokens = tokenize(input, { allowParameterNames: true });
  if (!tokens) return [];
  const found = new Set<string>();
  for (const t of tokens) {
    if (t.type !== "name") continue;
    if (RESERVED_NAMES.has(t.value)) continue;
    if (t.value.length !== 1) continue;
    found.add(t.value);
  }
  return [...found].sort();
}

export function defaultParamValues(names: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of names) {
    out[n] = n === "b" || n === "c" ? 0 : 1;
  }
  return out;
}

/** Strip y= / f(x)= prefix for graphing. */
export function normalizeGraphExpression(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^\s*y\s*=\s*/i, "");
  s = s.replace(/^\s*f\s*\(\s*x\s*\)\s*=\s*/i, "");
  return s.trim();
}
