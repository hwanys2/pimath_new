import { formatMeasure, formatNiceNumber } from "@/lib/diagrams/math-label";

export type Vec = { x: number; y: number };

export type LabelMode = "auto" | "x" | "hide" | "custom";

export type MeasLabel = {
  mode: LabelMode;
  custom: string;
  dx: number;
  dy: number;
  lineDx?: number;
  lineDy?: number;
};

export type VertexMark = {
  name: string;
  nameDx: number;
  nameDy: number;
  showInterior: boolean;
  showExterior: boolean;
  fillExterior: boolean;
  interior: MeasLabel;
  exterior: MeasLabel;
};

export type EdgeMark = {
  showLength: boolean;
  length: MeasLabel;
};

export type DiagramStyle = {
  lineWidth: number;
  fontSize: number;
  pointLabelSize: number;
  pointRadius: number;
  dimOffset: number;
  padding: number;
  exportScale: number;
};

export type PolygonState = {
  points: Vec[];
  vertices: VertexMark[];
  edges: EdgeMark[];
  diagonals: [number, number][];
  showVertexNames: boolean;
  showDots: boolean;
  unit: string;
  unknownLetter: string;
  style: DiagramStyle;
};

export type PolygonPreset = {
  id: string;
  title: string;
  hint: string;
  state: PolygonState;
};

export function emptyLabel(mode: LabelMode = "auto"): MeasLabel {
  return { mode, custom: "", dx: 0, dy: 0, lineDx: 0, lineDy: 0 };
}

export function defaultVertexName(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : `P${i + 1}`;
}

function regularPoints(n: number, radius = 4, startDeg = 90): Vec[] {
  const count = Math.round(Math.min(8, Math.max(3, n)));
  const pts: Vec[] = [];
  for (let i = 0; i < count; i += 1) {
    const a = ((startDeg - (i * 360) / count) * Math.PI) / 180;
    pts.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  return pts;
}

function makeVertex(i: number, patch: Partial<VertexMark> = {}): VertexMark {
  return {
    name: defaultVertexName(i),
    nameDx: 0,
    nameDy: 0,
    showInterior: false,
    showExterior: false,
    fillExterior: false,
    interior: emptyLabel("auto"),
    exterior: emptyLabel("auto"),
    ...patch,
  };
}

function makeEdge(patch: Partial<EdgeMark> = {}): EdgeMark {
  return { showLength: false, length: emptyLabel("auto"), ...patch };
}

const DEFAULT_STYLE: DiagramStyle = {
  lineWidth: 1.7,
  fontSize: 22,
  pointLabelSize: 26,
  pointRadius: 3.4,
  dimOffset: 22,
  padding: 58,
  exportScale: 3,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function cloneState(state: PolygonState): PolygonState {
  return structuredClone(state);
}

export function normalizeState(state: PolygonState): PolygonState {
  const n = Math.round(clamp(state.points?.length ?? 0, 3, 8));
  let points = (state.points ?? []).slice(0, n);
  if (points.length < n) {
    points = regularPoints(n);
  }
  const vertices = Array.from({ length: n }, (_, i) => {
    const prev = state.vertices?.[i];
    return makeVertex(i, prev);
  });
  const edges = Array.from({ length: n }, (_, i) => makeEdge(state.edges?.[i]));
  const diagonals = (state.diagonals ?? []).filter(([a, b]) => {
    if (a === b || a < 0 || b < 0 || a >= n || b >= n) return false;
    const d = Math.abs(a - b);
    return d !== 1 && d !== n - 1;
  }).map(([a, b]) => (a < b ? ([a, b] as [number, number]) : ([b, a] as [number, number])));
  const style = { ...DEFAULT_STYLE, ...state.style };
  return {
    ...state,
    points,
    vertices,
    edges,
    diagonals,
    showVertexNames: state.showVertexNames !== false,
    showDots: state.showDots !== false,
    unit: state.unit?.trim() ? state.unit : "cm",
    unknownLetter: /^[A-Za-z]$/.test(state.unknownLetter) ? state.unknownLetter : "x",
    style: {
      ...style,
      lineWidth: clamp(style.lineWidth, 1, 3.5),
      fontSize: clamp(style.fontSize, 12, 64),
      pointLabelSize: clamp(style.pointLabelSize, 14, 72),
      pointRadius: clamp(style.pointRadius, 2, 10),
      dimOffset: clamp(style.dimOffset, 10, 48),
      padding: clamp(style.padding, 36, 90),
      exportScale: clamp(style.exportScale, 2, 4),
    },
  };
}

function baseState(points: Vec[], patch: Partial<PolygonState> = {}): PolygonState {
  const n = points.length;
  return normalizeState({
    points,
    vertices: Array.from({ length: n }, (_, i) => makeVertex(i)),
    edges: Array.from({ length: n }, () => makeEdge()),
    diagonals: [],
    showVertexNames: true,
    showDots: true,
    unit: "cm",
    unknownLetter: "x",
    style: { ...DEFAULT_STYLE },
    ...patch,
  });
}

export function withSideCount(state: PolygonState, n: number): PolygonState {
  const count = Math.round(clamp(n, 3, 8));
  return normalizeState({
    ...state,
    points: regularPoints(count, 4),
    vertices: Array.from({ length: count }, (_, i) =>
      makeVertex(i, {
        name: state.vertices[i]?.name ?? defaultVertexName(i),
      }),
    ),
    edges: Array.from({ length: count }, () => makeEdge()),
    diagonals: [],
  });
}

export function toRegular(state: PolygonState): PolygonState {
  return normalizeState({
    ...state,
    points: regularPoints(state.points.length, 4),
  });
}

export function setAllInteriors(state: PolygonState, on: boolean): PolygonState {
  return {
    ...state,
    vertices: state.vertices.map((v) => ({ ...v, showInterior: on })),
  };
}

export function setAllExteriors(state: PolygonState, on: boolean): PolygonState {
  return {
    ...state,
    vertices: state.vertices.map((v) => ({
      ...v,
      showExterior: on,
      fillExterior: on ? v.fillExterior : false,
    })),
  };
}

export function setAllLengths(state: PolygonState, on: boolean): PolygonState {
  return {
    ...state,
    edges: state.edges.map((e) => ({ ...e, showLength: on })),
  };
}

export function allInteriorsOn(state: PolygonState): boolean {
  return state.vertices.length > 0 && state.vertices.every((v) => v.showInterior);
}

export function allExteriorsOn(state: PolygonState): boolean {
  return state.vertices.length > 0 && state.vertices.every((v) => v.showExterior);
}

export function allLengthsOn(state: PolygonState): boolean {
  return state.edges.length > 0 && state.edges.every((e) => e.showLength);
}

export function labelUnknownLetter(label: MeasLabel, fallback: string): string {
  const fromLabel = label.custom.trim();
  if (/^[A-Za-z]$/.test(fromLabel)) return fromLabel;
  return fallback.trim() || "x";
}

export function resolveLengthText(
  label: MeasLabel,
  autoValue: number,
  unit: string,
  unknownLetter: string,
): string | null {
  if (label.mode === "hide") return null;
  if (label.mode === "x") {
    const u = unit.trim();
    const math = `$${labelUnknownLetter(label, unknownLetter)}$`;
    return u ? `${math} ${u}` : math;
  }
  if (label.mode === "custom") {
    const t = label.custom.trim();
    return t.length > 0 ? t : null;
  }
  return formatMeasure(autoValue, unit);
}

export function resolveAngleText(
  label: MeasLabel,
  autoDeg: number,
  unknownLetter: string,
): string | null {
  if (label.mode === "hide") return null;
  if (label.mode === "x") {
    return `$${labelUnknownLetter(label, unknownLetter)}$`;
  }
  if (label.mode === "custom") {
    const t = label.custom.trim();
    return t.length > 0 ? t : null;
  }
  return `${formatNiceNumber(autoDeg)}°`;
}

function patchVertex(
  vertices: VertexMark[],
  i: number,
  patch: Partial<VertexMark>,
): VertexMark[] {
  return vertices.map((v, idx) => (idx === i ? { ...v, ...patch } : v));
}

export const POLYGON_PRESETS: PolygonPreset[] = [
  {
    id: "quad-angle",
    title: "사각형 한 각",
    hint: "내각 60°",
    state: baseState(
      [
        { x: -3.4, y: 2.6 },
        { x: 2.2, y: 3.1 },
        { x: 3.6, y: -2.4 },
        { x: -3.1, y: -2.2 },
      ],
      {
        vertices: [
          makeVertex(0),
          makeVertex(1, {
            showInterior: true,
            interior: { ...emptyLabel("custom"), custom: "60°" },
          }),
          makeVertex(2),
          makeVertex(3),
        ],
      },
    ),
  },
  {
    id: "tri-exterior",
    title: "삼각형 외각",
    hint: "밑변 연장 · x",
    state: baseState(
      [
        { x: -3.4, y: -2.0 },
        { x: 3.6, y: -2.0 },
        { x: -1.6, y: 3.1 },
      ],
      {
        vertices: [
          makeVertex(0, {
            showInterior: true,
            interior: { ...emptyLabel("custom"), custom: "125°" },
          }),
          makeVertex(1, {
            showExterior: true,
            fillExterior: true,
            exterior: { ...emptyLabel("x"), custom: "x" },
          }),
          makeVertex(2, {
            showInterior: true,
            interior: { ...emptyLabel("custom"), custom: "20°" },
          }),
        ],
      },
    ),
  },
  {
    id: "pent-angles",
    title: "오각형 내각·외각",
    hint: "외각 x 채움",
    state: baseState(
      [
        { x: 0.2, y: 4.2 },
        { x: 3.8, y: 1.6 },
        { x: 2.6, y: -2.8 },
        { x: -2.4, y: -2.6 },
        { x: -3.6, y: 1.8 },
      ],
      {
        vertices: [
          makeVertex(0, {
            showInterior: true,
            interior: { ...emptyLabel("custom"), custom: "120°" },
          }),
          makeVertex(1, {
            showExterior: true,
            fillExterior: true,
            exterior: { ...emptyLabel("x"), custom: "x" },
          }),
          makeVertex(2, {
            showExterior: true,
            exterior: { ...emptyLabel("custom"), custom: "60°" },
          }),
          makeVertex(3, {
            showInterior: true,
            interior: { ...emptyLabel("custom"), custom: "100°" },
          }),
          makeVertex(4, {
            showExterior: true,
            exterior: { ...emptyLabel("custom"), custom: "70°" },
          }),
        ],
      },
    ),
  },
  {
    id: "pent-diag",
    title: "대각선",
    hint: "한 꼭짓점에서",
    state: baseState(regularPoints(5, 4), {
      vertices: Array.from({ length: 5 }, (_, i) => makeVertex(i)),
      diagonals: [
        [0, 2],
        [0, 3],
      ],
    }),
  },
];

export const DEFAULT_POLYGON_STATE: PolygonState = POLYGON_PRESETS[0]!.state;

export { DEFAULT_STYLE };
