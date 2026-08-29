import { formatMeasure } from "@/lib/diagrams/math-label";

export type LabelMode = "auto" | "x" | "hide" | "custom";

export type MeasLabel = {
  mode: LabelMode;
  custom: string;
  dx: number;
  dy: number;
  lineDx?: number;
  lineDy?: number;
};

export type SolidFamily =
  | "prism"
  | "pyramid"
  | "frustum"
  | "cylinder"
  | "cone"
  | "coneFrustum"
  | "platonic";

export type PlatonicKind =
  | "tetrahedron"
  | "cube"
  | "octahedron"
  | "dodecahedron"
  | "icosahedron";

export type CylinderLie = "vertical" | "horizontal";

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

export type SolidSketchState = {
  family: SolidFamily;
  sides: number;
  platonic: PlatonicKind;
  width: number;
  depth: number;
  height: number;
  baseSize: number;
  topSize: number;
  radius: number;
  topRadius: number;
  edgeLength: number;
  cylinderLie: CylinderLie;
  azimuthDeg: number;
  elevationDeg: number;
  showFill: boolean;
  showVertexNames: boolean;
  showHidden: boolean;
  showHeight: boolean;
  showHeightRightAngle: boolean;
  showRadius: boolean;
  showSlant: boolean;
  showBaseEdge: boolean;
  showCenter: boolean;
  vertexNames: string[];
  nameDx: number[];
  nameDy: number[];
  heightLabel: MeasLabel;
  radiusLabel: MeasLabel;
  slantLabel: MeasLabel;
  baseEdgeLabel: MeasLabel;
  edgeLabels: Record<string, MeasLabel>;
  unit: string;
  unknownLetter: string;
  style: DiagramStyle;
};

export type SolidPreset = {
  id: string;
  title: string;
  hint: string;
  state: SolidSketchState;
};

export const DEFAULT_AZIMUTH = -32;
export const DEFAULT_ELEVATION = 28;

export function emptyLabel(mode: LabelMode = "auto"): MeasLabel {
  return { mode, custom: "", dx: 0, dy: 0, lineDx: 0, lineDy: 0 };
}

const DEFAULT_STYLE: DiagramStyle = {
  lineWidth: 1.7,
  fontSize: 24,
  pointLabelSize: 28,
  pointRadius: 4.5,
  rightAngleSize: 11,
  dimOffset: 22,
  padding: 56,
  exportScale: 3,
};

function baseState(
  patch: Partial<SolidSketchState> & Pick<SolidSketchState, "family">,
): SolidSketchState {
  return normalizeState({
    sides: 4,
    platonic: "cube",
    width: 6,
    depth: 4,
    height: 5,
    baseSize: 5,
    topSize: 3,
    radius: 3,
    topRadius: 1.8,
    edgeLength: 5,
    cylinderLie: "vertical",
    azimuthDeg: DEFAULT_AZIMUTH,
    elevationDeg: DEFAULT_ELEVATION,
    showFill: true,
    showVertexNames: true,
    showHidden: true,
    showHeight: false,
    showHeightRightAngle: false,
    showRadius: false,
    showSlant: false,
    showBaseEdge: false,
    showCenter: false,
    vertexNames: [],
    nameDx: [],
    nameDy: [],
    heightLabel: emptyLabel("auto"),
    radiusLabel: emptyLabel("auto"),
    slantLabel: emptyLabel("auto"),
    baseEdgeLabel: emptyLabel("auto"),
    edgeLabels: {},
    unit: "cm",
    unknownLetter: "x",
    style: { ...DEFAULT_STYLE },
    ...patch,
  });
}

export const SOLID_SKETCH_PRESETS: SolidPreset[] = [
  {
    id: "cuboid",
    title: "직육면체",
    hint: "꼭짓점 이름",
    state: baseState({
      family: "prism",
      sides: 4,
      width: 6,
      depth: 4,
      height: 5,
      showVertexNames: true,
    }),
  },
  {
    id: "tri-pyramid",
    title: "삼각뿔",
    hint: "높이·밑면",
    state: baseState({
      family: "pyramid",
      sides: 3,
      baseSize: 8,
      height: 9,
      showVertexNames: true,
      showHeight: true,
      showHeightRightAngle: true,
      showBaseEdge: true,
    }),
  },
  {
    id: "penta-prism",
    title: "오각기둥",
    hint: "꼭짓점 이름",
    state: baseState({
      family: "prism",
      sides: 5,
      baseSize: 4,
      height: 7,
      showVertexNames: true,
    }),
  },
  {
    id: "cyl-side",
    title: "가로 원기둥",
    hint: "반지름·높이",
    state: baseState({
      family: "cylinder",
      radius: 2,
      height: 5,
      cylinderLie: "horizontal",
      showVertexNames: false,
      showCenter: true,
      showRadius: true,
      showHeight: true,
    }),
  },
  {
    id: "cone",
    title: "원뿔",
    hint: "모선·반지름",
    state: baseState({
      family: "cone",
      radius: 6,
      height: 6.708,
      showVertexNames: false,
      showCenter: true,
      showRadius: true,
      showSlant: true,
    }),
  },
  {
    id: "tetra",
    title: "정사면체",
    hint: "한 모서리",
    state: baseState({
      family: "platonic",
      platonic: "tetrahedron",
      edgeLength: 6,
      showVertexNames: true,
      showBaseEdge: true,
    }),
  },
];

export const DEFAULT_SOLID_SKETCH_STATE: SolidSketchState = structuredClone(
  SOLID_SKETCH_PRESETS[0]!.state,
);

export function cloneState(state: SolidSketchState): SolidSketchState {
  return structuredClone(state);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function defaultVertexNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    i < 26 ? String.fromCharCode(65 + i) : `P${i + 1}`,
  );
}

export function normalizeState(state: SolidSketchState): SolidSketchState {
  const sides = Math.round(clamp(state.sides, 3, 8));
  const style = { ...DEFAULT_STYLE, ...state.style };
  return {
    ...state,
    sides,
    width: clamp(state.width, 0.5, 40),
    depth: clamp(state.depth, 0.5, 40),
    height: clamp(state.height, 0.5, 40),
    baseSize: clamp(state.baseSize, 0.5, 40),
    topSize: clamp(state.topSize, 0.4, 40),
    radius: clamp(state.radius, 0.4, 40),
    topRadius: clamp(state.topRadius, 0.3, 40),
    edgeLength: clamp(state.edgeLength, 0.5, 40),
    azimuthDeg: ((state.azimuthDeg % 360) + 360) % 360,
    elevationDeg: clamp(state.elevationDeg, 6, 82),
    vertexNames: Array.isArray(state.vertexNames) ? state.vertexNames : [],
    nameDx: Array.isArray(state.nameDx) ? state.nameDx : [],
    nameDy: Array.isArray(state.nameDy) ? state.nameDy : [],
    edgeLabels: state.edgeLabels ?? {},
    heightLabel: { ...emptyLabel(), ...state.heightLabel },
    radiusLabel: { ...emptyLabel(), ...state.radiusLabel },
    slantLabel: { ...emptyLabel(), ...state.slantLabel },
    baseEdgeLabel: { ...emptyLabel(), ...state.baseEdgeLabel },
    unit: state.unit?.trim() ? state.unit : "cm",
    unknownLetter: /^[A-Za-z]$/.test(state.unknownLetter) ? state.unknownLetter : "x",
    style: {
      ...style,
      lineWidth: clamp(style.lineWidth, 1, 3.5),
      fontSize: clamp(style.fontSize, 12, 64),
      pointLabelSize: clamp(style.pointLabelSize, 14, 72),
      pointRadius: clamp(style.pointRadius, 2, 10),
      padding: clamp(style.padding, 28, 90),
      exportScale: clamp(style.exportScale, 2, 4),
    },
  };
}

export function labelUnknownLetter(label: MeasLabel, fallback: string): string {
  const fromLabel = label.custom.trim();
  if (/^[A-Za-z]$/.test(fromLabel)) return fromLabel;
  return fallback.trim() || "x";
}

export function resolveLabelText(
  label: MeasLabel,
  autoValue: number,
  unit: string,
  unknownLetter: string,
): string | null {
  if (label.mode === "hide") return null;
  if (label.mode === "x") {
    const u = unit.trim();
    const math = `$${labelUnknownLetter(label, unknownLetter)}$`;
    return u ? `${math} ${u}` : math;
  }
  if (label.mode === "custom") {
    const t = label.custom.trim();
    return t.length > 0 ? t : null;
  }
  return formatMeasure(autoValue, unit);
}

export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export const FAMILY_OPTIONS: { id: SolidFamily; label: string }[] = [
  { id: "prism", label: "각기둥" },
  { id: "pyramid", label: "각뿔" },
  { id: "frustum", label: "각뿔대" },
  { id: "cylinder", label: "원기둥" },
  { id: "cone", label: "원뿔" },
  { id: "coneFrustum", label: "원뿔대" },
  { id: "platonic", label: "정다면체" },
];

export const PLATONIC_OPTIONS: { id: PlatonicKind; label: string }[] = [
  { id: "tetrahedron", label: "정사면체" },
  { id: "cube", label: "정육면체" },
  { id: "octahedron", label: "정팔면체" },
  { id: "dodecahedron", label: "정십이면체" },
  { id: "icosahedron", label: "정이십면체" },
];

export function familyNeedsSides(family: SolidFamily): boolean {
  return family === "prism" || family === "pyramid" || family === "frustum";
}

export function familyIsRound(family: SolidFamily): boolean {
  return family === "cylinder" || family === "cone" || family === "coneFrustum";
}

/** 원뿔·각뿔·뿔대: 모선(옆면 모서리)으로 높이를 잡을 수 있다. */
export function familyHasSlant(family: SolidFamily): boolean {
  return (
    family === "pyramid" ||
    family === "frustum" ||
    family === "cone" ||
    family === "coneFrustum"
  );
}

export function resetView(state: SolidSketchState): SolidSketchState {
  return {
    ...state,
    azimuthDeg: DEFAULT_AZIMUTH,
    elevationDeg: DEFAULT_ELEVATION,
  };
}

export function withFamily(
  state: SolidSketchState,
  family: SolidFamily,
): SolidSketchState {
  const next = normalizeState({
    ...state,
    family,
    vertexNames: [],
    nameDx: [],
    nameDy: [],
    edgeLabels: {},
    showVertexNames: !familyIsRound(family),
    showCenter: familyIsRound(family),
    showHeight: false,
    showHeightRightAngle: false,
    showRadius: familyIsRound(family) && family !== "coneFrustum" ? false : false,
    showSlant: false,
    showBaseEdge: false,
  });
  if (family === "cone") {
    next.showCenter = true;
  }
  if (family === "cylinder" || family === "coneFrustum") {
    next.showCenter = true;
  }
  return next;
}
