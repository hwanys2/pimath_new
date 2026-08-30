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

export type SimilarityKind =
  | "nested"
  | "adjacent"
  | "cevian"
  | "altitude"
  | "bowtie"
  | "parallels"
  | "centroid";

export type TickCount = 0 | 1 | 2 | 3;

export const SIMILARITY_KINDS: { id: SimilarityKind; label: string }[] = [
  { id: "nested", label: "평행선" },
  { id: "adjacent", label: "맞붙음" },
  { id: "cevian", label: "보조선" },
  { id: "altitude", label: "직각 높이" },
  { id: "bowtie", label: "나비꼴" },
  { id: "parallels", label: "평행선 비" },
  { id: "centroid", label: "무게중심" },
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
  ticks: TickCount;
  parallel: boolean;
};

export type AngleMark = {
  id: string;
  vertex: string;
  from: string;
  to: string;
  show: boolean;
  fill: boolean;
  label: MeasLabel;
};

export type TransversalSpec = {
  xl: number;
  xn: number;
};

export type ParallelsSpec = {
  yL: number;
  yM: number;
  yN: number;
  xMin: number;
  xMax: number;
  trans: TransversalSpec[];
  shareTop: boolean;
  meetAtM: boolean;
  lineNames: [string, string, string];
};

export type SimilarTrianglesState = {
  kind: SimilarityKind;
  A: Vec;
  B: Vec;
  C: Vec;
  /** Adjacent extra vertex. */
  D: Vec;
  /** 0–1 along a side (nested DE, cevian D, bowtie scale). */
  t: number;
  /** Bowtie second ray when not parallel. */
  t2: number;
  midpoint: boolean;
  bowtieParallel: boolean;
  medianAD: boolean;
  medianBE: boolean;
  medianCF: boolean;
  fillFace: boolean;
  names: Record<string, NameMark>;
  segs: SegMark[];
  angles: AngleMark[];
  parallels: ParallelsSpec;
  showVertexNames: boolean;
  showDots: boolean;
  unit: string;
  unknownLetter: string;
  style: DiagramStyle;
};

export type SimilarPreset = {
  id: string;
  title: string;
  hint: string;
  state: SimilarTrianglesState;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function cloneState(state: SimilarTrianglesState): SimilarTrianglesState {
  return structuredClone(state);
}

export function customLen(text: string, patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("custom"), custom: text, ...patch };
}

export function xLen(letter: string, patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("x"), custom: letter, ...patch };
}

export function customAng(text: string, patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("custom"), custom: text, ...patch };
}

export function xAng(letter: string, patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("x"), custom: letter, ...patch };
}

function name(id: string, label?: string, dx = 0, dy = 0): NameMark {
  return { name: label ?? id, dx, dy };
}

export function defaultNamesFor(kind: SimilarityKind): Record<string, NameMark> {
  const ids = pointIdsFor(kind);
  const out: Record<string, NameMark> = {};
  for (const id of ids) out[id] = name(id);
  if (kind === "parallels") {
    out.l = name("l");
    out.m = name("m");
    out.n = name("n");
  }
  return out;
}

export function pointIdsFor(kind: SimilarityKind): string[] {
  switch (kind) {
    case "nested":
      return ["A", "B", "C", "D", "E"];
    case "adjacent":
      return ["A", "B", "C", "D"];
    case "cevian":
      return ["A", "B", "C", "D"];
    case "altitude":
      return ["A", "B", "C", "D"];
    case "bowtie":
      return ["A", "B", "C", "D", "E"];
    case "centroid":
      return ["A", "B", "C", "D", "E", "F", "G"];
    case "parallels":
      return ["T0L", "T0M", "T0N", "T1L", "T1M", "T1N", "T2L", "T2M", "T2N"];
  }
}

export function defaultSegsFor(kind: SimilarityKind): SegMark[] {
  const s = (a: string, b: string, id = `${a}${b}`): SegMark => ({
    id,
    a,
    b,
    show: false,
    label: emptyLabel("auto"),
    ticks: 0,
    parallel: false,
  });
  switch (kind) {
    case "nested":
      return [s("A", "D"), s("D", "B"), s("A", "E"), s("E", "C"), s("D", "E"), s("B", "C"), s("A", "B"), s("A", "C")];
    case "adjacent":
      return [s("A", "B"), s("B", "C"), s("A", "C"), s("A", "D"), s("C", "D")];
    case "cevian":
      return [s("A", "B"), s("B", "C"), s("A", "C"), s("A", "D"), s("D", "C"), s("B", "D")];
    case "altitude":
      return [s("A", "B"), s("A", "C"), s("B", "C"), s("A", "D"), s("B", "D"), s("D", "C")];
    case "bowtie":
      return [s("A", "B"), s("B", "C"), s("A", "C"), s("A", "D"), s("A", "E"), s("D", "E")];
    case "centroid":
      return [
        s("A", "B"),
        s("B", "C"),
        s("A", "C"),
        s("A", "G"),
        s("G", "D"),
        s("B", "D"),
        s("D", "C"),
        s("E", "G"),
        s("G", "C"),
        s("B", "E"),
        s("C", "F"),
        s("A", "F"),
        s("F", "B"),
      ];
    case "parallels":
      return [
        s("T0L", "T0M", "t0u"),
        s("T0M", "T0N", "t0d"),
        s("T1L", "T1M", "t1u"),
        s("T1M", "T1N", "t1d"),
        s("T2L", "T2M", "t2u"),
        s("T2M", "T2N", "t2d"),
      ];
  }
}

export function defaultAnglesFor(kind: SimilarityKind): AngleMark[] {
  const a = (id: string, vertex: string, from: string, to: string): AngleMark => ({
    id,
    vertex,
    from,
    to,
    show: false,
    fill: false,
    label: emptyLabel("auto"),
  });
  switch (kind) {
    case "nested":
      return [
        a("A", "A", "B", "C"),
        a("B", "B", "A", "C"),
        a("C", "C", "A", "B"),
        a("ADE", "D", "A", "E"),
        a("AED", "E", "A", "D"),
        a("ABC", "B", "A", "C"),
        a("ACB", "C", "A", "B"),
      ];
    case "adjacent":
      return [a("B", "B", "A", "C"), a("D", "D", "A", "C"), a("BAC", "A", "B", "C"), a("DAC", "A", "D", "C")];
    case "cevian":
      return [a("ABD", "B", "A", "D"), a("DBC", "B", "D", "C"), a("C", "C", "B", "A"), a("A", "A", "B", "C")];
    case "altitude":
      return [a("A", "A", "B", "C"), a("D", "D", "A", "C"), a("B", "B", "A", "C"), a("C", "C", "A", "B")];
    case "bowtie":
      return [a("BAC", "A", "B", "C"), a("DAE", "A", "D", "E"), a("B", "B", "A", "C"), a("D", "D", "A", "E")];
    case "centroid":
      return [a("A", "A", "B", "C"), a("B", "B", "A", "C"), a("C", "C", "A", "B")];
    case "parallels":
      return [];
  }
}

function defaultParallels(): ParallelsSpec {
  return {
    yL: 2.4,
    yM: 0.35,
    yN: -1.7,
    xMin: -3.6,
    xMax: 3.6,
    trans: [
      { xl: -2.4, xn: -1.5 },
      { xl: 1.8, xn: 0.7 },
    ],
    shareTop: false,
    meetAtM: false,
    lineNames: ["l", "m", "n"],
  };
}

function mergeNames(
  kind: SimilarityKind,
  prev?: Record<string, NameMark>,
): Record<string, NameMark> {
  const base = defaultNamesFor(kind);
  if (!prev) return base;
  const out = { ...base };
  for (const id of Object.keys(base)) {
    const p = prev[id];
    if (!p) continue;
    out[id] = {
      name: p.name?.trim() ? p.name : base[id]!.name,
      dx: clamp(p.dx ?? 0, -80, 80),
      dy: clamp(p.dy ?? 0, -80, 80),
    };
  }
  return out;
}

function mergeSegs(kind: SimilarityKind, prev?: SegMark[]): SegMark[] {
  const base = defaultSegsFor(kind);
  const map = new Map((prev ?? []).map((s) => [s.id, s]));
  return base.map((b) => {
    const p = map.get(b.id);
    if (!p) return b;
    const ticks = p.ticks === 1 || p.ticks === 2 || p.ticks === 3 ? p.ticks : 0;
    return {
      ...b,
      show: p.show === true,
      label: { ...emptyLabel("auto"), ...p.label },
      ticks,
      parallel: p.parallel === true,
    };
  });
}

function mergeAngles(kind: SimilarityKind, prev?: AngleMark[]): AngleMark[] {
  const base = defaultAnglesFor(kind);
  const map = new Map((prev ?? []).map((a) => [a.id, a]));
  return base.map((b) => {
    const p = map.get(b.id);
    if (!p) return b;
    return {
      ...b,
      show: p.show === true,
      fill: p.fill === true,
      label: { ...emptyLabel("auto"), ...p.label },
    };
  });
}

const DEFAULT_ABC = {
  A: { x: 0, y: 4.2 },
  B: { x: -3.4, y: 0 },
  C: { x: 3.2, y: 0 },
  D: { x: 4.6, y: 1.1 },
};

export function normalizeState(
  state: Partial<SimilarTrianglesState> & Pick<SimilarTrianglesState, "kind">,
): SimilarTrianglesState {
  const kind = SIMILARITY_KINDS.some((k) => k.id === state.kind) ? state.kind : "nested";
  const style = { ...DEFAULT_STYLE, ...state.style };
  const par = state.parallels;
  const trans = Array.isArray(par?.trans) && par.trans.length >= 2
    ? par.trans.slice(0, 3).map((t) => ({
        xl: clamp(t.xl, -8, 8),
        xn: clamp(t.xn, -8, 8),
      }))
    : defaultParallels().trans;
  while (trans.length < 2) trans.push({ xl: 1.5, xn: 0.8 });
  return {
    kind,
    A: state.A ?? DEFAULT_ABC.A,
    B: state.B ?? DEFAULT_ABC.B,
    C: state.C ?? DEFAULT_ABC.C,
    D: state.D ?? DEFAULT_ABC.D,
    t:
      kind === "bowtie"
        ? clamp(state.t ?? 0.5, 0.15, 3)
        : clamp(state.t ?? 0.38, 0.08, 0.92),
    t2: clamp(state.t2 ?? 0.55, 0.12, 3),
    midpoint: state.midpoint === true,
    bowtieParallel: state.bowtieParallel !== false,
    medianAD: state.medianAD !== false,
    medianBE: kind === "centroid" ? state.medianBE === true : false,
    medianCF: kind === "centroid" ? state.medianCF === true : false,
    fillFace: state.fillFace === true,
    names: mergeNames(kind, state.names),
    segs: mergeSegs(kind, state.segs),
    angles: mergeAngles(kind, state.angles),
    parallels: {
      yL: clamp(par?.yL ?? 2.4, -1, 6),
      yM: clamp(par?.yM ?? 0.35, -3, 4),
      yN: clamp(par?.yN ?? -1.7, -6, 2),
      xMin: clamp(par?.xMin ?? -3.6, -8, 0),
      xMax: clamp(par?.xMax ?? 3.6, 0, 8),
      trans,
      shareTop: par?.shareTop === true,
      meetAtM: par?.meetAtM === true,
      lineNames: par?.lineNames ?? ["l", "m", "n"],
    },
    showVertexNames: state.showVertexNames !== false,
    showDots: state.showDots !== false,
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

function patchSeg(
  segs: SegMark[],
  id: string,
  patch: Partial<SegMark> & { label?: MeasLabel },
): SegMark[] {
  return segs.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

function patchAng(
  angles: AngleMark[],
  id: string,
  patch: Partial<AngleMark> & { label?: MeasLabel },
): AngleMark[] {
  return angles.map((a) => (a.id === id ? { ...a, ...patch } : a));
}

function build(
  kind: SimilarityKind,
  patch: Partial<SimilarTrianglesState> = {},
): SimilarTrianglesState {
  return normalizeState({ kind, ...patch });
}

function withMarks(
  state: SimilarTrianglesState,
  segs: Record<string, MeasLabel | [MeasLabel, Partial<SegMark>]> = {},
  angs: Record<string, MeasLabel | [MeasLabel, Partial<AngleMark>]> = {},
): SimilarTrianglesState {
  let next = state;
  for (const [id, spec] of Object.entries(segs)) {
    const [label, extra] = Array.isArray(spec) ? spec : [spec, {}];
    next = { ...next, segs: patchSeg(next.segs, id, { show: true, label, ...extra }) };
  }
  for (const [id, spec] of Object.entries(angs)) {
    const [label, extra] = Array.isArray(spec) ? spec : [spec, {}];
    next = { ...next, angles: patchAng(next.angles, id, { show: true, label, ...extra }) };
  }
  return next;
}

function rename(state: SimilarTrianglesState, map: Record<string, string>): SimilarTrianglesState {
  const names = { ...state.names };
  for (const [id, label] of Object.entries(map)) {
    names[id] = { ...(names[id] ?? name(id)), name: label };
  }
  return { ...state, names };
}

function rightAtA(): { A: Vec; B: Vec; C: Vec } {
  const A = { x: 0.2, y: 3.5 };
  const B = { x: -3.3, y: -0.3 };
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const len = Math.hypot(abx, aby) || 1;
  const nx = -aby / len;
  const ny = abx / len;
  const sign = nx >= 0 ? 1 : -1;
  const C = { x: A.x + sign * nx * 3.8, y: A.y + sign * ny * 3.8 };
  return { A, B, C };
}

function rightCentered(): { A: Vec; B: Vec; C: Vec } {
  const A = { x: 0, y: 3.6 };
  const B = { x: -2.8, y: -0.2 };
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const len = Math.hypot(abx, aby) || 1;
  const nx = -aby / len;
  const ny = abx / len;
  const sign = nx >= 0 ? 1 : -1;
  const C = { x: A.x + sign * nx * 3.4, y: A.y + sign * ny * 3.4 };
  return { A, B, C };
}

function withRightSquares(state: SimilarTrianglesState): SimilarTrianglesState {
  return {
    ...state,
    angles: state.angles.map((a) =>
      a.id === "A" || a.id === "D" ? { ...a, show: true, label: emptyLabel("hide") } : a,
    ),
  };
}

function withTicks(
  state: SimilarTrianglesState,
  ticks: Record<string, TickCount>,
  parallelIds: string[] = [],
): SimilarTrianglesState {
  return {
    ...state,
    segs: state.segs.map((s) => ({
      ...s,
      ticks: ticks[s.id] ?? s.ticks,
      parallel: parallelIds.includes(s.id) ? true : s.parallel,
    })),
  };
}

const p1 = withMarks(
  build("nested", { A: { x: 0, y: 4.3 }, B: { x: -3.5, y: 0 }, C: { x: 3.4, y: 0 }, t: 1 / 3 }),
  { AD: customLen("2 cm"), DB: customLen("4 cm"), DE: xLen("x"), BC: customLen("6 cm") },
  { ADE: customAng("75°"), B: customAng("75°") },
);

const p2 = withMarks(
  build("adjacent", {
    A: { x: 0.15, y: 3.9 },
    B: { x: -3.3, y: 0 },
    C: { x: 0.55, y: 0.05 },
    D: { x: 4.4, y: 0.55 },
  }),
  {
    AB: customLen("6 cm"),
    BC: customLen("4 cm"),
    AC: customLen("6 cm"),
    AD: customLen("9 cm"),
    CD: customLen("9 cm"),
  },
  { B: customAng("70°"), D: [xAng("x"), { fill: true }] },
);

const p3 = withMarks(
  build("nested", { t: 8 / 15, A: { x: 0, y: 4.4 }, B: { x: -3.6, y: 0 }, C: { x: 3.5, y: 0 } }),
  {
    AD: customLen("8 cm"),
    DB: customLen("7 cm"),
    AE: customLen("10 cm"),
    EC: customLen("2 cm"),
    DE: customLen("12 cm"),
    BC: xLen("x"),
  },
);

const p4 = withMarks(
  build("cevian", {
    A: { x: -0.2, y: 4.2 },
    B: { x: -3.2, y: 0 },
    C: { x: 3.4, y: 0 },
    t: 0.42,
  }),
  { AB: customLen("6 cm"), AD: xLen("x"), AC: customLen("8 cm") },
  { ABD: customAng("40°"), C: customAng("40°") },
);

const p5r = withRightSquares(
  withMarks(build("altitude", rightAtA()), {
    AC: customLen("8 cm"),
    DC: customLen("4 cm"),
    BC: xLen("x"),
  }),
);

const p6r = withRightSquares(
  withMarks(build("altitude", rightCentered()), {
    AD: customLen("9 cm"),
    BD: customLen("6 cm"),
    DC: xLen("x"),
  }),
);

const p7 = withMarks(
  build("nested", { t: 10 / 12, A: { x: 0, y: 4.4 }, B: { x: -3.6, y: 0 }, C: { x: 3.5, y: 0 } }),
  {
    AD: customLen("10 cm"),
    AB: xLen("x"),
    AE: customLen("8 cm"),
    AC: customLen("12 cm"),
    DE: customLen("9 cm"),
    BC: xLen("y"),
  },
);

const p8 = rename(
  withMarks(
    build("nested", { t: 12 / 15, A: { x: 0, y: 4.5 }, B: { x: -3.7, y: 0 }, C: { x: 3.6, y: 0 } }),
    {
      AD: xLen("x"),
      DB: customLen("2 cm"),
      AE: customLen("12 cm"),
      EC: customLen("3 cm"),
      DE: xLen("y"),
      BC: customLen("15 cm"),
    },
  ),
  { B: "D", C: "E", D: "B", E: "C" },
);

const p9 = withMarks(
  build("bowtie", {
    A: { x: 0, y: 0.35 },
    B: { x: -2.6, y: -1.7 },
    C: { x: -0.2, y: -2.5 },
    t: 15 / 10,
    bowtieParallel: false,
    t2: 10 / 6,
  }),
  {
    AB: xLen("x"),
    AC: customLen("6 cm"),
    BC: customLen("12 cm"),
    AE: customLen("10 cm"),
    AD: customLen("15 cm"),
    DE: xLen("y"),
  },
);

const p10 = withMarks(
  build("bowtie", {
    A: { x: 0, y: 0.9 },
    B: { x: -2.8, y: -1.6 },
    C: { x: 2.9, y: -1.6 },
    t: 11 / 20,
    bowtieParallel: true,
  }),
  {
    DE: xLen("x"),
    AE: customLen("10 cm"),
    AD: customLen("11 cm"),
    BC: customLen("24 cm"),
    AB: xLen("y"),
    AC: customLen("20 cm"),
  },
);

const p11 = withMarks(
  withTicks(
    build("nested", {
      A: { x: -2.6, y: 0.2 },
      B: { x: 3.2, y: 0 },
      C: { x: 0.4, y: 4.1 },
      midpoint: true,
      t: 0.5,
    }),
    { AD: 1, DB: 1 },
    ["DE", "BC"],
  ),
  { DE: customLen("7 cm"), BC: xLen("y") },
  { ADE: customAng("45°"), B: [xAng("x"), { fill: true }] },
);

const p11c = withMarks(
  withTicks(
    build("nested", {
      A: { x: -2.4, y: 3.8 },
      B: { x: -2.5, y: -0.3 },
      C: { x: 3.5, y: 3.5 },
      midpoint: true,
      t: 0.5,
    }),
    { AD: 2, DB: 2, AE: 2, EC: 2 },
    ["DE", "BC"],
  ),
  { BC: customLen("16 cm"), DE: xLen("y") },
  { A: customAng("80°"), B: customAng("60°"), AED: [xAng("x"), { fill: true }] },
);

const p12m = withMarks(
  build("parallels", {
    parallels: {
      ...defaultParallels(),
      trans: [
        { xl: -2.5, xn: -1.4 },
        { xl: 1.9, xn: 0.65 },
      ],
    },
  }),
  { t0u: customLen("8 cm"), t0d: customLen("4 cm"), t1u: xLen("x"), t1d: customLen("5 cm") },
);

const p13m = withMarks(
  build("parallels", {
    parallels: {
      ...defaultParallels(),
      yL: 2.5,
      yM: 0.55,
      yN: -1.85,
      trans: [
        { xl: -2.1, xn: 2.0 },
        { xl: 2.2, xn: -1.6 },
      ],
    },
  }),
  { t0u: xLen("x"), t0d: customLen("9 cm"), t1u: customLen("8 cm"), t1d: customLen("12 cm") },
);

const p14m = withMarks(
  build("parallels", {
    parallels: {
      ...defaultParallels(),
      shareTop: true,
      meetAtM: true,
      trans: [
        { xl: -2.7, xn: -2.15 },
        { xl: -2.7, xn: 2.4 },
        { xl: 2.5, xn: -0.4 },
      ],
    },
  }),
  {
    t0u: customLen("6 cm"),
    t0d: customLen("3 cm"),
    t1u: customLen("8 cm"),
    t1d: xLen("x"),
    t2u: customLen("9 cm"),
    t2d: xLen("y"),
  },
);

const p15 = withMarks(
  build("centroid", {
    A: { x: 0, y: 4.2 },
    B: { x: -3.4, y: 0 },
    C: { x: 3.3, y: 0 },
    medianAD: true,
    medianBE: false,
    medianCF: false,
  }),
  { AG: customLen("6 cm"), GD: xLen("x"), BD: customLen("4 cm"), DC: xLen("y") },
);

const p16 = withMarks(
  build("centroid", {
    A: { x: 0.1, y: 4.15 },
    B: { x: -3.5, y: 0 },
    C: { x: 3.4, y: 0 },
    medianAD: true,
    medianBE: false,
    medianCF: true,
  }),
  { BD: customLen("10 cm"), BC: xLen("x"), EG: xLen("y"), GC: customLen("18 cm") },
);

const p17 = build("centroid", {
  A: { x: 0, y: 4.2 },
  B: { x: -3.5, y: 0 },
  C: { x: 3.4, y: 0 },
  medianAD: true,
  medianBE: true,
  medianCF: true,
  fillFace: true,
});

const p18 = withMarks(
  build("centroid", {
    A: { x: 0, y: 4.25 },
    B: { x: -3.45, y: 0 },
    C: { x: 3.35, y: 0 },
    medianAD: true,
    medianBE: true,
    medianCF: true,
  }),
  { AB: xLen("x"), BD: customLen("6 cm"), AG: customLen("9 cm"), EG: xLen("y") },
);

export const SIMILAR_PRESETS: SimilarPreset[] = [
  { id: "nested-75", title: "평행선 DE∥BC", hint: "AD=2, DB=4, x", state: p1 },
  { id: "adjacent-sss", title: "맞붙은 닮음", hint: "6·4·6 / 9·9", state: p2 },
  { id: "nested-sides", title: "대응변 모두", hint: "8·7·10·2", state: p3 },
  { id: "cevian-40", title: "각이 같은 보조선", hint: "40°·40°, AD=x", state: p4 },
  { id: "alt-hyp", title: "직각삼각형 빗변", hint: "AC=8, DC=4", state: p5r },
  { id: "alt-mean", title: "높이의 기하평균", hint: "AD=9, BD=6", state: p6r },
  { id: "nested-xy", title: "평행선 대응", hint: "AD=10, AB=x", state: p7 },
  { id: "nested-outer", title: "큰 삼각형 안 평행", hint: "BD=2, DE=15", state: p8 },
  { id: "bowtie-sas", title: "나비꼴 맞꼭지각", hint: "AB=x, ED=y", state: p9 },
  { id: "bowtie-par", title: "나비꼴 평행", hint: "ED∥BC", state: p10 },
  { id: "mid-xy", title: "중점연결", hint: "45°, ED=7", state: p11 },
  { id: "mid-ticks", title: "중점·평행 화살", hint: "80°·60°, DE=y", state: p11c },
  { id: "par-basic", title: "평행선 가로지르기", hint: "8:4 / x:5", state: p12m },
  { id: "par-cross", title: "가로지르기 교차", hint: "x:9 / 8:12", state: p13m },
  { id: "par-three", title: "가로선 세 개", hint: "6:3 / 8:x / 9:y", state: p14m },
  { id: "cent-one", title: "무게중심 한 중선", hint: "AG=6, GD=x", state: p15 },
  { id: "cent-two", title: "무게중심 두 중선", hint: "BD=10, GC=18", state: p16 },
  { id: "cent-all", title: "세 중선", hint: "G와 분홍 채움", state: p17 },
  { id: "cent-labels", title: "중선 길이", hint: "AB=x, AG=9", state: p18 },
];

export const DEFAULT_SIMILAR_STATE: SimilarTrianglesState = SIMILAR_PRESETS[0]!.state;

export function withKind(prev: SimilarTrianglesState, kind: SimilarityKind): SimilarTrianglesState {
  const template = SIMILAR_PRESETS.find((p) => p.state.kind === kind)?.state
    ?? build(kind);
  return normalizeState({
    ...template,
    A: prev.A,
    B: prev.B,
    C: prev.C,
    D: prev.D,
    style: prev.style,
    unit: prev.unit,
    unknownLetter: prev.unknownLetter,
    showVertexNames: prev.showVertexNames,
    showDots: prev.showDots,
  });
}

export function findSeg(state: SimilarTrianglesState, id: string): SegMark | undefined {
  return state.segs.find((s) => s.id === id);
}

export function findAng(state: SimilarTrianglesState, id: string): AngleMark | undefined {
  return state.angles.find((a) => a.id === id);
}

export function patchSegState(
  state: SimilarTrianglesState,
  id: string,
  patch: Partial<SegMark>,
): SimilarTrianglesState {
  return { ...state, segs: patchSeg(state.segs, id, patch) };
}

export function patchAngState(
  state: SimilarTrianglesState,
  id: string,
  patch: Partial<AngleMark>,
): SimilarTrianglesState {
  return { ...state, angles: patchAng(state.angles, id, patch) };
}

export function setPointName(
  state: SimilarTrianglesState,
  id: string,
  nameValue: string,
): SimilarTrianglesState {
  const prev = state.names[id] ?? name(id);
  return {
    ...state,
    names: { ...state.names, [id]: { ...prev, name: nameValue.trim() || prev.name } },
  };
}
