export const GRID_GRAY = "#d4d4d4";
export const GRAPH_PINK = "#e84a8c";
export const INK = "#111111";

export const BOX_PALETTE = [
  { id: "salmon", fill: "rgba(240, 157, 148, 0.78)", pill: "#f7c9c4", label: "살구" },
  { id: "mint", fill: "rgba(154, 201, 154, 0.78)", pill: "#c5e0c5", label: "연두" },
  { id: "gold", fill: "rgba(236, 196, 106, 0.82)", pill: "#f5d78a", label: "노랑" },
  { id: "lavender", fill: "rgba(186, 168, 214, 0.78)", pill: "#d4c6eb", label: "보라" },
  { id: "cyan", fill: "rgba(61, 183, 212, 0.42)", pill: "#b5e4ef", label: "청록" },
  { id: "pink", fill: "rgba(232, 74, 140, 0.38)", pill: "#f5c0d6", label: "분홍" },
] as const;

export const PILL_COLORS = [
  { id: "pill-pink", fill: "#f5c4c8", label: "분홍" },
  { id: "pill-blue", fill: "#c5e4f5", label: "하늘" },
  { id: "pill-peach", fill: "#f7d4b8", label: "복숭아" },
  { id: "pill-mint", fill: "#c8e8d4", label: "민트" },
] as const;

export type BoxOrientation = "horizontal" | "vertical";

export const STAT_KEYS = ["min", "q1", "median", "q3", "max"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  min: "최솟값",
  q1: "Q1",
  median: "중앙값",
  q3: "Q3",
  max: "최댓값",
};

export type FiveNumber = {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
};

export type BoxPlotStyle = {
  lineWidth: number;
  fontSize: number;
  pointLabelSize: number;
  axisNameSize: number;
  titleSize: number;
  padding: number;
  exportScale: number;
  gridColor: string;
};

export type BoxSeries = {
  id: string;
  name: string;
  fill: string;
  pillFill: string;
  values: FiveNumber;
  labelDx: number;
  labelDy: number;
};

export type BoxPlotState = {
  orientation: BoxOrientation;
  axisMin: number;
  axisMax: number;
  majorTick: number;
  gridStep: number;
  axisLabel: string;
  title: string;
  showTitle: boolean;
  showGrid: boolean;
  showFrame: boolean;
  showValueArrows: boolean;
  showNamePills: boolean;
  axisLabelDx: number;
  axisLabelDy: number;
  titleDx: number;
  titleDy: number;
  series: BoxSeries[];
  style: BoxPlotStyle;
};

const DEFAULT_STYLE: BoxPlotStyle = {
  lineWidth: 1.45,
  fontSize: 14,
  pointLabelSize: 15,
  axisNameSize: 16,
  titleSize: 20,
  padding: 52,
  exportScale: 3,
  gridColor: GRID_GRAY,
};

export const MIN_SERIES = 1;
export const MAX_SERIES = 4;

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
  return String(rounded);
}

export function valueSnapStep(
  state: Pick<BoxPlotState, "gridStep" | "majorTick">,
): number {
  const g = state.gridStep > 1e-12 ? state.gridStep : state.majorTick;
  if (g >= 1) return 1;
  if (g >= 0.5) return 0.5;
  if (g >= 0.1) return 0.1;
  return Math.max(0.01, g);
}

export function sortFive(values: FiveNumber): FiveNumber {
  const arr = [values.min, values.q1, values.median, values.q3, values.max]
    .map((n) => (Number.isFinite(n) ? n : 0))
    .sort((a, b) => a - b);
  return {
    min: arr[0]!,
    q1: arr[1]!,
    median: arr[2]!,
    q3: arr[3]!,
    max: arr[4]!,
  };
}

export function makeFive(partial: Partial<FiveNumber> = {}): FiveNumber {
  return sortFive({
    min: finiteOr(partial.min, 2),
    q1: finiteOr(partial.q1, 6),
    median: finiteOr(partial.median, 8),
    q3: finiteOr(partial.q3, 14),
    max: finiteOr(partial.max, 22),
  });
}

export function orderFive(values: FiveNumber, key: StatKey): FiveNumber {
  const next = { ...values };
  const idx = STAT_KEYS.indexOf(key);
  for (let i = idx + 1; i < STAT_KEYS.length; i += 1) {
    const prevKey = STAT_KEYS[i - 1]!;
    const k = STAT_KEYS[i]!;
    if (next[k] < next[prevKey]) next[k] = next[prevKey];
  }
  for (let i = idx - 1; i >= 0; i -= 1) {
    const nextKey = STAT_KEYS[i + 1]!;
    const k = STAT_KEYS[i]!;
    if (next[k] > next[nextKey]) next[k] = next[nextKey];
  }
  return next;
}

export function clampStat(
  value: number,
  key: StatKey,
  values: FiveNumber,
  axisMin: number,
  axisMax: number,
): number {
  const idx = STAT_KEYS.indexOf(key);
  const lo = idx <= 0 ? axisMin : values[STAT_KEYS[idx - 1]!];
  const hi = idx >= STAT_KEYS.length - 1 ? axisMax : values[STAT_KEYS[idx + 1]!];
  return Math.min(hi, Math.max(lo, value));
}

export function iqr(values: FiveNumber): number {
  return values.q3 - values.q1;
}

export function dataRange(values: FiveNumber): number {
  return values.max - values.min;
}

export function makeSeries(
  partial: Partial<BoxSeries> & { values?: Partial<FiveNumber> } = {},
): BoxSeries {
  const idx = 0;
  const palette = BOX_PALETTE[idx]!;
  return {
    id: partial.id ?? newId("b"),
    name: typeof partial.name === "string" ? partial.name : "",
    fill: partial.fill ?? palette.fill,
    pillFill: partial.pillFill ?? PILL_COLORS[0]!.fill,
    values: makeFive(partial.values),
    labelDx: finiteOr(partial.labelDx, 0),
    labelDy: finiteOr(partial.labelDy, 0),
  };
}

export function seriesExtent(state: Pick<BoxPlotState, "series">): {
  lo: number;
  hi: number;
} {
  let lo = Infinity;
  let hi = -Infinity;
  for (const series of state.series) {
    lo = Math.min(lo, series.values.min);
    hi = Math.max(hi, series.values.max);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 10 };
  return { lo, hi };
}

function niceTick(range: number): number {
  if (!(range > 0)) return 1;
  const raw = range / 6;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  if (n <= 1) return pow;
  if (n <= 2) return 2 * pow;
  if (n <= 5) return 5 * pow;
  return 10 * pow;
}

export function defaultGridStep(majorTick: number): number {
  if (!(majorTick > 0)) return 1;
  if (majorTick >= 10 && Math.abs(majorTick / 5 - Math.round(majorTick / 5)) < 1e-9) {
    return majorTick / 5;
  }
  if (majorTick >= 2) return Math.min(1, majorTick / 2);
  return majorTick;
}

function expandAxis(state: BoxPlotState): BoxPlotState {
  const { lo, hi } = seriesExtent(state);
  if (lo >= state.axisMin - 1e-9 && hi <= state.axisMax + 1e-9) return state;
  const tick = state.majorTick > 1e-12 ? state.majorTick : 1;
  const axisMin = Math.min(state.axisMin, Math.floor((lo - 1e-9) / tick) * tick);
  const axisMax = Math.max(state.axisMax, Math.ceil((hi + 1e-9) / tick) * tick);
  return {
    ...state,
    axisMin,
    axisMax: Math.max(axisMax, axisMin + tick),
  };
}

export function fitAxisToData(state: BoxPlotState): BoxPlotState {
  const { lo, hi } = seriesExtent(state);
  const span = Math.max(hi - lo, 1e-6);
  const majorTick = niceTick(span);
  const pad = majorTick;
  const axisMin = Math.floor((lo - pad * 0.15) / majorTick) * majorTick;
  const axisMax = Math.ceil((hi + pad * 0.15) / majorTick) * majorTick;
  return normalizeState({
    ...state,
    axisMin,
    axisMax: Math.max(axisMax, axisMin + majorTick),
    majorTick,
    gridStep: defaultGridStep(majorTick),
  });
}

export function normalizeState(state: BoxPlotState): BoxPlotState {
  const majorTick = Math.max(0.01, finiteOr(state.majorTick, 2));
  let gridStep = Math.max(0.01, finiteOr(state.gridStep, defaultGridStep(majorTick)));
  let axisMin = finiteOr(state.axisMin, 0);
  let axisMax = finiteOr(state.axisMax, 10);
  if (axisMax <= axisMin + 1e-9) axisMax = axisMin + majorTick;
  const rawSeries =
    Array.isArray(state.series) && state.series.length > 0
      ? state.series.slice(0, MAX_SERIES)
      : [makeSeries()];
  const series = rawSeries.map((s, i) => {
    const palette = BOX_PALETTE[i % BOX_PALETTE.length]!;
    const pill = PILL_COLORS[i % PILL_COLORS.length]!;
    return makeSeries({
      ...s,
      id: s.id || newId("b"),
      fill: s.fill || palette.fill,
      pillFill: s.pillFill || pill.fill,
      values: s.values,
    });
  });
  return {
    orientation: state.orientation === "vertical" ? "vertical" : "horizontal",
    axisMin,
    axisMax,
    majorTick,
    gridStep,
    axisLabel: typeof state.axisLabel === "string" ? state.axisLabel : "",
    title: typeof state.title === "string" ? state.title : "",
    showTitle: Boolean(state.showTitle),
    showGrid: state.showGrid !== false,
    showFrame: state.showFrame !== false,
    showValueArrows: Boolean(state.showValueArrows),
    showNamePills: state.showNamePills !== false,
    axisLabelDx: finiteOr(state.axisLabelDx, 0),
    axisLabelDy: finiteOr(state.axisLabelDy, 0),
    titleDx: finiteOr(state.titleDx, 0),
    titleDy: finiteOr(state.titleDy, 0),
    series,
    style: {
      ...DEFAULT_STYLE,
      ...state.style,
      padding: Math.min(96, Math.max(36, state.style?.padding ?? DEFAULT_STYLE.padding)),
      axisNameSize: Math.min(
        36,
        Math.max(12, state.style?.axisNameSize ?? DEFAULT_STYLE.axisNameSize),
      ),
      titleSize: Math.min(
        40,
        Math.max(12, state.style?.titleSize ?? DEFAULT_STYLE.titleSize),
      ),
      exportScale: [2, 3, 4].includes(state.style?.exportScale)
        ? state.style.exportScale
        : DEFAULT_STYLE.exportScale,
      gridColor: state.style?.gridColor || GRID_GRAY,
    },
  };
}

function baseState(partial: Partial<BoxPlotState> = {}): BoxPlotState {
  return normalizeState({
    orientation: "horizontal",
    axisMin: 2,
    axisMax: 22,
    majorTick: 2,
    gridStep: 1,
    axisLabel: "(장)",
    title: "",
    showTitle: false,
    showGrid: true,
    showFrame: true,
    showValueArrows: true,
    showNamePills: true,
    axisLabelDx: 0,
    axisLabelDy: 0,
    titleDx: 0,
    titleDy: 0,
    series: [
      makeSeries({
        id: "b-a",
        fill: BOX_PALETTE[0].fill,
        pillFill: PILL_COLORS[0].fill,
        values: { min: 2, q1: 6, median: 8, q3: 14, max: 22 },
      }),
    ],
    style: { ...DEFAULT_STYLE },
    ...partial,
  });
}

export const BOXPLOT_PRESETS: {
  id: string;
  title: string;
  hint: string;
  state: BoxPlotState;
}[] = [
  {
    id: "reading-pages",
    title: "가로 · 하나",
    hint: "최솟값~최댓값, 값 화살표",
    state: baseState(),
  },
  {
    id: "tree-height",
    title: "세로 · 나무 높이",
    hint: "제목·단위, 연두 상자",
    state: baseState({
      orientation: "vertical",
      axisMin: 10,
      axisMax: 27,
      majorTick: 5,
      gridStep: 1,
      axisLabel: "(m)",
      title: "나무의 높이",
      showTitle: true,
      showValueArrows: false,
      series: [
        makeSeries({
          id: "b-a",
          fill: BOX_PALETTE[1].fill,
          pillFill: PILL_COLORS[0].fill,
          values: { min: 11, q1: 16, median: 21, q3: 24, max: 26 },
        }),
      ],
    }),
  },
  {
    id: "two-factories",
    title: "세로 · 공장 비교",
    hint: "상자 두 개, 이름 알약",
    state: baseState({
      orientation: "vertical",
      axisMin: 0,
      axisMax: 36,
      majorTick: 10,
      gridStep: 2,
      axisLabel: "(켤레)",
      title: "불량품 수",
      showTitle: true,
      showValueArrows: false,
      series: [
        makeSeries({
          id: "b-a",
          name: "공장 A",
          fill: BOX_PALETTE[2].fill,
          pillFill: PILL_COLORS[0].fill,
          values: { min: 4, q1: 12, median: 16, q3: 20, max: 24 },
        }),
        makeSeries({
          id: "b-b",
          name: "공장 B",
          fill: BOX_PALETTE[2].fill,
          pillFill: PILL_COLORS[1].fill,
          values: { min: 10, q1: 16, median: 24, q3: 28, max: 34 },
        }),
      ],
    }),
  },
  {
    id: "class-ages",
    title: "가로 · 반 나이",
    hint: "탁구반·요가반 비교",
    state: baseState({
      orientation: "horizontal",
      axisMin: 10,
      axisMax: 60,
      majorTick: 10,
      gridStep: 2,
      axisLabel: "(세)",
      title: "나이",
      showTitle: true,
      showValueArrows: false,
      series: [
        makeSeries({
          id: "b-a",
          name: "탁구반",
          fill: BOX_PALETTE[3].fill,
          pillFill: PILL_COLORS[0].fill,
          values: { min: 16, q1: 24, median: 30, q3: 40, max: 46 },
        }),
        makeSeries({
          id: "b-b",
          name: "요가반",
          fill: BOX_PALETTE[3].fill,
          pillFill: PILL_COLORS[1].fill,
          values: { min: 22, q1: 30, median: 44, q3: 50, max: 58 },
        }),
      ],
    }),
  },
];

export const DEFAULT_BOXPLOT_STATE: BoxPlotState = structuredClone(
  BOXPLOT_PRESETS[0]!.state,
);

export function hasChartTitle(state: Pick<BoxPlotState, "title" | "showTitle">): boolean {
  return Boolean(state.showTitle) && state.title.trim().length > 0;
}

export function cloneState(state: BoxPlotState): BoxPlotState {
  return structuredClone(state);
}

export function addSeries(state: BoxPlotState): BoxPlotState {
  if (state.series.length >= MAX_SERIES) return state;
  const last = state.series[state.series.length - 1]!;
  const pill = PILL_COLORS[state.series.length % PILL_COLORS.length]!;
  const step = state.majorTick > 0 ? state.majorTick : 1;
  const shifted = makeFive({
    min: last.values.min + step,
    q1: last.values.q1 + step,
    median: last.values.median + step,
    q3: last.values.q3 + step,
    max: last.values.max + step,
  });
  return expandAxis(
    normalizeState({
      ...state,
      series: [
        ...state.series,
        makeSeries({
          name: `상자 ${state.series.length + 1}`,
          fill: last.fill,
          pillFill: pill.fill,
          values: shifted,
        }),
      ],
    }),
  );
}

export function removeSeries(state: BoxPlotState, id: string): BoxPlotState {
  if (state.series.length <= MIN_SERIES) return state;
  return normalizeState({
    ...state,
    series: state.series.filter((s) => s.id !== id),
  });
}

export function patchSeries(
  state: BoxPlotState,
  seriesId: string,
  patch: Partial<BoxSeries>,
): BoxPlotState {
  return normalizeState({
    ...state,
    series: state.series.map((s) =>
      s.id === seriesId ? { ...s, ...patch, values: patch.values ?? s.values } : s,
    ),
  });
}

export function setStat(
  state: BoxPlotState,
  seriesId: string,
  key: StatKey,
  raw: number,
  mode: "clamp" | "cascade" = "cascade",
): BoxPlotState {
  if (!Number.isFinite(raw)) return state;
  const step = valueSnapStep(state);
  const snapped = snapValue(raw, step);
  const series = state.series.map((s) => {
    if (s.id !== seriesId) return s;
    if (mode === "clamp") {
      const value = clampStat(snapped, key, s.values, state.axisMin, state.axisMax);
      return { ...s, values: { ...s.values, [key]: value } };
    }
    return { ...s, values: orderFive({ ...s.values, [key]: snapped }, key) };
  });
  if (mode === "clamp") return normalizeState({ ...state, series });
  return expandAxis(normalizeState({ ...state, series }));
}

export function namedSeries(state: Pick<BoxPlotState, "series" | "showNamePills">): BoxSeries[] {
  if (!state.showNamePills) return [];
  return state.series.filter((s) => s.name.trim().length > 0);
}
