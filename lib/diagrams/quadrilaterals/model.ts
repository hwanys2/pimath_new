import {
  DEFAULT_STYLE,
  emptyLabel,
  resolveAngleText,
  resolveLengthText,
  type DiagramStyle,
  type MeasLabel,
  type PolygonState,
  type Vec,
} from "@/lib/diagrams/polygon/model";

export type { DiagramStyle, MeasLabel, Vec };
export { emptyLabel, resolveAngleText, resolveLengthText, DEFAULT_STYLE };

export type QuadFamily =
  | "parallelogram"
  | "rectangle"
  | "rhombus"
  | "square"
  | "trapezoid";

export type TickCount = 0 | 1 | 2 | 3;
export type ExtraArcs = 0 | 1 | 2;
export type AngleFill = "none" | "pink" | "blue";
export type AngleMark = "none" | "dot" | "x";
export type FaceFill = "none" | "green" | "yellow";
export type DiagSegId = "AO" | "OC" | "BO" | "OD" | "AC" | "BD";
export type FaceKey = "DBC" | "ODC" | "ABC" | "AOB" | "BOC" | "OAD";

export const QUAD_FAMILIES: { id: QuadFamily; label: string }[] = [
  { id: "parallelogram", label: "평행사변형" },
  { id: "rectangle", label: "직사각형" },
  { id: "rhombus", label: "마름모" },
  { id: "square", label: "정사각형" },
  { id: "trapezoid", label: "사다리꼴" },
];

export const DIAG_SEG_IDS: DiagSegId[] = ["AO", "OC", "BO", "OD", "AC", "BD"];
export const FACE_KEYS: FaceKey[] = ["AOB", "BOC", "ODC", "OAD", "DBC", "ABC"];

export type ExtDir = "in" | "out";

export const EXT_SLOTS: { vertex: 0 | 1 | 2 | 3; dir: ExtDir; label: string }[] = [
  { vertex: 0, dir: "in", label: "DA→A" },
  { vertex: 0, dir: "out", label: "AB→A" },
  { vertex: 1, dir: "in", label: "AB→B" },
  { vertex: 1, dir: "out", label: "BC→B" },
  { vertex: 2, dir: "in", label: "BC→C" },
  { vertex: 2, dir: "out", label: "CD→C" },
  { vertex: 3, dir: "in", label: "CD→D" },
  { vertex: 3, dir: "out", label: "DA→D" },
];

const EXT_NAMES = ["E", "F", "G", "H", "P", "Q", "R", "S"];

export type WedgeMark = {
  show: boolean;
  fill: AngleFill;
  label: MeasLabel;
  extraArcs: ExtraArcs;
  showDot: boolean;
  showX: boolean;
};

export type QuadVertex = {
  name: string;
  nameDx: number;
  nameDy: number;
  showInterior: boolean;
  fillInterior: AngleFill;
  showExterior: boolean;
  fillExterior: boolean;
  interior: MeasLabel;
  exterior: MeasLabel;
  extraArcs: ExtraArcs;
  angleMark: AngleMark;
  wedgePrev: WedgeMark;
  wedgeNext: WedgeMark;
};

export type QuadEdge = {
  showLength: boolean;
  length: MeasLabel;
  ticks: TickCount;
  parallel: boolean;
};

export type DiagSeg = {
  show: boolean;
  label: MeasLabel;
};

export type QuadExtension = {
  vertex: 0 | 1 | 2 | 3;
  dir: ExtDir;
  name: string;
  nameDx: number;
  nameDy: number;
};

export type QuadState = {
  family: QuadFamily;
  points: Vec[];
  vertices: QuadVertex[];
  edges: QuadEdge[];
  interiorAnglesDeg: number[];
  referenceEdgeLength: number;
  showDiagAC: boolean;
  showDiagBD: boolean;
  showO: boolean;
  oName: string;
  oDx: number;
  oDy: number;
  showRightAtO: boolean;
  diagSegs: Record<DiagSegId, DiagSeg>;
  faces: Record<FaceKey, FaceFill>;
  extensions: QuadExtension[];
  showGuides: boolean;
  guideTopName: string;
  guideBottomName: string;
  guideTopDx: number;
  guideTopDy: number;
  guideBottomDx: number;
  guideBottomDy: number;
  showVertexNames: boolean;
  showDots: boolean;
  unit: string;
  unknownLetter: string;
  style: DiagramStyle;
};

export type QuadPreset = {
  id: string;
  title: string;
  hint: string;
  state: QuadState;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function interiorAngleAt(points: Vec[], i: number): number {
  const n = points.length;
  const p = points[i]!;
  const prev = points[(i - 1 + n) % n]!;
  const next = points[(i + 1) % n]!;
  const ux = prev.x - p.x;
  const uy = prev.y - p.y;
  const wx = next.x - p.x;
  const wy = next.y - p.y;
  const lu = Math.hypot(ux, uy) || 1;
  const lw = Math.hypot(wx, wy) || 1;
  const dot = (ux / lu) * (wx / lw) + (uy / lu) * (wy / lw);
  return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
}

function edgeLen(points: Vec[], i: number): number {
  const a = points[i]!;
  const b = points[(i + 1) % points.length]!;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function vertexLetter(i: number): "A" | "B" | "C" | "D" {
  return (["A", "B", "C", "D"] as const)[i] ?? "A";
}

export function emptyWedge(): WedgeMark {
  return {
    show: false,
    fill: "none",
    label: emptyLabel("auto"),
    extraArcs: 0,
    showDot: false,
    showX: false,
  };
}

function makeVertex(i: number, patch: Partial<QuadVertex> = {}): QuadVertex {
  const { wedgePrev, wedgeNext, interior, exterior, ...rest } = patch;
  return {
    name: vertexLetter(i),
    nameDx: 0,
    nameDy: 0,
    showInterior: false,
    fillInterior: "none",
    showExterior: false,
    fillExterior: false,
    extraArcs: 0,
    angleMark: "none",
    ...rest,
    interior: interior ?? emptyLabel("auto"),
    exterior: exterior ?? emptyLabel("auto"),
    wedgePrev: { ...emptyWedge(), ...wedgePrev, label: wedgePrev?.label ?? emptyLabel("auto") },
    wedgeNext: { ...emptyWedge(), ...wedgeNext, label: wedgeNext?.label ?? emptyLabel("auto") },
  };
}

function makeEdge(patch: Partial<QuadEdge> = {}): QuadEdge {
  const { length, ...rest } = patch;
  return {
    showLength: false,
    ticks: 0,
    parallel: false,
    ...rest,
    length: length ?? emptyLabel("auto"),
  };
}

function makeSeg(patch: Partial<DiagSeg> = {}): DiagSeg {
  const { label, ...rest } = patch;
  return { show: false, ...rest, label: label ?? emptyLabel("auto") };
}

function emptyDiagSegs(patch: Partial<Record<DiagSegId, Partial<DiagSeg>>> = {}): Record<DiagSegId, DiagSeg> {
  const out = {} as Record<DiagSegId, DiagSeg>;
  for (const id of DIAG_SEG_IDS) {
    out[id] = makeSeg(patch[id]);
  }
  return out;
}

function emptyFaces(patch: Partial<Record<FaceKey, FaceFill>> = {}): Record<FaceKey, FaceFill> {
  return {
    DBC: patch.DBC ?? "none",
    ODC: patch.ODC ?? "none",
    ABC: patch.ABC ?? "none",
    AOB: patch.AOB ?? "none",
    BOC: patch.BOC ?? "none",
    OAD: patch.OAD ?? "none",
  };
}

function makeExtension(patch: Partial<QuadExtension> = {}): QuadExtension {
  const vertex: 0 | 1 | 2 | 3 =
    patch.vertex === 0 || patch.vertex === 1 || patch.vertex === 2 || patch.vertex === 3
      ? patch.vertex
      : 1;
  return {
    vertex,
    dir: patch.dir === "out" ? "out" : "in",
    name: patch.name?.trim() ? patch.name : "E",
    nameDx: clamp(patch.nameDx ?? 0, -80, 80),
    nameDy: clamp(patch.nameDy ?? 0, -80, 80),
  };
}

function nextExtName(existing: QuadExtension[]): string {
  const used = new Set(existing.map((e) => e.name));
  return EXT_NAMES.find((n) => !used.has(n)) ?? "E";
}

type LegacyExtension = QuadExtension & { show?: boolean };

function readExtensions(
  state: Partial<QuadState> & { extension?: LegacyExtension },
): QuadExtension[] {
  if (Array.isArray(state.extensions) && state.extensions.length > 0) {
    const out: QuadExtension[] = [];
    const seen = new Set<string>();
    for (const item of state.extensions.slice(0, 8)) {
      const ext = makeExtension(item);
      const key = `${ext.vertex}:${ext.dir}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ext);
    }
    return out;
  }
  const legacy = state.extension;
  if (legacy?.show === true) return [makeExtension(legacy)];
  return [];
}

export { makeExtension, nextExtName };

export function parallelogramPoints(A: Vec, B: Vec, C: Vec): Vec[] {
  return [A, B, C, { x: A.x + C.x - B.x, y: A.y + C.y - B.y }];
}

export function defaultParallelogram(): Vec[] {
  return parallelogramPoints(
    { x: -2.2, y: 2.15 },
    { x: -3.5, y: -2.05 },
    { x: 3.3, y: -2.05 },
  );
}

export function rectanglePoints(w = 6.6, h = 4.1): Vec[] {
  return [
    { x: -w / 2, y: h / 2 },
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
  ];
}

export function rhombusDiamond(halfH = 3.05, halfW = 3.55): Vec[] {
  return [
    { x: 0, y: halfH },
    { x: -halfW, y: 0 },
    { x: 0, y: -halfH },
    { x: halfW, y: 0 },
  ];
}

export function squarePoints(s = 4.6): Vec[] {
  return rectanglePoints(s, s);
}

export function trapezoidPoints(): Vec[] {
  return [
    { x: -1.45, y: 2.15 },
    { x: -3.9, y: -2.15 },
    { x: 3.9, y: -2.15 },
    { x: 1.55, y: 2.15 },
  ];
}

function mergeWedge(prev: WedgeMark | undefined, patch?: Partial<WedgeMark>): WedgeMark {
  const base = prev ?? emptyWedge();
  return {
    ...base,
    ...patch,
    label: patch?.label ? { ...emptyLabel("auto"), ...patch.label } : { ...base.label },
  };
}

export function cloneState(state: QuadState): QuadState {
  return structuredClone(state);
}

export function toPolygonState(state: QuadState): PolygonState {
  const diagonals: [number, number][] = [];
  if (state.showDiagAC) diagonals.push([0, 2]);
  if (state.showDiagBD) diagonals.push([1, 3]);
  return {
    points: state.points,
    vertices: state.vertices.map((v) => ({
      name: v.name,
      nameDx: v.nameDx,
      nameDy: v.nameDy,
      showInterior: v.showInterior,
      showExterior: v.showExterior,
      fillExterior: v.fillExterior,
      interior: v.interior,
      exterior: v.exterior,
    })),
    edges: state.edges.map((e) => ({
      showLength: e.showLength,
      length: e.length,
    })),
    diagonals,
    interiorAnglesDeg: state.interiorAnglesDeg,
    referenceEdgeLength: state.referenceEdgeLength,
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  };
}

export function fromPolygonState(poly: PolygonState, prev: QuadState): QuadState {
  return normalizeState({
    ...prev,
    points: poly.points,
    vertices: prev.vertices.map((v, i) => {
      const pv = poly.vertices[i];
      if (!pv) return v;
      return {
        ...v,
        name: pv.name,
        nameDx: pv.nameDx,
        nameDy: pv.nameDy,
        showInterior: pv.showInterior,
        showExterior: pv.showExterior,
        fillExterior: pv.fillExterior,
        interior: pv.interior,
        exterior: pv.exterior,
      };
    }),
    edges: prev.edges.map((e, i) => {
      const pe = poly.edges[i];
      if (!pe) return e;
      return { ...e, showLength: pe.showLength, length: pe.length };
    }),
    interiorAnglesDeg: poly.interiorAnglesDeg,
    referenceEdgeLength: poly.referenceEdgeLength,
    showVertexNames: poly.showVertexNames,
    showDots: poly.showDots,
    unit: poly.unit,
    unknownLetter: poly.unknownLetter,
    style: poly.style,
  });
}

export function normalizeState(
  state: (Partial<QuadState> & Pick<QuadState, "points"> | QuadState) & {
    extension?: LegacyExtension;
  },
): QuadState {
  let points = (state.points ?? []).slice(0, 4);
  if (points.length < 4) points = defaultParallelogram();
  const vertices = [0, 1, 2, 3].map((i) => {
    const prev = state.vertices?.[i];
    return makeVertex(i, {
      ...prev,
      wedgePrev: mergeWedge(prev?.wedgePrev),
      wedgeNext: mergeWedge(prev?.wedgeNext),
    });
  });
  const edges = [0, 1, 2, 3].map((i) => makeEdge(state.edges?.[i]));
  const family: QuadFamily =
    state.family === "rectangle" ||
    state.family === "rhombus" ||
    state.family === "square" ||
    state.family === "trapezoid"
      ? state.family
      : "parallelogram";
  const style = { ...DEFAULT_STYLE, ...state.style };
  return {
    family,
    points,
    vertices,
    edges,
    interiorAnglesDeg: points.map((_, i) => interiorAngleAt(points, i)),
    referenceEdgeLength: clamp(
      state.referenceEdgeLength != null && Number.isFinite(state.referenceEdgeLength)
        ? state.referenceEdgeLength
        : edgeLen(points, 0),
      0.5,
      40,
    ),
    showDiagAC: state.showDiagAC === true,
    showDiagBD: state.showDiagBD === true,
    showO: state.showO === true,
    oName: state.oName?.trim() ? state.oName : "O",
    oDx: clamp(state.oDx ?? 0, -80, 80),
    oDy: clamp(state.oDy ?? 0, -80, 80),
    showRightAtO: state.showRightAtO === true,
    diagSegs: emptyDiagSegs(state.diagSegs),
    faces: emptyFaces(state.faces),
    extensions: readExtensions(state),
    showGuides: state.showGuides === true,
    guideTopName: state.guideTopName?.trim() ? state.guideTopName : "l",
    guideBottomName: state.guideBottomName?.trim() ? state.guideBottomName : "m",
    guideTopDx: clamp(state.guideTopDx ?? 0, -80, 80),
    guideTopDy: clamp(state.guideTopDy ?? 0, -80, 80),
    guideBottomDx: clamp(state.guideBottomDx ?? 0, -80, 80),
    guideBottomDy: clamp(state.guideBottomDy ?? 0, -80, 80),
    showVertexNames: state.showVertexNames !== false,
    showDots: state.showDots !== false,
    unit: state.unit?.trim() ? state.unit : "cm",
    unknownLetter:
      state.unknownLetter && /^[A-Za-z]$/.test(state.unknownLetter)
        ? state.unknownLetter
        : "x",
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

function baseState(points: Vec[], patch: Partial<QuadState> = {}): QuadState {
  return normalizeState({
    family: "parallelogram",
    points,
    vertices: [0, 1, 2, 3].map((i) => makeVertex(i)),
    edges: [0, 1, 2, 3].map(() => makeEdge()),
    showVertexNames: true,
    showDots: true,
    unit: "cm",
    unknownLetter: "x",
    style: { ...DEFAULT_STYLE },
    ...patch,
  });
}

function customLen(text: string): MeasLabel {
  return { ...emptyLabel("custom"), custom: text };
}

function xLen(letter: string): MeasLabel {
  return { ...emptyLabel("x"), custom: letter };
}

function customAng(text: string): MeasLabel {
  return { ...emptyLabel("custom"), custom: text };
}

function xAng(letter: string): MeasLabel {
  return { ...emptyLabel("x"), custom: letter };
}

function withDiags(patch: Partial<QuadState> = {}): Partial<QuadState> {
  return { showDiagAC: true, showDiagBD: true, showO: true, ...patch };
}

export const QUAD_PRESETS: QuadPreset[] = [
  {
    id: "opp-sides",
    title: "대변 길이",
    hint: "5·7 · x·y cm",
    state: baseState(defaultParallelogram(), {
      edges: [
        makeEdge({ showLength: true, length: customLen("5") }),
        makeEdge({ showLength: true, length: customLen("7") }),
        makeEdge({ showLength: true, length: xLen("y") }),
        makeEdge({ showLength: true, length: xLen("x") }),
      ],
    }),
  },
  {
    id: "opp-angles",
    title: "대각·이웃각",
    hint: "100° · x·y",
    state: baseState(defaultParallelogram(), {
      vertices: [
        makeVertex(0),
        makeVertex(1, {
          showInterior: true,
          fillInterior: "pink",
          interior: xAng("x"),
        }),
        makeVertex(2, {
          showInterior: true,
          fillInterior: "blue",
          interior: xAng("y"),
        }),
        makeVertex(3, {
          showInterior: true,
          interior: customAng("100°"),
        }),
      ],
    }),
  },
  {
    id: "diag-meet",
    title: "대각선 교점",
    hint: "AO 4 · DO 3 · y",
    state: baseState(
      defaultParallelogram(),
      withDiags({
        edges: [
          makeEdge({ showLength: true, length: xLen("x") }),
          makeEdge(),
          makeEdge(),
          makeEdge(),
        ],
        diagSegs: emptyDiagSegs({
          AO: { show: true, label: customLen("4") },
          OC: { show: true, label: xLen("y") },
          OD: { show: true, label: customLen("3") },
        }),
      }),
    ),
  },
  {
    id: "diag-full",
    title: "대각선 전체",
    hint: "AB 5 · AC 12 · x·y",
    state: baseState(
      defaultParallelogram(),
      withDiags({
        edges: [
          makeEdge({ showLength: true, length: customLen("5") }),
          makeEdge(),
          makeEdge(),
          makeEdge(),
        ],
        diagSegs: emptyDiagSegs({
          AO: { show: true, label: xLen("x") },
          BO: { show: true, label: xLen("y") },
          AC: { show: true, label: customLen("12") },
        }),
      }),
    ),
  },
  {
    id: "equal-marks",
    title: "맞꼭지각 표시",
    hint: "점·x · 연장 E",
    state: baseState(defaultParallelogram(), {
      vertices: [
        makeVertex(0, { showInterior: true, interior: emptyLabel("hide"), angleMark: "dot" }),
        makeVertex(1, { showInterior: true, interior: emptyLabel("hide"), angleMark: "x" }),
        makeVertex(2, { showInterior: true, interior: emptyLabel("hide"), angleMark: "dot" }),
        makeVertex(3, { showInterior: true, interior: emptyLabel("hide"), angleMark: "x" }),
      ],
      extensions: [{ vertex: 1, dir: "in", name: "E", nameDx: 0, nameDy: 0 }],
    }),
  },
  {
    id: "parallel-ticks",
    title: "평행·등변",
    hint: "화살 · 빗금 2",
    state: baseState(defaultParallelogram(), {
      edges: [
        makeEdge(),
        makeEdge({ ticks: 2, parallel: true }),
        makeEdge(),
        makeEdge({ ticks: 2, parallel: true }),
      ],
    }),
  },
  {
    id: "parallel-equal",
    title: "평행하고 같은 길이",
    hint: "AD∥BC · 5 cm",
    state: baseState(defaultParallelogram(), {
      edges: [
        makeEdge(),
        makeEdge({ showLength: true, length: customLen("5"), parallel: true }),
        makeEdge(),
        makeEdge({ showLength: true, length: customLen("5"), parallel: true }),
      ],
    }),
  },
  {
    id: "both-sides",
    title: "대변의 길이",
    hint: "6 cm · 4 cm",
    state: baseState(defaultParallelogram(), {
      edges: [
        makeEdge({ showLength: true, length: customLen("4") }),
        makeEdge({ showLength: true, length: customLen("6") }),
        makeEdge({ showLength: true, length: customLen("4") }),
        makeEdge({ showLength: true, length: customLen("6") }),
      ],
    }),
  },
  {
    id: "diag-bisect",
    title: "대각선 이등분",
    hint: "3 cm · 2 cm",
    state: baseState(
      defaultParallelogram(),
      withDiags({
        diagSegs: emptyDiagSegs({
          AO: { show: true, label: customLen("3") },
          OC: { show: true, label: customLen("3") },
          BO: { show: true, label: customLen("2") },
          OD: { show: true, label: customLen("2") },
        }),
      }),
    ),
  },
  {
    id: "rect-half",
    title: "직사각형 반 대각선",
    hint: "AO 8 · BD x",
    state: baseState(
      rectanglePoints(),
      withDiags({
        family: "rectangle",
        diagSegs: emptyDiagSegs({
          AO: { show: true, label: customLen("8") },
          BD: { show: true, label: xLen("x") },
        }),
      }),
    ),
  },
  {
    id: "rect-full",
    title: "직사각형 전체 대각선",
    hint: "AC 12 · OD x",
    state: baseState(
      rectanglePoints(),
      withDiags({
        family: "rectangle",
        diagSegs: emptyDiagSegs({
          AC: { show: true, label: customLen("12") },
          OD: { show: true, label: xLen("x") },
        }),
      }),
    ),
  },
  {
    id: "rhombus-angle",
    title: "마름모",
    hint: "60° · y · x·7 cm",
    state: (() => {
      const h = 2.15;
      const w = h * Math.sqrt(3);
      return baseState(
        rhombusDiamond(h, w),
        withDiags({
          family: "rhombus",
          vertices: [
            makeVertex(0, {
              wedgePrev: {
                show: true,
                fill: "none",
                extraArcs: 0,
                showDot: false,
                showX: false,
                label: customAng("60°"),
              },
            }),
            makeVertex(1, {
              wedgePrev: {
                show: true,
                fill: "pink",
                extraArcs: 0,
                showDot: false,
                showX: false,
                label: xAng("y"),
              },
            }),
            makeVertex(2),
            makeVertex(3),
          ],
          diagSegs: emptyDiagSegs({
            BO: { show: true, label: xLen("x") },
            OD: { show: true, label: customLen("7") },
          }),
        }),
      );
    })(),
  },
  {
    id: "rhombus-right",
    title: "마름모 수직",
    hint: "직각 · 25° · 8 cm",
    state: (() => {
      const w = 3.5;
      const h = w * Math.tan((25 * Math.PI) / 180);
      return baseState(
        rhombusDiamond(h, w),
        withDiags({
          family: "rhombus",
          showRightAtO: true,
          vertices: [
            makeVertex(0, {
              wedgeNext: {
                show: true,
                fill: "pink",
                extraArcs: 0,
                showDot: false,
                showX: false,
                label: xAng("y"),
              },
            }),
            makeVertex(1),
            makeVertex(2),
            makeVertex(3, {
              wedgePrev: {
                show: true,
                fill: "none",
                extraArcs: 0,
                showDot: false,
                showX: false,
                label: customAng("25°"),
              },
            }),
          ],
          edges: [
            makeEdge({ showLength: true, length: customLen("8") }),
            makeEdge(),
            makeEdge(),
            makeEdge({ showLength: true, length: xLen("x") }),
          ],
        }),
      );
    })(),
  },
  {
    id: "parallel-area",
    title: "평행선 사이",
    hint: "l∥m · △DBC",
    state: baseState(trapezoidPoints(), {
      family: "trapezoid",
      showDiagAC: true,
      showDiagBD: true,
      showGuides: true,
      faces: emptyFaces({ DBC: "green" }),
    }),
  },
  {
    id: "trap-diag",
    title: "사다리꼴 대각선",
    hint: "△ODC 채움",
    state: baseState(
      trapezoidPoints(),
      withDiags({
        family: "trapezoid",
        faces: emptyFaces({ ODC: "yellow" }),
      }),
    ),
  },
];

export const DEFAULT_QUAD_STATE: QuadState = QUAD_PRESETS[0]!.state;

export function setFamily(state: QuadState, family: QuadFamily): QuadState {
  return normalizeState({ ...state, family });
}

export function cycleAngleFill(current: AngleFill): AngleFill {
  if (current === "none") return "pink";
  if (current === "pink") return "blue";
  return "none";
}

export function cycleFaceFill(current: FaceFill): FaceFill {
  if (current === "none") return "green";
  if (current === "yellow") return "none";
  return "yellow";
}

export function cycleAngleMark(current: AngleMark): AngleMark {
  if (current === "none") return "dot";
  if (current === "dot") return "x";
  return "none";
}
