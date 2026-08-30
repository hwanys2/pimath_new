import { GRID_COLOR } from "@/lib/diagrams/coordinate-plane/model";
import { simplifySqrtInt } from "@/lib/diagrams/pythagorean/radical";

export type SqrtKind = "square" | "triangle";
export type ShapeSide = "left" | "right";

export type NameLabel = {
  name: string;
  dx: number;
  dy: number;
};

export type SqrtNumberLineStyle = {
  lineWidth: number;
  fontSize: number;
  pointLabelSize: number;
  pointRadius: number;
  paddingX: number;
  paddingTop: number;
  paddingBottom: number;
  exportScale: number;
  gridColor: string;
};

export type SqrtNumberLineState = {
  kind: SqrtKind;
  /** 시작점 O의 수직선 위치 */
  origin: number;
  legA: number;
  legB: number;
  shapeSide: ShapeSide;
  min: number;
  max: number;
  tickStep: number;
  labelEvery: number;
  leftArrow: boolean;
  rightArrow: boolean;
  showTickLabels: boolean;
  plusOnPositive: boolean;
  showGrid: boolean;
  showShape: boolean;
  showFill: boolean;
  showArc: boolean;
  showPosPoint: boolean;
  showNegPoint: boolean;
  showPosValue: boolean;
  showNegValue: boolean;
  showVertexNames: boolean;
  showRightAngle: boolean;
  posPointName: string;
  negPointName: string;
  posValueRaw: string;
  negValueRaw: string;
  names: Record<"O" | "A" | "B" | "C" | "P" | "Q", NameLabel>;
  style: SqrtNumberLineStyle;
};

export type SqrtPreset = {
  id: string;
  title: string;
  hint: string;
  state: SqrtNumberLineState;
};

const DEFAULT_STYLE: SqrtNumberLineStyle = {
  lineWidth: 1.7,
  fontSize: 18,
  pointLabelSize: 22,
  pointRadius: 3.6,
  paddingX: 44,
  paddingTop: 36,
  paddingBottom: 52,
  exportScale: 3,
  gridColor: GRID_COLOR,
};

function defaultNames(): SqrtNumberLineState["names"] {
  return {
    O: { name: "O", dx: -10, dy: 14 },
    A: { name: "A", dx: 6, dy: -10 },
    B: { name: "B", dx: 6, dy: -10 },
    C: { name: "C", dx: -10, dy: -10 },
    P: { name: "P", dx: 0, dy: -22 },
    Q: { name: "Q", dx: 0, dy: -22 },
  };
}

export function cloneState(state: SqrtNumberLineState): SqrtNumberLineState {
  return structuredClone(state);
}

export function radicand(state: Pick<SqrtNumberLineState, "legA" | "legB">): number {
  const a = Math.max(1, Math.round(state.legA));
  const b = Math.max(1, Math.round(state.legB));
  return a * a + b * b;
}

export function sqrtLength(state: Pick<SqrtNumberLineState, "legA" | "legB">): number {
  return Math.sqrt(radicand(state));
}

/** n = a²+b² 인 (a,b) 쌍. a≤b 순, (b,a)는 a≠b일 때 추가. */
export function pairsFor(n: number): [number, number][] {
  const intN = Math.round(n);
  if (intN < 2) return [];
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (let a = 1; a * a <= intN; a += 1) {
    const rest = intN - a * a;
    const b = Math.round(Math.sqrt(rest));
    if (b < 1 || a * a + b * b !== intN) continue;
    for (const pair of [
      [a, b] as [number, number],
      [b, a] as [number, number],
    ]) {
      const key = `${pair[0]},${pair[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(pair);
    }
  }
  return out;
}

export function isValidLegPair(legA: number, legB: number): boolean {
  const a = Math.round(legA);
  const b = Math.round(legB);
  if (a < 1 || b < 1) return false;
  return pairsFor(a * a + b * b).some(([x, y]) => x === a && y === b);
}

export function formatSqrtLabel(n: number, signed = false): string {
  const { coeff, radicand: r } = simplifySqrtInt(n);
  let core: string;
  if (r <= 1) {
    core = String(coeff);
  } else if (coeff === 1) {
    core = `$\\sqrt{${r}}$`;
  } else {
    core = `$${coeff}\\sqrt{${r}}$`;
  }
  if (signed && n < 0) {
    if (core.startsWith("$")) return `$-${core.slice(1)}`;
    return `-${core}`;
  }
  return core;
}

export function defaultPosValueRaw(state: Pick<SqrtNumberLineState, "legA" | "legB">): string {
  return formatSqrtLabel(radicand(state));
}

export function defaultNegValueRaw(state: Pick<SqrtNumberLineState, "legA" | "legB">): string {
  const inner = formatSqrtLabel(radicand(state));
  if (inner.startsWith("$")) return `$-${inner.slice(1)}`;
  return `-${inner}`;
}

function clampLeg(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(8, Math.max(1, Math.round(n)));
}

function clampRange(state: SqrtNumberLineState): { min: number; max: number } {
  const r = sqrtLength(state);
  const spanNeed = Math.max(state.legA, state.legB, r, 2) + 1.5;
  let min = Number.isFinite(state.min) ? state.min : state.origin - spanNeed;
  let max = Number.isFinite(state.max) ? state.max : state.origin + spanNeed;
  if (min > max) {
    const t = min;
    min = max;
    max = t;
  }
  if (max - min < 3) max = min + 3;
  if (max - min > 14) max = min + 14;
  if (state.origin - r < min) min = Math.floor(state.origin - r - 0.5);
  if (state.origin + r > max) max = Math.ceil(state.origin + r + 0.5);
  return { min, max };
}

export function normalizeState(state: SqrtNumberLineState): SqrtNumberLineState {
  const legA = clampLeg(state.legA);
  const legB = clampLeg(state.legB);
  const origin = Number.isFinite(state.origin) ? state.origin : 0;
  const { min, max } = clampRange({ ...state, legA, legB, origin });
  const tickStep = Math.max(0.25, Number.isFinite(state.tickStep) ? state.tickStep : 1);
  const labelEvery = Math.min(5, Math.max(1, Math.round(state.labelEvery || 1)));
  const style = { ...DEFAULT_STYLE, ...state.style };
  const names = { ...defaultNames(), ...state.names };
  for (const key of ["O", "A", "B", "C", "P", "Q"] as const) {
    names[key] = {
      name: names[key]?.name?.trim() || key,
      dx: names[key]?.dx ?? 0,
      dy: names[key]?.dy ?? 0,
    };
  }
  const base: SqrtNumberLineState = {
    ...state,
    kind: state.kind === "triangle" ? "triangle" : "square",
    origin,
    legA,
    legB,
    shapeSide: state.shapeSide === "left" ? "left" : "right",
    min,
    max,
    tickStep,
    labelEvery,
    leftArrow: state.leftArrow ?? true,
    rightArrow: state.rightArrow ?? true,
    showTickLabels: state.showTickLabels ?? true,
    plusOnPositive: state.plusOnPositive ?? false,
    showGrid: state.showGrid ?? true,
    showShape: state.showShape ?? true,
    showFill: state.showFill ?? true,
    showArc: state.showArc ?? true,
    showPosPoint: state.showPosPoint ?? true,
    showNegPoint: state.showNegPoint ?? true,
    showPosValue: state.showPosValue ?? true,
    showNegValue: state.showNegValue ?? true,
    showVertexNames: state.showVertexNames ?? true,
    showRightAngle: state.showRightAngle ?? true,
    posPointName: state.posPointName?.trim() || "P",
    negPointName: state.negPointName?.trim() || "Q",
    names,
    style,
  };
  return {
    ...base,
    posValueRaw: state.posValueRaw?.trim() || defaultPosValueRaw(base),
    negValueRaw: state.negValueRaw?.trim() || defaultNegValueRaw(base),
  };
}

function baseState(partial: Partial<SqrtNumberLineState>): SqrtNumberLineState {
  return normalizeState({
    kind: "triangle",
    origin: 0,
    legA: 1,
    legB: 1,
    shapeSide: "left",
    min: -3,
    max: 3,
    tickStep: 1,
    labelEvery: 1,
    leftArrow: true,
    rightArrow: true,
    showTickLabels: true,
    plusOnPositive: false,
    showGrid: true,
    showShape: true,
    showFill: true,
    showArc: true,
    showPosPoint: true,
    showNegPoint: true,
    showPosValue: true,
    showNegValue: true,
    showVertexNames: true,
    showRightAngle: true,
    posPointName: "P",
    negPointName: "Q",
    posValueRaw: "",
    negValueRaw: "",
    names: defaultNames(),
    style: DEFAULT_STYLE,
    ...partial,
  });
}

export const DEFAULT_SQRT_NUMBER_LINE_STATE = baseState({});

export const SQRT_KINDS: { id: SqrtKind; label: string }[] = [
  { id: "triangle", label: "직각삼각형" },
  { id: "square", label: "정사각형" },
];

export const COMMON_SQRT_N = [2, 5, 10, 13, 17, 25] as const;

export const SQRT_NUMBER_LINE_PRESETS: SqrtPreset[] = [
  {
    id: "tri-sqrt2",
    title: "√2 삼각형",
    hint: "1·1, O=0",
    state: baseState({
      kind: "triangle",
      shapeSide: "left",
      legA: 1,
      legB: 1,
      min: -2,
      max: 2,
    }),
  },
  {
    id: "sq-sqrt5",
    title: "√5 정사각형",
    hint: "2·1",
    state: baseState({
      kind: "square",
      legA: 2,
      legB: 1,
      min: -3,
      max: 3,
    }),
  },
  {
    id: "tri-sqrt5",
    title: "√5 삼각형",
    hint: "2·1, 오른쪽",
    state: baseState({
      kind: "triangle",
      shapeSide: "right",
      legA: 2,
      legB: 1,
      min: -1,
      max: 4,
    }),
  },
  {
    id: "sq-sqrt10",
    title: "√10 정사각형",
    hint: "3·1",
    state: baseState({
      kind: "square",
      legA: 3,
      legB: 1,
      min: -2,
      max: 5,
    }),
  },
  {
    id: "origin-2-sqrt2",
    title: "시작 2에서 √2",
    hint: "삼각형·점만",
    state: baseState({
      kind: "triangle",
      origin: 2,
      shapeSide: "left",
      legA: 1,
      legB: 1,
      min: -1,
      max: 5,
    }),
  },
  {
    id: "points-only",
    title: "점만",
    hint: "도형·호 숨김",
    state: baseState({
      kind: "triangle",
      legA: 1,
      legB: 1,
      shapeSide: "left",
      showShape: false,
      showArc: false,
      min: -2,
      max: 2,
    }),
  },
];

export function applyLegs(
  state: SqrtNumberLineState,
  legA: number,
  legB: number,
): SqrtNumberLineState {
  const a = clampLeg(legA);
  const b = clampLeg(legB);
  if (!isValidLegPair(a, b)) return state;
  return normalizeState({
    ...state,
    legA: a,
    legB: b,
    posValueRaw: "",
    negValueRaw: "",
  });
}

export function applyRadicand(
  state: SqrtNumberLineState,
  n: number,
  pairIndex = 0,
): SqrtNumberLineState | { error: string } {
  const pairs = pairsFor(n);
  if (pairs.length === 0) {
    return {
      error: `${n}은 a²+b² 꼴로 정수 a, b를 찾을 수 없어요. √2·√5·√10 등을 이용해 주세요.`,
    };
  }
  const idx = Math.min(Math.max(0, pairIndex), pairs.length - 1);
  const [a, b] = pairs[idx]!;
  return applyLegs(state, a, b);
}
