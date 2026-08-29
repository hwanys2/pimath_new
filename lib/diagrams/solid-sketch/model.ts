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
  | "sphere"
  | "hemisphere"
  | "coneHemisphere"
  | "cylinderHemisphere"
  | "cylinderCone"
  | "platonic";

export type PlatonicKind =
  | "tetrahedron"
  | "cube"
  | "octahedron"
  | "dodecahedron"
  | "icosahedron";

export type CylinderLie = "vertical" | "horizontal";

/** 꼭짓점 표시: 이름+점 → 점만 → 숨김 */
export type VertexDisplayMode = "names" | "dots" | "hidden";

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
  capHeight: number;
  edgeLength: number;
  cylinderLie: CylinderLie;
  hemisphereFlip: boolean;
  /** 인덱스별 표시. 비어 있으면 vertexModesDefault 사용 */
  vertexModes: VertexDisplayMode[];
  vertexModesDefault: VertexDisplayMode;
  azimuthDeg: number;
  elevationDeg: number;
  showFill: boolean;
  showHidden: boolean;
  showHeight: boolean;
  showHeightRightAngle: boolean;
  showFaceHeight: boolean;
  showRadius: boolean;
  showSlant: boolean;
  showBaseEdge: boolean;
  showCenter: boolean;
  vertexNames: string[];
  nameDx: number[];
  nameDy: number[];
  heightLabel: MeasLabel;
  faceHeightLabel: MeasLabel;
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
    capHeight: 5,
    edgeLength: 5,
    cylinderLie: "vertical",
    hemisphereFlip: false,
    vertexModes: [],
    vertexModesDefault: "names",
    azimuthDeg: DEFAULT_AZIMUTH,
    elevationDeg: DEFAULT_ELEVATION,
    showFill: true,
    showHidden: true,
    showHeight: false,
    showHeightRightAngle: false,
    showFaceHeight: false,
    showRadius: false,
    showSlant: false,
    showBaseEdge: false,
    showCenter: false,
    vertexNames: [],
    nameDx: [],
    nameDy: [],
    heightLabel: emptyLabel("auto"),
    faceHeightLabel: emptyLabel("auto"),
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
      showHeight: true,
      showHeightRightAngle: true,
      showBaseEdge: true,
    }),
  },
  {
    id: "square-frustum",
    title: "사각뿔대",
    hint: "옆면 높이",
    state: baseState({
      family: "frustum",
      sides: 4,
      baseSize: 5,
      topSize: 3,
      height: 3.873,
      showFaceHeight: true,
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
      vertexModesDefault: "hidden",
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
      vertexModesDefault: "hidden",
      showCenter: true,
      showRadius: true,
      showSlant: true,
    }),
  },
  {
    id: "sphere",
    title: "구",
    hint: "중심·반지름",
    state: baseState({
      family: "sphere",
      radius: 5,
      vertexModesDefault: "hidden",
      showCenter: true,
      showRadius: true,
    }),
  },
  {
    id: "hemisphere",
    title: "반구",
    hint: "중심·반지름",
    state: baseState({
      family: "hemisphere",
      radius: 5,
      vertexModesDefault: "hidden",
      showCenter: true,
      showRadius: true,
    }),
  },
  {
    id: "ice-cream",
    title: "원뿔+반구",
    hint: "같은 반지름",
    state: baseState({
      family: "coneHemisphere",
      radius: 4,
      height: 6,
      vertexModesDefault: "hidden",
      showCenter: true,
      showRadius: true,
      showHeight: true,
      showSlant: true,
    }),
  },
  {
    id: "silo",
    title: "원기둥+반구",
    hint: "같은 반지름",
    state: baseState({
      family: "cylinderHemisphere",
      radius: 3,
      height: 5,
      vertexModesDefault: "hidden",
      showCenter: true,
      showRadius: true,
      showHeight: true,
    }),
  },
  {
    id: "rocket",
    title: "원기둥+원뿔",
    hint: "같은 반지름",
    state: baseState({
      family: "cylinderCone",
      radius: 3,
      height: 5,
      capHeight: 4,
      vertexModesDefault: "hidden",
      showCenter: true,
      showRadius: true,
      showHeight: true,
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

function isVertexDisplayMode(value: unknown): value is VertexDisplayMode {
  return value === "names" || value === "dots" || value === "hidden";
}

export function vertexMode(state: SolidSketchState, index: number): VertexDisplayMode {
  const override = state.vertexModes[index];
  if (isVertexDisplayMode(override)) return override;
  return state.vertexModesDefault;
}

export function vertexDotsVisible(state: SolidSketchState, index: number): boolean {
  return vertexMode(state, index) !== "hidden";
}

export function vertexNameVisible(state: SolidSketchState, index: number): boolean {
  return vertexMode(state, index) === "names";
}

export function cycleVertexDisplay(mode: VertexDisplayMode): VertexDisplayMode {
  if (mode === "names") return "dots";
  if (mode === "dots") return "hidden";
  return "names";
}

export function vertexModeTitle(mode: VertexDisplayMode): string {
  if (mode === "names") return "점 이름";
  if (mode === "dots") return "점";
  return "안보임";
}

export function cycleVertexMode(
  state: SolidSketchState,
  index: number,
): SolidSketchState {
  const vertexModes = [...state.vertexModes];
  vertexModes[index] = cycleVertexDisplay(vertexMode(state, index));
  return { ...state, vertexModes };
}

export function defaultVertexNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    i < 26 ? String.fromCharCode(65 + i) : `P${i + 1}`,
  );
}

function normalizeVertexModesArray(raw: unknown): VertexDisplayMode[] {
  if (!Array.isArray(raw)) return [];
  const modes: VertexDisplayMode[] = [];
  for (let i = 0; i < raw.length; i++) {
    const mode = raw[i];
    if (isVertexDisplayMode(mode)) modes[i] = mode;
  }
  return modes;
}

function migrateLegacyVertexModes(raw: Partial<SolidSketchState>): {
  vertexModes: VertexDisplayMode[];
  vertexModesDefault: VertexDisplayMode;
} {
  const legacyGlobal = (() => {
    const mode = (raw as { vertexDisplay?: unknown }).vertexDisplay;
    if (isVertexDisplayMode(mode)) return mode;
    const showVertexNames = (raw as { showVertexNames?: boolean }).showVertexNames;
    if (showVertexNames === false) return "hidden" as const;
    return "names" as const;
  })();

  const hidden = Array.isArray(raw.hiddenVertexNames) ? raw.hiddenVertexNames : [];
  if (legacyGlobal === "names") {
    const vertexModes: VertexDisplayMode[] = [];
    for (let i = 0; i < hidden.length; i++) {
      if (hidden[i]) vertexModes[i] = "dots";
    }
    return { vertexModes, vertexModesDefault: "names" };
  }

  return { vertexModes: [], vertexModesDefault: legacyGlobal };
}

function resolveVertexModes(state: SolidSketchState): {
  vertexModes: VertexDisplayMode[];
  vertexModesDefault: VertexDisplayMode;
} {
  const vertexModes = normalizeVertexModesArray(state.vertexModes ?? []);
  const hasOverrides = vertexModes.some((mode) => isVertexDisplayMode(mode));
  const legacy = state as SolidSketchState & {
    vertexDisplay?: VertexDisplayMode;
    showVertexNames?: boolean;
    hiddenVertexNames?: boolean[];
  };
  const hasLegacy =
    isVertexDisplayMode(legacy.vertexDisplay) ||
    legacy.showVertexNames === false ||
    (Array.isArray(legacy.hiddenVertexNames) && legacy.hiddenVertexNames.some(Boolean));

  if (!hasOverrides && hasLegacy) {
    return migrateLegacyVertexModes(state);
  }

  return {
    vertexModes,
    vertexModesDefault: isVertexDisplayMode(state.vertexModesDefault)
      ? state.vertexModesDefault
      : "names",
  };
}

export function normalizeState(state: SolidSketchState): SolidSketchState {
  const sides = Math.round(clamp(state.sides, 3, 8));
  const style = { ...DEFAULT_STYLE, ...state.style };
  const migratedVertexModes = resolveVertexModes(state);
  const vertexModesDefault = migratedVertexModes.vertexModesDefault;

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
    capHeight: clamp(state.capHeight ?? 5, 0.5, 40),
    edgeLength: clamp(state.edgeLength, 0.5, 40),
    hemisphereFlip: Boolean(state.hemisphereFlip),
    vertexModes: migratedVertexModes.vertexModes,
    vertexModesDefault,
    azimuthDeg: ((state.azimuthDeg % 360) + 360) % 360,
    elevationDeg: clamp(state.elevationDeg, 6, 82),
    vertexNames: Array.isArray(state.vertexNames) ? state.vertexNames : [],
    nameDx: Array.isArray(state.nameDx) ? state.nameDx : [],
    nameDy: Array.isArray(state.nameDy) ? state.nameDy : [],
    edgeLabels: state.edgeLabels ?? {},
    heightLabel: { ...emptyLabel(), ...state.heightLabel },
    faceHeightLabel: { ...emptyLabel(), ...state.faceHeightLabel },
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
  { id: "sphere", label: "구" },
  { id: "hemisphere", label: "반구" },
  { id: "coneHemisphere", label: "원뿔+반구" },
  { id: "cylinderHemisphere", label: "원기둥+반구" },
  { id: "cylinderCone", label: "원기둥+원뿔" },
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

export function familyIsSphere(family: SolidFamily): boolean {
  return family === "sphere";
}

export function familyHasHemisphere(family: SolidFamily): boolean {
  return (
    family === "hemisphere" ||
    family === "coneHemisphere" ||
    family === "cylinderHemisphere"
  );
}

export function familyIsStacked(family: SolidFamily): boolean {
  return (
    family === "coneHemisphere" ||
    family === "cylinderHemisphere" ||
    family === "cylinderCone"
  );
}

/** 꼭짓점 없는 회전체·구·반구·조합. */
export function familyIsSmooth(family: SolidFamily): boolean {
  return (
    familyIsRound(family) ||
    familyIsSphere(family) ||
    familyHasHemisphere(family) ||
    family === "cylinderCone"
  );
}

/** 각뿔·각뿔대: 옆면(이등변삼각형·사다리꼴)의 수선 높이. */
export function familyHasFaceHeight(family: SolidFamily): boolean {
  return family === "pyramid" || family === "frustum";
}

/** 원뿔·각뿔·뿔대: 모선(옆면 모서리)으로 높이를 잡을 수 있다. */
export function familyHasSlant(family: SolidFamily): boolean {
  return (
    family === "pyramid" ||
    family === "frustum" ||
    family === "cone" ||
    family === "coneFrustum" ||
    family === "coneHemisphere" ||
    family === "cylinderCone"
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
    vertexModes: [],
    vertexModesDefault: "names",
    edgeLabels: {},
    showCenter: familyIsSmooth(family),
    showHeight: false,
    showHeightRightAngle: false,
    showFaceHeight: false,
    showRadius: familyIsSmooth(family),
    showSlant: false,
    showBaseEdge: false,
  });
  return next;
}
