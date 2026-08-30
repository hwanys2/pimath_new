export const GRAPH_PINK = "#e84a8c";
export const GRAPH_CYAN = "#3db7d4";
export const GRAPH_INK = "#111111";
export const GRID_GRAY = "#d4d4d4";

export type ScatterKind = "single" | "quad";
export type CloudKind = "positive" | "negative" | "none" | "circle";
export type PointRole = "cloud" | "named" | "mark";

export const CLOUD_KIND_LABELS: Record<CloudKind, string> = {
  positive: "양의 상관",
  negative: "음의 상관",
  none: "상관 없음",
  circle: "원형",
};

export type ScatterStyle = {
  lineWidth: number;
  fontSize: number;
  pointLabelSize: number;
  axisNameSize: number;
  titleSize: number;
  pointRadius: number;
  markRadius: number;
  padding: number;
  exportScale: number;
  gridColor: string;
};

export type ScatterPoint = {
  id: string;
  x: number;
  y: number;
  label: string;
  role: PointRole;
  panel: number;
  labelDx: number;
  labelDy: number;
};

export type ScatterState = {
  kind: ScatterKind;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xTick: number;
  yTick: number;
  xGrid: number;
  yGrid: number;
  xAxisLabel: string;
  yAxisLabel: string;
  title: string;
  showTitle: boolean;
  showGrid: boolean;
  showTicks: boolean;
  showOrigin: boolean;
  originLabel: string;
  xBreak: boolean;
  yBreak: boolean;
  yLabelVertical: boolean;
  showPanelNumbers: boolean;
  cloudKind: CloudKind;
  cloudCount: number;
  cloudSpread: number;
  cloudSeed: number;
  panelKinds: CloudKind[];
  pointColor: string;
  markColor: string;
  xAxisLabelDx: number;
  xAxisLabelDy: number;
  yAxisLabelDx: number;
  yAxisLabelDy: number;
  titleDx: number;
  titleDy: number;
  points: ScatterPoint[];
  style: ScatterStyle;
};

const DEFAULT_STYLE: ScatterStyle = {
  lineWidth: 1.45,
  fontSize: 14,
  pointLabelSize: 15,
  axisNameSize: 16,
  titleSize: 20,
  pointRadius: 3.4,
  markRadius: 4.6,
  padding: 68,
  exportScale: 3,
  gridColor: GRID_GRAY,
};

const MARK_NAMES = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export const MIN_CLOUD = 0;
export const MAX_CLOUD = 280;
export const MIN_SPREAD = 0.08;
export const MAX_SPREAD = 0.72;

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
  state: Pick<ScatterState, "xGrid" | "yGrid" | "xTick" | "yTick">,
): number {
  const g = Math.min(
    state.xGrid > 1e-12 ? state.xGrid : state.xTick,
    state.yGrid > 1e-12 ? state.yGrid : state.yTick,
  );
  if (g >= 1) return Math.min(1, g);
  if (g >= 0.5) return 0.5;
  if (g >= 0.1) return 0.1;
  return Math.max(0.01, g);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function generateCloud(
  kind: CloudKind,
  count: number,
  seed: number,
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number },
  spread: number,
): { x: number; y: number }[] {
  const n = Math.min(MAX_CLOUD, Math.max(0, Math.round(count)));
  if (n === 0) return [];
  const rng = mulberry32(seed >>> 0 || 1);
  const xSpan = Math.max(bounds.xMax - bounds.xMin, 1e-9);
  const ySpan = Math.max(bounds.yMax - bounds.yMin, 1e-9);
  const padX = xSpan * 0.07;
  const padY = ySpan * 0.08;
  const x0 = bounds.xMin + padX;
  const x1 = bounds.xMax - padX;
  const y0 = bounds.yMin + padY;
  const y1 = bounds.yMax - padY;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const sx = (x1 - x0) / 2;
  const sy = (y1 - y0) / 2;
  const noise = clamp(spread, MIN_SPREAD, MAX_SPREAD);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    let x: number;
    let y: number;
    if (kind === "positive") {
      const t = rng();
      x = x0 + t * (x1 - x0);
      y = y0 + t * (y1 - y0) + gaussian(rng) * sy * noise;
    } else if (kind === "negative") {
      const t = rng();
      x = x0 + t * (x1 - x0);
      y = y1 - t * (y1 - y0) + gaussian(rng) * sy * noise;
    } else if (kind === "none") {
      x = x0 + rng() * (x1 - x0);
      y = cy + gaussian(rng) * sy * (0.1 + noise * 0.18);
    } else {
      const ang = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * (0.32 + noise * 0.28);
      x = cx + Math.cos(ang) * r * sx * 1.05;
      y = cy + Math.sin(ang) * r * sy * 1.05;
    }
    out.push({
      x: clamp(x, bounds.xMin + xSpan * 0.02, bounds.xMax - xSpan * 0.02),
      y: clamp(y, bounds.yMin + ySpan * 0.02, bounds.yMax - ySpan * 0.02),
    });
  }
  return out;
}

export function dataBounds(
  state: Pick<ScatterState, "xMin" | "xMax" | "yMin" | "yMax">,
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  return {
    xMin: state.xMin,
    xMax: state.xMax,
    yMin: state.yMin,
    yMax: state.yMax,
  };
}

function cloudPoint(
  panel: number,
  index: number,
  x: number,
  y: number,
): ScatterPoint {
  return {
    id: `c-${panel}-${index}`,
    x,
    y,
    label: "",
    role: "cloud",
    panel,
    labelDx: 0,
    labelDy: 0,
  };
}

export function replaceCloud(state: ScatterState, seed = state.cloudSeed): ScatterState {
  const kept = state.points.filter((p) => p.role !== "cloud");
  const bounds = dataBounds(state);
  const spread = clamp(state.cloudSpread, MIN_SPREAD, MAX_SPREAD);
  const next: ScatterPoint[] = [...kept];
  if (state.kind === "quad") {
    const kinds = padPanelKinds(state.panelKinds);
    kinds.forEach((kind, panel) => {
      generateCloud(kind, state.cloudCount, seed + panel * 97, bounds, spread).forEach(
        (pt, i) => {
          next.push(cloudPoint(panel, i, pt.x, pt.y));
        },
      );
    });
  } else if (state.cloudCount > 0) {
    generateCloud(state.cloudKind, state.cloudCount, seed, bounds, spread).forEach(
      (pt, i) => {
        next.push(cloudPoint(0, i, pt.x, pt.y));
      },
    );
  }
  return { ...state, cloudSeed: seed, points: next };
}

function padPanelKinds(kinds: CloudKind[] | undefined): CloudKind[] {
  const fallback: CloudKind[] = ["positive", "negative", "none", "circle"];
  const src = Array.isArray(kinds) ? kinds : fallback;
  return fallback.map((k, i) => (isCloudKind(src[i]) ? src[i]! : k));
}

function isCloudKind(value: unknown): value is CloudKind {
  return (
    value === "positive" ||
    value === "negative" ||
    value === "none" ||
    value === "circle"
  );
}

function isPointRole(value: unknown): value is PointRole {
  return value === "cloud" || value === "named" || value === "mark";
}

export function makePoint(
  partial: Partial<ScatterPoint> & { x: number; y: number },
): ScatterPoint {
  const role: PointRole = isPointRole(partial.role) ? partial.role : "named";
  return {
    id: partial.id ?? newId(role === "mark" ? "m" : role === "cloud" ? "c" : "n"),
    x: finiteOr(partial.x, 0),
    y: finiteOr(partial.y, 0),
    label: typeof partial.label === "string" ? partial.label : "",
    role,
    panel: Math.min(3, Math.max(0, Math.round(finiteOr(partial.panel, 0)))),
    labelDx: finiteOr(partial.labelDx, role === "named" ? 10 : 12),
    labelDy: finiteOr(partial.labelDy, role === "named" ? -8 : -12),
  };
}

export function nextMarkName(points: ScatterPoint[]): string {
  const used = new Set(
    points
      .filter((p) => p.role === "mark")
      .map((p) => p.label.trim().toUpperCase()),
  );
  for (const ch of MARK_NAMES) {
    if (!used.has(ch)) return ch;
  }
  return `P${points.length + 1}`;
}

export function labeledPoints(state: Pick<ScatterState, "points">): ScatterPoint[] {
  return state.points.filter((p) => p.role !== "cloud");
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
  if (majorTick >= 1) return 0.5;
  return majorTick / 2;
}

export function normalizeState(state: ScatterState): ScatterState {
  const xTick = Math.max(0.01, finiteOr(state.xTick, 5));
  const yTick = Math.max(0.01, finiteOr(state.yTick, 1));
  let xMin = finiteOr(state.xMin, 0);
  let xMax = finiteOr(state.xMax, 10);
  let yMin = finiteOr(state.yMin, 0);
  let yMax = finiteOr(state.yMax, 10);
  if (xMax <= xMin + 1e-9) xMax = xMin + xTick;
  if (yMax <= yMin + 1e-9) yMax = yMin + yTick;
  const xGrid = Math.max(0.01, finiteOr(state.xGrid, defaultGridStep(xTick)));
  const yGrid = Math.max(0.01, finiteOr(state.yGrid, defaultGridStep(yTick)));
  const kind: ScatterKind = state.kind === "quad" ? "quad" : "single";
  const cloudKind = isCloudKind(state.cloudKind) ? state.cloudKind : "positive";
  const cloudCount = Math.min(
    MAX_CLOUD,
    Math.max(MIN_CLOUD, Math.round(finiteOr(state.cloudCount, 40))),
  );
  const points = Array.isArray(state.points)
    ? state.points.map((p) =>
        makePoint({
          ...p,
          x: finiteOr(p.x, 0),
          y: finiteOr(p.y, 0),
        }),
      )
    : [];
  return {
    kind,
    xMin,
    xMax,
    yMin,
    yMax,
    xTick,
    yTick,
    xGrid,
    yGrid,
    xAxisLabel: typeof state.xAxisLabel === "string" ? state.xAxisLabel : "",
    yAxisLabel: typeof state.yAxisLabel === "string" ? state.yAxisLabel : "",
    title: typeof state.title === "string" ? state.title : "",
    showTitle: Boolean(state.showTitle),
    showGrid: state.showGrid !== false,
    showTicks: state.showTicks !== false,
    showOrigin: state.showOrigin !== false,
    originLabel: typeof state.originLabel === "string" ? state.originLabel : "O",
    xBreak: xMin > 1e-9 && Boolean(state.xBreak),
    yBreak: yMin > 1e-9 && Boolean(state.yBreak),
    yLabelVertical: state.yLabelVertical !== false,
    showPanelNumbers: state.showPanelNumbers !== false,
    cloudKind,
    cloudCount,
    cloudSpread: clamp(finiteOr(state.cloudSpread, 0.32), MIN_SPREAD, MAX_SPREAD),
    cloudSeed: Math.round(finiteOr(state.cloudSeed, 1)) || 1,
    panelKinds: padPanelKinds(state.panelKinds),
    pointColor: typeof state.pointColor === "string" ? state.pointColor : GRAPH_PINK,
    markColor: typeof state.markColor === "string" ? state.markColor : GRAPH_INK,
    xAxisLabelDx: finiteOr(state.xAxisLabelDx, 0),
    xAxisLabelDy: finiteOr(state.xAxisLabelDy, 0),
    yAxisLabelDx: finiteOr(state.yAxisLabelDx, 0),
    yAxisLabelDy: finiteOr(state.yAxisLabelDy, 0),
    titleDx: finiteOr(state.titleDx, 0),
    titleDy: finiteOr(state.titleDy, 0),
    points,
    style: {
      ...DEFAULT_STYLE,
      ...state.style,
      padding: Math.min(120, Math.max(40, state.style?.padding ?? DEFAULT_STYLE.padding)),
      pointRadius: Math.min(
        8,
        Math.max(1.4, state.style?.pointRadius ?? DEFAULT_STYLE.pointRadius),
      ),
      markRadius: Math.min(
        10,
        Math.max(2, state.style?.markRadius ?? DEFAULT_STYLE.markRadius),
      ),
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

function baseState(partial: Partial<ScatterState> = {}): ScatterState {
  return normalizeState({
    kind: "single",
    xMin: 0,
    xMax: 10,
    yMin: 0,
    yMax: 10,
    xTick: 2,
    yTick: 2,
    xGrid: 1,
    yGrid: 1,
    xAxisLabel: "$x$",
    yAxisLabel: "$y$",
    title: "",
    showTitle: false,
    showGrid: true,
    showTicks: true,
    showOrigin: true,
    originLabel: "O",
    xBreak: false,
    yBreak: false,
    yLabelVertical: true,
    showPanelNumbers: true,
    cloudKind: "positive",
    cloudCount: 40,
    cloudSpread: 0.32,
    cloudSeed: 7,
    panelKinds: ["positive", "negative", "none", "circle"],
    pointColor: GRAPH_PINK,
    markColor: GRAPH_INK,
    xAxisLabelDx: 0,
    xAxisLabelDy: 0,
    yAxisLabelDx: 0,
    yAxisLabelDy: 0,
    titleDx: 0,
    titleDy: 0,
    points: [],
    style: { ...DEFAULT_STYLE },
    ...partial,
  });
}

function markAt(
  label: string,
  x: number,
  y: number,
  dx: number,
  dy: number,
): ScatterPoint {
  return makePoint({
    id: `m-${label}`,
    x,
    y,
    label,
    role: "mark",
    panel: 0,
    labelDx: dx,
    labelDy: dy,
  });
}

const FOOD_ITEMS: { label: string; x: number; y: number; dx: number; dy: number }[] = [
  { label: "소고기뭇국", x: 48, y: 2.2, dx: 14, dy: -10 },
  { label: "된장찌개", x: 78, y: 4.2, dx: -8, dy: 14 },
  { label: "순댓국", x: 102, y: 6.4, dx: 12, dy: -11 },
  { label: "김치찌개", x: 128, y: 8.6, dx: 12, dy: -10 },
  { label: "라면", x: 148, y: 7.2, dx: 12, dy: 12 },
  { label: "두부조림", x: 158, y: 9.4, dx: 14, dy: -8 },
  { label: "비빔밥", x: 172, y: 5.8, dx: 12, dy: 12 },
  { label: "소불고기", x: 188, y: 11.2, dx: 12, dy: -10 },
  { label: "제육볶음", x: 208, y: 13.4, dx: 12, dy: -10 },
  { label: "해물파전", x: 228, y: 12.2, dx: 12, dy: 12 },
  { label: "치킨", x: 248, y: 15.2, dx: 10, dy: -10 },
  { label: "돈가스", x: 276, y: 17.6, dx: -8, dy: -12 },
];

export const SCATTER_PRESETS: {
  id: string;
  title: string;
  hint: string;
  state: ScatterState;
}[] = [
  {
    id: "depth-oxygen",
    title: "수심·용존산소",
    hint: "음의 상관, y축 끊기",
    state: replaceCloud(
      baseState({
        xMin: 0,
        xMax: 30,
        yMin: 4,
        yMax: 6.5,
        xTick: 5,
        yTick: 0.5,
        xGrid: 2.5,
        yGrid: 0.25,
        xAxisLabel: "수심(m)",
        yAxisLabel: "용존 산소량(mg/L)",
        yBreak: true,
        yLabelVertical: true,
        cloudKind: "negative",
        cloudCount: 28,
        cloudSpread: 0.28,
        cloudSeed: 19,
        showGrid: true,
        showTicks: true,
      }),
    ),
  },
  {
    id: "volume-price",
    title: "용량·가격",
    hint: "양의 상관, 점 A~D",
    state: replaceCloud(
      baseState({
        xMin: 0,
        xMax: 500,
        yMin: 0,
        yMax: 4000,
        xTick: 100,
        yTick: 1000,
        xGrid: 50,
        yGrid: 500,
        xAxisLabel: "용량(mL)",
        yAxisLabel: "가격(원)",
        yLabelVertical: true,
        cloudKind: "positive",
        cloudCount: 160,
        cloudSpread: 0.22,
        cloudSeed: 41,
        showGrid: false,
        showTicks: false,
        style: { ...DEFAULT_STYLE, pointRadius: 2.05, markRadius: 4.8 },
        points: [
          markAt("C", 95, 780, -14, 14),
          markAt("A", 230, 2920, 0, -14),
          markAt("B", 405, 3380, 12, -12),
          markAt("D", 455, 1180, 12, 12),
        ],
      }),
    ),
  },
  {
    id: "correlation-four",
    title: "상관 비교",
    hint: "양의·음의·없음·원형 2×2",
    state: replaceCloud(
      baseState({
        kind: "quad",
        xMin: 0,
        xMax: 10,
        yMin: 0,
        yMax: 10,
        xTick: 2,
        yTick: 2,
        xGrid: 1,
        yGrid: 1,
        xAxisLabel: "$x$(세)",
        yAxisLabel: "$y$(회)",
        yLabelVertical: false,
        showGrid: false,
        showTicks: false,
        showPanelNumbers: true,
        cloudCount: 70,
        cloudSpread: 0.24,
        cloudSeed: 11,
        panelKinds: ["positive", "negative", "none", "circle"],
        style: { ...DEFAULT_STYLE, pointRadius: 2.15, axisNameSize: 14, padding: 48 },
      }),
    ),
  },
  {
    id: "calories-fat",
    title: "열량·지방",
    hint: "음식 이름 붙인 점",
    state: baseState({
      xMin: 0,
      xMax: 300,
      yMin: 0,
      yMax: 20,
      xTick: 30,
      yTick: 4,
      xGrid: 30,
      yGrid: 4,
      xAxisLabel: "열량(kcal)",
      yAxisLabel: "지방 함량(g)",
      yLabelVertical: true,
      cloudKind: "positive",
      cloudCount: 0,
      showGrid: true,
      showTicks: true,
      points: FOOD_ITEMS.map((item) =>
        makePoint({
          id: `n-${item.label}`,
          x: item.x,
          y: item.y,
          label: item.label,
          role: "named",
          panel: 0,
          labelDx: item.dx,
          labelDy: item.dy,
        }),
      ),
    }),
  },
];

export const DEFAULT_SCATTER_STATE: ScatterState = structuredClone(
  SCATTER_PRESETS[0]!.state,
);

export function hasChartTitle(
  state: Pick<ScatterState, "title" | "showTitle">,
): boolean {
  return Boolean(state.showTitle) && state.title.trim().length > 0;
}

export function cloneState(state: ScatterState): ScatterState {
  return structuredClone(state);
}

export function setKind(state: ScatterState, kind: ScatterKind): ScatterState {
  if (kind === state.kind) return state;
  if (kind === "quad") {
    return replaceCloud(
      normalizeState({
        ...state,
        kind,
        showGrid: false,
        showTicks: false,
        cloudCount: Math.max(40, state.cloudCount),
      }),
    );
  }
  return replaceCloud(
    normalizeState({
      ...state,
      kind,
      points: state.points.filter((p) => p.panel === 0 && p.role !== "cloud"),
    }),
  );
}

export function setCloudKind(state: ScatterState, cloudKind: CloudKind): ScatterState {
  return replaceCloud(normalizeState({ ...state, cloudKind }));
}

export function setPanelKind(
  state: ScatterState,
  index: number,
  kind: CloudKind,
): ScatterState {
  const panelKinds = padPanelKinds(state.panelKinds).slice();
  if (index < 0 || index > 3) return state;
  panelKinds[index] = kind;
  return replaceCloud(normalizeState({ ...state, panelKinds }));
}

export function setCloudCount(state: ScatterState, cloudCount: number): ScatterState {
  return replaceCloud(normalizeState({ ...state, cloudCount }));
}

export function setCloudSpread(state: ScatterState, cloudSpread: number): ScatterState {
  return replaceCloud(normalizeState({ ...state, cloudSpread }));
}

export function reshuffleCloud(state: ScatterState): ScatterState {
  return replaceCloud(state, state.cloudSeed + 1);
}

export function clearCloud(state: ScatterState): ScatterState {
  return normalizeState({
    ...state,
    cloudCount: 0,
    points: state.points.filter((p) => p.role !== "cloud"),
  });
}

export function addPoint(
  state: ScatterState,
  partial: Partial<ScatterPoint> & { x: number; y: number },
): ScatterState {
  const role: PointRole = isPointRole(partial.role) ? partial.role : "named";
  const label =
    typeof partial.label === "string"
      ? partial.label
      : role === "mark"
        ? nextMarkName(state.points)
        : "";
  const point = makePoint({
    ...partial,
    role,
    label,
    panel: state.kind === "quad" ? Math.min(3, Math.max(0, partial.panel ?? 0)) : 0,
  });
  return normalizeState({
    ...state,
    points: [...state.points, point],
  });
}

export function removePoint(state: ScatterState, id: string): ScatterState {
  return normalizeState({
    ...state,
    points: state.points.filter((p) => p.id !== id),
  });
}

export function patchPoint(
  state: ScatterState,
  id: string,
  patch: Partial<ScatterPoint>,
): ScatterState {
  return normalizeState({
    ...state,
    points: state.points.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
}

export function movePoint(
  state: ScatterState,
  id: string,
  x: number,
  y: number,
  snap = true,
): ScatterState {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return state;
  const step = valueSnapStep(state);
  const nx = snap ? snapValue(x, step) : x;
  const ny = snap ? snapValue(y, step) : y;
  const clampedX = clamp(nx, state.xMin, state.xMax);
  const clampedY = clamp(ny, state.yMin, state.yMax);
  return patchPoint(state, id, { x: clampedX, y: clampedY });
}

export function parsePointTable(
  text: string,
): { label: string; x: number; y: number }[] {
  const out: { label: string; x: number; y: number }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const comma = line.split(/[\t,]+/).map((s) => s.trim()).filter(Boolean);
    const parts = comma.length >= 2 ? comma : line.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const x = Number(parts[parts.length - 2]);
    const y = Number(parts[parts.length - 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ label: parts.slice(0, -2).join(" "), x, y });
  }
  return out;
}

export function importPoints(
  state: ScatterState,
  rows: { label: string; x: number; y: number }[],
  role: PointRole = "named",
): ScatterState {
  if (rows.length === 0) return state;
  let next = state;
  for (const row of rows) {
    next = addPoint(next, {
      x: row.x,
      y: row.y,
      label: row.label,
      role: row.label.trim().length === 1 && /^[A-Za-z]$/.test(row.label.trim())
        ? "mark"
        : role,
    });
  }
  return next;
}

export function pointExtent(state: Pick<ScatterState, "points">): {
  loX: number;
  hiX: number;
  loY: number;
  hiY: number;
} {
  if (state.points.length === 0) {
    return { loX: 0, hiX: 10, loY: 0, hiY: 10 };
  }
  let loX = Infinity;
  let hiX = -Infinity;
  let loY = Infinity;
  let hiY = -Infinity;
  for (const p of state.points) {
    loX = Math.min(loX, p.x);
    hiX = Math.max(hiX, p.x);
    loY = Math.min(loY, p.y);
    hiY = Math.max(hiY, p.y);
  }
  return { loX, hiX, loY, hiY };
}

export function fitAxisToData(state: ScatterState): ScatterState {
  const { loX, hiX, loY, hiY } = pointExtent(state);
  const xSpan = Math.max(hiX - loX, 1e-6);
  const ySpan = Math.max(hiY - loY, 1e-6);
  const xTick = niceTick(xSpan);
  const yTick = niceTick(ySpan);
  const xMin = Math.min(0, Math.floor((loX - xTick * 0.1) / xTick) * xTick);
  const xMax = Math.ceil((hiX + xTick * 0.15) / xTick) * xTick;
  const yMin = Math.min(0, Math.floor((loY - yTick * 0.1) / yTick) * yTick);
  const yMax = Math.ceil((hiY + yTick * 0.15) / yTick) * yTick;
  return normalizeState({
    ...state,
    xMin,
    xMax: Math.max(xMax, xMin + xTick),
    yMin,
    yMax: Math.max(yMax, yMin + yTick),
    xTick,
    yTick,
    xGrid: defaultGridStep(xTick),
    yGrid: defaultGridStep(yTick),
  });
}

export function cloudTrend(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0;
  const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const my = points.reduce((s, p) => s + p.y, 0) / points.length;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den < 1e-12) return 0;
  return num / den;
}
