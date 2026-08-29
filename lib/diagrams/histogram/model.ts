export const GRAPH_PINK = "#e84a8c";
export const GRAPH_CYAN = "#3db7d4";
export const GRAPH_INK = "#111111";
export const GRID_GRAY = "#d4d4d4";
export const FILL_CYAN = "rgba(61, 183, 212, 0.34)";
export const FILL_PINK = "rgba(232, 74, 140, 0.32)";

export type HistogramKind = "histogram" | "polygon";

export type HistogramStyle = {
  lineWidth: number;
  fontSize: number;
  pointLabelSize: number;
  pointRadius: number;
  graphWidth: number;
  padding: number;
  exportScale: number;
  gridColor: string;
};

export type HistogramSeries = {
  id: string;
  name: string;
  color: string;
  fill: string;
  frequencies: number[];
  labelDx: number;
  labelDy: number;
};

export type HistogramState = {
  kind: HistogramKind;
  classStart: number;
  classWidth: number;
  classCount: number;
  xBreak: boolean;
  xAxisLabel: string;
  yAxisLabel: string;
  yMax: number;
  yTick: number;
  showGrid: boolean;
  showPoints: boolean;
  series: HistogramSeries[];
  style: HistogramStyle;
};

const DEFAULT_STYLE: HistogramStyle = {
  lineWidth: 1.5,
  fontSize: 14,
  pointLabelSize: 16,
  pointRadius: 3.2,
  graphWidth: 2.1,
  padding: 56,
  exportScale: 3,
  gridColor: GRID_GRAY,
};

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function classEnd(state: Pick<HistogramState, "classStart" | "classWidth" | "classCount">): number {
  return state.classStart + state.classCount * state.classWidth;
}

export function classBound(state: Pick<HistogramState, "classStart" | "classWidth">, i: number): number {
  return state.classStart + i * state.classWidth;
}

export function classMid(
  state: Pick<HistogramState, "classStart" | "classWidth">,
  i: number,
): number {
  return state.classStart + (i + 0.5) * state.classWidth;
}

export function classBounds(state: Pick<HistogramState, "classStart" | "classWidth" | "classCount">): number[] {
  const out: number[] = [];
  for (let i = 0; i <= state.classCount; i += 1) {
    out.push(classBound(state, i));
  }
  return out;
}

export function tickValues(min: number, max: number, step: number): number[] {
  if (!(step > 1e-12)) return [];
  const start = Math.ceil((min - 1e-9) / step) * step;
  const ticks: number[] = [];
  const n = Math.round((max - start) / step) + 4;
  for (let i = 0; i <= n; i += 1) {
    const v = Math.round((start + i * step) * 1e6) / 1e6;
    if (v > max + 1e-9) break;
    if (v >= min - 1e-9) ticks.push(v);
  }
  return ticks;
}

export function snapValue(value: number, step: number): number {
  if (step <= 1e-12) return value;
  return Math.round(value / step) * step;
}

export function formatTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 1e6) / 1e6;
  if (Math.abs(rounded) < 1e-9) return "0";
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return String(Math.round(rounded));
  }
  const s = String(rounded);
  return s;
}

export function makeSeries(
  partial: Partial<HistogramSeries> & { frequencies: number[] },
): HistogramSeries {
  return {
    id: partial.id ?? newId("s"),
    name: partial.name ?? "",
    color: partial.color ?? GRAPH_CYAN,
    fill: partial.fill ?? FILL_CYAN,
    frequencies: partial.frequencies.map((n) => (Number.isFinite(n) ? Math.max(0, n) : 0)),
    labelDx: partial.labelDx ?? 10,
    labelDy: partial.labelDy ?? -16,
  };
}

function padFrequencies(values: number[] | undefined, count: number): number[] {
  const src = Array.isArray(values) ? values : [];
  const next: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const n = src[i];
    next.push(Number.isFinite(n) ? Math.max(0, n as number) : 0);
  }
  return next;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function maxFrequency(state: Pick<HistogramState, "series">): number {
  let max = 0;
  for (const series of state.series) {
    for (const n of series.frequencies) {
      if (n > max) max = n;
    }
  }
  return max;
}

export function niceYMax(needed: number, tick: number): number {
  const step = tick > 1e-12 ? tick : 1;
  const floor = Math.max(step, needed);
  return Math.ceil((floor - 1e-9) / step) * step;
}

export function normalizeState(state: HistogramState): HistogramState {
  const classCount = Math.min(12, Math.max(3, Math.round(finiteOr(state.classCount, 5))));
  const classWidth = Math.max(0.01, finiteOr(state.classWidth, 1));
  const classStart = finiteOr(state.classStart, 0);
  const yTick = Math.max(0.001, finiteOr(state.yTick, 1));
  const seriesRaw = Array.isArray(state.series) && state.series.length > 0
    ? state.series.slice(0, 2)
    : [makeSeries({ frequencies: Array.from({ length: classCount }, () => 0) })];
  const series = seriesRaw.map((s, i) =>
    makeSeries({
      ...s,
      id: s.id || newId("s"),
      color: s.color || (i === 0 ? GRAPH_CYAN : GRAPH_PINK),
      fill: s.fill || (i === 0 ? FILL_CYAN : FILL_PINK),
      frequencies: padFrequencies(s.frequencies, classCount),
    }),
  );
  const needed = maxFrequency({ series });
  let yMax = Math.max(yTick, finiteOr(state.yMax, niceYMax(needed, yTick)));
  if (yMax + 1e-9 < needed) yMax = niceYMax(needed, yTick);
  const xBreak = classStart > 1e-9 && Boolean(state.xBreak);
  return {
    kind: state.kind === "polygon" ? "polygon" : "histogram",
    classStart,
    classWidth,
    classCount,
    xBreak,
    xAxisLabel: typeof state.xAxisLabel === "string" ? state.xAxisLabel : "",
    yAxisLabel: typeof state.yAxisLabel === "string" ? state.yAxisLabel : "",
    yMax,
    yTick,
    showGrid: state.showGrid !== false,
    showPoints: state.showPoints !== false,
    series,
    style: {
      ...DEFAULT_STYLE,
      ...state.style,
      padding: Math.min(88, Math.max(40, state.style?.padding ?? DEFAULT_STYLE.padding)),
      pointRadius: Math.min(6, Math.max(2, state.style?.pointRadius ?? DEFAULT_STYLE.pointRadius)),
      exportScale: [2, 3, 4].includes(state.style?.exportScale)
        ? state.style.exportScale
        : DEFAULT_STYLE.exportScale,
      gridColor: state.style?.gridColor || GRID_GRAY,
    },
  };
}

function baseState(partial: Partial<HistogramState> = {}): HistogramState {
  return normalizeState({
    kind: "histogram",
    classStart: 0,
    classWidth: 10,
    classCount: 5,
    xBreak: false,
    xAxisLabel: "(점)",
    yAxisLabel: "(명)",
    yMax: 10,
    yTick: 2,
    showGrid: true,
    showPoints: true,
    series: [
      makeSeries({
        id: "s-a",
        frequencies: [2, 5, 8, 6, 3],
        color: GRAPH_CYAN,
        fill: FILL_CYAN,
      }),
    ],
    style: { ...DEFAULT_STYLE },
    ...partial,
  });
}

export const HISTOGRAM_PRESETS: {
  id: string;
  title: string;
  hint: string;
  state: HistogramState;
}[] = [
  {
    id: "humidity-days",
    title: "습도·일수",
    hint: "히스토그램, x축 끊기",
    state: baseState({
      kind: "histogram",
      classStart: 75,
      classWidth: 5,
      classCount: 5,
      xBreak: true,
      xAxisLabel: "(%)",
      yAxisLabel: "(일)",
      yMax: 12,
      yTick: 2,
      series: [
        makeSeries({
          id: "s-a",
          frequencies: [1, 4, 11, 7, 8],
          color: GRAPH_CYAN,
          fill: FILL_CYAN,
        }),
      ],
    }),
  },
  {
    id: "score-polygon",
    title: "점수 다각형",
    hint: "도수분포다각형, 끊기",
    state: baseState({
      kind: "polygon",
      classStart: 4.5,
      classWidth: 0.5,
      classCount: 7,
      xBreak: true,
      xAxisLabel: "(점)",
      yAxisLabel: "(개국)",
      yMax: 12,
      yTick: 2,
      series: [
        makeSeries({
          id: "s-a",
          frequencies: [1, 0, 4, 8, 9, 11, 5],
          color: GRAPH_PINK,
          fill: FILL_PINK,
        }),
      ],
    }),
  },
  {
    id: "two-schools",
    title: "학교 A·B 비교",
    hint: "상대도수 다각형 2개",
    state: baseState({
      kind: "polygon",
      classStart: 0,
      classWidth: 20,
      classCount: 5,
      xBreak: false,
      xAxisLabel: "(점)",
      yAxisLabel: "(상대도수)",
      yMax: 0.3,
      yTick: 0.1,
      series: [
        makeSeries({
          id: "s-a",
          name: "학교 A",
          frequencies: [0.05, 0.15, 0.3, 0.22, 0.18],
          color: GRAPH_PINK,
          fill: FILL_PINK,
          labelDx: 12,
          labelDy: -18,
        }),
        makeSeries({
          id: "s-b",
          name: "학교 B",
          frequencies: [0.08, 0.3, 0.22, 0.18, 0.1],
          color: GRAPH_CYAN,
          fill: FILL_CYAN,
          labelDx: 12,
          labelDy: -18,
        }),
      ],
    }),
  },
];

export const DEFAULT_HISTOGRAM_STATE: HistogramState = structuredClone(
  HISTOGRAM_PRESETS[0]!.state,
);

export function cloneState(state: HistogramState): HistogramState {
  return structuredClone(state);
}

export function polygonVertices(
  state: Pick<HistogramState, "classStart" | "classWidth" | "classCount">,
  frequencies: number[],
): { x: number; y: number }[] {
  const w = state.classWidth;
  const pts: { x: number; y: number }[] = [
    { x: state.classStart - w / 2, y: 0 },
  ];
  for (let i = 0; i < state.classCount; i += 1) {
    pts.push({ x: classMid(state, i), y: frequencies[i] ?? 0 });
  }
  pts.push({ x: classEnd(state) + w / 2, y: 0 });
  return pts;
}

export function seriesPeakIndex(frequencies: number[]): number {
  let best = 0;
  let max = -1;
  frequencies.forEach((n, i) => {
    if (n > max) {
      max = n;
      best = i;
    }
  });
  return best;
}

export function addCompareSeries(state: HistogramState): HistogramState {
  if (state.series.length >= 2) return state;
  const zeros = Array.from({ length: state.classCount }, () => 0);
  return normalizeState({
    ...state,
    series: [
      ...state.series,
      makeSeries({
        frequencies: zeros,
        color: GRAPH_PINK,
        fill: FILL_PINK,
      }),
    ],
  });
}

export function removeSeries(state: HistogramState, id: string): HistogramState {
  if (state.series.length <= 1) return state;
  return normalizeState({
    ...state,
    series: state.series.filter((s) => s.id !== id),
  });
}

export function setFrequency(
  state: HistogramState,
  seriesId: string,
  index: number,
  value: number,
): HistogramState {
  const snapped = Math.max(0, snapValue(value, state.yTick));
  const series = state.series.map((s) => {
    if (s.id !== seriesId) return s;
    const frequencies = s.frequencies.slice();
    if (index < 0 || index >= frequencies.length) return s;
    frequencies[index] = snapped;
    return { ...s, frequencies };
  });
  return normalizeState({ ...state, series });
}

export function patchSeries(
  state: HistogramState,
  seriesId: string,
  patch: Partial<HistogramSeries>,
): HistogramState {
  return normalizeState({
    ...state,
    series: state.series.map((s) =>
      s.id === seriesId ? { ...s, ...patch } : s,
    ),
  });
}
