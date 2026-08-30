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

export type PointId =
  | "A"
  | "B"
  | "C"
  | "O"
  | "I"
  | "c0"
  | "c1"
  | "c2"
  | "i0"
  | "i1"
  | "i2";

export type CenterKind = "circum" | "in";

export type AngleMark = {
  id: string;
  at: PointId;
  from: PointId;
  to: PointId;
  label: MeasLabel;
  fill: boolean;
};

export type LengthMark = {
  id: string;
  a: PointId;
  b: PointId;
  label: MeasLabel;
};

export type CenterDisplay = {
  on: boolean;
  name: string;
  nameDx: number;
  nameDy: number;
  showCircle: boolean;
  rays: [boolean, boolean, boolean];
  perps: [boolean, boolean, boolean];
  showFeet: [boolean, boolean, boolean];
  footNames: [string, string, string];
};

export type TriangleCentersState = {
  points: [Vec, Vec, Vec];
  vertexNames: [string, string, string];
  vertexNameDx: [number, number, number];
  vertexNameDy: [number, number, number];
  vertexRights: [boolean, boolean, boolean];
  circum: CenterDisplay;
  incenter: CenterDisplay;
  angles: AngleMark[];
  lengths: LengthMark[];
  showVertexNames: boolean;
  showDots: boolean;
  unit: string;
  unknownLetter: string;
  style: DiagramStyle;
  interiorAnglesDeg: number[];
  referenceEdgeLength: number;
};

export type CentersPreset = {
  id: string;
  title: string;
  hint: string;
  state: TriangleCentersState;
};

export const VERTEX_IDS: PointId[] = ["A", "B", "C"];
export const EDGE_FEET: { circum: PointId; in: PointId }[] = [
  { circum: "c0", in: "i0" },
  { circum: "c1", in: "i1" },
  { circum: "c2", in: "i2" },
];

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function angleId(at: PointId, from: PointId, to: PointId): string {
  return `ang:${at}:${pairKey(from, to)}`;
}

export function lengthId(a: PointId, b: PointId): string {
  return `len:${pairKey(a, b)}`;
}

export function vertexIndex(id: PointId): 0 | 1 | 2 | null {
  if (id === "A") return 0;
  if (id === "B") return 1;
  if (id === "C") return 2;
  return null;
}

export function vertexId(i: number): PointId {
  return VERTEX_IDS[i] ?? "A";
}

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

function defaultCenter(name: string, on: boolean): CenterDisplay {
  return {
    on,
    name,
    nameDx: 0,
    nameDy: 0,
    showCircle: false,
    rays: [on, on, on],
    perps: [false, false, false],
    showFeet: [true, true, true],
    footNames: ["D", "E", "F"],
  };
}

function mergeBool3(
  prev: [boolean, boolean, boolean] | boolean | undefined,
  fallback: boolean,
): [boolean, boolean, boolean] {
  if (Array.isArray(prev)) {
    return [Boolean(prev[0]), Boolean(prev[1]), Boolean(prev[2])];
  }
  if (typeof prev === "boolean") return [prev, prev, prev];
  return [fallback, fallback, fallback];
}

function mergeCenter(
  prev: CenterDisplay | undefined,
  fallbackName: string,
): CenterDisplay {
  const base = defaultCenter(fallbackName, false);
  if (!prev) return base;
  return {
    ...base,
    ...prev,
    rays: [
      prev.rays?.[0] ?? false,
      prev.rays?.[1] ?? false,
      prev.rays?.[2] ?? false,
    ],
    perps: [
      prev.perps?.[0] ?? false,
      prev.perps?.[1] ?? false,
      prev.perps?.[2] ?? false,
    ],
    showFeet: mergeBool3(
      prev.showFeet ?? (prev as { showFeetNames?: boolean }).showFeetNames,
      true,
    ),
    footNames: [
      prev.footNames?.[0] || "D",
      prev.footNames?.[1] || "E",
      prev.footNames?.[2] || "F",
    ],
    name: prev.name?.trim() ? prev.name : fallbackName,
  };
}

function mergeLabel(prev?: MeasLabel): MeasLabel {
  return { ...emptyLabel("auto"), ...prev };
}

/** Triangle ABC with given angles (°) and base BC. y-up. */
export function triangleFromAngles(
  degA: number,
  degB: number,
  degC: number,
  sideBC = 5.4,
): [Vec, Vec, Vec] {
  const A = (degA * Math.PI) / 180;
  const B = (degB * Math.PI) / 180;
  const a = sideBC;
  const ab = a * (Math.sin((degC * Math.PI) / 180) / Math.sin(A));
  return [
    { x: ab * Math.cos(B), y: ab * Math.sin(B) },
    { x: 0, y: 0 },
    { x: a, y: 0 },
  ];
}

export function cloneState(state: TriangleCentersState): TriangleCentersState {
  return structuredClone(state);
}

export function toPolygonState(state: TriangleCentersState): PolygonState {
  return {
    points: [...state.points],
    vertices: state.vertexNames.map((name, i) => ({
      name,
      nameDx: state.vertexNameDx[i] ?? 0,
      nameDy: state.vertexNameDy[i] ?? 0,
      showInterior: false,
      showExterior: false,
      fillExterior: false,
      interior: emptyLabel("auto"),
      exterior: emptyLabel("auto"),
    })),
    edges: [
      { showLength: false, length: emptyLabel("auto") },
      { showLength: false, length: emptyLabel("auto") },
      { showLength: false, length: emptyLabel("auto") },
    ],
    diagonals: [],
    interiorAnglesDeg: state.interiorAnglesDeg,
    referenceEdgeLength: state.referenceEdgeLength,
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  };
}

export function fromPolygonState(
  poly: PolygonState,
  prev: TriangleCentersState,
): TriangleCentersState {
  const pts = poly.points.slice(0, 3);
  if (pts.length < 3) return prev;
  return normalizeState({
    ...prev,
    points: [pts[0]!, pts[1]!, pts[2]!],
    interiorAnglesDeg: poly.interiorAnglesDeg.slice(0, 3),
    referenceEdgeLength: poly.referenceEdgeLength,
  });
}

export function normalizeState(
  state: Partial<TriangleCentersState> & Pick<TriangleCentersState, "points"> | TriangleCentersState,
): TriangleCentersState {
  let points = state.points.slice(0, 3) as Vec[];
  if (points.length < 3) points = [...triangleFromAngles(70, 55, 55)];
  const style = { ...DEFAULT_STYLE, ...state.style };
  const interiorAnglesDeg = [0, 1, 2].map((i) => interiorAngleAt(points, i));
  const referenceEdgeLength = clamp(
    state.referenceEdgeLength != null && Number.isFinite(state.referenceEdgeLength)
      ? state.referenceEdgeLength
      : edgeLen(points, 1),
    0.5,
    40,
  );
  const angles = (state.angles ?? []).map((a) => ({
    ...a,
    id: a.id || angleId(a.at, a.from, a.to),
    label: mergeLabel(a.label),
    fill: Boolean(a.fill),
  }));
  const lengths = (state.lengths ?? []).map((m) => ({
    ...m,
    id: m.id || lengthId(m.a, m.b),
    label: mergeLabel(m.label),
  }));
  return {
    points: [points[0]!, points[1]!, points[2]!],
    vertexNames: [
      state.vertexNames?.[0]?.trim() || "A",
      state.vertexNames?.[1]?.trim() || "B",
      state.vertexNames?.[2]?.trim() || "C",
    ],
    vertexNameDx: [
      state.vertexNameDx?.[0] ?? 0,
      state.vertexNameDx?.[1] ?? 0,
      state.vertexNameDx?.[2] ?? 0,
    ],
    vertexNameDy: [
      state.vertexNameDy?.[0] ?? 0,
      state.vertexNameDy?.[1] ?? 0,
      state.vertexNameDy?.[2] ?? 0,
    ],
    vertexRights: [
      Boolean(state.vertexRights?.[0]),
      Boolean(state.vertexRights?.[1]),
      Boolean(state.vertexRights?.[2]),
    ],
    circum: mergeCenter(state.circum, "O"),
    incenter: mergeCenter(state.incenter, "I"),
    angles,
    lengths,
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
    interiorAnglesDeg,
    referenceEdgeLength,
  };
}

function customAngle(
  at: PointId,
  from: PointId,
  to: PointId,
  custom: string,
  fill = false,
): AngleMark {
  return {
    id: angleId(at, from, to),
    at,
    from,
    to,
    label: { ...emptyLabel("custom"), custom },
    fill,
  };
}

function xAngle(
  at: PointId,
  from: PointId,
  to: PointId,
  letter = "x",
  fill = true,
): AngleMark {
  return {
    id: angleId(at, from, to),
    at,
    from,
    to,
    label: { ...emptyLabel("x"), custom: letter },
    fill,
  };
}

function customLen(a: PointId, b: PointId, custom: string): LengthMark {
  return {
    id: lengthId(a, b),
    a,
    b,
    label: { ...emptyLabel("custom"), custom },
  };
}

function xLen(a: PointId, b: PointId, letter: string): LengthMark {
  return {
    id: lengthId(a, b),
    a,
    b,
    label: { ...emptyLabel("x"), custom: letter },
  };
}

function baseState(
  points: [Vec, Vec, Vec],
  patch: Partial<TriangleCentersState> = {},
): TriangleCentersState {
  return normalizeState({
    points,
    vertexNames: ["A", "B", "C"],
    vertexNameDx: [0, 0, 0],
    vertexNameDy: [0, 0, 0],
    vertexRights: [false, false, false],
    circum: defaultCenter("O", false),
    incenter: defaultCenter("I", false),
    angles: [],
    lengths: [],
    showVertexNames: true,
    showDots: true,
    unit: "cm",
    unknownLetter: "x",
    style: { ...DEFAULT_STYLE },
    ...patch,
  });
}

const ACUTE = triangleFromAngles(72, 58, 50, 5.6);
const RIGHT_AT_C: [Vec, Vec, Vec] = [
  { x: 5.4, y: 4.2 },
  { x: 0, y: 0 },
  { x: 5.4, y: 0 },
];
const ISO_10_10_12: [Vec, Vec, Vec] = [
  { x: 3, y: 4 },
  { x: 0, y: 0 },
  { x: 6, y: 0 },
];

export const CENTERS_PRESETS: CentersPreset[] = [
  {
    id: "circum-base",
    title: "외심 밑각",
    hint: "OA·OB·OC · x",
    state: baseState(ACUTE, {
      circum: {
        ...defaultCenter("O", true),
        rays: [true, true, true],
      },
      angles: [
        xAngle("A", "O", "B"),
        customAngle("B", "O", "C", "15°"),
        customAngle("C", "O", "A", "42°"),
      ],
    }),
  },
  {
    id: "circum-central",
    title: "외심 중심각",
    hint: "∠AOB · x",
    state: baseState(triangleFromAngles(66, 48, 66, 5.5), {
      circum: {
        ...defaultCenter("O", true),
        rays: [true, true, true],
      },
      angles: [
        customAngle("O", "A", "B", "132°"),
        customAngle("B", "O", "C", "26°"),
        xAngle("C", "O", "B"),
      ],
    }),
  },
  {
    id: "circum-inscribed",
    title: "외심 원주각",
    hint: "∠A = x · ∠BOC",
    state: baseState(triangleFromAngles(50, 65, 65, 5.6), {
      circum: {
        ...defaultCenter("O", true),
        rays: [false, true, true],
      },
      angles: [xAngle("A", "B", "C"), customAngle("O", "B", "C", "100°")],
    }),
  },
  {
    id: "circum-right",
    title: "직각삼각형 외심",
    hint: "빗변 중점 · 반지름",
    state: baseState(RIGHT_AT_C, {
      circum: {
        ...defaultCenter("O", true),
        rays: [false, true, true],
      },
      vertexRights: [false, false, true],
      lengths: [xLen("O", "B", "x"), customLen("O", "C", "4 cm")],
    }),
  },
  {
    id: "circum-circle",
    title: "외접원·수선",
    hint: "원 · OA · 수직이등분선",
    state: baseState(ACUTE, {
      circum: {
        ...defaultCenter("O", true),
        showCircle: true,
        rays: [true, true, true],
        perps: [true, true, true],
        showFeet: [true, true, true],
      },
    }),
  },
  {
    id: "in-tangents",
    title: "내심 접선",
    hint: "수선 · 접선 길이",
    state: baseState(triangleFromAngles(68, 54, 58, 5.8), {
      incenter: {
        ...defaultCenter("I", true),
        name: "O",
        rays: [false, false, false],
        perps: [true, true, true],
        showFeet: [true, true, true],
      },
      lengths: [
        customLen("A", "i0", "5 cm"),
        xLen("B", "i0", "y"),
        xLen("B", "i1", "x"),
        customLen("C", "i1", "7 cm"),
      ],
    }),
  },
  {
    id: "in-halves",
    title: "내심 반각",
    hint: "이등분선 · x",
    state: baseState(triangleFromAngles(70, 70, 40, 5.5), {
      incenter: {
        ...defaultCenter("I", true),
        rays: [true, true, true],
      },
      angles: [
        customAngle("B", "A", "I", "35°"),
        customAngle("C", "I", "B", "15°"),
        xAngle("A", "I", "C"),
      ],
    }),
  },
  {
    id: "in-central",
    title: "내심 중심각",
    hint: "∠BIC = 90°+A/2",
    state: baseState(triangleFromAngles(40, 70, 70, 5.6), {
      incenter: {
        ...defaultCenter("I", true),
        rays: [false, true, true],
      },
      angles: [xAngle("A", "B", "C"), customAngle("I", "B", "C", "110°")],
    }),
  },
  {
    id: "in-circle",
    title: "내접원·세 변",
    hint: "10·10·12 cm",
    state: baseState(ISO_10_10_12, {
      incenter: {
        ...defaultCenter("I", true),
        showCircle: true,
        rays: [false, false, false],
        perps: [false, false, false],
      },
      lengths: [
        customLen("A", "B", "10 cm"),
        customLen("B", "C", "12 cm"),
        customLen("C", "A", "10 cm"),
      ],
    }),
  },
  {
    id: "both-centers",
    title: "외심과 내심",
    hint: "O·I 둘 다",
    state: baseState(triangleFromAngles(74, 52, 54, 5.6), {
      circum: {
        ...defaultCenter("O", true),
        rays: [true, true, true],
      },
      incenter: {
        ...defaultCenter("I", true),
        rays: [true, true, true],
      },
    }),
  },
];

export const DEFAULT_CENTERS_STATE: TriangleCentersState = CENTERS_PRESETS[0]!.state;
