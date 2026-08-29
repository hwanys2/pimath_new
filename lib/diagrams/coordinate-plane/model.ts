import { formatNiceCoeff } from "@/lib/diagrams/math-label";

export type GraphLabelMode = "auto" | "letter" | "custom" | "hide";

export const GRAPH_PINK = "#e84a8c";
export const GRAPH_CYAN = "#3db7d4";
export const GRAPH_INK = "#111111";
export const GRID_COLOR = "#9fd4ea";

export type CoordStyle = {
  lineWidth: number;
  fontSize: number;
  pointLabelSize: number;
  equationSize: number;
  pointRadius: number;
  graphWidth: number;
  padding: number;
  exportScale: number;
  gridColor: string;
};

export type CoordPoint = {
  id: string;
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

export type DirectGraph = {
  t: "direct";
  id: string;
  a: number;
  color: string;
  width: number;
  labelMode: GraphLabelMode;
  letter: string;
  custom: string;
  labelDx: number;
  labelDy: number;
};

export type InverseGraph = {
  t: "inverse";
  id: string;
  a: number;
  color: string;
  width: number;
  labelMode: GraphLabelMode;
  letter: string;
  custom: string;
  labelDx: number;
  labelDy: number;
  bothBranches: boolean;
};

export type PolyVertex = { x: number; y: number };

export type PolylineGraph = {
  t: "polyline";
  id: string;
  vertices: PolyVertex[];
  color: string;
  width: number;
  rounded: boolean;
  labelMode: GraphLabelMode;
  letter: string;
  custom: string;
  labelDx: number;
  labelDy: number;
};

export type PlaneGraph = DirectGraph | InverseGraph | PolylineGraph;

export type CoordPlaneState = {
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
  yLabelVertical: boolean;
  yBreak: boolean;
  yBreakTo: number;
  points: CoordPoint[];
  graphs: PlaneGraph[];
  style: CoordStyle;
};

const DEFAULT_STYLE: CoordStyle = {
  lineWidth: 1.55,
  fontSize: 15,
  pointLabelSize: 20,
  equationSize: 18,
  pointRadius: 3.3,
  graphWidth: 2.15,
  padding: 44,
  exportScale: 3,
  gridColor: GRID_COLOR,
};

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const POINT_NAMES = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function nextPointName(existing: CoordPoint[]): string {
  const used = new Set(existing.map((p) => p.name.trim().toUpperCase()));
  for (const ch of POINT_NAMES) {
    if (!used.has(ch)) return ch;
  }
  return `P${existing.length + 1}`;
}

function defaultLabelOffset(x: number, y: number): { dx: number; dy: number } {
  const onX = Math.abs(y) < 1e-9;
  const onY = Math.abs(x) < 1e-9;
  if (onX && !onY) return { dx: 0, dy: -16 };
  if (onY && !onX) return { dx: -16, dy: 0 };
  if (y < 0) return { dx: -14, dy: 16 };
  return { dx: -14, dy: -14 };
}

export function makePoint(
  partial: Partial<CoordPoint> & { x: number; y: number; name: string },
): CoordPoint {
  const off = defaultLabelOffset(partial.x, partial.y);
  return {
    id: partial.id ?? newId("p"),
    name: partial.name,
    x: partial.x,
    y: partial.y,
    showDot: partial.showDot ?? true,
    showName: partial.showName ?? true,
    labelDx: partial.labelDx ?? off.dx,
    labelDy: partial.labelDy ?? off.dy,
    dropX: partial.dropX ?? false,
    dropY: partial.dropY ?? false,
    axisMarkX: partial.axisMarkX ?? false,
    axisMarkY: partial.axisMarkY ?? false,
  };
}

function graphBase(
  partial: Partial<Omit<DirectGraph, "t">> & { id?: string },
): Omit<DirectGraph, "t" | "a"> & { a?: number } {
  return {
    id: partial.id ?? newId("g"),
    color: partial.color ?? GRAPH_PINK,
    width: partial.width ?? 0,
    labelMode: partial.labelMode ?? "auto",
    letter: partial.letter ?? "a",
    custom: partial.custom ?? "",
    labelDx: partial.labelDx ?? 0,
    labelDy: partial.labelDy ?? 0,
  };
}

export function makeDirect(
  partial: Partial<DirectGraph> & { a: number },
): DirectGraph {
  const base = graphBase(partial);
  return {
    t: "direct",
    ...base,
    a: partial.a,
    labelMode: partial.labelMode ?? "auto",
  };
}

export function makeInverse(
  partial: Partial<InverseGraph> & { a: number },
): InverseGraph {
  const base = graphBase(partial);
  return {
    t: "inverse",
    ...base,
    a: partial.a,
    bothBranches: partial.bothBranches ?? true,
    labelMode: partial.labelMode ?? "auto",
  };
}

export function makePolyline(
  partial: Partial<PolylineGraph> & { vertices: PolyVertex[] },
): PolylineGraph {
  const base = graphBase(partial);
  return {
    t: "polyline",
    ...base,
    vertices: partial.vertices.map((v) => ({ x: v.x, y: v.y })),
    rounded: partial.rounded ?? false,
    labelMode: partial.labelMode ?? "hide",
  };
}

export function clampRange(min: number, max: number, tick: number) {
  let a = Number.isFinite(min) ? min : -5;
  let b = Number.isFinite(max) ? max : 5;
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }
  const step = Math.max(tick, 0.1);
  if (b - a < step) b = a + step;
  if (b - a > 200) b = a + 200;
  return { min: a, max: b, tick: step };
}

export function normalizeState(state: CoordPlaneState): CoordPlaneState {
  const xs = clampRange(state.xMin, state.xMax, state.xTick);
  const ys = clampRange(state.yMin, state.yMax, state.yTick);
  const xLabelEvery = Math.max(1, Math.round(state.xLabelEvery || 1));
  const yLabelEvery = Math.max(1, Math.round(state.yLabelEvery || 1));
  let yBreakTo = Number.isFinite(state.yBreakTo) ? state.yBreakTo : 0;
  yBreakTo = Math.min(ys.max - ys.tick, Math.max(ys.min, yBreakTo));
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
    yBreakTo,
    points: state.points.map((p) => ({
      ...p,
      x: Math.min(xs.max, Math.max(xs.min, p.x)),
      y: Math.min(ys.max, Math.max(ys.min, p.y)),
    })),
    graphs: state.graphs.map((g) => {
      if (g.t === "polyline") {
        return {
          ...g,
          vertices: g.vertices.map((v) => ({
            x: Math.min(xs.max, Math.max(xs.min, v.x)),
            y: Math.min(ys.max, Math.max(ys.min, v.y)),
          })),
          width: g.width > 0 ? g.width : 0,
        };
      }
      return {
        ...g,
        a: Number.isFinite(g.a) ? g.a : 1,
        width: g.width > 0 ? g.width : 0,
      };
    }),
    style: { ...DEFAULT_STYLE, ...state.style },
  };
}

export function tickValues(min: number, max: number, step: number): number[] {
  const start = Math.ceil((min - 1e-9) / step) * step;
  const ticks: number[] = [];
  const n = Math.round((max - start) / step) + 4;
  for (let i = 0; i <= n; i += 1) {
    const v = Math.round((start + i * step) * 1000) / 1000;
    if (v > max + 1e-9) break;
    if (v >= min - 1e-9) ticks.push(v);
  }
  return ticks;
}

export function graphStrokeWidth(graph: PlaneGraph, fallback: number): number {
  return graph.width > 0 ? graph.width : fallback;
}

export function graphEquationText(graph: PlaneGraph): string | null {
  if (graph.labelMode === "hide") return null;
  if (graph.t === "polyline") {
    if (graph.labelMode === "custom") return graph.custom.trim() || null;
    if (graph.labelMode === "letter") return graph.letter.trim() || null;
    return graph.custom.trim() || null;
  }
  if (graph.labelMode === "custom") {
    return graph.custom.trim() || defaultEquation(graph);
  }
  if (graph.labelMode === "letter") {
    const L = graph.letter.trim() || "a";
    if (graph.t === "direct") return `y=${L}x`;
    return `y=\\frac{${L}}{x}`;
  }
  return defaultEquation(graph);
}

function defaultEquation(graph: DirectGraph | InverseGraph): string {
  if (graph.t === "direct") {
    const a = graph.a;
    if (Math.abs(a - 1) < 1e-9) return "y=x";
    if (Math.abs(a + 1) < 1e-9) return "y=-x";
    const coeff = formatNiceCoeff(a);
    if (coeff.startsWith("-")) return `y=${coeff}x`;
    return `y=${coeff}x`;
  }
  const coeff = formatNiceCoeff(graph.a);
  return `y=\\frac{${coeff}}{x}`;
}

function baseState(partial: Partial<CoordPlaneState> = {}): CoordPlaneState {
  return normalizeState({
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
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
    yLabelVertical: false,
    yBreak: false,
    yBreakTo: 0,
    points: [],
    graphs: [],
    style: { ...DEFAULT_STYLE },
    ...partial,
  });
}

export const COORD_PLANE_PRESETS: {
  id: string;
  title: string;
  hint: string;
  state: CoordPlaneState;
}[] = [
  {
    id: "ordered-pairs",
    title: "순서쌍 점 찍기",
    hint: "A, B, C와 격자",
    state: baseState({
      xMin: -7,
      xMax: 7,
      yMin: -7,
      yMax: 7,
      xLabelEvery: 2,
      yLabelEvery: 2,
      points: [
        makePoint({ id: "p-a", name: "A", x: 3, y: 6 }),
        makePoint({ id: "p-b", name: "B", x: -4, y: -3 }),
        makePoint({ id: "p-c", name: "C", x: 5, y: 0 }),
      ],
    }),
  },
  {
    id: "axis-break",
    title: "축 끊기·단위",
    hint: "분, °C, y축 물결",
    state: baseState({
      xMin: 0,
      xMax: 10,
      yMin: 0,
      yMax: 70,
      xTick: 1,
      yTick: 2,
      xLabelEvery: 2,
      yLabelEvery: 5,
      yBreak: true,
      yBreakTo: 30,
      xAxisLabel: "$x$(분)",
      yAxisLabel: "$y$(°C)",
    }),
  },
  {
    id: "situation",
    title: "상황 그래프",
    hint: "높이·시간, 꺾은선",
    state: baseState({
      xMin: 0,
      xMax: 10,
      yMin: 0,
      yMax: 8,
      showGrid: false,
      showTickLabels: false,
      showTicks: false,
      xAxisLabel: "시간",
      yAxisLabel: "높이",
      yLabelVertical: true,
      graphs: [
        makePolyline({
          id: "g-ht",
          vertices: [
            { x: 0, y: 1.6 },
            { x: 4.2, y: 5.4 },
            { x: 9.2, y: 5.4 },
          ],
          rounded: true,
          color: GRAPH_PINK,
        }),
      ],
    }),
  },
  {
    id: "inverse",
    title: "반비례",
    hint: "y = a/x",
    state: baseState({
      graphs: [
        makeInverse({
          id: "g-inv",
          a: 4,
          labelMode: "letter",
          letter: "a",
          color: GRAPH_PINK,
          labelDx: 18,
          labelDy: -22,
        }),
      ],
    }),
  },
  {
    id: "direct",
    title: "정비례",
    hint: "y = ax",
    state: baseState({
      graphs: [
        makeDirect({
          id: "g-dir",
          a: 3,
          labelMode: "letter",
          letter: "a",
          color: GRAPH_PINK,
          labelDx: 16,
          labelDy: -14,
        }),
      ],
    }),
  },
  {
    id: "intersect",
    title: "정비례·반비례 교점",
    hint: "P와 수선",
    state: baseState({
      xMin: -8,
      xMax: 8,
      yMin: -8,
      yMax: 8,
      showGrid: false,
      showTickLabels: false,
      showTicks: false,
      graphs: [
        makeDirect({
          id: "g-ax",
          a: 2 / 3,
          labelMode: "letter",
          letter: "a",
          color: GRAPH_PINK,
          labelDx: 22,
          labelDy: -10,
        }),
        makeInverse({
          id: "g-24",
          a: 24,
          labelMode: "custom",
          custom: "y=\\frac{24}{x}",
          color: GRAPH_CYAN,
          labelDx: 8,
          labelDy: -28,
        }),
      ],
      points: [
        makePoint({
          id: "p-p",
          name: "P",
          x: 6,
          y: 4,
          dropX: true,
          axisMarkX: true,
          labelDx: 0,
          labelDy: -16,
        }),
      ],
    }),
  },
];

export const DEFAULT_COORD_PLANE_STATE: CoordPlaneState = structuredClone(
  COORD_PLANE_PRESETS[0]!.state,
);

export function cloneState(state: CoordPlaneState): CoordPlaneState {
  return structuredClone(state);
}

export function addPointAt(
  state: CoordPlaneState,
  x: number,
  y: number,
): CoordPlaneState {
  const point = makePoint({
    name: nextPointName(state.points),
    x,
    y,
  });
  return { ...state, points: [...state.points, point] };
}

export function addDirectGraph(state: CoordPlaneState): CoordPlaneState {
  return {
    ...state,
    graphs: [
      ...state.graphs,
      makeDirect({ a: 1, color: GRAPH_PINK, labelMode: "letter" }),
    ],
  };
}

export function addInverseGraph(state: CoordPlaneState): CoordPlaneState {
  return {
    ...state,
    graphs: [
      ...state.graphs,
      makeInverse({ a: 6, color: GRAPH_PINK, labelMode: "letter" }),
    ],
  };
}

export function addPolylineGraph(state: CoordPlaneState): CoordPlaneState {
  const midX = (state.xMin + state.xMax) / 2;
  const midY = (state.yMin + state.yMax) / 2;
  const spanX = (state.xMax - state.xMin) * 0.28;
  const spanY = (state.yMax - state.yMin) * 0.22;
  return {
    ...state,
    graphs: [
      ...state.graphs,
      makePolyline({
        vertices: [
          { x: midX - spanX, y: midY - spanY * 0.4 },
          { x: midX, y: midY + spanY },
          { x: midX + spanX, y: midY + spanY },
        ],
        rounded: false,
        color: GRAPH_PINK,
      }),
    ],
  };
}

export function graphTitle(graph: PlaneGraph): string {
  if (graph.t === "direct") return "정비례";
  if (graph.t === "inverse") return "반비례";
  return "꺾은선";
}
