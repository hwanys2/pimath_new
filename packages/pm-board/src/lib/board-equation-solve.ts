export type SolveResult = {
  steps: string[];
  answerLatex: string;
  warnings?: string;
};

/** Local fallback for school-level equations/inequalities (no API). */
export function solveLocally(
  expr: string,
  kind: "equation" | "inequality",
): SolveResult | null {
  const s = expr
    .replace(/\s+/g, "")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/−/g, "-");

  if (kind === "inequality") {
    return solveInequalityLocal(s);
  }
  return solveEquationLocal(s);
}

function solveEquationLocal(s: string): SolveResult | null {
  const parts = s.split("=");
  if (parts.length !== 2) return null;
  let left = parts[0];
  let right = parts[1];
  if (!left.includes("x") && right.includes("x")) {
    [left, right] = [right, left];
  }
  if (!left.includes("x")) return null;

  const linear = matchLinear(left, right);
  if (linear) {
    const { a, b } = linear;
    if (Math.abs(a) < 1e-12) return null;
    const x = -b / a;
    return {
      steps: [
        `일차방정식 $${formatLinear(a, b)} = 0$`,
        `$x = ${formatNum(-b)}/${formatNum(a)} = ${formatNum(x)}$`,
      ],
      answerLatex: `x = ${formatNum(x)}`,
    };
  }

  const quad = matchQuadratic(left, right);
  if (quad) {
    const { a, b, c } = quad;
    const D = b * b - 4 * a * c;
    const steps = [
      `이차방정식 $${a}x^2 ${b >= 0 ? "+" : ""}${b}x ${c >= 0 ? "+" : ""}${c} = 0$`,
      `판별식 $D = ${b}^2 - 4 \\cdot ${a} \\cdot ${c} = ${D}$`,
    ];
    if (D < 0) {
      return {
        steps: [...steps, "실근이 없습니다."],
        answerLatex: "\\text{실근 없음}",
      };
    }
    const sqrtD = Math.sqrt(D);
    const x1 = (-b + sqrtD) / (2 * a);
    const x2 = (-b - sqrtD) / (2 * a);
    steps.push(
      `$x = \\frac{-${b} \\pm \\sqrt{${D}}}{${2 * a}}$`,
      D === 0
        ? `$x = ${formatNum(x1)}$`
        : `$x_1 = ${formatNum(x1)},\\quad x_2 = ${formatNum(x2)}$`,
    );
    return {
      steps,
      answerLatex:
        D === 0
          ? `x = ${formatNum(x1)}`
          : `x = ${formatNum(x1)} \\text{ 또는 } x = ${formatNum(x2)}`,
    };
  }

  const pure = s.match(/^x\^2=(-?\d+(?:\.\d+)?)$/);
  if (pure) {
    const k = parseFloat(pure[1]);
    if (k < 0) {
      return {
        steps: ["$x^2 = " + k + "$", "실수 해가 없습니다."],
        answerLatex: "\\text{실근 없음}",
      };
    }
    const r = Math.sqrt(k);
    return {
      steps: [
        `$x^2 = ${k}$`,
        `$x = \\pm\\sqrt{${k}} = \\pm ${formatNum(r)}$`,
      ],
      answerLatex: `x = \\pm ${formatNum(r)}`,
    };
  }

  return null;
}

function solveInequalityLocal(s: string): SolveResult | null {
  const m = s.match(/^(.+?)(<=|>=|<|>)(.+)$/);
  if (!m) return null;
  let left = m[1];
  const op = m[2];
  let right = m[3];
  if (!left.includes("x") && right.includes("x")) {
    [left, right] = [right, left];
  }
  const linear = matchLinear(left, right);
  if (!linear) return null;
  const { a, b } = linear;
  if (Math.abs(a) < 1e-12) return null;
  const boundary = -b / a;
  const flip = a < 0;
  let interval: string;
  const effective = flip ? flipOp(op) : op;
  if (effective === ">" || effective === ">=") {
    interval = `${effective === ">" ? "(" : "["}${formatNum(boundary)}, \\infty)`;
  } else {
    interval = `${effective === "<" ? "(" : "["}-\\infty, ${formatNum(boundary)}${effective === "<=" ? "]" : ")"}`;
  }
  return {
    steps: [
      `일차부등식 $${formatLinear(a, b)} ${op} 0$`,
      `양변을 ${formatNum(a)}로 나눕니다${flip ? " (부등호 방향 반전)" : ""}.`,
      `$x ${effective} ${formatNum(boundary)}$`,
    ],
    answerLatex: interval,
  };
}

function flipOp(op: string): string {
  if (op === "<") return ">";
  if (op === ">") return "<";
  if (op === "<=") return ">=";
  if (op === ">=") return "<=";
  return op;
}

function matchLinear(
  left: string,
  right: string,
): { a: number; b: number } | null {
  const moved = moveToZero(left, right);
  const m = moved.match(/^([+-]?(?:\d+(?:\.\d+)?)?)x([+-]\d+(?:\.\d+)?)?$/);
  if (!m) {
    const m2 = moved.match(/^([+-]?\d+(?:\.\d+)?)x$/);
    if (m2) return { a: parseFloat(m2[1]), b: 0 };
    return null;
  }
  const a =
    m[1] === "" || m[1] === "+" ? 1 : m[1] === "-" ? -1 : parseFloat(m[1]);
  const b = m[2] ? parseFloat(m[2]) : 0;
  return { a, b };
}

function matchQuadratic(
  left: string,
  right: string,
): { a: number; b: number; c: number } | null {
  const moved = moveToZero(left, right);
  const re =
    /^([+-]?(?:\d+(?:\.\d+)?)?)x\^2([+-](?:\d+(?:\.\d+)?)?x)?([+-]\d+(?:\.\d+)?)?$/;
  const m = moved.match(re);
  if (!m) return null;
  const a =
    m[1] === "" || m[1] === "+" ? 1 : m[1] === "-" ? -1 : parseFloat(m[1]);
  let b = 0;
  if (m[2]) {
    const raw = m[2];
    b = raw === "+x" || raw === "x" ? 1 : raw === "-x" ? -1 : parseFloat(raw);
  }
  const c = m[3] ? parseFloat(m[3]) : 0;
  return { a, b, c };
}

function moveToZero(left: string, right: string): string {
  if (right === "0") return left;
  return `${left}-(${right})`;
}

function formatLinear(a: number, b: number): string {
  const ax = a === 1 ? "x" : a === -1 ? "-x" : `${a}x`;
  if (b === 0) return ax;
  return `${ax}${b >= 0 ? "+" : ""}${b}`;
}

function formatNum(n: number): string {
  const r = Math.round(n * 1e6) / 1e6;
  return Number.isInteger(r) ? String(r) : String(r);
}
