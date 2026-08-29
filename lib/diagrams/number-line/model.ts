import {
  formatPointValue,
  isNearInteger,
  lcm,
  nHintFromValue,
  parseNumberLineValue,
  unitStart,
} from "@/lib/diagrams/number-line/parse";

export type EqualMarks = 1 | 2 | 3;

export type NumberLinePoint = {
  id: string;
  name: string;
  value: number;
  inputRaw: string;
  labelDx: number;
  labelDy: number;
  showName: boolean;
  showValue: boolean;
  showDivision: boolean;
  /** null = 값에서 자동 */
  n: number | null;
  equalMarks: EqualMarks;
};

export type DivisionBand = {
  id: string;
  start: number;
  n: number;
  equalMarks: EqualMarks;
};

export type NumberLineStyle = {
  lineWidth: number;
  fontSize: number;
  pointLabelSize: number;
  pointRadius: number;
  paddingX: number;
  paddingY: number;
  exportScale: number;
};

export type NumberLineState = {
  min: number;
  max: number;
  tickStep: number;
  labelEvery: number;
  leftArrow: boolean;
  rightArrow: boolean;
  showTickLabels: boolean;
  plusOnPositive: boolean;
  points: NumberLinePoint[];
  bands: DivisionBand[];
  style: NumberLineStyle;
};

export type ResolvedBand = {
  start: number;
  n: number;
  equalMarks: EqualMarks;
};

const DEFAULT_STYLE: NumberLineStyle = {
  lineWidth: 1.7,
  fontSize: 18,
  pointLabelSize: 22,
  pointRadius: 3.4,
  paddingX: 44,
  paddingY: 28,
  exportScale: 3,
};

export function newPointId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}

export function newBandId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b-${Math.random().toString(36).slice(2, 10)}`;
}

const POINT_NAMES = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function nextPointName(existing: NumberLinePoint[]): string {
  const used = new Set(existing.map((p) => p.name.trim().toUpperCase()));
  for (const ch of POINT_NAMES) {
    if (!used.has(ch)) return ch;
  }
  return `P${existing.length + 1}`;
}

export function defaultEqualMarks(n: number): EqualMarks {
  return n === 2 ? 2 : 1;
}

export function makePoint(
  partial: Partial<NumberLinePoint> & { value: number; name: string },
): NumberLinePoint {
  const n =
    partial.n === undefined
      ? nHintFromValue(partial.value)
      : partial.n;
  return {
    id: partial.id ?? newPointId(),
    name: partial.name,
    value: partial.value,
    inputRaw: partial.inputRaw ?? formatPointValue(partial.value),
    labelDx: partial.labelDx ?? 0,
    labelDy: partial.labelDy ?? 0,
    showName: partial.showName ?? true,
    showValue: partial.showValue ?? false,
    showDivision: partial.showDivision ?? false,
    n: n ?? null,
    equalMarks: partial.equalMarks ?? defaultEqualMarks(n ?? 4),
  };
}

export function clampRange(min: number, max: number, tickStep: number) {
  let a = Number.isFinite(min) ? min : -5;
  let b = Number.isFinite(max) ? max : 5;
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

export function normalizeState(state: NumberLineState): NumberLineState {
  const range = clampRange(state.min, state.max, state.tickStep);
  const labelEvery = Math.max(1, Math.round(state.labelEvery || 1));
  return {
    ...state,
    min: range.min,
    max: range.max,
    tickStep: range.tickStep,
    labelEvery,
    points: state.points.map((p) => ({
      ...p,
      value: Math.min(range.max, Math.max(range.min, p.value)),
      n: p.n == null ? null : Math.min(12, Math.max(2, Math.round(p.n))),
      equalMarks: (p.equalMarks === 2 || p.equalMarks === 3
        ? p.equalMarks
        : 1) as EqualMarks,
    })),
    bands: state.bands.map((b) => ({
      ...b,
      n: Math.min(12, Math.max(2, Math.round(b.n))),
      start: Math.floor(b.start),
      equalMarks: (b.equalMarks === 2 || b.equalMarks === 3
        ? b.equalMarks
        : 1) as EqualMarks,
    })),
    style: { ...DEFAULT_STYLE, ...state.style },
  };
}

export function resolvedN(point: NumberLinePoint): number | null {
  if (isNearInteger(point.value)) return null;
  if (point.n != null) return Math.min(12, Math.max(2, point.n));
  return nHintFromValue(point.value);
}

export function resolveBands(state: NumberLineState): ResolvedBand[] {
  const map = new Map<number, { n: number; equalMarks: EqualMarks }>();

  function merge(start: number, n: number, marks: EqualMarks) {
    const key = start;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { n, equalMarks: marks });
      return;
    }
    let nextN = lcmClamped(prev.n, n);
    const equalMarks: EqualMarks =
      nextN === 2 ? 2 : marks === 1 && prev.equalMarks === 1 ? 1 : 1;
    map.set(key, { n: nextN, equalMarks });
  }

  for (const point of state.points) {
    if (!point.showDivision) continue;
    const n = resolvedN(point);
    if (n == null) continue;
    const start = unitStart(point.value);
    if (start + 1 < state.min - 1e-9 || start > state.max + 1e-9) continue;
    merge(start, n, point.equalMarks);
  }
  for (const band of state.bands) {
    if (band.start + 1 < state.min - 1e-9 || band.start > state.max + 1e-9) {
      continue;
    }
    merge(band.start, band.n, band.equalMarks);
  }

  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, v]) => ({ start, n: v.n, equalMarks: v.equalMarks }));
}

function lcmClamped(a: number, b: number): number {
  const n = lcm(a, b);
  return n > 12 ? Math.max(a, b) : n;
}

export function addPointFromRaw(
  state: NumberLineState,
  raw: string,
  name?: string,
): NumberLineState | { error: string } {
  const parsed = parseNumberLineValue(raw);
  if (!parsed) {
    return { error: "정수, 소수, 분수(3/4, -4 1/4)로 넣어 주세요." };
  }
  if (parsed.value < state.min - 1e-9 || parsed.value > state.max + 1e-9) {
    return { error: "점이 수직선 시작·끝 밖에 있어요." };
  }
  const point = makePoint({
    name: (name?.trim() || nextPointName(state.points)).trim(),
    value: parsed.value,
    inputRaw: raw.trim(),
    n: parsed.nHint,
    showDivision: false,
    equalMarks: defaultEqualMarks(parsed.nHint ?? 4),
  });
  return { ...state, points: [...state.points, point] };
}

export function addPointAtValue(
  state: NumberLineState,
  value: number,
): NumberLineState {
  const clamped = Math.min(state.max, Math.max(state.min, value));
  const n = nHintFromValue(clamped);
  const point = makePoint({
    name: nextPointName(state.points),
    value: clamped,
    n,
    showDivision: false,
    equalMarks: defaultEqualMarks(n ?? 4),
  });
  return { ...state, points: [...state.points, point] };
}

export function tickValues(min: number, max: number, step: number): number[] {
  const start = Math.ceil((min - 1e-9) / step) * step;
  const ticks: number[] = [];
  const n = Math.round((max - start) / step);
  for (let i = 0; i <= n + 2; i += 1) {
    const v = Math.round((start + i * step) * 1000) / 1000;
    if (v > max + 1e-9) break;
    if (v >= min - 1e-9) ticks.push(v);
  }
  return ticks;
}

function baseState(partial: Partial<NumberLineState> = {}): NumberLineState {
  return normalizeState({
    min: -5,
    max: 5,
    tickStep: 1,
    labelEvery: 1,
    leftArrow: true,
    rightArrow: true,
    showTickLabels: true,
    plusOnPositive: true,
    points: [],
    bands: [],
    style: { ...DEFAULT_STYLE },
    ...partial,
  });
}

export const NUMBER_LINE_PRESETS: {
  id: string;
  title: string;
  hint: string;
  state: NumberLineState;
}[] = [
  {
    id: "integers",
    title: "정수 수직선",
    hint: "−5부터 +5까지",
    state: baseState(),
  },
  {
    id: "rationals",
    title: "유리수 점 읽기",
    hint: "등분된 점 A, B, C, D",
    state: baseState({
      points: [
        makePoint({
          id: "p-a",
          name: "A",
          value: -4.25,
          inputRaw: "-17/4",
          n: 4,
          equalMarks: 1,
          showDivision: true,
        }),
        makePoint({
          id: "p-b",
          name: "B",
          value: -1.5,
          inputRaw: "-3/2",
          n: 2,
          equalMarks: 2,
          showDivision: true,
        }),
        makePoint({
          id: "p-c",
          name: "C",
          value: 3.75,
          inputRaw: "15/4",
          n: 4,
          equalMarks: 1,
          showDivision: true,
        }),
        makePoint({
          id: "p-d",
          name: "D",
          value: 5,
          inputRaw: "5",
          showDivision: false,
        }),
      ],
    }),
  },
  {
    id: "unit-interval",
    title: "0에서 1까지",
    hint: "단위 구간 4등분",
    state: baseState({
      min: 0,
      max: 1,
      plusOnPositive: false,
      points: [
        makePoint({
          id: "p-a",
          name: "A",
          value: 0.75,
          inputRaw: "3/4",
          n: 4,
          equalMarks: 1,
          showDivision: true,
        }),
      ],
    }),
  },
  {
    id: "absolute",
    title: "절대값",
    hint: "원점 대칭인 두 점",
    state: baseState({
      points: [
        makePoint({
          id: "p-a",
          name: "A",
          value: -3,
          inputRaw: "-3",
          showDivision: false,
        }),
        makePoint({
          id: "p-b",
          name: "B",
          value: 3,
          inputRaw: "+3",
          showDivision: false,
        }),
      ],
    }),
  },
];

export const DEFAULT_NUMBER_LINE_STATE: NumberLineState = structuredClone(
  NUMBER_LINE_PRESETS[1]!.state,
);

export function cloneState(state: NumberLineState): NumberLineState {
  return structuredClone(state);
}
