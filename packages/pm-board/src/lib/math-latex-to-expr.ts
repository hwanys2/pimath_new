/**
 * Heuristic LaTeX (Mathpix) → board-math expression syntax.
 */

export function latexToExpr(latex: string): string {
  let s = latex.trim();
  s = s.replace(/^\$+|\$+$/g, "");
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\cdot/g, "*");
  s = s.replace(/\\times/g, "*");
  s = s.replace(/\\div/g, "/");
  s = s.replace(/\\pi/g, "pi");
  s = s.replace(/\\infty/g, "");

  for (let i = 0; i < 8; i++) {
    const next = s.replace(
      /\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
      "($1)/($2)",
    );
    if (next === s) break;
    s = next;
  }

  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)");
  s = s.replace(/\\sqrt\[(\d+)\]\{([^{}]*)\}/g, "($2)^(1/$1)");

  const trig = ["sin", "cos", "tan", "log", "ln", "exp", "abs"] as const;
  for (const fn of trig) {
    s = s.replace(new RegExp(`\\\\${fn}`, "g"), fn);
  }

  s = s.replace(/\^\{([^{}]*)\}/g, "^$1");
  s = s.replace(/\^([0-9a-zA-Z])/g, "^$1");
  s = s.replace(/_\{([^{}]*)\}/g, "_$1");

  s = s.replace(/[{}]/g, "");
  s = s.replace(/\\/g, "");
  s = s.replace(/\s+/g, "");
  s = s.replace(/−/g, "-");

  return s;
}
