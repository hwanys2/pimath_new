import {
  emptyLabel,
  labelUnknownLetter,
  resolveAngleText,
  resolveLengthText,
  type MeasLabel,
  type Vec,
} from "@/lib/diagrams/polygon/model";

export type { MeasLabel, Vec };
export { emptyLabel, labelUnknownLetter, resolveAngleText, resolveLengthText };

export type TangentKind =
  | "two-tangents"
  | "incircle-triangle"
  | "tangential-quad"
  | "three-tangents";

export const TANGENT_KINDS: { id: TangentKind; label: string }[] = [
  { id: "two-tangents", label: "한 점에서 두 접선" },
  { id: "incircle-triangle", label: "삼각형 내접원" },
  { id: "tangential-quad", label: "접선사각형" },
  { id: "three-tangents", label: "세 접선 삼각형" },
];

export type PointDisplayMode = "both" | "dot" | "name" | "none";

export const POINT_DISPLAY_MODES: { id: PointDisplayMode; label: string }[] = [
  { id: "both", label: "점과이름" },
  { id: "dot", label: "점만" },
  { id: "name", label: "이름만" },
  { id: "none", label: "안보임" },
];

export type AngleFill = "none" | "pink" | "blue" | "green" | "gray";

export type DiagramStyle = {
  lineWidth: number;
  fontSize: number;
  pointLabelSize: number;
  pointRadius: number;
  rightAngleSize: number;
  dimOffset: number;
  padding: number;
  exportScale: number;
};

export const DEFAULT_STYLE: DiagramStyle = {
  lineWidth: 1.7,
  fontSize: 20,
  pointLabelSize: 24,
  pointRadius: 3.2,
  rightAngleSize: 11,
  dimOffset: 20,
  padding: 52,
  exportScale: 3,
};

export type NamedPoint = {
  name: string;
  dx: number;
  dy: number;
  mode: PointDisplayMode;
};

export type LengthMark = {
  id: string;
  show: boolean;
  label: MeasLabel;
  /** Actual geometry constraint entered through the numeric value control. */
  lockedValue?: number;
};

export type AngleMark = {
  id: string;
  show: boolean;
  fill: AngleFill;
  label: MeasLabel;
};

/** External point P, tangents at A·B. */
export type TwoTangentsDraft = {
  /** Distance OP (math units). Must be > radius. */
  opDist: number;
  /** Direction of P from O, degrees. */
  pAngleDeg: number;
  showOA: boolean;
  showOB: boolean;
  showOP: boolean;
  showRightAngles: boolean;
  equalRadiusTicks: 0 | 1 | 2;
  equalTangentTicks: 0 | 1 | 2;
  showChordAB: boolean;
  showAngleP: boolean;
  showAngleA: boolean;
  extendPast: number;
  points: {
    O: NamedPoint;
    P: NamedPoint;
    A: NamedPoint;
    B: NamedPoint;
  };
  lengths: {
    PA: LengthMark;
    PB: LengthMark;
    OA: LengthMark;
    OB: LengthMark;
    OP: LengthMark;
    AB: LengthMark;
  };
  angles: {
    P: AngleMark;
    A: AngleMark;
  };
};

export type TriangleDraft = {
  /** Vertices A, B, C in math coords. */
  verts: [Vec, Vec, Vec];
  showTouchPoints: boolean;
  points: {
    A: NamedPoint;
    B: NamedPoint;
    C: NamedPoint;
    O: NamedPoint;
    P: NamedPoint;
    Q: NamedPoint;
    R: NamedPoint;
  };
  /** Side lengths AB, BC, CA. */
  sides: {
    AB: LengthMark;
    BC: LengthMark;
    CA: LengthMark;
  };
  /** Tangent segments from vertices: AP=AR, BP=BQ, CQ=CR. */
  segs: {
    AP: LengthMark;
    BP: LengthMark;
    CQ: LengthMark;
    AR: LengthMark;
    BQ: LengthMark;
    CR: LengthMark;
  };
};

export type QuadDraft = {
  /** Touch-point angles on the unit circle (degrees), CCW. */
  touchDeg: [number, number, number, number];
  showTouchPoints: boolean;
  points: {
    A: NamedPoint;
    B: NamedPoint;
    C: NamedPoint;
    D: NamedPoint;
    O: NamedPoint;
    P: NamedPoint;
    Q: NamedPoint;
    R: NamedPoint;
    S: NamedPoint;
  };
  sides: {
    AB: LengthMark;
    BC: LengthMark;
    CD: LengthMark;
    AD: LengthMark;
  };
  segs: {
    AP: LengthMark;
    BP: LengthMark;
    BQ: LengthMark;
    CQ: LengthMark;
    CR: LengthMark;
    DR: LengthMark;
    DS: LengthMark;
    AS: LengthMark;
  };
};

/** Triangle ABC with circle tangent to BC and AB·AC extensions (excircle-like). */
export type ThreeTangentsDraft = {
  verts: [Vec, Vec, Vec];
  showTouchPoints: boolean;
  points: {
    A: NamedPoint;
    B: NamedPoint;
    C: NamedPoint;
    O: NamedPoint;
    D: NamedPoint;
    E: NamedPoint;
    F: NamedPoint;
  };
  lengths: {
    AD: LengthMark;
    AF: LengthMark;
    AB: LengthMark;
    AC: LengthMark;
    BC: LengthMark;
    BE: LengthMark;
    CE: LengthMark;
  };
};

export type CircleTangentsState = {
  kind: TangentKind;
  radius: number;
  unit: string;
  unknownLetter: string;
  viewRotationDeg: number;
  showCenter: boolean;
  two: TwoTangentsDraft;
  tri: TriangleDraft;
  quad: QuadDraft;
  three: ThreeTangentsDraft;
  style: DiagramStyle;
};

export type TangentPreset = {
  id: string;
  title: string;
  hint: string;
  state: CircleTangentsState;
};

function np(name: string, mode: PointDisplayMode = "both"): NamedPoint {
  return { name, dx: 0, dy: 0, mode };
}

function lenMark(
  id: string,
  show: boolean,
  mode: MeasLabel["mode"] = "auto",
  custom = "",
): LengthMark {
  return { id, show, label: { ...emptyLabel(mode), custom } };
}

function angMark(
  id: string,
  show: boolean,
  mode: MeasLabel["mode"] = "auto",
  custom = "",
  fill: AngleFill = "none",
): AngleMark {
  return { id, show, fill, label: { ...emptyLabel(mode), custom } };
}

function defaultTwo(): TwoTangentsDraft {
  return {
    opDist: 10,
    pAngleDeg: 180,
    showOA: false,
    showOB: false,
    showOP: false,
    showRightAngles: false,
    equalRadiusTicks: 0,
    equalTangentTicks: 0,
    showChordAB: false,
    showAngleP: false,
    showAngleA: false,
    extendPast: 0.35,
    points: {
      O: np("O"),
      P: np("P"),
      A: np("A"),
      B: np("B"),
    },
    lengths: {
      PA: lenMark("PA", true),
      PB: lenMark("PB", true, "x"),
      OA: lenMark("OA", false),
      OB: lenMark("OB", false),
      OP: lenMark("OP", false),
      AB: lenMark("AB", false),
    },
    angles: {
      P: angMark("angP", false),
      A: angMark("angA", false, "x"),
    },
  };
}

function defaultTri(): TriangleDraft {
  return {
    verts: [
      { x: 0, y: 4.2 },
      { x: -4.2, y: -2.6 },
      { x: 4.8, y: -2.6 },
    ],
    showTouchPoints: true,
    points: {
      A: np("A"),
      B: np("B"),
      C: np("C"),
      O: np("O"),
      P: np("P"),
      Q: np("Q"),
      R: np("R"),
    },
    sides: {
      AB: lenMark("AB", true, "custom", "10 cm"),
      BC: lenMark("BC", true, "custom", "14 cm"),
      CA: lenMark("CA", true, "custom", "8 cm"),
    },
    segs: {
      AP: lenMark("AP", false),
      BP: lenMark("BP", false),
      CQ: lenMark("CQ", false),
      AR: lenMark("AR", false),
      BQ: lenMark("BQ", false),
      CR: lenMark("CR", true, "x"),
    },
  };
}

function defaultQuad(): QuadDraft {
  return {
    touchDeg: [40, 130, 220, 310],
    showTouchPoints: true,
    points: {
      A: np("A"),
      B: np("B"),
      C: np("C"),
      D: np("D"),
      O: np("O"),
      P: np("P"),
      Q: np("Q"),
      R: np("R"),
      S: np("S"),
    },
    sides: {
      AB: lenMark("AB", false),
      BC: lenMark("BC", false),
      CD: lenMark("CD", false),
      AD: lenMark("AD", false),
    },
    segs: {
      AP: lenMark("AP", true, "custom", "4 cm"),
      BP: lenMark("BP", false),
      BQ: lenMark("BQ", true, "custom", "6 cm"),
      CQ: lenMark("CQ", false),
      CR: lenMark("CR", true, "custom", "5 cm"),
      DR: lenMark("DR", false),
      DS: lenMark("DS", true, "x"),
      AS: lenMark("AS", false),
    },
  };
}

function defaultThree(): ThreeTangentsDraft {
  return {
    verts: [
      { x: -6.5, y: 0 },
      { x: -1.2, y: 2.4 },
      { x: -1.2, y: -2.8 },
    ],
    showTouchPoints: true,
    points: {
      A: np("A"),
      B: np("B"),
      C: np("C"),
      O: np("O"),
      D: np("D"),
      E: np("E"),
      F: np("F"),
    },
    lengths: {
      AD: lenMark("AD", true, "custom", "8 cm"),
      AF: lenMark("AF", false),
      AB: lenMark("AB", true, "custom", "5 cm"),
      AC: lenMark("AC", false),
      BC: lenMark("BC", false),
      BE: lenMark("BE", false),
      CE: lenMark("CE", false),
    },
  };
}

export const DEFAULT_TANGENTS_STATE: CircleTangentsState = {
  kind: "two-tangents",
  radius: 6,
  unit: "cm",
  unknownLetter: "x",
  viewRotationDeg: 0,
  showCenter: true,
  two: defaultTwo(),
  tri: defaultTri(),
  quad: defaultQuad(),
  three: defaultThree(),
  style: { ...DEFAULT_STYLE },
};

export function cloneState(state: CircleTangentsState): CircleTangentsState {
  return structuredClone(state);
}

export function normalizeState(state: CircleTangentsState): CircleTangentsState {
  const style = { ...DEFAULT_STYLE, ...state.style };
  const two = { ...defaultTwo(), ...state.two };
  two.points = { ...defaultTwo().points, ...state.two?.points };
  two.lengths = { ...defaultTwo().lengths, ...state.two?.lengths };
  two.angles = { ...defaultTwo().angles, ...state.two?.angles };
  const tri = { ...defaultTri(), ...state.tri };
  tri.points = { ...defaultTri().points, ...state.tri?.points };
  tri.sides = { ...defaultTri().sides, ...state.tri?.sides };
  tri.segs = { ...defaultTri().segs, ...state.tri?.segs };
  const quad = { ...defaultQuad(), ...state.quad };
  quad.points = { ...defaultQuad().points, ...state.quad?.points };
  quad.sides = { ...defaultQuad().sides, ...state.quad?.sides };
  quad.segs = { ...defaultQuad().segs, ...state.quad?.segs };
  const three = { ...defaultThree(), ...state.three };
  three.points = { ...defaultThree().points, ...state.three?.points };
  three.lengths = { ...defaultThree().lengths, ...state.three?.lengths };
  const radius = Math.max(1, Number(state.radius) || 6);
  const opDist = Math.max(radius + 0.5, Number(two.opDist) || radius + 4);
  return {
    ...DEFAULT_TANGENTS_STATE,
    ...state,
    radius,
    unit: state.unit ?? "cm",
    unknownLetter: state.unknownLetter?.trim() || "x",
    viewRotationDeg: Number(state.viewRotationDeg) || 0,
    showCenter: state.showCenter !== false,
    two: { ...two, opDist },
    tri,
    quad,
    three,
    style,
  };
}

export function withKind(
  state: CircleTangentsState,
  kind: TangentKind,
): CircleTangentsState {
  return normalizeState({ ...state, kind });
}

function base(kind: TangentKind, patch: Partial<CircleTangentsState> = {}): CircleTangentsState {
  return normalizeState({ ...DEFAULT_TANGENTS_STATE, kind, ...patch });
}

export const TANGENT_PRESETS: TangentPreset[] = [
  {
    id: "two-equal-12",
    title: "두 접선 12·x",
    hint: "한 점에서 그은 접선 길이",
    state: base("two-tangents", {
      radius: 5,
      two: {
        ...defaultTwo(),
        opDist: 13,
        pAngleDeg: 180,
        lengths: {
          ...defaultTwo().lengths,
          PA: lenMark("PA", true, "custom", "12 cm"),
          PB: lenMark("PB", true, "x"),
        },
      },
    }),
  },
  {
    id: "two-pythag-6-10",
    title: "반지름 6·OP 10",
    hint: "직각삼각형으로 접선 길이",
    state: base("two-tangents", {
      radius: 6,
      two: {
        ...defaultTwo(),
        opDist: 10,
        pAngleDeg: 0,
        showOA: true,
        showOP: true,
        showRightAngles: true,
        lengths: {
          ...defaultTwo().lengths,
          PA: lenMark("PA", false),
          PB: lenMark("PB", true, "x"),
          OA: lenMark("OA", true, "custom", "6 cm"),
          OP: lenMark("OP", true, "custom", "10 cm"),
        },
      },
    }),
  },
  {
    id: "two-right-ticks",
    title: "직각·등호 빗금",
    hint: "접선⊥반지름",
    state: base("two-tangents", {
      radius: 5.5,
      two: {
        ...defaultTwo(),
        opDist: 11,
        pAngleDeg: 180,
        showOA: true,
        showOB: true,
        showOP: true,
        showRightAngles: true,
        equalRadiusTicks: 1,
        lengths: {
          ...defaultTwo().lengths,
          PA: lenMark("PA", false),
          PB: lenMark("PB", false),
        },
      },
    }),
  },
  {
    id: "two-chord-50",
    title: "접현·50°·x",
    hint: "두 접선과 접점 연결현",
    state: base("two-tangents", {
      radius: 5,
      two: {
        ...defaultTwo(),
        opDist: 12,
        pAngleDeg: 180,
        showChordAB: true,
        showAngleP: true,
        showAngleA: true,
        lengths: {
          ...defaultTwo().lengths,
          PA: lenMark("PA", true, "custom", "8 cm"),
          PB: lenMark("PB", false),
        },
        angles: {
          P: angMark("angP", true, "custom", "50°"),
          A: angMark("angA", true, "x"),
        },
      },
    }),
  },
  {
    id: "tri-incircle-x",
    title: "내접원 10·14·8",
    hint: "접선 조각 x",
    state: base("incircle-triangle", {
      tri: defaultTri(),
    }),
  },
  {
    id: "quad-4-6-5-x",
    title: "접선사각형 4·6·5·x",
    hint: "대변 합이 같음",
    state: base("tangential-quad", {
      radius: 4.5,
      quad: defaultQuad(),
    }),
  },
  {
    id: "quad-sides-10-11-9-x",
    title: "접선사각형 대변 10·11·9·x",
    hint: "AB+CD = AD+BC",
    state: base("tangential-quad", {
      radius: 4.53,
      quad: {
        ...defaultQuad(),
        showTouchPoints: false,
        sides: {
          AB: lenMark("AB", true, "custom", "10 cm"),
          BC: lenMark("BC", true, "custom", "11 cm"),
          CD: lenMark("CD", true, "custom", "9 cm"),
          AD: lenMark("AD", true, "x"),
        },
        segs: {
          AP: lenMark("AP", false),
          BP: lenMark("BP", false),
          BQ: lenMark("BQ", false),
          CQ: lenMark("CQ", false),
          CR: lenMark("CR", false),
          DR: lenMark("DR", false),
          DS: lenMark("DS", false),
          AS: lenMark("AS", false),
        },
      },
    }),
  },
  {
    id: "three-8-5-6",
    title: "세 접선 8·5·6",
    hint: "연장 접점과 삼각형",
    state: base("three-tangents", {
      three: defaultThree(),
    }),
  },
];

export function cyclePointMode(mode: PointDisplayMode): PointDisplayMode {
  const order: PointDisplayMode[] = ["both", "dot", "name", "none"];
  const i = order.indexOf(mode);
  return order[(i + 1) % order.length]!;
}

export function pointModeTitle(mode: PointDisplayMode): string {
  if (mode === "both") return "점과이름";
  if (mode === "dot") return "점만";
  if (mode === "name") return "이름만";
  return "안보임";
}

export function lengthModeTitle(
  show: boolean,
  mode: MeasLabel["mode"],
): string {
  if (!show || mode === "hide") return "숨김";
  if (mode === "x") return "문자";
  if (mode === "custom") return "직접";
  return "숫자";
}
