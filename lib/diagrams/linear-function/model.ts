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

export { GRAPH_CYAN, GRAPH_INK, GRAPH_PINK, GRID_COLOR, GRID_GRAY, newId } from "@/lib/diagrams/coordinate-plane/model";
export type { CoordStyle, GraphLabelMode } from "@/lib/diagrams/coordinate-plane/model";

export const SLOPE_ORANGE = "#e8a045";
export const TRANSLATION_RED = "#e24a4a";
export const GRAPH_PURPLE = "#7b4fb2";

export type LinearKind = "linear" | "vertical";

export type LinearGraph = {
  id: string;
  kind: LinearKind;
  a: number;
  b: number;
  /** x = c when kind is vertical. */
  c: number;
  color: string;
  width: number;
  labelMode: GraphLabelMode;
  letterA: string;
  letterB: string;
  custom: string;
  labelDx: number;
  labelDy: number;
  showXIntercept: boolean;
  showYIntercept: boolean;
  xiLabelDx: number;
  xiLabelDy: number;
  yiLabelDx: number;
  yiLabelDy: number;
};

export type LinearPoint = {
  id: string;
  graphId: string;
  name: string;
  x: number;
  y: number;
  showDot: boolean;
  showName: boolean;
  labelDx: number;
  labelDy: number;
  dropX: boolean;
  dropY: boolean;
  axisMarkX: boolean;
  axisMarkY: boolean;
};

export type SlopeStep = {
  id: string;
  graphId: string;
  x1: number;
  x2: number;
  color: string;
  showDx: boolean;
  showDy: boolean;
  dxLabelDx: number;
  dxLabelDy: number;
  dyLabelDx: number;
  dyLabelDy: number;
};

export type Translation = {
  id: string;
  fromGraphId: string;
  toGraphId: string;
  xs: number[];
  color: string;
  showDelta: boolean;
  deltaDx: number;
  deltaDy: number;
};

export type LinearFunctionState = {
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
  graphs: LinearGraph[];
  points: LinearPoint[];
  slopeSteps: SlopeStep[];
  translations: Translation[];
  style: CoordStyle;
};

const DEFAULT_STYLE: CoordStyle = {
  lineWidth: 1.55,
  fontSize: 15,
  pointLabelSize: 20,
  axisNameSize: 20,
  equationSize: 18,
  pointRadius: 3.3,
  graphWidth: 2.15,
  padding: 72,
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

export function isVertical(graph: Pick<LinearGraph, "kind">): boolean {
  return graph.kind === "vertical";
}

export function isHorizontal(graph: Pick<LinearGraph, "kind" | "a">): boolean {
  return graph.kind !== "vertical" && Math.abs(graph.a) < 1e-9;
}

export function yOnLine(graph: Pick<LinearGraph, "a" | "b">, x: number): number {
  return graph.a * x + graph.b;
}

export function pointCoords(
  graph: LinearGraph,
  point: Pick<LinearPoint, "x" | "y">,
): { x: number; y: number } {
  if (isVertical(graph)) return { x: graph.c, y: point.y };
  return { x: point.x, y: yOnLine(graph, point.x) };
}

export function xIntercept(graph: LinearGraph): number | null {
  if (isVertical(graph)) return graph.c;
  if (Math.abs(graph.a) < 1e-9) return null;
  return -graph.b / graph.a;
}

export function yIntercept(graph: LinearGraph): number | null {
  if (isVertical(graph)) return null;
  return graph.b;
}

function clampOffset(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(80, Math.max(-80, value as number));
}

export function makeLinear(
  partial: Partial<LinearGraph> & { a: number; b?: number },
): LinearGraph {
  return {
    id: partial.id ?? newId("g"),
    kind: partial.kind ?? "linear",
    a: partial.a,
    b: partial.b ?? 0,
    c: partial.c ?? 2,
    color: partial.color ?? GRAPH_PINK,
    width: partial.width ?? 0,
    labelMode: partial.labelMode ?? "auto",
    letterA: partial.letterA ?? "a",
    letterB: partial.letterB ?? "b",
    custom: partial.custom ?? "",
    labelDx: partial.labelDx ?? 0,
    labelDy: partial.labelDy ?? 0,
    showXIntercept: partial.showXIntercept ?? false,
    showYIntercept: partial.showYIntercept ?? false,
    xiLabelDx: partial.xiLabelDx ?? 0,
    xiLabelDy: partial.xiLabelDy ?? 0,
    yiLabelDx: partial.yiLabelDx ?? 0,
    yiLabelDy: partial.yiLabelDy ?? 0,
  };
}

export function makePoint(
  partial: Partial<LinearPoint> & { graphId: string; x: number },
): LinearPoint {
  return {
    id: partial.id ?? newId("p"),
    graphId: partial.graphId,
    name: partial.name ?? "P",
    x: partial.x,
    y: partial.y ?? 0,
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

export function makeSlopeStep(
  partial: Partial<SlopeStep> & { graphId: string; x1: number; x2: number },
): SlopeStep {
  return {
    id: partial.id ?? newId("s"),
    graphId: partial.graphId,
    x1: partial.x1,
    x2: partial.x2,
    color: partial.color ?? SLOPE_ORANGE,
    showDx: partial.showDx ?? true,
    showDy: partial.showDy ?? true,
    dxLabelDx: partial.dxLabelDx ?? 0,
    dxLabelDy: partial.dxLabelDy ?? 0,
    dyLabelDx: partial.dyLabelDx ?? 0,
    dyLabelDy: partial.dyLabelDy ?? 0,
  };
}

export function makeTranslation(
  partial: Partial<Translation> & {
    fromGraphId: string;
    toGraphId: string;
    xs: number[];
  },
): Translation {
  return {
    id: partial.id ?? newId("t"),
    fromGraphId: partial.fromGraphId,
    toGraphId: partial.toGraphId,
    xs: [...partial.xs],
    color: partial.color ?? TRANSLATION_RED,
    showDelta: partial.showDelta ?? false,
    deltaDx: partial.deltaDx ?? 0,
    deltaDy: partial.deltaDy ?? 0,
  };
}

function formatAx(a: number): string {
  if (Math.abs(a) < 1e-9) return "0";
  if (Math.abs(a - 1) < 1e-9) return "x";
  if (Math.abs(a + 1) < 1e-9) return "-x";
  return `${formatNiceCoeff(a)}x`;
}

export function formatLinearEquation(a: number, b: number): string {
  const ax = formatAx(a);
  if (Math.abs(b) < 1e-9) {
    if (ax === "0") return "y=0";
    return `y=${ax}`;
  }
  const bText = formatNiceCoeff(b);
  if (ax === "0") return `y=${bText}`;
  if (b > 0) return `y=${ax}+${bText}`;
  return `y=${ax}${bText}`;
}

export function linearEquationText(graph: LinearGraph): string | null {
  if (graph.labelMode === "hide") return null;
  if (isVertical(graph)) {
    if (graph.labelMode === "custom") {
      return graph.custom.trim() || `x=${formatNiceCoeff(graph.c)}`;
    }
    if (graph.labelMode === "letter") {
      return `x=${graph.letterA.trim() || "a"}`;
    }
    return `x=${formatNiceCoeff(graph.c)}`;
  }
  if (graph.labelMode === "custom") {
    return graph.custom.trim() || formatLinearEquation(graph.a, graph.b);
  }
  if (graph.labelMode === "letter") {
    const A = graph.letterA.trim() || "a";
    const B = graph.letterB.trim() || "b";
    if (isHorizontal(graph)) return `y=${B}`;
    return `y=${A}x+${B}`;
  }
  return formatLinearEquation(graph.a, graph.b);
}

export function graphStrokeWidth(graph: LinearGraph, fallback: number): number {
  return graph.width > 0 ? graph.width : fallback;
}

const GRAPH_COLORS = [GRAPH_PINK, GRAPH_CYAN, GRAPH_INK, GRAPH_PURPLE];

export function nextGraphColor(existing: LinearGraph[]): string {
  return GRAPH_COLORS[existing.length % GRAPH_COLORS.length]!;
}

function baseState(partial: Partial<LinearFunctionState> = {}): LinearFunctionState {
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
    slopeSteps: [],
    translations: [],
    style: { ...DEFAULT_STYLE },
    ...partial,
  });
}

export function normalizeState(state: LinearFunctionState): LinearFunctionState {
  const xs = clampRange(state.xMin, state.xMax, state.xTick);
  const ys = clampRange(state.yMin, state.yMax, state.yTick);
  const xLabelEvery = Math.max(1, Math.round(state.xLabelEvery || 1));
  const yLabelEvery = Math.max(1, Math.round(state.yLabelEvery || 1));
  const graphIds = new Set(state.graphs.map((g) => g.id));
  return {
    ...state,
    xMin: xs.min,
    xMax: xs.max,
    xTick: xs.tick,
    yMin: ys.min,
    yMax: ys.max,
    yTick: ys.tick,
    xLabelEvery,
    yLabelEvery,
    xAxisLabelDx: clampOffset(state.xAxisLabelDx),
    xAxisLabelDy: clampOffset(state.xAxisLabelDy),
    yAxisLabelDx: clampOffset(state.yAxisLabelDx),
    yAxisLabelDy: clampOffset(state.yAxisLabelDy),
    graphs: state.graphs.map((g) => ({
      ...g,
      kind: g.kind === "vertical" ? "vertical" : "linear",
      a: Number.isFinite(g.a) ? g.a : 1,
      b: Number.isFinite(g.b) ? g.b : 0,
      c: Number.isFinite(g.c) ? g.c : 2,
      width: g.width > 0 ? g.width : 0,
      letterA: g.letterA || "a",
      letterB: g.letterB || "b",
    })),
    points: state.points
      .filter((p) => graphIds.has(p.graphId))
      .map((p) => {
        const graph = state.graphs.find((g) => g.id === p.graphId);
        const coords = graph
          ? pointCoords(
              {
                ...graph,
                kind: graph.kind === "vertical" ? "vertical" : "linear",
                c: Number.isFinite(graph.c) ? graph.c : 2,
              },
              { x: p.x, y: Number.isFinite(p.y) ? p.y : 0 },
            )
          : { x: p.x, y: 0 };
        return {
          ...p,
          x: Math.min(xs.max, Math.max(xs.min, coords.x)),
          y: Math.min(ys.max, Math.max(ys.min, coords.y)),
        };
      }),
    slopeSteps: state.slopeSteps
      .filter((s) => graphIds.has(s.graphId))
      .map((s) => ({
        ...s,
        x1: Math.min(xs.max, Math.max(xs.min, s.x1)),
        x2: Math.min(xs.max, Math.max(xs.min, s.x2)),
      })),
    translations: state.translations
      .filter(
        (t) => graphIds.has(t.fromGraphId) && graphIds.has(t.toGraphId),
      )
      .map((t) => ({
        ...t,
        xs: t.xs.map((x) => Math.min(xs.max, Math.max(xs.min, x))),
      })),
    style: {
      ...DEFAULT_STYLE,
      ...state.style,
      padding: Math.min(96, Math.max(40, state.style?.padding ?? DEFAULT_STYLE.padding)),
      pointRadius: Math.min(
        6,
        Math.max(2, state.style?.pointRadius ?? DEFAULT_STYLE.pointRadius),
      ),
      axisNameSize: Math.min(
        36,
        Math.max(12, state.style?.axisNameSize ?? DEFAULT_STYLE.axisNameSize),
      ),
    },
  };
}

export function toPlaneBackdrop(state: LinearFunctionState): CoordPlaneState {
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
    points: [],
    graphs: [],
    style: state.style,
  };
}

export function cloneState(state: LinearFunctionState): LinearFunctionState {
  return structuredClone(state);
}

export function addLinearGraph(state: LinearFunctionState): LinearFunctionState {
  const n = state.graphs.length;
  const graph = makeLinear({
    a: n === 0 ? 1 : n === 1 ? 1 : 0.5,
    b: n === 0 ? 0 : n === 1 ? 2 : -1,
    color: nextGraphColor(state.graphs),
    labelMode: "auto",
  });
  return { ...state, graphs: [...state.graphs, graph] };
}

export function addVerticalGraph(state: LinearFunctionState): LinearFunctionState {
  const graph = makeLinear({
    a: 0,
    b: 0,
    kind: "vertical",
    c: 2,
    color: nextGraphColor(state.graphs),
    labelMode: "auto",
  });
  return { ...state, graphs: [...state.graphs, graph] };
}

export function addHorizontalGraph(state: LinearFunctionState): LinearFunctionState {
  const graph = makeLinear({
    a: 0,
    b: -2,
    color: nextGraphColor(state.graphs),
    labelMode: "auto",
  });
  return { ...state, graphs: [...state.graphs, graph] };
}

export function addPointOnGraph(
  state: LinearFunctionState,
  graphId: string,
  x: number,
  y?: number,
): LinearFunctionState {
  const graph = state.graphs.find((g) => g.id === graphId);
  if (!graph) return state;
  const alongX = isVertical(graph) ? graph.c : x;
  const alongY = isVertical(graph)
    ? (y ?? 2)
    : yOnLine(graph, alongX);
  const point = makePoint({
    graphId,
    x: alongX,
    y: alongY,
    name: nextPointName(state.points),
    showName: true,
    dropX: true,
    dropY: true,
    axisMarkX: true,
    axisMarkY: true,
  });
  return { ...state, points: [...state.points, point] };
}

export function addSlopeStep(
  state: LinearFunctionState,
  graphId: string,
): LinearFunctionState {
  const graph = state.graphs.find((g) => g.id === graphId);
  if (!graph || isVertical(graph)) return state;
  const x1 =
    0 >= state.xMin && 0 <= state.xMax
      ? 0
      : Math.min(state.xMax - state.xTick * 2, Math.max(state.xMin, 0));
  let x2 = x1 + Math.max(state.xTick * 4, 2);
  if (x2 > state.xMax) x2 = x1 - Math.max(state.xTick * 4, 2);
  return {
    ...state,
    slopeSteps: [
      ...state.slopeSteps,
      makeSlopeStep({ graphId, x1, x2 }),
    ],
  };
}

export function defaultTranslationXs(state: LinearFunctionState): number[] {
  const span = state.xMax - state.xMin;
  const step = Math.max(state.xTick * 2, span * 0.16);
  const start = state.xMin + span * 0.18;
  const xs: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const x = start + i * step;
    if (x > state.xMax - span * 0.08) break;
    xs.push(Math.round(x * 1000) / 1000);
  }
  return xs.length >= 2 ? xs : [state.xMin + state.xTick, state.xMin + state.xTick * 3];
}

export function addTranslation(
  state: LinearFunctionState,
  fromGraphId: string,
  toGraphId: string,
): LinearFunctionState {
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
        xs: defaultTranslationXs(state),
      }),
    ],
  };
}

export function graphsAreParallel(a: LinearGraph, b: LinearGraph): boolean {
  if (isVertical(a) && isVertical(b)) return true;
  if (isVertical(a) || isVertical(b)) return false;
  return Math.abs(a.a - b.a) < 1e-6;
}

export function removeById(
  state: LinearFunctionState,
  id: string,
): LinearFunctionState {
  return {
    ...state,
    graphs: state.graphs.filter((g) => g.id !== id),
    points: state.points.filter((p) => p.id !== id && p.graphId !== id),
    slopeSteps: state.slopeSteps.filter((s) => s.id !== id && s.graphId !== id),
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

export const LINEAR_FUNCTION_PRESETS: {
  id: string;
  title: string;
  hint: string;
  state: LinearFunctionState;
}[] = [
  {
    id: "intercepts",
    title: "절편",
    hint: "x절편 −4, y절편 7",
    state: baseState({
      xMin: -6,
      xMax: 6,
      yMin: -2,
      yMax: 9,
      showGrid: false,
      showTickLabels: false,
      showTicks: false,
      graphs: [
        makeLinear({
          id: "g-int",
          a: 7 / 4,
          b: 7,
          color: GRAPH_PINK,
          labelMode: "hide",
          showXIntercept: true,
          showYIntercept: true,
        }),
      ],
    }),
  },
  {
    id: "point-drop",
    title: "점의 좌표",
    hint: "수선으로 x, y 표시",
    state: baseState({
      xMin: -4,
      xMax: 7,
      yMin: -4,
      yMax: 7,
      showGrid: false,
      showTickLabels: false,
      showTicks: false,
      graphs: [
        makeLinear({
          id: "g-drop",
          a: 3 / 2,
          b: -2,
          color: GRAPH_PINK,
          labelMode: "hide",
          showYIntercept: true,
        }),
      ],
      points: [
        makePoint({
          id: "p-p",
          graphId: "g-drop",
          name: "P",
          x: 4,
          showDot: true,
          showName: false,
          dropX: true,
          dropY: true,
          axisMarkX: true,
          axisMarkY: true,
        }),
      ],
    }),
  },
  {
    id: "slope",
    title: "기울기",
    hint: "Δx, Δy 화살",
    state: baseState({
      xMin: -3,
      xMax: 8,
      yMin: -2,
      yMax: 5,
      xLabelEvery: 2,
      yLabelEvery: 2,
      showGrid: true,
      graphs: [
        makeLinear({
          id: "g-slope",
          a: -1 / 4,
          b: 2,
          color: GRAPH_PINK,
          labelMode: "hide",
          showYIntercept: false,
        }),
      ],
      slopeSteps: [
        makeSlopeStep({
          id: "s-1",
          graphId: "g-slope",
          x1: 0,
          x2: 4,
        }),
      ],
    }),
  },
  {
    id: "translate",
    title: "평행이동",
    hint: "같은 기울기, 위아래로",
    state: baseState({
      xMin: -3,
      xMax: 8,
      yMin: -5,
      yMax: 5,
      xLabelEvery: 2,
      yLabelEvery: 2,
      showGrid: true,
      graphs: [
        makeLinear({
          id: "g-from",
          a: 3 / 4,
          b: 0,
          color: GRAPH_INK,
          labelMode: "auto",
          labelDx: 10,
          labelDy: -16,
        }),
        makeLinear({
          id: "g-to",
          a: 3 / 4,
          b: -2,
          color: GRAPH_PINK,
          labelMode: "auto",
          labelDx: 14,
          labelDy: 18,
        }),
      ],
      translations: [
        makeTranslation({
          id: "t-1",
          fromGraphId: "g-from",
          toGraphId: "g-to",
          xs: [-1, 1, 3, 5],
        }),
      ],
    }),
  },
  {
    id: "axes-const",
    title: "x=a, y=b",
    hint: "수직선·수평선",
    state: baseState({
      xMin: -5,
      xMax: 5,
      yMin: -5,
      yMax: 5,
      xLabelEvery: 2,
      yLabelEvery: 2,
      showGrid: true,
      graphs: [
        makeLinear({
          id: "g-xeq",
          a: 0,
          kind: "vertical",
          c: 2,
          color: GRAPH_PINK,
          labelMode: "auto",
          labelDx: 16,
          labelDy: 4,
        }),
        makeLinear({
          id: "g-yeq",
          a: 0,
          b: -3,
          color: GRAPH_PURPLE,
          labelMode: "auto",
          labelDx: 22,
          labelDy: -12,
        }),
      ],
    }),
  },
  {
    id: "several",
    title: "여러 그래프",
    hint: "일차함수 세 개",
    state: baseState({
      xMin: -6,
      xMax: 6,
      yMin: -6,
      yMax: 6,
      showGrid: true,
      graphs: [
        makeLinear({
          id: "g-a",
          a: 1,
          b: 0,
          color: GRAPH_PINK,
          labelMode: "auto",
          labelDx: 8,
          labelDy: -14,
        }),
        makeLinear({
          id: "g-b",
          a: 2,
          b: -1,
          color: GRAPH_CYAN,
          labelMode: "auto",
          labelDx: 10,
          labelDy: 16,
        }),
        makeLinear({
          id: "g-c",
          a: -1,
          b: 3,
          color: GRAPH_INK,
          labelMode: "auto",
          labelDx: -12,
          labelDy: -14,
        }),
      ],
    }),
  },
];

export const DEFAULT_LINEAR_FUNCTION_STATE: LinearFunctionState = structuredClone(
  LINEAR_FUNCTION_PRESETS[0]!.state,
);
