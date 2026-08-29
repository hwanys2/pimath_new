import {
  formatPointLabel,
  formatPointValue,
  parseNumberLineValue,
  rewriteInputRaw,
} from "@/lib/diagrams/number-line/parse";

export type InequalityKind = "blank" | "ray" | "segment" | "split";
export type RayDirection = "left" | "right";
export type BoundKey = "start" | "end";

export type InequalityBound = {
  value: number;
  inputRaw: string;
  inclusive: boolean;
  showValue: boolean;
  labelDx: number;
  labelDy: number;
};

export type InequalityStyle = {
  lineWidth: number;
  fontSize: number;
  pointLabelSize: number;
  pointRadius: number;
  shelfHeight: number;
  paddingX: number;
  paddingY: number;
  exportScale: number;
};

export type InequalityState = {
  min: number;
  max: number;
  tickStep: number;
  labelEvery: number;
  leftArrow: boolean;
  rightArrow: boolean;
  showTickLabels: boolean;
  plusOnPositive: boolean;
  kind: InequalityKind;
  direction: RayDirection;
  start: InequalityBound;
  end: InequalityBound;
  showFill: boolean;
  fillHex: string;
  fillAlpha: number;
  style: InequalityStyle;
};

export const FILL_PRESETS: { id: string; hex: string; label: string }[] = [
  { id: "pink", hex: "#e84a8c", label: "분홍" },
  { id: "cyan", hex: "#3db7d4", label: "청록" },
  { id: "gray", hex: "#6b7280", label: "회색" },
  { id: "gold", hex: "#d4a017", label: "노랑" },
];

const DEFAULT_STYLE: InequalityStyle = {
  lineWidth: 1.7,
  fontSize: 18,
  pointLabelSize: 18,
  pointRadius: 5.6,
  shelfHeight: 38,
  paddingX: 44,
  paddingY: 28,
  exportScale: 3,
};

export function normalizeHex(hex: string): string {
  const raw = hex.replace("#", "").trim().toLowerCase();
  if (/^[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  }
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  return "#e84a8c";
}

export function fillRgba(hex: string, alpha: number): string {
  const full = normalizeHex(hex).slice(1);
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const a = Math.min(1, Math.max(0, Number.isFinite(alpha) ? alpha : 0.28));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function makeBound(
  partial: Partial<InequalityBound> & { value: number },
): InequalityBound {
  return {
    value: partial.value,
    inputRaw: partial.inputRaw ?? formatPointValue(partial.value),
    inclusive: partial.inclusive ?? false,
    showValue: partial.showValue ?? false,
    labelDx: partial.labelDx ?? 0,
    labelDy: partial.labelDy ?? 0,
  };
}

function clampRange(min: number, max: number, tickStep: number) {
  let a = Number.isFinite(min) ? min : 0;
  let b = Number.isFinite(max) ? max : 4;
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }
  const step = Math.max(tickStep, 0.1);
  if (b - a < step) b = a + step;
  if (b - a > 40) b = a + 40;
  return { min: a, max: b, tickStep: step };
}

function clampBound(
  bound: InequalityBound,
  min: number,
  max: number,
): InequalityBound {
  const value = Math.min(max, Math.max(min, bound.value));
  return {
    ...bound,
    value,
    inputRaw:
      Math.abs(value - bound.value) < 1e-9
        ? bound.inputRaw
        : rewriteInputRaw(bound.inputRaw, value),
  };
}

export function boundKeys(kind: InequalityKind): BoundKey[] {
  if (kind === "blank") return [];
  if (kind === "ray") return ["start"];
  return ["start", "end"];
}

export function normalizeState(state: InequalityState): InequalityState {
  const range = clampRange(state.min, state.max, state.tickStep);
  const labelEvery = Math.max(1, Math.round(state.labelEvery || 1));
  const kind: InequalityKind =
    state.kind === "ray" || state.kind === "segment" || state.kind === "split"
      ? state.kind
      : "blank";
  let start = clampBound(state.start, range.min, range.max);
  let end = clampBound(state.end, range.min, range.max);
  if (kind === "segment" || kind === "split") {
    if (start.value > end.value + 1e-9) {
      const swapped = start;
      start = end;
      end = swapped;
    }
    if (Math.abs(end.value - start.value) < 1e-9) {
      const bumped = Math.min(range.max, start.value + range.tickStep);
      end = {
        ...end,
        value: bumped,
        inputRaw: rewriteInputRaw(end.inputRaw, bumped),
      };
    }
  }
  const style = { ...DEFAULT_STYLE, ...state.style };
  return {
    ...state,
    min: range.min,
    max: range.max,
    tickStep: range.tickStep,
    labelEvery,
    kind,
    direction: state.direction === "left" ? "left" : "right",
    start,
    end,
    showFill: Boolean(state.showFill),
    fillHex: normalizeHex(state.fillHex || "#e84a8c"),
    fillAlpha: Math.min(0.7, Math.max(0.06, state.fillAlpha || 0.28)),
    style: {
      ...style,
      lineWidth: Math.min(3.5, Math.max(1, style.lineWidth)),
      fontSize: Math.min(36, Math.max(12, style.fontSize)),
      pointLabelSize: Math.min(36, Math.max(12, style.pointLabelSize)),
      pointRadius: Math.min(10, Math.max(3, style.pointRadius)),
      shelfHeight: Math.min(80, Math.max(16, style.shelfHeight)),
      paddingX: Math.min(90, Math.max(28, style.paddingX)),
      exportScale: [2, 3, 4].includes(style.exportScale) ? style.exportScale : 3,
    },
  };
}

export function setBoundFromRaw(
  state: InequalityState,
  which: BoundKey,
  raw: string,
): InequalityState {
  const parsed = parseNumberLineValue(raw);
  if (!parsed) {
    return { ...state, [which]: { ...state[which], inputRaw: raw } };
  }
  if (parsed.value < state.min - 1e-9 || parsed.value > state.max + 1e-9) {
    return { ...state, [which]: { ...state[which], inputRaw: raw } };
  }
  return normalizeState({
    ...state,
    [which]: {
      ...state[which],
      inputRaw: raw.trim(),
      value: parsed.value,
    },
  });
}

export function snapInequalityValue(
  value: number,
  state: InequalityState,
): number {
  const clamped = Math.min(state.max, Math.max(state.min, value));
  const step = state.tickStep;
  const candidates: number[] = [];
  const start = Math.ceil((state.min - 1e-9) / step) * step;
  const n = Math.round((state.max - start) / step);
  for (let i = 0; i <= n + 2; i += 1) {
    const v = Math.round((start + i * step) * 1000) / 1000;
    if (v > state.max + 1e-9) break;
    if (v >= state.min - 1e-9) {
      candidates.push(v);
      const half = Math.round((v + step / 2) * 1000) / 1000;
      if (half <= state.max + 1e-9) candidates.push(half);
    }
  }
  let best = clamped;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = Math.abs(c - clamped);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  const snapRadius = Math.min(step / 6, 0.12);
  const rounded = Math.round(clamped * 1000) / 1000;
  if (bestD > snapRadius) return rounded;
  return Math.round(best * 1000) / 1000;
}

export function describeInequality(state: InequalityState): string {
  if (state.kind === "blank") return "해의 범위를 그리지 않아요.";
  const a = formatPointLabel(state.start.inputRaw, state.start.value);
  const b = formatPointLabel(state.end.inputRaw, state.end.value);
  if (state.kind === "ray") {
    if (state.direction === "right") {
      return state.start.inclusive ? `x ≥ ${a}` : `x > ${a}`;
    }
    return state.start.inclusive ? `x ≤ ${a}` : `x < ${a}`;
  }
  if (state.kind === "segment") {
    const left = state.start.inclusive ? `${a} ≤` : `${a} <`;
    const right = state.end.inclusive ? `≤ ${b}` : `< ${b}`;
    return `${left} x ${right}`;
  }
  const left = state.start.inclusive ? `x ≤ ${a}` : `x < ${a}`;
  const right = state.end.inclusive ? `x ≥ ${b}` : `x > ${b}`;
  return `${left} 또는 ${right}`;
}

function baseState(partial: Partial<InequalityState> = {}): InequalityState {
  return normalizeState({
    min: 0,
    max: 4,
    tickStep: 1,
    labelEvery: 1,
    leftArrow: true,
    rightArrow: true,
    showTickLabels: true,
    plusOnPositive: false,
    kind: "ray",
    direction: "right",
    start: makeBound({ value: 2, inputRaw: "2", inclusive: false }),
    end: makeBound({ value: 4, inputRaw: "4", inclusive: false }),
    showFill: true,
    fillHex: "#e84a8c",
    fillAlpha: 0.28,
    style: { ...DEFAULT_STYLE },
    ...partial,
  });
}

export const INEQUALITY_PRESETS: {
  id: string;
  title: string;
  hint: string;
  state: InequalityState;
}[] = [
  {
    id: "blank",
    title: "빈 수직선",
    hint: "축만",
    state: baseState({
      kind: "blank",
      showFill: false,
    }),
  },
  {
    id: "greater",
    title: "x > 2",
    hint: "빈 점, 오른쪽",
    state: baseState(),
  },
  {
    id: "less-eq",
    title: "x ≤ −1",
    hint: "칠한 점, 왼쪽",
    state: baseState({
      min: -5,
      max: 5,
      kind: "ray",
      direction: "left",
      start: makeBound({ value: -1, inputRaw: "-1", inclusive: true }),
      end: makeBound({ value: 2, inputRaw: "2" }),
    }),
  },
  {
    id: "between",
    title: "1 ≤ x < 4",
    hint: "두 점 사이",
    state: baseState({
      min: -1,
      max: 6,
      kind: "segment",
      start: makeBound({ value: 1, inputRaw: "1", inclusive: true }),
      end: makeBound({ value: 4, inputRaw: "4", inclusive: false }),
    }),
  },
  {
    id: "split",
    title: "양쪽(또는)",
    hint: "x < −1 또는 x ≥ 3",
    state: baseState({
      min: -4,
      max: 6,
      kind: "split",
      start: makeBound({ value: -1, inputRaw: "-1", inclusive: false }),
      end: makeBound({ value: 3, inputRaw: "3", inclusive: true }),
    }),
  },
];

export const DEFAULT_INEQUALITY_STATE: InequalityState = structuredClone(
  INEQUALITY_PRESETS[1]!.state,
);

export function cloneState(state: InequalityState): InequalityState {
  return structuredClone(state);
}
