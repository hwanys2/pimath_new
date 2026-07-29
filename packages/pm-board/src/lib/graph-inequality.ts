import {
  compileExpression,
  normalizeGraphExpression,
} from "./board-math";
import type { PlotView } from "./graph-plot";
import { DEFAULT_PLOT_VIEW } from "./graph-plot";

export type InequalityOp = ">" | "<" | ">=" | "<=";

export type ParsedInequality =
  | {
      type: "x";
      op: InequalityOp;
      boundary: number;
    }
  | {
      type: "y";
      op: InequalityOp;
      expr: string;
    }
  | {
      type: "fx";
      op: InequalityOp;
      expr: string;
    };

function flipOp(op: InequalityOp): InequalityOp {
  const map: Record<InequalityOp, InequalityOp> = {
    ">": "<",
    "<": ">",
    ">=": "<=",
    "<=": ">=",
  };
  return map[op];
}

export function parseInequality(input: string): ParsedInequality | null {
  const s = input
    .replace(/\s+/g, "")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/−/g, "-");
  const m = s.match(/^(.+?)(<=|>=|<|>)(.+)$/);
  if (!m) return null;
  let left = m[1];
  const op = m[2] as InequalityOp;
  let right = m[3];

  if (/^y$/i.test(left)) {
    return { type: "y", op, expr: normalizeGraphExpression(right) };
  }
  if (/^y$/i.test(right)) {
    return {
      type: "y",
      op: flipOp(op),
      expr: normalizeGraphExpression(left),
    };
  }

  const xOnly = left.match(/^x(<=|>=|<|>)(-?\d+(?:\.\d+)?)$/);
  if (xOnly) {
    return {
      type: "x",
      op: xOnly[1] as InequalityOp,
      boundary: parseFloat(xOnly[2]),
    };
  }

  if (!left.includes("x") && right.includes("x")) {
    return parseInequality(`${right}${flipOp(op)}${left}`);
  }

  const lhs = normalizeGraphExpression(left);
  const rhs = normalizeGraphExpression(right);
  const diff = `${lhs}-(${rhs})`;
  return { type: "fx", op, expr: diff };
}

export function inequalityShadePath(
  parsed: ParsedInequality,
  view: PlotView,
  w: number,
  h: number,
): string {
  const sx = w / (view.xMax - view.xMin);
  const sy = h / (view.yMax - view.yMin);
  const toPx = {
    x: (x: number) => (x - view.xMin) * sx,
    y: (y: number) => h - (y - view.yMin) * sy,
  };

  if (parsed.type === "x") {
    const bx = toPx.x(parsed.boundary);
    const fillRight = parsed.op === ">" || parsed.op === ">=";
    const x0 = fillRight ? bx : 0;
    const x1 = fillRight ? w : bx;
    return `M${x0},0 L${x1},0 L${x1},${h} L${x0},${h} Z`;
  }

  const expr = parsed.expr;
  const fn = compileExpression(expr);
  if (!fn) return "";
  const step = (view.xMax - view.xMin) / Math.max(w, 80);
  const pts: { x: number; y: number }[] = [];
  for (let x = view.xMin; x <= view.xMax + step; x += step) {
    const y = fn(x);
    if (Number.isFinite(y)) pts.push({ x: toPx.x(x), y: toPx.y(y) });
  }
  if (pts.length < 2) return "";
  const above = parsed.op === ">" || parsed.op === ">=";
  const edgeY = above ? 0 : h;
  let d = `M${pts[0].x},${edgeY} L${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L${pts[i].x},${pts[i].y}`;
  }
  d += ` L${pts[pts.length - 1].x},${edgeY} Z`;
  return d;
}

export { DEFAULT_PLOT_VIEW };
