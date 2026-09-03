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
  | "rectangle";

export type LockedRightVertex = "A" | "B" | "C";
export type RightVertex = LockedRightVertex | "none";
export type AltitudeVertex = "A" | "B" | "C";

export function isLockedRight(rv: RightVertex): rv is LockedRightVertex {
  return rv === "A" || rv === "B" || rv === "C";
}

/** Kinds that have triangle ABC, so a vertex can drop an altitude to the opposite side. */
export function kindSupportsAltitude(kind: PythagoreanKind): boolean {
  return kind !== "proof";
}

export function altitudeVerticesFor(kind: PythagoreanKind): AltitudeVertex[] {
  if (!kindSupportsAltitude(kind)) return [];
  if (kind === "altitude") return ["B", "C"];
  return ["A", "B", "C"];
}

export function altitudeFootId(from: AltitudeVertex): string {
  if (from === "A") return "Ha";
  if (from === "B") return "Hb";
  return "H";
}

export function altitudeBaseIds(from: AltitudeVertex): {
  a: AltitudeVertex;
  b: AltitudeVertex;
} {
  if (from === "A") return { a: "B", b: "C" };
  if (from === "B") return { a: "A", b: "C" };
  return { a: "A", b: "B" };
}

export type ProofView = "both" | "inner" | "tiles";

export const PYTHAGOREAN_KINDS: { id: PythagoreanKind; label: string }[] = [
  { id: "triangle", label: "직각삼각형" },
  { id: "squares", label: "세 변 위 정사각형" },
  { id: "proof", label: "넓이 증명" },
  { id: "altitude", label: "빗변 수선" },
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
  /** Vertices from which an altitude to the opposite side is drawn. */
  altitudes: AltitudeVertex[];
  names: Record<string, NameMark>;
  segs: SegMark[];
  showVertexNames: boolean;
  showDots: boolean;
  showRightAngle: boolean;
  showGrid: boolean;
  /** 모눈 가로·세로 칸 수 (한 칸 = 1 math unit). */
  gridCols: number;
  gridRows: number;
  /** 모눈 바깥 여백(칸). */
  gridMargin: number;
  showFill: boolean;
  showSquareLabels: boolean;
  showDissection: boolean;
  squareLabelMode: "korean" | "formula";
  /** proof kind */
  proofView: ProofView;
  proofLegA: number;
  proofLegB: number;
  /** coordinate kind */
  coordXMin: number;
  coordXMax: number;
  coordYMin: number;
  coordYMax: number;
  /** Extra grid cells beyond axis limits (viewport margin). */
  coordPadding: number;
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

/** Leg-aligned grid cell count that fits the current figure. */
export function figureGridExtent(
  state: Pick<
    PythagoreanState,
    | "kind"
    | "rightVertex"
    | "legLeft"
    | "legRight"
    | "A"
    | "B"
    | "C"
    | "proofLegA"
    | "proofLegB"
    | "proofView"
    | "rectWidth"
    | "rectHeight"
    | "rectSquare"
  >,
): { cols: number; rows: number } {
  if (state.kind === "proof") {
    const span = (state.proofLegA ?? 3) + (state.proofLegB ?? 4);
    const cols = state.proofView === "both" ? span * 2 + 1.2 : span;
    return { cols: Math.max(1, Math.ceil(cols)), rows: Math.max(1, Math.ceil(span)) };
  }
  if (state.kind === "rectangle") {
    const w = state.rectWidth ?? 6;
    const h = state.rectSquare ? w : (state.rectHeight ?? 8);
    return { cols: Math.max(1, Math.ceil(w)), rows: Math.max(1, Math.ceil(h)) };
  }
  const ll = state.legLeft;
  const lr = state.legRight;
  if (state.rightVertex === "none") {
    const xs = [state.A.x, state.B.x, state.C.x];
    const ys = [state.A.y, state.B.y, state.C.y];
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    return { cols: Math.max(1, Math.ceil(spanX)), rows: Math.max(1, Math.ceil(spanY)) };
  }
  if (state.rightVertex === "B") {
    return { cols: Math.ceil(lr), rows: Math.ceil(ll) };
  }
  if (state.rightVertex === "A") {
    const maxX = Math.max(state.A.x, state.B.x, state.C.x, 0);
    const maxY = Math.max(state.A.y, state.B.y, state.C.y, 0);
    return { cols: Math.ceil(maxX), rows: Math.ceil(maxY) };
  }
  return { cols: Math.ceil(ll), rows: Math.ceil(lr) };
}

/** Math bounds for drawing the 모눈 lines (user-set cols × rows + margin). */
export function gridDrawBounds(state: PythagoreanState): { min: Vec; max: Vec } {
  const m = state.gridMargin;
  return {
    min: { x: -m, y: -m },
    max: { x: state.gridCols + m, y: state.gridRows + m },
  };
}

/** Snap grid cols/rows to match the current leg ratio. */
export function fitGridToFigure(state: PythagoreanState): PythagoreanState {
  const { cols, rows } = figureGridExtent(state);
  return { ...state, gridCols: cols, gridRows: rows };
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
    H: name("H"),
    Ha: name("H"),
    Hb: name("H"),
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
      return [s("A", "B"), s("B", "C"), s("A", "C")];
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

function altitudeSegsFor(altitudes: AltitudeVertex[]): SegMark[] {
  const s = (a: string, b: string, id = `${a}${b}`): SegMark => ({
    id,
    a,
    b,
    show: false,
    label: emptyLabel("auto"),
  });
  const out: SegMark[] = [];
  for (const from of altitudes) {
    const foot = altitudeFootId(from);
    const base = altitudeBaseIds(from);
    out.push(s(from, foot), s(base.a, foot), s(base.b, foot));
  }
  return out;
}

function mergeSegs(
  kind: PythagoreanKind,
  prev?: SegMark[],
  altitudes: AltitudeVertex[] = [],
): SegMark[] {
  const base = [
    ...defaultSegsFor(kind),
    ...(kindSupportsAltitude(kind) ? altitudeSegsFor(altitudes) : []),
  ];
  const seen = new Set<string>();
  const unique = base.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
  const map = new Map((prev ?? []).map((s) => [s.id, s]));
  return unique.map((b) => {
    const p = map.get(b.id);
    if (!p) return b;
    return {
      ...b,
      show: p.show === true,
      label: { ...emptyLabel("auto"), ...p.label },
    };
  });
}

export function parseAltitudes(raw?: AltitudeVertex[]): AltitudeVertex[] {
  if (!Array.isArray(raw)) return [];
  const uniq: AltitudeVertex[] = [];
  for (const v of raw) {
    if ((v === "A" || v === "B" || v === "C") && !uniq.includes(v)) uniq.push(v);
  }
  return uniq;
}

export function toggleAltitude(
  state: PythagoreanState,
  from: AltitudeVertex,
): PythagoreanState {
  if (!altitudeVerticesFor(state.kind).includes(from)) return state;
  const current = parseAltitudes(state.altitudes);
  const has = current.includes(from);
  const altitudes = has ? current.filter((v) => v !== from) : [...current, from];
  return normalizeState({ ...state, altitudes });
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

function fixCoordAxes(state: PythagoreanState): PythagoreanState {
  let { coordXMin, coordXMax, coordYMin, coordYMax } = state;
  if (coordXMin > coordXMax) [coordXMin, coordXMax] = [coordXMax, coordXMin];
  if (coordYMin > coordYMax) [coordYMin, coordYMax] = [coordYMax, coordYMin];
  if (coordXMax - coordXMin < 1) coordXMax = coordXMin + 1;
  if (coordYMax - coordYMin < 1) coordYMax = coordYMin + 1;
  return { ...state, coordXMin, coordXMax, coordYMin, coordYMax };
}

/** Build A,B,C with right angle at A and hypotenuse BC on the x-axis. */
export function altitudeTriangleFromLegs(
  legAB: number,
  legAC: number,
): { A: Vec; B: Vec; C: Vec } {
  const ab = Math.max(0.5, legAB);
  const ac = Math.max(0.5, legAC);
  const bc = Math.hypot(ab, ac);
  const B: Vec = { x: 0, y: 0 };
  const C: Vec = { x: bc, y: 0 };
  const x = (ab * ab - ac * ac + bc * bc) / (2 * bc);
  const y = Math.sqrt(Math.max(0, ab * ab - x * x));
  const A: Vec = { x, y };
  return { A, B, C };
}

/** Build A,B,C with right angle at C, legs along +x (BC) and +y (AC) from C. */
export function triangleFromLegsAtC(legBC: number, legAC: number): { A: Vec; B: Vec; C: Vec } {
  const bc = Math.max(0.5, legBC);
  const ac = Math.max(0.5, legAC);
  const C: Vec = { x: 0, y: 0 };
  const B: Vec = { x: bc, y: 0 };
  const A: Vec = { x: 0, y: ac };
  return { A, B, C };
}

/** Pick axis-aligned triangle layout for the given right-angle vertex. */
export function triangleForRightVertex(
  legLeft: number,
  legRight: number,
  rightVertex: "A" | "B" | "C",
): { A: Vec; B: Vec; C: Vec } {
  if (rightVertex === "B") return triangleFromLegsAtB(legLeft, legRight);
  if (rightVertex === "A") return altitudeTriangleFromLegs(legLeft, legRight);
  return triangleFromLegsAtC(legLeft, legRight);
}

/** Build A,B,C with right angle at B. */
export function triangleFromLegsAtB(legAB: number, legBC: number): { A: Vec; B: Vec; C: Vec } {
  const lab = Math.max(0.5, legAB);
  const lbc = Math.max(0.5, legBC);
  const B: Vec = { x: 0, y: 0 };
  const A: Vec = { x: 0, y: lab };
  const C: Vec = { x: lbc, y: 0 };
  return { A, B, C };
}

function snapAltitudeState(state: PythagoreanState): PythagoreanState {
  const { A, B } = state;
  let { C } = state;
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const acx = C.x - A.x;
  const acy = C.y - A.y;
  const abLen = Math.hypot(abx, aby);
  const acLen = Math.hypot(acx, acy);
  if (abLen < 0.4 || acLen < 0.4) {
    const t = altitudeTriangleFromLegs(state.legLeft, state.legRight);
    return { ...state, rightVertex: "A", A: t.A, B: t.B, C: t.C };
  }
  const nx = -aby / abLen;
  const ny = abx / abLen;
  const sign = acx * nx + acy * ny >= 0 ? 1 : -1;
  C = { x: A.x + nx * sign * acLen, y: A.y + ny * sign * acLen };
  return { ...state, rightVertex: "A", C };
}

export function normalizeState(
  state: Partial<PythagoreanState> & Pick<PythagoreanState, "kind">,
): PythagoreanState {
  const rawKind =
    (state.kind as string) === "coordinate" ? "triangle" : state.kind;
  const kind = PYTHAGOREAN_KINDS.some((k) => k.id === rawKind) ? rawKind : "triangle";
  const style = { ...DEFAULT_STYLE, ...state.style };
  const rv: RightVertex =
    kind === "altitude"
      ? "A"
      : state.rightVertex === "none" && kind === "triangle"
        ? "none"
        : state.rightVertex === "A" || state.rightVertex === "B"
          ? state.rightVertex
          : "C";
  const altitudes = kindSupportsAltitude(kind)
    ? parseAltitudes(state.altitudes).filter((v) => altitudeVerticesFor(kind).includes(v))
    : [];
  const ll0 = clamp(state.legLeft ?? 3, 0.5, 40);
  const lr0 = clamp(state.legRight ?? 4, 0.5, 40);
  const lockIso = state.isoscelesRight === true && isLockedRight(rv);
  const ll = lockIso ? Math.max(ll0, lr0) : ll0;
  const lr = lockIso ? ll : lr0;
  const legs =
    kind === "altitude"
      ? altitudeTriangleFromLegs(ll, lr)
      : isLockedRight(rv)
        ? triangleForRightVertex(ll, lr, rv)
        : triangleFromLegsAtC(ll, lr);

  let result = fixCoordAxes({
    kind,
    A: state.A ?? legs.A,
    B: state.B ?? legs.B,
    C: state.C ?? legs.C,
    rightVertex: rv,
    legLeft: ll,
    legRight: lr,
    isoscelesRight: lockIso,
    altitudes,
    names: mergeNames(state.names),
    segs: mergeSegs(kind, state.segs, altitudes),
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
    coordXMin: clamp(
      state.coordXMin ?? (state as { coordMin?: number }).coordMin ?? -1,
      -30,
      30,
    ),
    coordXMax: clamp(
      state.coordXMax ?? (state as { coordMax?: number }).coordMax ?? 8,
      -30,
      40,
    ),
    coordYMin: clamp(
      state.coordYMin ?? (state as { coordMin?: number }).coordMin ?? -1,
      -30,
      30,
    ),
    coordYMax: clamp(
      state.coordYMax ?? (state as { coordMax?: number }).coordMax ?? 8,
      -30,
      40,
    ),
    coordPadding: clamp(state.coordPadding ?? 0.5, 0, 5),
    showAxisDrops: state.showAxisDrops === true,
    rectWidth: clamp(state.rectWidth ?? 6, 0.5, 40),
    rectHeight: clamp(state.rectHeight ?? 8, 0.5, 40),
    rectSquare: state.rectSquare === true,
    showDiagonal: state.showDiagonal !== false,
    unit: state.unit?.trim() ? state.unit : "cm",
    unknownLetter:
      state.unknownLetter && /^[A-Za-z]$/.test(state.unknownLetter) ? state.unknownLetter : "x",
    gridCols: clamp(Math.round(state.gridCols ?? 8), 1, 50),
    gridRows: clamp(Math.round(state.gridRows ?? 8), 1, 50),
    gridMargin: clamp(state.gridMargin ?? 1, 0, 5),
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
  });
  if (result.kind === "altitude") {
    result = snapAltitudeState(result);
  }
  if (result.kind === "rectangle") {
    const w = result.rectWidth;
    const h = result.rectSquare ? w : result.rectHeight;
    result = {
      ...result,
      A: { x: 0, y: 0 },
      B: { x: w, y: 0 },
      C: { x: w, y: h },
      legLeft: w,
      legRight: h,
    };
  }
  const extent = figureGridExtent(result);
  const gridCols = clamp(Math.round(state.gridCols ?? extent.cols), 1, 50);
  const gridRows = clamp(Math.round(state.gridRows ?? extent.rows), 1, 50);
  return {
    ...result,
    gridCols: Math.max(gridCols, extent.cols),
    gridRows: Math.max(gridRows, extent.rows),
    gridMargin: clamp(state.gridMargin ?? 1, 0, 5),
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
  build("triangle", {
    legLeft: 3,
    legRight: 4,
    showGrid: true,
    gridCols: 3,
    gridRows: 4,
    ...triangleFromLegsAtC(3, 4),
  }),
  { AB: customLen("c"), BC: customLen("a"), AC: customLen("b") },
);

const tri912x = withMarks(
  build("triangle", {
    legLeft: 9,
    legRight: 12,
    showGrid: true,
    gridCols: 9,
    gridRows: 12,
    ...triangleFromLegsAtC(9, 12),
  }),
  { AB: xLen("x"), BC: customLen("9 cm"), AC: customLen("12 cm") },
);

const tri24x25 = withMarks(
  build("triangle", {
    legLeft: 7,
    legRight: 24,
    showGrid: true,
    gridCols: 7,
    gridRows: 24,
    ...triangleFromLegsAtC(7, 24),
  }),
  { AB: customLen("25 cm"), BC: xLen("x"), AC: customLen("24 cm") },
);

const isoRight = withMarks(
  build("triangle", {
    legLeft: 5,
    legRight: 5,
    isoscelesRight: true,
    showGrid: true,
    gridCols: 5,
    gridRows: 5,
    ...triangleFromLegsAtC(5, 5),
  }),
  {
    AB: emptyLabel("auto"),
    BC: customLen("5 cm"),
    AC: customLen("5 cm"),
  },
);

const sq32 = build("squares", {
  legLeft: 3,
  legRight: 2,
  showGrid: true,
  showFill: true,
  gridCols: 3,
  gridRows: 2,
  ...triangleFromLegsAtC(3, 2),
});
const sq22 = build("squares", {
  legLeft: 2,
  legRight: 2,
  showGrid: true,
  showFill: true,
  gridCols: 2,
  gridRows: 2,
  ...triangleFromLegsAtC(2, 2),
});
const sq43 = build("squares", {
  legLeft: 4,
  legRight: 3,
  showGrid: true,
  showFill: true,
  gridCols: 4,
  gridRows: 3,
  ...triangleFromLegsAtC(4, 3),
});

const proofPair = build("proof", { proofLegA: 3, proofLegB: 4, proofView: "both" });

const alt3040 = withMarks(
  build("altitude", {
    legLeft: 30,
    legRight: 40,
    rightVertex: "A",
    ...altitudeTriangleFromLegs(30, 40),
  }),
  { AB: customLen("30 cm"), AC: customLen("40 cm") },
);

const rect68 = withMarks(
  build("rectangle", { rectWidth: 6, rectHeight: 8 }),
  { AB: customLen("6 cm"), BC: customLen("8 cm"), AC: customLen("10 cm") },
);

const rectSquare = withMarks(
  build("rectangle", { rectWidth: 5, rectHeight: 5, rectSquare: true }),
  { AB: customLen("5 cm"), AC: emptyLabel("auto") },
);

const obtuseAlt = withMarks(
  build("triangle", {
    rightVertex: "none",
    showGrid: false,
    altitudes: ["A"],
    A: { x: -1, y: 3 },
    B: { x: 5, y: 0 },
    C: { x: 0, y: 0 },
  }),
  {
    BC: customLen("a"),
    AC: customLen("b"),
    AB: customLen("c"),
    AHa: customLen("h"),
  },
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
  { id: "tri-obtuse", title: "둔각 수선", hint: "연장선", state: obtuseAlt },
  { id: "rect-68", title: "직사각형 6×8", hint: "대각선 10", state: rect68 },
  { id: "rect-sq", title: "정사각형", hint: "대각선 5√2", state: rectSquare },
];

export const DEFAULT_PYTHAGOREAN_STATE: PythagoreanState = PYTHAGOREAN_PRESETS[0]!.state;

export function canvasStyleOf(state: PythagoreanState): Pick<
  PythagoreanState,
  | "showGrid"
  | "showVertexNames"
  | "showDots"
  | "gridCols"
  | "gridRows"
  | "gridMargin"
  | "style"
  | "unit"
  | "unknownLetter"
> {
  return {
    showGrid: state.showGrid,
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    gridCols: state.gridCols,
    gridRows: state.gridRows,
    gridMargin: state.gridMargin,
    style: state.style,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
  };
}

export function applyPreset(prev: PythagoreanState, preset: PythagoreanState): PythagoreanState {
  return normalizeState({
    ...cloneState(preset),
    ...canvasStyleOf(prev),
  });
}

export function withKind(prev: PythagoreanState, kind: PythagoreanKind): PythagoreanState {
  const template =
    PYTHAGOREAN_PRESETS.find((p) => p.state.kind === kind)?.state ?? build(kind);
  return normalizeState({
    ...template,
    ...canvasStyleOf(prev),
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
