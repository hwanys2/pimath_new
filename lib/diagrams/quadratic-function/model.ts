import { formatNiceCoeff, formatNiceNumber } from "@/lib/diagrams/math-label";
import {
  GRAPH_CYAN,
  GRAPH_INK,
  GRAPH_PINK,
  GRID_COLOR,
  clampRange,
  newId,
  type CoordPlaneState,
  type CoordStyle,
  type GraphLabelMode,
} from "@/lib/diagrams/coordinate-plane/model";

export {
  GRAPH_CYAN,
  GRAPH_INK,
  GRAPH_PINK,
  GRID_COLOR,
  GRID_GRAY,
  newId,
} from "@/lib/diagrams/coordinate-plane/model";
export type { CoordStyle, GraphLabelMode } from "@/lib/diagrams/coordinate-plane/model";

export const GRAPH_PURPLE = "#7b4fb2";
export const GRAPH_GREEN = "#4caf6a";
export const TRANSLATION_RED = "#e24a4a";
export const TRANSLATION_ORANGE = "#e8a045";
export const EXTREMA_HIGHLIGHT = "#fce4ec";

export type QuadraticKind = "quadratic" | "horizontal";

export type QuadraticGraph = {
  id: string;
  kind: QuadraticKind;
  a: number;
  p: number;
  q: number;
  color: string;
  width: number;
  labelMode: GraphLabelMode;
  letterA: string;
  letterP: string;
  letterQ: string;
  custom: string;
  labelDx: number;
  labelDy: number;
  showVertex: boolean;
  showVertexDrop: boolean;
  showVertexMarks: boolean;
  showAxisOfSymmetry: boolean;
  showExtrema: boolean;
  showXIntercept: boolean;
  showYIntercept: boolean;
  vertexLabelDx: number;
  vertexLabelDy: number;
  pMarkDx: number;
  pMarkDy: number;
  qMarkDx: number;
  qMarkDy: number;
  xiLabelDx: number;
  xiLabelDy: number;
  yiLabelDx: number;
  yiLabelDy: number;
};

export type QuadraticPoint = {
  id: string;
  graphId: string;
  name: string;
  x: number;
  showDot: boolean;
  showName: boolean;
  labelDx: number;
  labelDy: number;
  dropX: boolean;
  dropY: boolean;
  axisMarkX: boolean;
  axisMarkY: boolean;
};

export type TranslationKind = "horizontal" | "vertical" | "vertex";

export type Translation = {
  id: string;
  fromGraphId: string;
  toGraphId: string;
  kind: TranslationKind;
  /** horizontal → y values; vertical → x values */
  values: number[];
  color: string;
  showDelta: boolean;
  deltaDx: number;
  deltaDy: number;
};

export type QuadraticFunctionState = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xTick: number;
  yTick: number;
  xLabelEvery: number;
  yLabelEvery: number;
  showGrid: boolean;
  showArrows: boolean;
  showOrigin: boolean;
  showTickLabels: boolean;
  showTicks: boolean;
  xAxisLabel: string;
  yAxisLabel: string;
  originLabel: string;
  xAxisLabelDx: number;
  xAxisLabelDy: number;
  yAxisLabelDx: number;
  yAxisLabelDy: number;
  yLabelVertical: boolean;
  graphs: QuadraticGraph[];
  points: QuadraticPoint[];
  translations: Translation[];
  style: CoordStyle;
};

const DEFAULT_STYLE: CoordStyle = {
  lineWidth: 1.8,
  fontSize: 22,
  pointLabelSize: 28,
  axisNameSize: 28,
  equationSize: 26,
  pointRadius: 4.2,
  graphWidth: 2.5,
  padding: 80,
  exportScale: 3,
  gridColor: GRID_COLOR,
};

const POINT_NAMES = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function nextPointName(existing: { name: string }[]): string {
  const used = new Set(existing.map((p) => p.name.trim().toUpperCase()));
  for (const ch of POINT_NAMES) {
    if (!used.has(ch)) return ch;
  }
  return `P${existing.length + 1}`;
}

export function isHorizontal(graph: Pick<QuadraticGraph, "kind">): boolean {
  return graph.kind === "horizontal";
}

export function yOnParabola(
  graph: Pick<QuadraticGraph, "kind" | "a" | "p" | "q">,
  x: number,
): number {
  if (isHorizontal(graph)) return graph.q;
  return graph.a * (x - graph.p) ** 2 + graph.q;
}

export function vertexOf(
  graph: Pick<QuadraticGraph, "kind" | "p" | "q">,
): { x: number; y: number } {
  return { x: graph.p, y: graph.q };
}

export function yIntercept(
  graph: Pick<QuadraticGraph, "kind" | "a" | "p" | "q">,
): number | null {
  if (isHorizontal(graph)) return null;
  return yOnParabola(graph, 0);
}

export function xIntercepts(
  graph: Pick<QuadraticGraph, "kind" | "a" | "p" | "q">,
): number[] {
  if (isHorizontal(graph)) return [];
  if (Math.abs(graph.a) < 1e-12) return [];
  const t = -graph.q / graph.a;
  if (t < -1e-12) return [];
  if (Math.abs(t) < 1e-12) return [graph.p];
  const r = Math.sqrt(t);
  return [graph.p - r, graph.p + r].sort((a, b) => a - b);
}

export function isMinimum(
  graph: Pick<QuadraticGraph, "kind" | "a">,
): boolean {
  return !isHorizontal(graph) && graph.a > 0;
}

export function xAtY(
  graph: Pick<QuadraticGraph, "kind" | "a" | "p" | "q">,
  y: number,
  branch: "left" | "right",
): number | null {
  if (isHorizontal(graph)) return null;
  const inner = (y - graph.q) / graph.a;
  if (inner < -1e-12) return null;
  const r = inner <= 1e-12 ? 0 : Math.sqrt(inner);
  const xl = graph.p - r;
  const xr = graph.p + r;
  return branch === "left" ? xl : xr;
}

function clampOffset(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(80, Math.max(-80, value as number));
}

export function makeQuadratic(
  partial: Partial<QuadraticGraph> & { a: number },
): QuadraticGraph {
  return {
    id: partial.id ?? newId("g"),
    kind: partial.kind ?? "quadratic",
    a: partial.a,
    p: partial.p ?? 0,
    q: partial.q ?? 0,
    color: partial.color ?? GRAPH_PINK,
    width: partial.width ?? 0,
    labelMode: partial.labelMode ?? "auto",
    letterA: partial.letterA ?? "a",
    letterP: partial.letterP ?? "p",
    letterQ: partial.letterQ ?? "q",
    custom: partial.custom ?? "",
    labelDx: partial.labelDx ?? 0,
    labelDy: partial.labelDy ?? 0,
    showVertex: partial.showVertex ?? false,
    showVertexDrop: partial.showVertexDrop ?? false,
    showVertexMarks: partial.showVertexMarks ?? false,
    showAxisOfSymmetry: partial.showAxisOfSymmetry ?? false,
    showExtrema: partial.showExtrema ?? false,
    showXIntercept: partial.showXIntercept ?? false,
    showYIntercept: partial.showYIntercept ?? false,
    vertexLabelDx: partial.vertexLabelDx ?? 0,
    vertexLabelDy: partial.vertexLabelDy ?? 0,
    pMarkDx: partial.pMarkDx ?? 0,
    pMarkDy: partial.pMarkDy ?? 14,
    qMarkDx: partial.qMarkDx ?? -10,
    qMarkDy: partial.qMarkDy ?? 0,
    xiLabelDx: partial.xiLabelDx ?? 0,
    xiLabelDy: partial.xiLabelDy ?? 0,
    yiLabelDx: partial.yiLabelDx ?? 0,
    yiLabelDy: partial.yiLabelDy ?? 0,
  };
}

export function makeHorizontal(
  partial: Partial<QuadraticGraph> & { q: number },
): QuadraticGraph {
  return makeQuadratic({
    ...partial,
    kind: "horizontal",
    a: 0,
    p: 0,
    q: partial.q,
  });
}

export function makePoint(
  partial: Partial<QuadraticPoint> & { graphId: string; x: number },
): QuadraticPoint {
  return {
    id: partial.id ?? newId("p"),
    graphId: partial.graphId,
    name: partial.name ?? "P",
    x: partial.x,
    showDot: partial.showDot ?? true,
    showName: partial.showName ?? false,
    labelDx: partial.labelDx ?? 10,
    labelDy: partial.labelDy ?? -12,
    dropX: partial.dropX ?? false,
    dropY: partial.dropY ?? false,
    axisMarkX: partial.axisMarkX ?? false,
    axisMarkY: partial.axisMarkY ?? false,
  };
}

export function makeTranslation(
  partial: Partial<Translation> & {
    fromGraphId: string;
    toGraphId: string;
    kind: TranslationKind;
    values: number[];
  },
): Translation {
  return {
    id: partial.id ?? newId("t"),
    fromGraphId: partial.fromGraphId,
    toGraphId: partial.toGraphId,
    kind: partial.kind,
    values: [...partial.values],
    color: partial.color ?? TRANSLATION_RED,
    showDelta: partial.showDelta ?? false,
    deltaDx: partial.deltaDx ?? 0,
    deltaDy: partial.deltaDy ?? 0,
  };
}

function formatParenShift(p: number): string {
  if (Math.abs(p) < 1e-9) return "x";
  if (p > 0) return `(x-${formatNiceCoeff(p)})`;
  return `(x+${formatNiceCoeff(-p)})`;
}

function formatSquareTerm(a: number): string {
  if (Math.abs(a) < 1e-9) return "0";
  const inner = formatParenShift(0);
  if (Math.abs(a - 1) < 1e-9) return `${inner}^2`;
  if (Math.abs(a + 1) < 1e-9) return `-${inner}^2`;
  return `${formatNiceCoeff(a)}${inner}^2`;
}

export function formatQuadraticEquation(
  a: number,
  p: number,
  q: number,
): string {
  if (Math.abs(a) < 1e-12) return `y=${formatNiceCoeff(q)}`;
  const sq = formatParenShift(p);
  let core: string;
  if (Math.abs(a - 1) < 1e-9) core = `${sq}^2`;
  else if (Math.abs(a + 1) < 1e-9) core = `-${sq}^2`;
  else core = `${formatNiceCoeff(a)}${sq}^2`;
  if (Math.abs(q) < 1e-9) return `y=${core}`;
  const qText = formatNiceCoeff(q);
  if (q > 0) return `y=${core}+${qText}`;
  return `y=${core}${qText}`;
}

function latexFracToSlash(text: string): string {
  return text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1/$2)");
}

export function equationPlainText(graph: QuadraticGraph): string {
  if (isHorizontal(graph)) return latexFracToSlash(`y=${formatNiceCoeff(graph.q)}`);
  return latexFracToSlash(formatQuadraticEquation(graph.a, graph.p, graph.q));
}

function parseNiceNumber(raw: string): number | null {
  let t = raw.trim().replace(/[()]/g, "");
  if (!t) return null;
  t = t.replace(/−/g, "-");
  const frac = t.match(/^([+-]?)(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const den = Number(frac[3]);
    if (den === 0) return null;
    const sign = frac[1] === "-" ? -1 : 1;
    return (sign * Number(frac[2])) / den;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type ParsedQuadratic = {
  kind: QuadraticKind;
  a: number;
  p: number;
  q: number;
};

function expandVertexForm(a: number, p: number, q: number) {
  const b = -2 * a * p;
  const c = a * p * p + q;
  return { a, b, c, p, q };
}

function fromStandard(a: number, b: number, c: number): ParsedQuadratic {
  if (Math.abs(a) < 1e-12) {
    return { kind: "horizontal", a: 0, p: 0, q: c };
  }
  const p = -b / (2 * a);
  const q = c - a * p * p;
  return { kind: "quadratic", a, p, q };
}

export function parseQuadraticEquation(raw: string): ParsedQuadratic | null {
  let s = raw
    .trim()
    .replace(/\$/g, "")
    .replace(/[ \t]/g, "")
    .replace(/[−–]/g, "-")
    .replace(/[＝=]/g, "=")
    .replace(/[＋]/g, "+")
    .replace(/\*/g, "")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1/$2)")
    .toLowerCase();
  if (!s) return null;

  if (/^y=/.test(s)) s = s.slice(2);
  if (!s.includes("x")) {
    const q = parseNiceNumber(s);
    if (q == null) return null;
    return { kind: "horizontal", a: 0, p: 0, q };
  }

  const vertexMatch = s.match(
    /^([+-])?(?:\(([^)]+)\)|(\d+(?:\/\d+)?|\d*\.\d+)?)?\(x([+-]\d+(?:\/\d+)?|\d*\.\d+)?\)\^2([+-]\d+(?:\/\d+)?|\d*\.\d+)?$/,
  );
  if (vertexMatch) {
    const sign = vertexMatch[1] === "-" ? -1 : 1;
    const coeffRaw = vertexMatch[2] ?? vertexMatch[3];
    let a = 1;
    if (coeffRaw != null && coeffRaw !== "") {
      const mag = parseNiceNumber(coeffRaw);
      if (mag == null) return null;
      a = sign * mag;
    } else if (sign < 0) a = -1;
    const shiftRaw = vertexMatch[4] ?? "";
    let p = 0;
    if (shiftRaw) {
      const shift = parseNiceNumber(shiftRaw);
      if (shift == null) return null;
      p = -shift;
    }
    const qRaw = vertexMatch[5] ?? "";
    let q = 0;
    if (qRaw) {
      const parsed = parseNiceNumber(qRaw);
      if (parsed == null) return null;
      q = parsed;
    }
    expandVertexForm(a, p, q);
    return { kind: "quadratic", a, p, q };
  }

  const simple = s.match(/^([+-])?(?:\(([^)]+)\)|(\d+(?:\/\d+)?|\d*\.\d+)?)?x\^2([+-]\d+(?:\/\d+)?|\d*\.\d+)?$/);
  if (simple) {
    const sign = simple[1] === "-" ? -1 : 1;
    const coeffRaw = simple[2] ?? simple[3];
    let a = sign;
    if (coeffRaw != null && coeffRaw !== "") {
      const mag = parseNiceNumber(coeffRaw);
      if (mag == null) return null;
      a = sign * mag;
    }
    const qRaw = simple[4] ?? "";
    let q = 0;
    if (qRaw) {
      const parsed = parseNiceNumber(qRaw);
      if (parsed == null) return null;
      q = parsed;
    }
    return { kind: "quadratic", a, p: 0, q };
  }

  const ax2 = s.match(/^([+-])?(?:\(([^)]+)\)|(\d+(?:\/\d+)?|\d*\.\d+)?)?x\^2/);
  if (ax2) {
    const rest = s.slice(ax2[0]!.length);
    const sign = ax2[1] === "-" ? -1 : 1;
    const coeffRaw = ax2[2] ?? ax2[3];
    let a = sign;
    if (coeffRaw != null && coeffRaw !== "") {
      const mag = parseNiceNumber(coeffRaw);
      if (mag == null) return null;
      a = sign * mag;
    }
    let b = 0;
    let c = 0;
    const bx = rest.match(/^([+-])(\d+(?:\/\d+)?|\d*\.\d+)?x/);
    if (bx) {
      const bSign = bx[1] === "-" ? -1 : 1;
      const bMag = bx[2] ? parseNiceNumber(bx[2]) : 1;
      if (bMag == null) return null;
      b = bSign * bMag;
    }
    const tail = bx ? rest.slice(bx[0]!.length) : rest;
    if (tail) {
      const cVal = parseNiceNumber(tail);
      if (cVal == null) return null;
      c = cVal;
    }
    return fromStandard(a, b, c);
  }

  const xOnly = s.match(/^([+-])?(?:\(([^)]+)\)|(\d+(?:\/\d+)?|\d*\.\d+)?)?x\^2$/);
  if (xOnly) {
    const sign = xOnly[1] === "-" ? -1 : 1;
    const coeffRaw = xOnly[2] ?? xOnly[3];
    let a = sign;
    if (coeffRaw != null && coeffRaw !== "") {
      const mag = parseNiceNumber(coeffRaw);
      if (mag == null) return null;
      a = sign * mag;
    }
    return { kind: "quadratic", a, p: 0, q: 0 };
  }

  return null;
}

export function graphFromParsed(
  parsed: ParsedQuadratic,
  color: string,
): QuadraticGraph {
  if (parsed.kind === "horizontal") {
    return makeHorizontal({ q: parsed.q, color, labelMode: "auto" });
  }
  return makeQuadratic({
    a: parsed.a,
    p: parsed.p,
    q: parsed.q,
    color,
    labelMode: "auto",
  });
}

export function addGraphFromEquation(
  state: QuadraticFunctionState,
  raw: string,
): QuadraticFunctionState | null {
  const parsed = parseQuadraticEquation(raw);
  if (!parsed) return null;
  const graph = graphFromParsed(parsed, nextGraphColor(state.graphs));
  return { ...state, graphs: [...state.graphs, graph] };
}

export function applyEquationToGraph(
  state: QuadraticFunctionState,
  graphId: string,
  raw: string,
): QuadraticFunctionState | null {
  const parsed = parseQuadraticEquation(raw);
  if (!parsed) return null;
  return {
    ...state,
    graphs: state.graphs.map((g) =>
      g.id === graphId
        ? {
            ...g,
            kind: parsed.kind,
            a: parsed.a,
            p: parsed.p,
            q: parsed.q,
            labelMode: g.labelMode === "hide" ? "hide" : "auto",
            custom: "",
          }
        : g,
    ),
  };
}

export function quadraticEquationText(graph: QuadraticGraph): string | null {
  if (graph.labelMode === "hide") return null;
  if (graph.labelMode === "custom") {
    return graph.custom.trim() || equationPlainText(graph);
  }
  if (isHorizontal(graph)) {
    if (graph.labelMode === "letter") {
      return `y=${graph.letterQ.trim() || "q"}`;
    }
    return `y=${formatNiceCoeff(graph.q)}`;
  }
  if (graph.labelMode === "letter") {
    const A = graph.letterA.trim() || "a";
    const P = graph.letterP.trim() || "p";
    const Q = graph.letterQ.trim() || "q";
    if (Math.abs(graph.p) < 1e-9 && Math.abs(graph.q) < 1e-9) {
      return `y=${A}x^2`;
    }
    if (Math.abs(graph.q) < 1e-9) {
      return `y=${A}(x-${P})^2`;
    }
    return `y=${A}(x-${P})^2+${Q}`;
  }
  return formatQuadraticEquation(graph.a, graph.p, graph.q);
}

export function graphStrokeWidth(
  graph: QuadraticGraph,
  fallback: number,
): number {
  return graph.width > 0 ? graph.width : fallback;
}

const GRAPH_COLORS = [
  GRAPH_PINK,
  GRAPH_CYAN,
  GRAPH_INK,
  GRAPH_PURPLE,
  GRAPH_GREEN,
];

export function nextGraphColor(existing: QuadraticGraph[]): string {
  return GRAPH_COLORS[existing.length % GRAPH_COLORS.length]!;
}

function baseState(
  partial: Partial<QuadraticFunctionState> = {},
): QuadraticFunctionState {
  return normalizeState({
    xMin: -6,
    xMax: 6,
    yMin: -6,
    yMax: 6,
    xTick: 1,
    yTick: 1,
    xLabelEvery: 2,
    yLabelEvery: 2,
    showGrid: true,
    showArrows: true,
    showOrigin: true,
    showTickLabels: true,
    showTicks: true,
    xAxisLabel: "$x$",
    yAxisLabel: "$y$",
    originLabel: "O",
    xAxisLabelDx: 0,
    xAxisLabelDy: 0,
    yAxisLabelDx: 0,
    yAxisLabelDy: 0,
    yLabelVertical: false,
    graphs: [],
    points: [],
    translations: [],
    style: { ...DEFAULT_STYLE },
    ...partial,
  });
}

export function normalizeState(
  state: QuadraticFunctionState,
): QuadraticFunctionState {
  const xs = clampRange(state.xMin, state.xMax, state.xTick);
  const tick = xs.tick;
  const ys = clampRange(state.yMin, state.yMax, tick);
  const xLabelEvery = Math.max(1, Math.round(state.xLabelEvery || 1));
  const yLabelEvery = Math.max(1, Math.round(state.yLabelEvery || 1));
  const graphIds = new Set(state.graphs.map((g) => g.id));
  return {
    ...state,
    xMin: xs.min,
    xMax: xs.max,
    xTick: tick,
    yMin: ys.min,
    yMax: ys.max,
    yTick: tick,
    xLabelEvery,
    yLabelEvery,
    xAxisLabelDx: clampOffset(state.xAxisLabelDx),
    xAxisLabelDy: clampOffset(state.xAxisLabelDy),
    yAxisLabelDx: clampOffset(state.yAxisLabelDx),
    yAxisLabelDy: clampOffset(state.yAxisLabelDy),
    graphs: state.graphs.map((g) => ({
      ...g,
      kind: g.kind === "horizontal" ? "horizontal" : "quadratic",
      a: Number.isFinite(g.a) ? g.a : 1,
      p: Number.isFinite(g.p) ? g.p : 0,
      q: Number.isFinite(g.q) ? g.q : 0,
      width: g.width > 0 ? g.width : 0,
      letterA: g.letterA || "a",
      letterP: g.letterP || "p",
      letterQ: g.letterQ || "q",
    })),
    points: state.points
      .filter((p) => graphIds.has(p.graphId))
      .map((p) => ({
        ...p,
        x: Math.min(xs.max, Math.max(xs.min, p.x)),
      })),
    translations: state.translations.filter(
      (t) => graphIds.has(t.fromGraphId) && graphIds.has(t.toGraphId),
    ),
    style: {
      ...DEFAULT_STYLE,
      ...state.style,
      padding: Math.min(
        160,
        Math.max(40, state.style?.padding ?? DEFAULT_STYLE.padding),
      ),
      fontSize: Math.min(
        64,
        Math.max(12, state.style?.fontSize ?? DEFAULT_STYLE.fontSize),
      ),
      pointLabelSize: Math.min(
        72,
        Math.max(14, state.style?.pointLabelSize ?? DEFAULT_STYLE.pointLabelSize),
      ),
      axisNameSize: Math.min(
        72,
        Math.max(12, state.style?.axisNameSize ?? DEFAULT_STYLE.axisNameSize),
      ),
      equationSize: Math.min(
        64,
        Math.max(12, state.style?.equationSize ?? DEFAULT_STYLE.equationSize),
      ),
      lineWidth: Math.min(
        6,
        Math.max(1, state.style?.lineWidth ?? DEFAULT_STYLE.lineWidth),
      ),
      graphWidth: Math.min(
        8,
        Math.max(1, state.style?.graphWidth ?? DEFAULT_STYLE.graphWidth),
      ),
      pointRadius: Math.min(
        12,
        Math.max(2, state.style?.pointRadius ?? DEFAULT_STYLE.pointRadius),
      ),
    },
  };
}

export function toPlaneBackdrop(
  state: QuadraticFunctionState,
): CoordPlaneState {
  return {
    xMin: state.xMin,
    xMax: state.xMax,
    yMin: state.yMin,
    yMax: state.yMax,
    xTick: state.xTick,
    yTick: state.yTick,
    xLabelEvery: state.xLabelEvery,
    yLabelEvery: state.yLabelEvery,
    showGrid: state.showGrid,
    showArrows: state.showArrows,
    showOrigin: state.showOrigin,
    showTickLabels: state.showTickLabels,
    showTicks: state.showTicks,
    xAxisLabel: state.xAxisLabel,
    yAxisLabel: state.yAxisLabel,
    originLabel: state.originLabel,
    xAxisLabelDx: state.xAxisLabelDx,
    xAxisLabelDy: state.xAxisLabelDy,
    yAxisLabelDx: state.yAxisLabelDx,
    yAxisLabelDy: state.yAxisLabelDy,
    yLabelVertical: state.yLabelVertical,
    yBreak: false,
    yBreakTo: 0,
    equalScale: true,
    points: [],
    graphs: [],
    style: state.style,
  };
}

export function cloneState(
  state: QuadraticFunctionState,
): QuadraticFunctionState {
  return structuredClone(state);
}

export function addQuadraticGraph(
  state: QuadraticFunctionState,
): QuadraticFunctionState {
  const n = state.graphs.length;
  const graph = makeQuadratic({
    a: n === 0 ? 1 : n === 1 ? 2 : -0.5,
    p: 0,
    q: n === 2 ? 2 : 0,
    color: nextGraphColor(state.graphs),
    labelMode: "auto",
  });
  return { ...state, graphs: [...state.graphs, graph] };
}

export function addHorizontalLine(
  state: QuadraticFunctionState,
): QuadraticFunctionState {
  const graph = makeHorizontal({
    q: 4,
    color: GRAPH_GREEN,
    labelMode: "auto",
  });
  return { ...state, graphs: [...state.graphs, graph] };
}

export function addPointOnGraph(
  state: QuadraticFunctionState,
  graphId: string,
  x: number,
): QuadraticFunctionState {
  const graph = state.graphs.find((g) => g.id === graphId);
  if (!graph) return state;
  const point = makePoint({
    graphId,
    x,
    name: nextPointName(state.points),
    showName: true,
    dropX: true,
    dropY: true,
    axisMarkX: true,
    axisMarkY: true,
  });
  return { ...state, points: [...state.points, point] };
}

export function defaultTranslationValues(
  state: QuadraticFunctionState,
  kind: TranslationKind,
): number[] {
  if (kind === "vertex") return [];
  return translationValuesForCount(state, kind, kind === "horizontal" ? 1 : 4);
}

export function translationValuesForCount(
  state: QuadraticFunctionState,
  kind: "horizontal" | "vertical",
  count: number,
  seed: number[] = [],
): number[] {
  const n = Math.min(8, Math.max(1, Math.round(count)));
  if (kind === "horizontal") {
    const yLo = state.yMin;
    const yHi = state.yMax;
    const span = yHi - yLo;
    if (span < 1e-9) return [yLo];
    const fallback = Math.min(
      yHi - state.yTick,
      Math.max(yLo + state.yTick, yLo + span * 0.35),
    );
    const start = seed[0] ?? fallback;
    const step = n > 1 ? (span * 0.55) / (n - 1) : 0;
    const ys = Array.from({ length: n }, (_, i) =>
      Math.round((start + i * step) * 1000) / 1000,
    ).filter((y) => y >= yLo - 1e-9 && y <= yHi + 1e-9);
    return ys.length > 0 ? ys : [fallback];
  }
  const span = state.xMax - state.xMin;
  const step = Math.max(state.xTick * 2, span * 0.16);
  const start = seed[0] ?? state.xMin + span * 0.18;
  const xs = Array.from({ length: n }, (_, i) =>
    Math.round((start + i * step) * 1000) / 1000,
  ).filter((x) => x >= state.xMin - 1e-9 && x <= state.xMax + 1e-9);
  return xs.length >= 1
    ? xs
    : [state.xMin + state.xTick, state.xMin + state.xTick * 3].slice(0, n);
}

export function addTranslation(
  state: QuadraticFunctionState,
  fromGraphId: string,
  toGraphId: string,
  kind: TranslationKind = "vertical",
): QuadraticFunctionState {
  if (fromGraphId === toGraphId) return state;
  if (
    !state.graphs.some((g) => g.id === fromGraphId) ||
    !state.graphs.some((g) => g.id === toGraphId)
  ) {
    return state;
  }
  return {
    ...state,
    translations: [
      ...state.translations,
      makeTranslation({
        fromGraphId,
        toGraphId,
        kind,
        values: defaultTranslationValues(state, kind),
      }),
    ],
  };
}

export function findGraphTranslation(
  state: QuadraticFunctionState,
  graphId: string,
  kind: TranslationKind,
): Translation | undefined {
  return state.translations.find(
    (t) =>
      t.kind === kind &&
      (t.fromGraphId === graphId || t.toGraphId === graphId),
  );
}

export function addParallelTranslation(
  state: QuadraticFunctionState,
  graphId: string,
  kind: TranslationKind,
): QuadraticFunctionState {
  const graph = state.graphs.find((g) => g.id === graphId);
  if (!graph || isHorizontal(graph)) return state;
  if (findGraphTranslation(state, graphId, kind)) return state;
  const parallel = state.graphs.find(
    (g) => g.id !== graphId && graphsHaveSameA(g, graph),
  );
  if (parallel) return addTranslation(state, graph.id, parallel.id, kind);
  const other = state.graphs.find(
    (g) => g.id !== graphId && !isHorizontal(g),
  );
  if (other) return addTranslation(state, graph.id, other.id, kind);
  const copy = makeQuadratic({
    a: graph.a,
    p: graph.p,
    q: graph.q - 2,
    color: nextGraphColor(state.graphs),
    labelMode: "auto",
  });
  return addTranslation(
    { ...state, graphs: [...state.graphs, copy] },
    graph.id,
    copy.id,
    kind,
  );
}

export function removeGraphTranslation(
  state: QuadraticFunctionState,
  graphId: string,
  kind: TranslationKind,
): QuadraticFunctionState {
  const trans = findGraphTranslation(state, graphId, kind);
  if (!trans) return state;
  const partnerId =
    trans.fromGraphId === graphId ? trans.toGraphId : trans.fromGraphId;
  const translations = state.translations.filter((t) => t.id !== trans.id);
  const partnerUsed =
    translations.some(
      (t) => t.fromGraphId === partnerId || t.toGraphId === partnerId,
    ) || state.points.some((p) => p.graphId === partnerId);
  const graphs =
    !partnerUsed && state.graphs.length > 1
      ? state.graphs.filter((g) => g.id !== partnerId)
      : state.graphs;
  return normalizeState({ ...state, graphs, translations });
}

export function toggleGraphTranslation(
  state: QuadraticFunctionState,
  graphId: string,
  kind: TranslationKind,
): QuadraticFunctionState {
  if (findGraphTranslation(state, graphId, kind)) {
    return removeGraphTranslation(state, graphId, kind);
  }
  return addParallelTranslation(state, graphId, kind);
}

export function graphsHaveSameA(a: QuadraticGraph, b: QuadraticGraph): boolean {
  if (isHorizontal(a) || isHorizontal(b)) return false;
  return Math.abs(a.a - b.a) < 1e-6;
}

export function removeById(
  state: QuadraticFunctionState,
  id: string,
): QuadraticFunctionState {
  return {
    ...state,
    graphs: state.graphs.filter((g) => g.id !== id),
    points: state.points.filter((p) => p.id !== id && p.graphId !== id),
    translations: state.translations.filter(
      (t) =>
        t.id !== id && t.fromGraphId !== id && t.toGraphId !== id,
    ),
  };
}

export function interceptLabel(value: number): string {
  const coeff = formatNiceCoeff(value);
  if (coeff.includes("frac")) return coeff;
  return formatNiceNumber(value);
}

export const QUADRATIC_FUNCTION_PRESETS: {
  id: string;
  title: string;
  hint: string;
  state: QuadraticFunctionState;
}[] = [
  {
    id: "several-a",
    title: "y=ax² 여러 개",
    hint: "(가)(나)(다)(라) 네 포물선",
    state: baseState({
      xMin: -6,
      xMax: 6,
      yMin: -6,
      yMax: 6,
      showGrid: false,
      showTickLabels: false,
      showTicks: false,
      graphs: [
        makeQuadratic({
          id: "g-ga",
          a: 0.5,
          color: GRAPH_PINK,
          labelMode: "custom",
          custom: "(가)",
          labelDx: -120,
          labelDy: -80,
        }),
        makeQuadratic({
          id: "g-na",
          a: 2,
          color: GRAPH_CYAN,
          labelMode: "custom",
          custom: "(나)",
          labelDx: -40,
          labelDy: -100,
        }),
        makeQuadratic({
          id: "g-da",
          a: -0.5,
          color: GRAPH_PURPLE,
          labelMode: "custom",
          custom: "(다)",
          labelDx: -100,
          labelDy: 60,
        }),
        makeQuadratic({
          id: "g-ra",
          a: -2,
          color: GRAPH_GREEN,
          labelMode: "custom",
          custom: "(라)",
          labelDx: 20,
          labelDy: 80,
        }),
      ],
    }),
  },
  {
    id: "intersection",
    title: "y=x²와 y=ax²",
    hint: "y=4 교점 A B C D",
    state: baseState({
      xMin: -5,
      xMax: 5,
      yMin: -1,
      yMax: 6,
      showGrid: false,
      showTickLabels: true,
      showTicks: true,
      yLabelEvery: 2,
      graphs: [
        makeQuadratic({
          id: "g-x2",
          a: 1,
          color: GRAPH_PINK,
          labelMode: "auto",
          labelDx: -60,
          labelDy: -30,
        }),
        makeQuadratic({
          id: "g-ax2",
          a: 2,
          color: GRAPH_CYAN,
          labelMode: "letter",
          letterA: "a",
          labelDx: 40,
          labelDy: -40,
        }),
        makeHorizontal({
          id: "g-y4",
          q: 4,
          color: GRAPH_GREEN,
          labelMode: "auto",
          labelDx: 80,
          labelDy: -8,
        }),
      ],
      points: [
        makePoint({ id: "p-a", graphId: "g-y4", x: -2, name: "A", showName: true }),
        makePoint({ id: "p-b", graphId: "g-y4", x: -Math.SQRT2, name: "B", showName: true }),
        makePoint({ id: "p-c", graphId: "g-y4", x: Math.SQRT2, name: "C", showName: true }),
        makePoint({ id: "p-d", graphId: "g-y4", x: 2, name: "D", showName: true }),
      ],
    }),
  },
  {
    id: "translate-pq",
    title: "평행이동",
    hint: "꼭짓점 L자 화살",
    state: baseState({
      xMin: -6,
      xMax: 6,
      yMin: -6,
      yMax: 6,
      xLabelEvery: 2,
      yLabelEvery: 2,
      showGrid: true,
      graphs: [
        makeQuadratic({
          id: "g-from",
          a: -1 / 3,
          color: GRAPH_INK,
          labelMode: "auto",
          labelDx: 60,
          labelDy: 50,
        }),
        makeQuadratic({
          id: "g-to",
          a: -1 / 3,
          p: -2,
          q: 3,
          color: GRAPH_PINK,
          labelMode: "auto",
          labelDx: -80,
          labelDy: 40,
        }),
      ],
      translations: [
        makeTranslation({
          id: "t-v",
          fromGraphId: "g-from",
          toGraphId: "g-to",
          kind: "vertex",
          values: [],
          color: TRANSLATION_ORANGE,
          showDelta: true,
        }),
      ],
    }),
  },
  {
    id: "vertex-intercepts",
    title: "꼭짓점·절편",
    hint: "수선과 축 숫자",
    state: baseState({
      xMin: -6,
      xMax: 4,
      yMin: -2,
      yMax: 8,
      showGrid: false,
      showTickLabels: true,
      showTicks: true,
      graphs: [
        makeQuadratic({
          id: "g-v",
          a: 1,
          p: -2,
          q: 1,
          color: GRAPH_PINK,
          labelMode: "hide",
          showVertexDrop: true,
          showVertexMarks: true,
          showYIntercept: true,
        }),
      ],
    }),
  },
  {
    id: "translate-x",
    title: "좌우 평행이동",
    hint: "y=x² → y=(x-2)²",
    state: baseState({
      xMin: -4,
      xMax: 8,
      yMin: -2,
      yMax: 10,
      xLabelEvery: 2,
      yLabelEvery: 2,
      showGrid: true,
      graphs: [
        makeQuadratic({
          id: "g-base",
          a: 1,
          color: GRAPH_INK,
          labelMode: "auto",
          labelDx: -50,
          labelDy: -20,
        }),
        makeQuadratic({
          id: "g-shift",
          a: 1,
          p: 2,
          color: GRAPH_PINK,
          labelMode: "auto",
          labelDx: 50,
          labelDy: -20,
        }),
      ],
      translations: [
        makeTranslation({
          id: "t-h",
          fromGraphId: "g-base",
          toGraphId: "g-shift",
          kind: "horizontal",
          values: [4],
          color: TRANSLATION_RED,
          showDelta: true,
        }),
      ],
    }),
  },
  {
    id: "maximum",
    title: "최댓값",
    hint: "대칭축·최댓값 선",
    state: baseState({
      xMin: -6,
      xMax: 6,
      yMin: -6,
      yMax: 4,
      xLabelEvery: 2,
      yLabelEvery: 2,
      showGrid: true,
      graphs: [
        makeQuadratic({
          id: "g-max",
          a: -0.5,
          p: 1,
          q: 2,
          color: GRAPH_PINK,
          labelMode: "hide",
          showAxisOfSymmetry: true,
          showExtrema: true,
          showVertex: true,
        }),
      ],
    }),
  },
];

export const DEFAULT_QUADRATIC_FUNCTION_STATE: QuadraticFunctionState =
  structuredClone(QUADRATIC_FUNCTION_PRESETS[0]!.state);
