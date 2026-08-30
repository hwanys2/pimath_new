import {
  DEFAULT_STYLE,
  emptyLabel,
  resolveAngleText,
  resolveLengthText,
  type DiagramStyle,
  type MeasLabel,
  type Vec,
} from "@/lib/diagrams/polygon/model";

export type { DiagramStyle, MeasLabel, Vec };
export { emptyLabel, resolveAngleText, resolveLengthText, DEFAULT_STYLE };

export type PythagoreanKind =
  | "triangle"
  | "squares"
  | "proof"
  | "altitude"
  | "coordinate"
  | "rectangle";

export type RightVertex = "A" | "B" | "C";

export type ProofView = "both" | "inner" | "tiles";

export const PYTHAGOREAN_KINDS: { id: PythagoreanKind; label: string }[] = [
  { id: "triangle", label: "직각삼각형" },
  { id: "squares", label: "세 변 위 정사각형" },
  { id: "proof", label: "넓이 증명" },
  { id: "altitude", label: "빗변 수선" },
  { id: "coordinate", label: "좌표평면" },
  { id: "rectangle", label: "사각형 대각선" },
];

export type NameMark = {
  name: string;
  dx: number;
  dy: number;
};

export type SegMark = {
  id: string;
  a: string;
  b: string;
  show: boolean;
  label: MeasLabel;
};

export type PythagoreanState = {
  kind: PythagoreanKind;
  /** Triangle vertices in math coords (y up). */
  A: Vec;
  B: Vec;
  C: Vec;
  rightVertex: RightVertex;
  /** Two legs (cm). Used when rebuilding triangle from numeric input. */
  legLeft: number;
  legRight: number;
  isoscelesRight: boolean;
  names: Record<string, NameMark>;
  segs: SegMark[];
  showVertexNames: boolean;
  showDots: boolean;
  showRightAngle: boolean;
  showGrid: boolean;
  showFill: boolean;
  showSquareLabels: boolean;
  showDissection: boolean;
  squareLabelMode: "korean" | "formula";
  /** proof kind */
  proofView: ProofView;
  proofLegA: number;
  proofLegB: number;
  /** coordinate kind */
  coordMin: number;
  coordMax: number;
  showAxisDrops: boolean;
  /** rectangle kind */
  rectWidth: number;
  rectHeight: number;
  rectSquare: boolean;
  showDiagonal: boolean;
  unit: string;
  unknownLetter: string;
  style: DiagramStyle;
};

export type PythagoreanPreset = {
  id: string;
  title: string;
  hint: string;
  state: PythagoreanState;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function cloneState(state: PythagoreanState): PythagoreanState {
  return structuredClone(state);
}

export function customLen(text: string, patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("custom"), custom: text, ...patch };
}

export function xLen(letter = "x", patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("x"), custom: letter, ...patch };
}

function name(id: string, label?: string, dx = 0, dy = 0): NameMark {
  return { name: label ?? id, dx, dy };
}

export function defaultNames(): Record<string, NameMark> {
  return {
    A: name("A"),
    B: name("B"),
    C: name("C"),
    D: name("D"),
  };
}

export function defaultSegsFor(kind: PythagoreanKind): SegMark[] {
  const s = (a: string, b: string, id = `${a}${b}`): SegMark => ({
    id,
    a,
    b,
    show: false,
    label: emptyLabel("auto"),
  });
  switch (kind) {
    case "triangle":
    case "squares":
      return [s("A", "B"), s("B", "C"), s("A", "C"), s("B", "C", "BC"), s("A", "C", "AC")];
    case "altitude":
      return [
        s("A", "B"),
        s("A", "C"),
        s("B", "C"),
        s("A", "D"),
        s("B", "D"),
        s("D", "C"),
      ];
    case "proof":
      return [];
    case "coordinate":
      return [s("A", "B"), s("B", "C"), s("A", "C")];
    case "rectangle":
      return [s("A", "B"), s("B", "C"), s("C", "D"), s("D", "A"), s("A", "C")];
    default:
      return [];
  }
}

function mergeNames(prev?: Record<string, NameMark>): Record<string, NameMark> {
  const base = defaultNames();
  if (!prev) return base;
  const out = { ...base };
  for (const [id, mark] of Object.entries(prev)) {
    out[id] = { ...(base[id] ?? name(id)), ...mark };
  }
  return out;
}

function mergeSegs(kind: PythagoreanKind, prev?: SegMark[]): SegMark[] {
  const base = defaultSegsFor(kind);
  const map = new Map((prev ?? []).map((s) => [s.id, s]));
  return base.map((b) => {
    const p = map.get(b.id);
    if (!p) return b;
    return {
      ...b,
      show: p.show === true,
      label: { ...emptyLabel("auto"), ...p.label },
    };
  });
}

/** Build A,B,C with right angle at C, hypotenuse AB horizontal on y=0. */
export function triangleFromLegs(legLeft: number, legRight: number): { A: Vec; B: Vec; C: Vec } {
  const lb = Math.max(0.5, legLeft);
  const lr = Math.max(0.5, legRight);
  const hyp = Math.hypot(lb, lr);
  const B: Vec = { x: 0, y: 0 };
  const A: Vec = { x: hyp, y: 0 };
  const x = (lb * lb - lr * lr + hyp * hyp) / (2 * hyp);
  const y = Math.sqrt(Math.max(0, lb * lb - x * x));
  const C: Vec = { x, y };
  return { A, B, C };
}

export function normalizeState(
  state: Partial<PythagoreanState> & Pick<PythagoreanState, "kind">,
): PythagoreanState {
  const kind = PYTHAGOREAN_KINDS.some((k) => k.id === state.kind) ? state.kind : "triangle";
  const style = { ...DEFAULT_STYLE, ...state.style };
  const legs = triangleFromLegs(state.legLeft ?? 3, state.legRight ?? 4);
  const rv = state.rightVertex === "A" || state.rightVertex === "B" ? state.rightVertex : "C";

  return {
    kind,
    A: state.A ?? legs.A,
    B: state.B ?? legs.B,
    C: state.C ?? legs.C,
    rightVertex: rv,
    legLeft: clamp(state.legLeft ?? 3, 0.5, 40),
    legRight: clamp(state.legRight ?? 4, 0.5, 40),
    isoscelesRight: state.isoscelesRight === true,
    names: mergeNames(state.names),
    segs: mergeSegs(kind, state.segs),
    showVertexNames: state.showVertexNames !== false,
    showDots: state.showDots !== false,
    showRightAngle: state.showRightAngle !== false,
    showGrid: state.showGrid !== false,
    showFill: state.showFill !== false,
    showSquareLabels: state.showSquareLabels !== false,
    showDissection: state.showDissection !== false,
    squareLabelMode: state.squareLabelMode === "formula" ? "formula" : "korean",
    proofView:
      state.proofView === "inner" || state.proofView === "tiles" ? state.proofView : "both",
    proofLegA: clamp(state.proofLegA ?? 3, 0.5, 20),
    proofLegB: clamp(state.proofLegB ?? 4, 0.5, 20),
    coordMin: clamp(state.coordMin ?? -1, -20, 20),
    coordMax: clamp(state.coordMax ?? 8, -20, 30),
    showAxisDrops: state.showAxisDrops === true,
    rectWidth: clamp(state.rectWidth ?? 6, 0.5, 40),
    rectHeight: clamp(state.rectHeight ?? 8, 0.5, 40),
    rectSquare: state.rectSquare === true,
    showDiagonal: state.showDiagonal !== false,
    unit: state.unit?.trim() ? state.unit : "cm",
    unknownLetter:
      state.unknownLetter && /^[A-Za-z]$/.test(state.unknownLetter) ? state.unknownLetter : "x",
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

function build(kind: PythagoreanKind, patch: Partial<PythagoreanState> = {}): PythagoreanState {
  return normalizeState({ kind, ...patch });
}

function withMarks(
  state: PythagoreanState,
  segs: Record<string, MeasLabel | Partial<SegMark>> = {},
): PythagoreanState {
  let next = state;
  for (const [id, spec] of Object.entries(segs)) {
    const label = "mode" in spec || "custom" in spec ? (spec as MeasLabel) : undefined;
    const extra = label ? {} : (spec as Partial<SegMark>);
    const segLabel = label ?? extra.label ?? emptyLabel("auto");
    next = {
      ...next,
      segs: next.segs.map((s) =>
        s.id === id ? { ...s, show: true, label: segLabel, ...extra } : s,
      ),
    };
  }
  return next;
}

const triABC = withMarks(
  build("triangle", { legLeft: 3, legRight: 4 }),
  { AB: customLen("c"), BC: customLen("a"), AC: customLen("b") },
);

const tri912x = withMarks(
  build("triangle", { legLeft: 9, legRight: 12 }),
  { AB: xLen("x"), BC: customLen("9 cm"), AC: customLen("12 cm") },
);

const tri24x25 = withMarks(
  build("triangle", {
    legLeft: 7,
    legRight: 24,
    rightVertex: "B",
    ...(() => {
      const t = triangleFromLegs(7, 24);
      return { A: t.A, B: t.B, C: t.C };
    })(),
  }),
  { AB: customLen("25 cm"), BC: xLen("x"), AC: customLen("24 cm") },
);

const isoRight = withMarks(
  build("triangle", { legLeft: 5, legRight: 5, isoscelesRight: true }),
  {
    AB: customLen("5√2 cm"),
    BC: customLen("5 cm"),
    AC: customLen("5 cm"),
  },
);

const sq32 = build("squares", { legLeft: 3, legRight: 2, showGrid: true, showFill: true });
const sq22 = build("squares", { legLeft: 2, legRight: 2, showGrid: true, showFill: true });
const sq43 = build("squares", { legLeft: 4, legRight: 3, showGrid: true, showFill: true });

const proofPair = build("proof", { proofLegA: 3, proofLegB: 4, proofView: "both" });

const alt3040 = withMarks(
  build("altitude", {
    legLeft: 30,
    legRight: 40,
    rightVertex: "A",
    A: { x: 2, y: 4 },
    B: { x: -1.5, y: 0 },
    C: { x: 3.5, y: 0 },
  }),
  { AB: customLen("30 cm"), AC: customLen("40 cm") },
);

const coord345 = build("coordinate", {
  legLeft: 3,
  legRight: 4,
  coordMin: 0,
  coordMax: 6,
  showGrid: true,
  A: { x: 0, y: 0 },
  B: { x: 3, y: 0 },
  C: { x: 0, y: 4 },
  rightVertex: "A",
});

const rect68 = withMarks(
  build("rectangle", { rectWidth: 6, rectHeight: 8 }),
  { AB: customLen("6 cm"), BC: customLen("8 cm"), AC: customLen("10 cm") },
);

const rectSquare = withMarks(
  build("rectangle", { rectWidth: 5, rectHeight: 5, rectSquare: true }),
  { AB: customLen("5 cm"), AC: customLen("5√2 cm") },
);

export const PYTHAGOREAN_PRESETS: PythagoreanPreset[] = [
  { id: "tri-abc", title: "a,b,c 호", hint: "기본 기호", state: triABC },
  { id: "tri-912x", title: "9·12·x", hint: "빗변 미지수", state: tri912x },
  { id: "tri-24x25", title: "24·x·25", hint: "다리 미지수", state: tri24x25 },
  { id: "tri-iso", title: "이등변직각", hint: "5·5·5√2", state: isoRight },
  { id: "sq-32", title: "모눈 3×2", hint: "ㄱㄴㄷ", state: sq32 },
  { id: "sq-22", title: "모눈 2×2", hint: "이등변", state: sq22 },
  { id: "sq-43", title: "모눈 4×3", hint: "3-4-5", state: sq43 },
  { id: "proof-both", title: "넓이 증명", hint: "c² / a²+b²", state: proofPair },
  { id: "alt-3040", title: "빗변 수선", hint: "30·40 cm", state: alt3040 },
  { id: "coord-345", title: "좌표 3-4-5", hint: "격자 위", state: coord345 },
  { id: "rect-68", title: "직사각형 6×8", hint: "대각선 10", state: rect68 },
  { id: "rect-sq", title: "정사각형", hint: "대각선 5√2", state: rectSquare },
];

export const DEFAULT_PYTHAGOREAN_STATE: PythagoreanState = PYTHAGOREAN_PRESETS[0]!.state;

export function withKind(prev: PythagoreanState, kind: PythagoreanKind): PythagoreanState {
  const template =
    PYTHAGOREAN_PRESETS.find((p) => p.state.kind === kind)?.state ?? build(kind);
  return normalizeState({
    ...template,
    style: prev.style,
    unit: prev.unit,
    unknownLetter: prev.unknownLetter,
    showVertexNames: prev.showVertexNames,
    showDots: prev.showDots,
  });
}

export function findSeg(state: PythagoreanState, id: string): SegMark | undefined {
  return state.segs.find((s) => s.id === id);
}

export function patchSegState(
  state: PythagoreanState,
  id: string,
  patch: Partial<SegMark>,
): PythagoreanState {
  return {
    ...state,
    segs: state.segs.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}

export function setPointName(
  state: PythagoreanState,
  id: string,
  nameValue: string,
): PythagoreanState {
  const prev = state.names[id] ?? name(id);
  return {
    ...state,
    names: { ...state.names, [id]: { ...prev, name: nameValue.trim() || prev.name } },
  };
}
