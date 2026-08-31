import {
  emptyLabel,
  labelUnknownLetter,
  resolveAngleText,
  resolveLengthText,
  type DiagramStyle,
  type MeasLabel,
} from "@/lib/diagrams/polygon/model";

export type { DiagramStyle, MeasLabel };
export { emptyLabel, labelUnknownLetter, resolveAngleText, resolveLengthText };

export type InscribedKind =
  | "central"
  | "same-arc"
  | "diameter"
  | "arc-ratio"
  | "cyclic-quad"
  | "tangent";

export const INSCRIBED_KINDS: { id: InscribedKind; label: string }[] = [
  { id: "central", label: "원주각·중심각" },
  { id: "same-arc", label: "같은 호" },
  { id: "diameter", label: "지름" },
  { id: "arc-ratio", label: "호와 원주각" },
  { id: "cyclic-quad", label: "내접사각형" },
  { id: "tangent", label: "접선과 현" },
];

export type CircPoint = {
  id: string;
  name: string;
  angleDeg: number;
  dx: number;
  dy: number;
  showName: boolean;
};

export type EdgeDraft = {
  id: string;
  a: string;
  b: string;
  show: boolean;
};

export type AngleFill = "none" | "pink" | "blue";

export type AngleDraft = {
  id: string;
  vertex: string;
  from: string;
  to: string;
  show: boolean;
  fill: AngleFill;
  reflex: boolean;
  right: boolean;
  label: MeasLabel;
};

export type ArcDraft = {
  id: string;
  a: string;
  b: string;
  ccw: boolean;
  show: boolean;
  highlight: boolean;
  label: MeasLabel;
};

export type TangentDraft = {
  at: string;
  show: boolean;
  tName: string;
  tDx: number;
  tDy: number;
  /** Half-length of the tangent, in radius units. */
  span: number;
};

export type ExtensionDraft = {
  from: string;
  through: string;
  extraName: string;
  extraT: number;
  extraDx: number;
  extraDy: number;
  show: boolean;
};

export type InscribedState = {
  kind: InscribedKind;
  radius: number;
  showCircle: boolean;
  showCenter: boolean;
  centerName: string;
  centerDx: number;
  centerDy: number;
  showDots: boolean;
  viewRotationDeg: number;
  unit: string;
  unknownLetter: string;
  /** When set, these two circumference points stay opposite (지름). */
  diameterPair: [string, string] | null;
  points: CircPoint[];
  edges: EdgeDraft[];
  angles: AngleDraft[];
  arcs: ArcDraft[];
  tangent: TangentDraft | null;
  extension: ExtensionDraft | null;
  style: DiagramStyle;
};

export type InscribedPreset = {
  id: string;
  title: string;
  hint: string;
  state: InscribedState;
};

const DEFAULT_STYLE: DiagramStyle = {
  lineWidth: 1.7,
  fontSize: 20,
  pointLabelSize: 22,
  pointRadius: 3.2,
  dimOffset: 22,
  padding: 56,
  exportScale: 3,
};

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function edgeId(a: string, b: string): string {
  return `e:${pairKey(a, b)}`;
}

export function angleId(vertex: string, from: string, to: string): string {
  const arms = from < to ? `${from}:${to}` : `${to}:${from}`;
  return `ang:${vertex}:${arms}`;
}

export function arcId(a: string, b: string, ccw: boolean): string {
  return `arc:${a}:${b}:${ccw ? "ccw" : "cw"}`;
}

function pt(
  id: string,
  name: string,
  angleDeg: number,
  patch: Partial<CircPoint> = {},
): CircPoint {
  return {
    id,
    name,
    angleDeg: normalizeDeg(angleDeg),
    dx: 0,
    dy: 0,
    showName: true,
    ...patch,
  };
}

function edge(a: string, b: string, show = true): EdgeDraft {
  return { id: edgeId(a, b), a, b, show };
}

function ang(
  vertex: string,
  from: string,
  to: string,
  patch: Partial<AngleDraft> = {},
): AngleDraft {
  return {
    id: angleId(vertex, from, to),
    vertex,
    from,
    to,
    show: true,
    fill: "none",
    reflex: false,
    right: false,
    label: emptyLabel("auto"),
    ...patch,
  };
}

function arc(
  a: string,
  b: string,
  ccw: boolean,
  patch: Partial<ArcDraft> = {},
): ArcDraft {
  return {
    id: arcId(a, b, ccw),
    a,
    b,
    ccw,
    show: true,
    highlight: false,
    label: emptyLabel("hide"),
    ...patch,
  };
}

export function customAng(text: string, patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("custom"), custom: text, ...patch };
}

export function xAng(letter: string, patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("x"), custom: letter, ...patch };
}

export function customLen(text: string, patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("custom"), custom: text, ...patch };
}

export function xLen(letter: string, patch: Partial<MeasLabel> = {}): MeasLabel {
  return { ...emptyLabel("x"), custom: letter, ...patch };
}

function baseState(partial: Partial<InscribedState>): InscribedState {
  return {
    kind: "central",
    radius: 10,
    showCircle: true,
    showCenter: true,
    centerName: "O",
    centerDx: 0,
    centerDy: 0,
    showDots: true,
    viewRotationDeg: 0,
    unit: "cm",
    unknownLetter: "x",
    diameterPair: null,
    points: [],
    edges: [],
    angles: [],
    arcs: [],
    tangent: null,
    extension: null,
    style: { ...DEFAULT_STYLE },
    ...partial,
  };
}

export function normalizeState(state: InscribedState): InscribedState {
  return {
    ...state,
    radius: Math.max(state.radius, 0.01),
    centerName: state.centerName?.trim() ? state.centerName : "O",
    unknownLetter: state.unknownLetter?.trim() || "x",
    unit: state.unit ?? "cm",
    viewRotationDeg: state.viewRotationDeg ?? 0,
    diameterPair: state.diameterPair ?? null,
    style: { ...DEFAULT_STYLE, ...state.style },
    points: (state.points ?? []).map((p) => ({
      ...p,
      angleDeg: normalizeDeg(p.angleDeg),
      dx: p.dx ?? 0,
      dy: p.dy ?? 0,
      showName: p.showName !== false,
    })),
    edges: (state.edges ?? []).map((e) => ({ ...e, show: e.show !== false })),
    angles: (state.angles ?? []).map((a) => ({
      ...a,
      show: a.show !== false,
      fill: a.fill === "pink" || a.fill === "blue" ? a.fill : "none",
      reflex: Boolean(a.reflex),
      right: Boolean(a.right),
      label: a.label ?? emptyLabel("auto"),
    })),
    arcs: (state.arcs ?? []).map((a) => ({
      ...a,
      show: a.show !== false,
      highlight: Boolean(a.highlight),
      label: a.label ?? emptyLabel("hide"),
    })),
    tangent: state.tangent
      ? {
          ...state.tangent,
          tName: state.tangent.tName?.trim() || "T",
          span: Math.max(state.tangent.span ?? 1.35, 0.4),
          tDx: state.tangent.tDx ?? 0,
          tDy: state.tangent.tDy ?? 0,
        }
      : null,
    extension: state.extension
      ? {
          ...state.extension,
          extraName: state.extension.extraName?.trim() || "E",
          extraT: Math.max(state.extension.extraT ?? 0.55, 0.2),
          extraDx: state.extension.extraDx ?? 0,
          extraDy: state.extension.extraDy ?? 0,
        }
      : null,
  };
}

export function cloneState(state: InscribedState): InscribedState {
  return structuredClone(state);
}

export const INSCRIBED_PRESETS: InscribedPreset[] = [
  {
    id: "central-70",
    title: "중심각 70° · 원주각 x",
    hint: "같은 호에서 원주각은 중심각의 절반",
    state: baseState({
      kind: "central",
      points: [pt("A", "A", 248), pt("B", "B", 318), pt("P", "P", 18)],
      edges: [edge("O", "A"), edge("O", "B"), edge("P", "A"), edge("P", "B")],
      angles: [
        ang("O", "A", "B", { label: customAng("70°") }),
        ang("P", "A", "B", { fill: "pink", label: xAng("x") }),
      ],
    }),
  },
  {
    id: "same-arc-30",
    title: "같은 호 · 30° x y",
    hint: "같은 호에 대한 원주각은 같다",
    state: baseState({
      kind: "same-arc",
      points: [
        pt("A", "A", 232),
        pt("B", "B", 292),
        pt("P", "P", 92),
        pt("Q", "Q", 12),
      ],
      edges: [
        edge("O", "A"),
        edge("O", "B"),
        edge("P", "A"),
        edge("P", "B"),
        edge("Q", "A"),
        edge("Q", "B"),
      ],
      angles: [
        ang("P", "A", "B", { label: customAng("30°") }),
        ang("O", "A", "B", { fill: "pink", label: xAng("x") }),
        ang("Q", "A", "B", { fill: "blue", label: xAng("y") }),
      ],
    }),
  },
  {
    id: "two-arcs",
    title: "두 호 · 25° 58°",
    hint: "호마다 원주각·중심각",
    state: baseState({
      kind: "central",
      points: [
        pt("A", "A", 118),
        pt("B", "B", 198),
        pt("C", "C", 256),
        pt("D", "D", 18),
        pt("E", "E", 322),
      ],
      edges: [
        edge("O", "C"),
        edge("O", "D"),
        edge("A", "B"),
        edge("A", "C"),
        edge("B", "E"),
        edge("C", "E"),
        edge("B", "D"),
      ],
      angles: [
        ang("A", "B", "C", { fill: "pink", label: xAng("x") }),
        ang("B", "A", "E", { label: customAng("25°") }),
        ang("O", "C", "D", { label: customAng("58°") }),
        ang("E", "B", "C", { fill: "blue", label: xAng("y") }),
      ],
    }),
  },
  {
    id: "diameter-90",
    title: "지름에 대한 원주각",
    hint: "지름이 보이는 원주각은 90°",
    state: baseState({
      kind: "diameter",
      diameterPair: ["A", "B"],
      points: [
        pt("A", "A", 180),
        pt("B", "B", 0),
        pt("P", "P", 52),
        pt("Q", "Q", 128),
      ],
      edges: [
        edge("A", "B"),
        edge("A", "P"),
        edge("B", "P"),
        edge("A", "Q"),
        edge("B", "Q"),
      ],
      angles: [
        ang("P", "A", "B", { right: true, fill: "pink", label: emptyLabel("hide") }),
        ang("Q", "A", "B", { right: true, fill: "pink", label: emptyLabel("hide") }),
        ang("O", "A", "B", { reflex: false, label: customAng("180°", { dy: 18 }) }),
      ],
      arcs: [
        arc("A", "B", true, {
          show: false,
          highlight: true,
          label: emptyLabel("hide"),
        }),
      ],
    }),
  },
  {
    id: "equal-arcs-2cm",
    title: "같은 호 2 cm",
    hint: "호가 같으면 원주각도 같다",
    state: baseState({
      kind: "arc-ratio",
      showCenter: true,
      points: [
        pt("P", "P", 92, { showName: false }),
        pt("A", "A", 218, { showName: false }),
        pt("B", "B", 270, { showName: false }),
        pt("C", "C", 322, { showName: false }),
      ],
      edges: [edge("P", "A"), edge("P", "B"), edge("P", "C")],
      angles: [
        ang("P", "A", "B", { fill: "pink", label: xAng("x") }),
        ang("P", "B", "C", { label: customAng("25°") }),
      ],
      arcs: [
        arc("A", "B", true, { label: customLen("2 cm") }),
        arc("B", "C", true, { label: customLen("2 cm") }),
      ],
    }),
  },
  {
    id: "arc-5-x",
    title: "호 5 cm · x cm",
    hint: "원주각의 비 = 호의 비",
    state: baseState({
      kind: "arc-ratio",
      diameterPair: ["A", "B"],
      points: [
        pt("A", "A", 175, { showName: false }),
        pt("B", "B", 355, { showName: false }),
        pt("C", "C", 48, { showName: false }),
        pt("D", "D", 300, { showName: false }),
      ],
      edges: [edge("A", "B"), edge("A", "C"), edge("A", "D"), edge("C", "B")],
      angles: [
        ang("A", "B", "D", { label: customAng("30°") }),
        ang("C", "A", "B", { label: customAng("60°") }),
      ],
      arcs: [
        arc("B", "C", true, { label: customLen("5 cm") }),
        arc("D", "B", true, { label: xLen("x") }),
      ],
    }),
  },
  {
    id: "arc-3-9",
    title: "호 3 cm · 9 cm",
    hint: "한 꼭짓점에서 두 원주각",
    state: baseState({
      kind: "arc-ratio",
      points: [
        pt("P", "P", 8, { showName: false }),
        pt("A", "A", 128, { showName: false }),
        pt("B", "B", 175, { showName: false }),
        pt("C", "C", 250, { showName: false }),
      ],
      edges: [edge("P", "A"), edge("P", "B"), edge("P", "C")],
      angles: [
        ang("P", "A", "B", { label: customAng("14°") }),
        ang("P", "B", "C", { fill: "pink", label: xAng("x") }),
      ],
      arcs: [
        arc("A", "B", true, { label: customLen("3 cm") }),
        arc("B", "C", true, { label: customLen("9 cm") }),
      ],
    }),
  },
  {
    id: "arc-8-x",
    title: "호 8 cm · x cm",
    hint: "맞붙은 원주각과 호",
    state: baseState({
      kind: "arc-ratio",
      points: [
        pt("P", "P", 95, { showName: false }),
        pt("A", "A", 200, { showName: false }),
        pt("B", "B", 268, { showName: false }),
        pt("C", "C", 338, { showName: false }),
      ],
      edges: [edge("P", "A"), edge("P", "B"), edge("P", "C")],
      angles: [
        ang("P", "A", "B", { label: customAng("64°") }),
        ang("P", "B", "C", { label: customAng("32°") }),
      ],
      arcs: [
        arc("A", "B", true, { label: customLen("8 cm") }),
        arc("B", "C", true, { label: xLen("x") }),
      ],
    }),
  },
  {
    id: "quad-ac",
    title: "내접사각형 · a, c",
    hint: "원주각은 중심각의 절반",
    state: baseState({
      kind: "cyclic-quad",
      points: [
        pt("A", "A", 95),
        pt("B", "B", 200),
        pt("C", "C", 258),
        pt("D", "D", 340),
      ],
      edges: [
        edge("A", "B"),
        edge("B", "C"),
        edge("C", "D"),
        edge("D", "A"),
        edge("O", "B"),
        edge("O", "D"),
      ],
      angles: [
        ang("O", "B", "D", { fill: "pink", label: xAng("c") }),
        ang("O", "B", "D", {
          id: "ang:O:B:D:reflex",
          reflex: true,
          fill: "blue",
          label: xAng("a"),
        }),
      ],
    }),
  },
  {
    id: "quad-exterior",
    title: "내접사각형의 외각",
    hint: "외각은 내대각과 같다",
    state: baseState({
      kind: "cyclic-quad",
      points: [
        pt("A", "A", 128),
        pt("B", "B", 210),
        pt("C", "C", 332),
        pt("D", "D", 48),
      ],
      edges: [edge("A", "B"), edge("B", "C"), edge("C", "D"), edge("D", "A")],
      extension: {
        from: "B",
        through: "C",
        extraName: "E",
        extraT: 0.62,
        extraDx: 0,
        extraDy: 0,
        show: true,
      },
      angles: [
        ang("A", "D", "B", { fill: "pink", label: emptyLabel("hide") }),
        ang("C", "D", "E", { fill: "pink", label: emptyLabel("hide") }),
      ],
    }),
  },
  {
    id: "quad-angles",
    title: "내접사각형 네 각",
    hint: "대각의 합은 180°",
    state: baseState({
      kind: "cyclic-quad",
      points: [
        pt("A", "A", 125, { showName: false }),
        pt("B", "B", 210, { showName: false }),
        pt("C", "C", 300, { showName: false }),
        pt("D", "D", 40, { showName: false }),
      ],
      edges: [edge("A", "B"), edge("B", "C"), edge("C", "D"), edge("D", "A")],
      angles: [
        ang("A", "D", "B", { label: customAng("80°") }),
        ang("B", "A", "C", { right: true, label: emptyLabel("hide") }),
        ang("D", "A", "C", { fill: "pink", label: xAng("x") }),
        ang("C", "B", "D", { fill: "blue", label: xAng("y") }),
      ],
    }),
  },
  {
    id: "two-triangles",
    title: "한 현 위 두 삼각형",
    hint: "같은 호에 대한 원주각",
    state: baseState({
      kind: "same-arc",
      points: [
        pt("A", "A", 155, { showName: false }),
        pt("B", "B", 25, { showName: false }),
        pt("P", "P", 95, { showName: false }),
        pt("Q", "Q", 255, { showName: false }),
      ],
      edges: [
        edge("A", "B"),
        edge("A", "P"),
        edge("B", "P"),
        edge("A", "Q"),
        edge("B", "Q"),
      ],
      angles: [
        ang("A", "P", "B", { label: customAng("75°") }),
        ang("B", "P", "A", { label: customAng("30°") }),
        ang("P", "A", "B", { fill: "pink", label: xAng("x") }),
        ang("Q", "A", "B", { fill: "blue", label: xAng("y") }),
      ],
    }),
  },
  {
    id: "tangent-40",
    title: "접선과 현 40°",
    hint: "접선·현이 이루는 각 = 원주각",
    state: baseState({
      kind: "tangent",
      points: [pt("A", "A", 270), pt("B", "B", 42), pt("C", "C", 148)],
      edges: [edge("A", "B"), edge("B", "C"), edge("C", "A")],
      tangent: {
        at: "A",
        show: true,
        tName: "T",
        tDx: 0,
        tDy: 0,
        span: 1.45,
      },
      angles: [
        ang("C", "A", "B", { label: customAng("80°") }),
        ang("B", "A", "C", { fill: "pink", label: xAng("x") }),
        ang("A", "C", "B", { fill: "blue", label: xAng("y") }),
        ang("A", "C", "T-", { label: customAng("40°", { dx: -10, dy: 8 }) }),
      ],
    }),
  },
  {
    id: "tangent-diameter",
    title: "접선과 지름 50°",
    hint: "접선에 수직인 반지름",
    state: baseState({
      kind: "tangent",
      diameterPair: ["C", "B"],
      points: [pt("A", "A", 270), pt("C", "C", 180), pt("B", "B", 0)],
      edges: [edge("A", "B"), edge("B", "C"), edge("C", "A")],
      tangent: {
        at: "A",
        show: true,
        tName: "T",
        tDx: 0,
        tDy: 0,
        span: 1.45,
      },
      angles: [
        ang("C", "B", "A", { fill: "pink", label: xAng("x") }),
        ang("B", "C", "A", { fill: "blue", label: xAng("y") }),
        ang("A", "B", "T+", { label: customAng("50°") }),
      ],
    }),
  },
  {
    id: "multi-inscribed",
    title: "여러 원주각",
    hint: "호를 나눠 더한 원주각",
    state: baseState({
      kind: "same-arc",
      points: [
        pt("A", "A", 145),
        pt("B", "B", 210),
        pt("C", "C", 255),
        pt("D", "D", 318),
        pt("E", "E", 28),
        pt("F", "F", 78),
      ],
      edges: [
        edge("O", "B"),
        edge("O", "D"),
        edge("A", "B"),
        edge("A", "C"),
        edge("E", "C"),
        edge("E", "D"),
        edge("F", "B"),
        edge("F", "D"),
      ],
      angles: [
        ang("A", "B", "C", { label: customAng("25°") }),
        ang("E", "C", "D", { label: customAng("40°") }),
        ang("O", "B", "D", { fill: "pink", label: xAng("x") }),
      ],
    }),
  },
];

export const DEFAULT_INSCRIBED_STATE: InscribedState = cloneState(
  INSCRIBED_PRESETS[0]!.state,
);

export function withKind(prev: InscribedState, kind: InscribedKind): InscribedState {
  const template =
    INSCRIBED_PRESETS.find((p) => p.state.kind === kind)?.state ??
    INSCRIBED_PRESETS[0]!.state;
  return normalizeState({
    ...cloneState(template),
    style: prev.style,
    unit: prev.unit,
    unknownLetter: prev.unknownLetter,
    radius: prev.radius,
  });
}

export function findPoint(state: InscribedState, id: string): CircPoint | undefined {
  return state.points.find((p) => p.id === id);
}

export function findEdge(state: InscribedState, id: string): EdgeDraft | undefined {
  return state.edges.find((e) => e.id === id);
}

export function findAngle(state: InscribedState, id: string): AngleDraft | undefined {
  return state.angles.find((a) => a.id === id);
}

export function findArc(state: InscribedState, id: string): ArcDraft | undefined {
  return state.arcs.find((a) => a.id === id);
}

export function displayAngleName(state: InscribedState, angle: AngleDraft): string {
  const nameOf = (id: string) => {
    if (id === "O") return state.centerName || "O";
    if (id === "T+" || id === "T-") return state.tangent?.tName || "T";
    if (id === "E") return state.extension?.extraName || "E";
    return findPoint(state, id)?.name || id;
  };
  return `∠${nameOf(angle.from)}${nameOf(angle.vertex)}${nameOf(angle.to)}`;
}

export function displayEdgeName(state: InscribedState, edgeDraft: EdgeDraft): string {
  const nameOf = (id: string) => {
    if (id === "O") return state.centerName || "O";
    return findPoint(state, id)?.name || id;
  };
  return `${nameOf(edgeDraft.a)}${nameOf(edgeDraft.b)}`;
}

export function nextPointName(state: InscribedState): string {
  const used = new Set(state.points.map((p) => p.name.trim()));
  for (let i = 0; i < 26; i += 1) {
    const n = String.fromCharCode(65 + i);
    if (!used.has(n)) return n;
  }
  return `P${state.points.length + 1}`;
}
