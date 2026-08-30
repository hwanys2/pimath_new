import {
  DEFAULT_STYLE,
  emptyLabel,
  type DiagramStyle,
  type MeasLabel,
  type Vec,
} from "@/lib/diagrams/polygon/model";
import {
  altitudeTriangleFromLegs,
  triangleForRightVertex,
  triangleFromLegsAtB,
  triangleFromLegsAtC,
  type RightVertex,
} from "@/lib/diagrams/pythagorean/model";

export type { DiagramStyle, MeasLabel, Vec };
export { emptyLabel, DEFAULT_STYLE };

export type TrigKind = "right" | "unit-circle" | "triangle-area" | "quad-area";

export type AngleFill = "none" | "pink" | "blue" | "green";

export type TriFill = "green" | "pink";

export type QuadFill = "pink" | "yellow";

export type QuadFamily = "general" | "parallelogram";

export const TRIG_KINDS: { id: TrigKind; label: string }[] = [
  { id: "right", label: "직각삼각형" },
  { id: "unit-circle", label: "단위원" },
  { id: "triangle-area", label: "삼각형의 넓이" },
  { id: "quad-area", label: "사각형의 넓이" },
];

export type NameMark = { name: string; dx: number; dy: number };

export type SegMark = {
  id: string;
  a: string;
  b: string;
  show: boolean;
  label: MeasLabel;
};

export type AngleMark = {
  id: string;
  vertex: string;
  from: string;
  to: string;
  show: boolean;
  fill: AngleFill;
  label: MeasLabel;
};

export type TriVertexMark = {
  name: string;
  nameDx: number;
  nameDy: number;
  showInterior: boolean;
  fillInterior: AngleFill;
  interior: MeasLabel;
};

export type TriEdgeMark = {
  showLength: boolean;
  length: MeasLabel;
};

export type TrigRatiosState = {
  kind: TrigKind;
  style: DiagramStyle;
  unit: string;
  unknownLetter: string;
  showVertexNames: boolean;
  showDots: boolean;
  rotateDeg: number;

  /** right triangle */
  A: Vec;
  B: Vec;
  C: Vec;
  rightVertex: RightVertex;
  legLeft: number;
  legRight: number;
  isoscelesRight: boolean;
  names: Record<string, NameMark>;
  segs: SegMark[];
  showRightAngle: boolean;
  refAngleVertex: RightVertex;
  angles: AngleMark[];

  /** unit circle */
  thetaDeg: number;
  showAxes: boolean;
  showAxisLabels: boolean;
  showAxisValues: boolean;
  showRadiusLabel: boolean;
  showUnitRightAngles: boolean;
  showYProjections: boolean;
  showAngleX: boolean;
  showAnglesYZ: boolean;
  axisPrecision: number;

  /** triangle area */
  triA: Vec;
  triB: Vec;
  triC: Vec;
  triNames: Record<string, NameMark>;
  triSegs: SegMark[];
  triAngles: AngleMark[];
  triVertices: TriVertexMark[];
  triEdges: TriEdgeMark[];
  altitudeFrom: "A" | "B" | "C";
  showTriFill: boolean;
  triFill: TriFill;
  showAltitudeHighlight: boolean;
  showAltitudeRight: boolean;
  showBaseExtension: boolean;

  /** quad area */
  quadFamily: QuadFamily;
  quadPoints: Vec[];
  quadVertices: TriVertexMark[];
  quadEdges: TriEdgeMark[];
  showQuadFill: boolean;
  quadFill: QuadFill;
  showQuadDiagonal: boolean;
};

export type TrigPreset = {
  id: string;
  title: string;
  hint: string;
  state: TrigRatiosState;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function wrapRotateDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((deg % 360) + 360) % 360;
}

export function cloneState(state: TrigRatiosState): TrigRatiosState {
  return structuredClone(state);
}

function name(id: string, label?: string, dx = 0, dy = 0): NameMark {
  return { name: label ?? id, dx, dy };
}

function seg(a: string, b: string, show = false, label?: MeasLabel): SegMark {
  return {
    id: `${a}${b}`,
    a,
    b,
    show,
    label: label ?? emptyLabel("auto"),
  };
}

function ang(
  id: string,
  vertex: string,
  from: string,
  to: string,
  show = false,
  fill: AngleFill = "none",
  label?: MeasLabel,
): AngleMark {
  return {
    id,
    vertex,
    from,
    to,
    show,
    fill,
    label: label ?? emptyLabel("auto"),
  };
}

function customLen(text: string, patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("custom"), custom: text, ...patch };
}

function xLen(letter = "x", patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("x"), custom: letter, ...patch };
}

function degLen(deg: number, patch: Partial<MeasLabel> = {}): MeasLabel {
  return customLen(`${deg}°`, patch);
}

function defaultRightNames(): Record<string, NameMark> {
  return { A: name("A"), B: name("B"), C: name("C") };
}

function defaultRightSegs(): SegMark[] {
  return [seg("A", "B"), seg("B", "C"), seg("A", "C")];
}

function defaultRightAngles(): AngleMark[] {
  return [
    ang("A", "A", "B", "C"),
    ang("B", "B", "A", "C"),
    ang("C", "C", "A", "B"),
  ];
}

function defaultTriNames(): Record<string, NameMark> {
  return { A: name("A"), B: name("B"), C: name("C"), H: name("H") };
}

function defaultTriSegs(): SegMark[] {
  return [
    seg("A", "B"),
    seg("B", "C"),
    seg("A", "C"),
    seg("C", "H"),
    seg("A", "H"),
  ];
}

function defaultTriAngles(): AngleMark[] {
  return [
    ang("A", "A", "B", "C"),
    ang("B", "B", "A", "C"),
    ang("C", "C", "A", "B"),
    ang("CAH", "C", "A", "H"),
    ang("HAB", "A", "H", "B"),
    ang("extA", "A", "C", "H"),
  ];
}

function makeTriVertex(i: number, patch: Partial<TriVertexMark> = {}): TriVertexMark {
  const letters = ["A", "B", "C", "D"];
  return {
    name: letters[i] ?? `P${i}`,
    nameDx: 0,
    nameDy: 0,
    showInterior: false,
    fillInterior: "none",
    interior: emptyLabel("auto"),
    ...patch,
  };
}

function makeTriEdge(patch: Partial<TriEdgeMark> = {}): TriEdgeMark {
  return { showLength: false, length: emptyLabel("auto"), ...patch };
}

function defaultQuadPoints(family: QuadFamily): Vec[] {
  if (family === "parallelogram") {
    return [
      { x: -2.2, y: 2.4 },
      { x: -3.6, y: 0 },
      { x: 1.2, y: 0 },
      { x: 2.6, y: 2.4 },
    ];
  }
  return [
    { x: -0.8, y: 2.8 },
    { x: -3.2, y: 0 },
    { x: 2.8, y: 0 },
    { x: 1.6, y: 1.4 },
  ];
}

function defaultQuadVertices(): TriVertexMark[] {
  return [0, 1, 2, 3].map((i) => makeTriVertex(i));
}

function defaultQuadEdges(): TriEdgeMark[] {
  return [0, 1, 2, 3].map(() => makeTriEdge());
}

function mergeNames(
  base: Record<string, NameMark>,
  prev?: Record<string, NameMark>,
): Record<string, NameMark> {
  const out = { ...base };
  if (!prev) return out;
  for (const [id, mark] of Object.entries(prev)) {
    out[id] = { ...(base[id] ?? name(id)), ...mark };
  }
  return out;
}

function mergeSegs(base: SegMark[], prev?: SegMark[]): SegMark[] {
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

function mergeAngles(base: AngleMark[], prev?: AngleMark[]): AngleMark[] {
  const map = new Map((prev ?? []).map((a) => [a.id, a]));
  return base.map((b) => {
    const p = map.get(b.id);
    if (!p) return b;
    const fill =
      p.fill === "pink" || p.fill === "blue" || p.fill === "green" ? p.fill : "none";
    return {
      ...b,
      show: p.show === true,
      fill,
      label: { ...emptyLabel("auto"), ...p.label },
    };
  });
}

function mergeTriVertices(
  base: TriVertexMark[],
  prev?: TriVertexMark[],
): TriVertexMark[] {
  return base.map((b, i) => {
    const p = prev?.[i];
    if (!p) return b;
    const fill =
      p.fillInterior === "pink" ||
      p.fillInterior === "blue" ||
      p.fillInterior === "green"
        ? p.fillInterior
        : "none";
    return {
      ...b,
      name: p.name?.trim() ? p.name : b.name,
      nameDx: p.nameDx ?? 0,
      nameDy: p.nameDy ?? 0,
      showInterior: p.showInterior === true,
      fillInterior: fill,
      interior: { ...emptyLabel("auto"), ...p.interior },
    };
  });
}

function mergeTriEdges(base: TriEdgeMark[], prev?: TriEdgeMark[]): TriEdgeMark[] {
  return base.map((b, i) => {
    const p = prev?.[i];
    if (!p) return b;
    return {
      ...b,
      showLength: p.showLength === true,
      length: { ...emptyLabel("auto"), ...p.length },
    };
  });
}

function baseDefaults(kind: TrigKind): TrigRatiosState {
  const style = { ...DEFAULT_STYLE };
  return {
    kind,
    style,
    unit: "cm",
    unknownLetter: "x",
    showVertexNames: true,
    showDots: true,
    rotateDeg: 0,
    A: { x: 0, y: 0 },
    B: { x: 0, y: 0 },
    C: { x: 0, y: 0 },
    rightVertex: "B",
    legLeft: 3,
    legRight: 4,
    isoscelesRight: false,
    names: defaultRightNames(),
    segs: defaultRightSegs(),
    showRightAngle: true,
    refAngleVertex: "A",
    angles: defaultRightAngles(),
    thetaDeg: 48,
    showAxes: true,
    showAxisLabels: true,
    showAxisValues: true,
    showRadiusLabel: true,
    showUnitRightAngles: true,
    showYProjections: true,
    showAngleX: true,
    showAnglesYZ: true,
    axisPrecision: 4,
    triA: { x: -2.8, y: 0 },
    triB: { x: 3.2, y: 0 },
    triC: { x: 0.4, y: 3.6 },
    triNames: defaultTriNames(),
    triSegs: defaultTriSegs(),
    triAngles: defaultTriAngles(),
    triVertices: [0, 1, 2].map((i) => makeTriVertex(i)),
    triEdges: [0, 1, 2].map(() => makeTriEdge()),
    altitudeFrom: "C",
    showTriFill: true,
    triFill: "green",
    showAltitudeHighlight: true,
    showAltitudeRight: true,
    showBaseExtension: true,
    quadFamily: "general",
    quadPoints: defaultQuadPoints("general"),
    quadVertices: defaultQuadVertices(),
    quadEdges: defaultQuadEdges(),
    showQuadFill: true,
    quadFill: "pink",
    showQuadDiagonal: true,
  };
}

export function normalizeState(
  state: Partial<TrigRatiosState> & Pick<TrigRatiosState, "kind">,
): TrigRatiosState {
  const kind = TRIG_KINDS.some((k) => k.id === state.kind) ? state.kind : "right";
  const style = { ...DEFAULT_STYLE, ...state.style };
  const rv: RightVertex =
    state.rightVertex === "A" || state.rightVertex === "B" ? state.rightVertex : "C";
  const ll0 = clamp(state.legLeft ?? 3, 0.5, 40);
  const lr0 = clamp(state.legRight ?? 4, 0.5, 40);
  const ll = state.isoscelesRight === true ? Math.max(ll0, lr0) : ll0;
  const lr = state.isoscelesRight === true ? ll : lr0;
  const legs = triangleForRightVertex(ll, lr, rv);
  const quadFamily: QuadFamily =
    state.quadFamily === "parallelogram" ? "parallelogram" : "general";

  return {
    ...baseDefaults(kind),
    kind,
    A: state.A ?? legs.A,
    B: state.B ?? legs.B,
    C: state.C ?? legs.C,
    rightVertex: rv,
    legLeft: ll,
    legRight: lr,
    isoscelesRight: state.isoscelesRight === true,
    names: mergeNames(defaultRightNames(), state.names),
    segs: mergeSegs(defaultRightSegs(), state.segs),
    showRightAngle: state.showRightAngle !== false,
    refAngleVertex:
      state.refAngleVertex === "A" || state.refAngleVertex === "B"
        ? state.refAngleVertex
        : state.refAngleVertex === "C"
          ? "C"
          : rv === "C"
            ? "A"
            : "A",
    angles: mergeAngles(defaultRightAngles(), state.angles),
    thetaDeg: clamp(state.thetaDeg ?? 48, 15, 80),
    showAxes: state.showAxes !== false,
    showAxisLabels: state.showAxisLabels !== false,
    showAxisValues: state.showAxisValues !== false,
    showRadiusLabel: state.showRadiusLabel !== false,
    showUnitRightAngles: state.showUnitRightAngles !== false,
    showYProjections: state.showYProjections !== false,
    showAngleX: state.showAngleX !== false,
    showAnglesYZ: state.showAnglesYZ !== false,
    axisPrecision: clamp(Math.round(state.axisPrecision ?? 4), 2, 6),
    triA: state.triA ?? { x: -2.8, y: 0 },
    triB: state.triB ?? { x: 3.2, y: 0 },
    triC: state.triC ?? { x: 0.4, y: 3.6 },
    triNames: mergeNames(defaultTriNames(), state.triNames),
    triSegs: mergeSegs(defaultTriSegs(), state.triSegs),
    triAngles: mergeAngles(defaultTriAngles(), state.triAngles),
    triVertices: mergeTriVertices(
      [0, 1, 2].map((i) => makeTriVertex(i)),
      state.triVertices,
    ),
    triEdges: mergeTriEdges(
      [0, 1, 2].map(() => makeTriEdge()),
      state.triEdges,
    ),
    altitudeFrom:
      state.altitudeFrom === "A" || state.altitudeFrom === "B" ? state.altitudeFrom : "C",
    showTriFill: state.showTriFill !== false,
    triFill: state.triFill === "pink" ? "pink" : "green",
    showAltitudeHighlight: state.showAltitudeHighlight !== false,
    showAltitudeRight: state.showAltitudeRight !== false,
    showBaseExtension: state.showBaseExtension !== false,
    quadFamily,
    quadPoints: (state.quadPoints ?? defaultQuadPoints(quadFamily)).slice(0, 4),
    quadVertices: mergeTriVertices(defaultQuadVertices(), state.quadVertices),
    quadEdges: mergeTriEdges(defaultQuadEdges(), state.quadEdges),
    showQuadFill: state.showQuadFill !== false,
    quadFill: state.quadFill === "yellow" ? "yellow" : "pink",
    showQuadDiagonal: state.showQuadDiagonal !== false,
    showVertexNames: state.showVertexNames !== false,
    showDots: state.showDots !== false,
    unit: state.unit?.trim() ? state.unit : "cm",
    unknownLetter:
      state.unknownLetter && /^[A-Za-z]$/.test(state.unknownLetter) ? state.unknownLetter : "x",
    rotateDeg: wrapRotateDeg(Number(state.rotateDeg ?? 0)),
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

function build(kind: TrigKind, patch: Partial<TrigRatiosState> = {}): TrigRatiosState {
  return normalizeState({ kind, ...patch });
}

function withSegs(state: TrigRatiosState, specs: Record<string, MeasLabel>): TrigRatiosState {
  let next = state;
  for (const [id, label] of Object.entries(specs)) {
    next = {
      ...next,
      segs: next.segs.map((s) => (s.id === id ? { ...s, show: true, label } : s)),
    };
  }
  return next;
}

function withTriSegs(state: TrigRatiosState, specs: Record<string, MeasLabel>): TrigRatiosState {
  let next = state;
  for (const [id, label] of Object.entries(specs)) {
    next = {
      ...next,
      triSegs: next.triSegs.map((s) => (s.id === id ? { ...s, show: true, label } : s)),
    };
  }
  return next;
}

function withAngle(
  state: TrigRatiosState,
  id: string,
  show: boolean,
  fill: AngleFill = "pink",
  label?: MeasLabel,
): TrigRatiosState {
  return {
    ...state,
    angles: state.angles.map((a) =>
      a.id === id ? { ...a, show, fill, label: label ?? a.label } : a,
    ),
  };
}

function withTriAngle(
  state: TrigRatiosState,
  id: string,
  show: boolean,
  fill: AngleFill = "pink",
  label?: MeasLabel,
): TrigRatiosState {
  return {
    ...state,
    triAngles: state.triAngles.map((a) =>
      a.id === id ? { ...a, show, fill, label: label ?? a.label } : a,
    ),
  };
}

function withQuadEdge(
  state: TrigRatiosState,
  index: number,
  show: boolean,
  label?: MeasLabel,
): TrigRatiosState {
  return {
    ...state,
    quadEdges: state.quadEdges.map((e, i) =>
      i === index ? { ...e, showLength: show, length: label ?? e.length } : e,
    ),
  };
}

function withQuadVertexAngle(
  state: TrigRatiosState,
  index: number,
  show: boolean,
  fill: AngleFill = "none",
  label?: MeasLabel,
): TrigRatiosState {
  return {
    ...state,
    quadVertices: state.quadVertices.map((v, i) =>
      i === index
        ? {
            ...v,
            showInterior: show,
            fillInterior: fill,
            interior: label ?? v.interior,
          }
        : v,
    ),
  };
}

const rightSqrt3 = withSegs(
  build("right", {
    rightVertex: "B",
    legLeft: Math.sqrt(3),
    legRight: 3,
    ...triangleFromLegsAtB(Math.sqrt(3), 3),
    refAngleVertex: "A",
  }),
  {
    AB: customLen("$\\sqrt{3}$"),
    BC: customLen("3"),
  },
);

const rightHyp46 = withSegs(
  build("right", {
    rightVertex: "C",
    legLeft: 4,
    legRight: 6,
    ...altitudeTriangleFromLegs(4, 6),
    refAngleVertex: "A",
  }),
  { AC: customLen("4"), AB: customLen("6") },
);

const right45xy = withSegs(
  withAngle(
    build("right", {
      rightVertex: "B",
      legLeft: 4,
      legRight: 4,
      ...triangleFromLegsAtB(4, 4),
      refAngleVertex: "C",
    }),
    "C",
    true,
    "pink",
    degLen(45),
  ),
  { AB: xLen("x"), BC: xLen("y"), AC: customLen("6 cm") },
);

const right60_4 = withSegs(
  withAngle(
    build("right", {
      rightVertex: "B",
      legLeft: 4,
      legRight: 4 * Math.sqrt(3),
      ...triangleFromLegsAtB(4, 4 * Math.sqrt(3)),
      refAngleVertex: "A",
    }),
    "A",
    true,
    "pink",
    degLen(60),
  ),
  { AB: customLen("4"), AC: xLen("x") },
);

const right454590 = withAngle(
  withAngle(
    build("right", {
      rightVertex: "C",
      legLeft: 1,
      legRight: 1,
      isoscelesRight: true,
      ...triangleFromLegsAtC(1, 1),
      refAngleVertex: "A",
    }),
    "A",
    true,
    "pink",
    degLen(45),
  ),
  "B",
  true,
  "none",
  degLen(45),
);

const right306090 = withAngle(
  withAngle(
    build("right", {
      rightVertex: "C",
      legLeft: 1,
      legRight: Math.sqrt(3),
      ...triangleFromLegsAtC(1, Math.sqrt(3)),
      refAngleVertex: "A",
    }),
    "A",
    true,
    "blue",
    degLen(60),
  ),
  "B",
  true,
  "green",
  degLen(30),
);

const unit48 = build("unit-circle", { thetaDeg: 48 });

const unitXyz = build("unit-circle", {
  thetaDeg: 35,
  showAxisValues: false,
  showRadiusLabel: false,
});

const triHeight = withTriSegs(
  build("triangle-area", {
    triA: { x: -3, y: 0 },
    triB: { x: 3, y: 0 },
    triC: { x: 1.2, y: 3.2 },
    altitudeFrom: "C",
  }),
  {
    AC: customLen("$b$"),
    AB: customLen("$c$"),
    CH: customLen("$h$"),
  },
);

const triObtuse = withTriAngle(
  build("triangle-area", {
    triA: { x: 0, y: 0.2 },
    triB: { x: 4, y: 0 },
    triC: { x: -1.2, y: 2.8 },
    altitudeFrom: "C",
  }),
  "extA",
  true,
  "none",
  customLen("$180° - A$"),
);

const tri608 = withTriAngle(
  withTriSegs(
    build("triangle-area", {
      triA: { x: -4, y: 0 },
      triB: { x: 4, y: 0 },
      triC: { x: -1.5, y: 3.4 },
      altitudeFrom: "C",
    }),
    { AB: customLen("8 cm"), AC: customLen("$3\\sqrt{3}$ cm") },
  ),
  "A",
  true,
  "pink",
  degLen(60),
);

const tri1357 = withTriAngle(
  withTriSegs(
    build("triangle-area", {
      triA: { x: -3.5, y: 0.2 },
      triB: { x: 2.5, y: 0 },
      triC: { x: -0.8, y: 2.8 },
      altitudeFrom: "C",
    }),
    { AB: customLen("10 cm"), BC: customLen("7 cm") },
  ),
  "B",
  true,
  "none",
  degLen(135),
);

const triAlt3045 = withTriAngle(
  withTriAngle(
    withTriSegs(
      build("triangle-area", {
        triA: { x: -3.2, y: 0 },
        triB: { x: 3.6, y: 0 },
        triC: { x: 0.2, y: 4.2 },
        altitudeFrom: "A",
      }),
      { AC: customLen("10 m") },
    ),
    "CAH",
    true,
    "none",
    degLen(30),
  ),
  "HAB",
  true,
  "none",
  degLen(45),
);

const quad60150 = withQuadEdge(
  withQuadEdge(
    withQuadEdge(
      withQuadEdge(
        withQuadVertexAngle(
          withQuadVertexAngle(
            build("quad-area", { quadFamily: "general" }),
            1,
            true,
            "none",
            degLen(60),
          ),
          3,
          true,
          "none",
          degLen(150),
        ),
        0,
        true,
        customLen("3 cm"),
      ),
      1,
      true,
      customLen("4 cm"),
    ),
    2,
    true,
    customLen("2 cm"),
  ),
  3,
  true,
  customLen("$\\sqrt{3}$ cm"),
);

const quadPara = withQuadVertexAngle(
  withQuadVertexAngle(
    withQuadEdge(
      withQuadEdge(
        build("quad-area", { quadFamily: "parallelogram" }),
        0,
        true,
        customLen("7 cm"),
      ),
      1,
      true,
      customLen("8 cm"),
    ),
    1,
    true,
    "none",
    degLen(60),
  ),
  2,
  true,
  "none",
  degLen(120),
);

const quadDiag = withQuadEdge(
  withQuadEdge(
    withQuadEdge(
      withQuadEdge(
        withQuadVertexAngle(
          withQuadVertexAngle(
            build("quad-area", {
              quadFamily: "general",
              quadPoints: [
                { x: -2.4, y: 2.6 },
                { x: -3.4, y: 0 },
                { x: 2.6, y: 0 },
                { x: 0.4, y: 2.2 },
              ],
            }),
            0,
            true,
            "none",
            degLen(120),
          ),
          2,
          true,
          "none",
          degLen(45),
        ),
        0,
        true,
        customLen("4 cm"),
      ),
      3,
      true,
      customLen("4 cm"),
    ),
    2,
    true,
    customLen("$4\\sqrt{3}$ cm"),
  ),
  1,
  true,
  customLen("$4\\sqrt{6}$ cm"),
);

export const TRIG_PRESETS: TrigPreset[] = [
  { id: "right-sqrt3", title: "√3·3", hint: "직각 B", state: rightSqrt3 },
  { id: "right-46", title: "4·6", hint: "빗변 아래", state: rightHyp46 },
  { id: "right-45xy", title: "45° x·y", hint: "미지수", state: right45xy },
  { id: "right-604", title: "60°·4", hint: "기준각 A", state: right60_4 },
  { id: "right-454590", title: "45-45-90", hint: "특수각", state: right454590 },
  { id: "right-306090", title: "30-60-90", hint: "특수각", state: right306090 },
  { id: "unit-48", title: "48° 값", hint: "sin·cos·tan", state: unit48 },
  { id: "unit-xyz", title: "x°·y°·z°", hint: "여각", state: unitXyz },
  { id: "tri-height", title: "예각 높이", hint: "b·c·h", state: triHeight },
  { id: "tri-obtuse", title: "둔각 180−A", hint: "연장", state: triObtuse },
  { id: "tri-608", title: "60°·8cm", hint: "넓이", state: tri608 },
  { id: "tri-1357", title: "135°·7cm", hint: "둔각", state: tri1357 },
  { id: "tri-alt", title: "수선 30·45", hint: "10 m", state: triAlt3045 },
  { id: "quad-60150", title: "60°·150°", hint: "사각형", state: quad60150 },
  { id: "quad-para", title: "평행사변형", hint: "60°·120°", state: quadPara },
  { id: "quad-diag", title: "대각선 BD", hint: "분홍", state: quadDiag },
];

export const DEFAULT_TRIG_STATE: TrigRatiosState = TRIG_PRESETS[0]!.state;

export function withKind(prev: TrigRatiosState, kind: TrigKind): TrigRatiosState {
  const template = TRIG_PRESETS.find((p) => p.state.kind === kind)?.state ?? build(kind);
  return normalizeState({
    ...template,
    style: prev.style,
    unit: prev.unit,
    unknownLetter: prev.unknownLetter,
    showVertexNames: prev.showVertexNames,
    showDots: prev.showDots,
  });
}

export function findSeg(state: TrigRatiosState, id: string): SegMark | undefined {
  const pool = state.kind === "triangle-area" ? state.triSegs : state.segs;
  return pool.find((s) => s.id === id);
}

export function patchSegState(
  state: TrigRatiosState,
  id: string,
  patch: Partial<SegMark>,
): TrigRatiosState {
  const key = state.kind === "triangle-area" ? "triSegs" : "segs";
  return {
    ...state,
    [key]: state[key].map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}

export function setPointName(
  state: TrigRatiosState,
  id: string,
  nameValue: string,
): TrigRatiosState {
  const key = state.kind === "triangle-area" ? "triNames" : "names";
  const prev = state[key][id] ?? name(id);
  return {
    ...state,
    [key]: { ...state[key], [id]: { ...prev, name: nameValue.trim() || prev.name } },
  };
}
