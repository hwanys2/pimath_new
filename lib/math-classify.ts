export type MathKind = "function" | "equation" | "inequality" | "display";

export type ClassifiedMath = {
  kind: MathKind;
  graphable: boolean;
  solvable: boolean;
};

function normalize(s: string): string {
  return s
    .replace(/\s+/g, "")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/−/g, "-");
}

export function classifyMathInput(latex: string, expr: string): ClassifiedMath {
  const raw = normalize(expr || latex);
  if (!raw) {
    return { kind: "display", graphable: false, solvable: false };
  }

  const hasIneq = /(?:<=|>=|<>|<|>)/.test(raw);
  if (hasIneq) {
    return { kind: "inequality", graphable: true, solvable: true };
  }

  const hasEq = raw.includes("=");
  if (hasEq) {
    const fnLike =
      /^y=/i.test(raw) ||
      /^f\s*\(\s*x\s*\)\s*=/i.test(raw) ||
      (/=/.test(raw) && !raw.match(/[^=]=/) && raw.split("=").length === 2);
    if (/^y=/i.test(raw) || /^f\s*\(\s*x\s*\)\s*=/i.test(raw)) {
      return { kind: "function", graphable: true, solvable: false };
    }
    if (raw.includes("x")) {
      return { kind: "equation", graphable: true, solvable: true };
    }
    if (fnLike) {
      return { kind: "function", graphable: true, solvable: false };
    }
    return { kind: "equation", graphable: false, solvable: true };
  }

  if (/x/i.test(raw)) {
    return { kind: "function", graphable: true, solvable: false };
  }

  return { kind: "display", graphable: false, solvable: false };
}
