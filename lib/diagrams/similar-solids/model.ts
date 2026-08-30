import {
  cloneState,
  DEFAULT_SOLID_SKETCH_STATE,
  normalizeState,
  type SolidSketchState,
} from "@/lib/diagrams/solid-sketch/model";
import { buildSolidMesh } from "@/lib/diagrams/solid-sketch/solids";

export type SimilarSolidsState = {
  source: SolidSketchState;
  ratioLeft: number;
  ratioRight: number;
  showFigureLabels: boolean;
  leftFigureLabel: string;
  rightFigureLabel: string;
  leftFigureDx: number;
  leftFigureDy: number;
  rightFigureDx: number;
  rightFigureDy: number;
  rightVertexNames: string[];
};

export type SimilarSolidsPreset = {
  id: string;
  title: string;
  hint: string;
  state: SimilarSolidsState;
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function makeSource(
  patch: Partial<SolidSketchState> & Pick<SolidSketchState, "family">,
): SolidSketchState {
  return normalizeState({
    ...cloneState(DEFAULT_SOLID_SKETCH_STATE),
    vertexModes: [],
    vertexNames: [],
    nameDx: [],
    nameDy: [],
    edgeLabels: {},
    showFill: true,
    showHidden: true,
    showHeight: false,
    showHeightRightAngle: false,
    showFaceHeight: false,
    showRadius: false,
    showSlant: false,
    showBaseEdge: false,
    showCenter: false,
    vertexModesDefault: "names",
    ...patch,
  });
}

function pairState(
  source: SolidSketchState,
  ratioLeft: number,
  ratioRight: number,
  extra: Partial<SimilarSolidsState> = {},
): SimilarSolidsState {
  return normalizeSimilarState({
    source,
    ratioLeft,
    ratioRight,
    showFigureLabels: false,
    leftFigureLabel: "A",
    rightFigureLabel: "B",
    leftFigureDx: 0,
    leftFigureDy: 0,
    rightFigureDx: 0,
    rightFigureDy: 0,
    rightVertexNames: [],
    ...extra,
  });
}

export const SIMILAR_SOLIDS_PRESETS: SimilarSolidsPreset[] = [
  {
    id: "tri-prism",
    title: "삼각기둥 3:5",
    hint: "높이",
    state: pairState(
      makeSource({
        family: "prism",
        sides: 3,
        baseSize: 4.5,
        height: 3,
        showHeight: true,
      }),
      3,
      5,
    ),
  },
  {
    id: "tri-pyramid",
    title: "삼각뿔 A·B",
    hint: "도형 이름",
    state: pairState(
      makeSource({
        family: "pyramid",
        sides: 3,
        baseSize: 6,
        height: 7,
        vertexModesDefault: "hidden",
      }),
      3,
      5,
      { showFigureLabels: true },
    ),
  },
  {
    id: "cuboid",
    title: "직육면체 2:3",
    hint: "가로·높이",
    state: pairState(
      makeSource({
        family: "prism",
        sides: 4,
        width: 6,
        depth: 4,
        height: 8,
        showHeight: true,
        showBaseEdge: true,
      }),
      2,
      3,
    ),
  },
  {
    id: "cylinder",
    title: "원기둥 1:2",
    hint: "높이·이름",
    state: pairState(
      makeSource({
        family: "cylinder",
        radius: 1.2,
        height: 2,
        vertexModesDefault: "hidden",
        showHeight: true,
      }),
      1,
      2,
      { showFigureLabels: true },
    ),
  },
  {
    id: "cone",
    title: "원뿔 2:3",
    hint: "높이·반지름",
    state: pairState(
      makeSource({
        family: "cone",
        radius: 2,
        height: 4,
        vertexModesDefault: "hidden",
        showHeight: true,
        showRadius: true,
        showCenter: true,
      }),
      2,
      3,
      { showFigureLabels: true },
    ),
  },
  {
    id: "sq-pyramid",
    title: "사각뿔 2:3",
    hint: "높이·밑면",
    state: pairState(
      makeSource({
        family: "pyramid",
        sides: 4,
        baseSize: 5,
        height: 6,
        showHeight: true,
        showBaseEdge: true,
      }),
      2,
      3,
    ),
  },
];

export const DEFAULT_SIMILAR_SOLIDS_STATE: SimilarSolidsState = structuredClone(
  SIMILAR_SOLIDS_PRESETS[0]!.state,
);

export function cloneSimilarState(state: SimilarSolidsState): SimilarSolidsState {
  return structuredClone(state);
}

export function similarityScale(state: SimilarSolidsState): number {
  const left = Math.max(state.ratioLeft, 1e-6);
  return state.ratioRight / left;
}

export function scaleSolidState(source: SolidSketchState, k: number): SolidSketchState {
  const factor = Number.isFinite(k) && k > 0 ? k : 1;
  return normalizeState({
    ...source,
    width: source.width * factor,
    depth: source.depth * factor,
    height: source.height * factor,
    baseSize: source.baseSize * factor,
    topSize: source.topSize * factor,
    radius: source.radius * factor,
    topRadius: source.topRadius * factor,
    capHeight: source.capHeight * factor,
    edgeLength: source.edgeLength * factor,
  });
}

export function continuedVertexNames(leftNames: string[], count: number): string[] {
  let code = 65;
  for (const name of leftNames) {
    const t = name.trim();
    if (/^[A-Z]$/.test(t)) code = Math.max(code, t.charCodeAt(0) + 1);
  }
  return Array.from({ length: count }, (_, i) => {
    const next = code + i;
    if (next <= 90) return String.fromCharCode(next);
    return `P${next - 90}`;
  });
}

export function pairSolidStates(state: SimilarSolidsState): {
  left: SolidSketchState;
  right: SolidSketchState;
} {
  const left = state.source;
  const k = similarityScale(state);
  const rightScaled = scaleSolidState(left, k);
  const leftNames = buildSolidMesh(left).names;
  const rightCount = buildSolidMesh(rightScaled).names.length;
  const autoRight = continuedVertexNames(leftNames, rightCount);
  const rightNames = autoRight.map((name, i) => {
    const custom = state.rightVertexNames[i]?.trim();
    return custom && custom.length > 0 ? custom : name;
  });
  return {
    left,
    right: { ...rightScaled, vertexNames: rightNames },
  };
}

export function normalizeSimilarState(state: SimilarSolidsState): SimilarSolidsState {
  const leftLabel = state.leftFigureLabel?.trim() || "A";
  const rightLabel = state.rightFigureLabel?.trim() || "B";
  return {
    source: normalizeState(state.source),
    ratioLeft: clamp(state.ratioLeft, 0.1, 40),
    ratioRight: clamp(state.ratioRight, 0.1, 40),
    showFigureLabels: Boolean(state.showFigureLabels),
    leftFigureLabel: leftLabel,
    rightFigureLabel: rightLabel,
    leftFigureDx: clamp(state.leftFigureDx ?? 0, -120, 120),
    leftFigureDy: clamp(state.leftFigureDy ?? 0, -80, 80),
    rightFigureDx: clamp(state.rightFigureDx ?? 0, -120, 120),
    rightFigureDy: clamp(state.rightFigureDy ?? 0, -80, 80),
    rightVertexNames: Array.isArray(state.rightVertexNames)
      ? state.rightVertexNames
      : [],
  };
}

export function patchSource(
  state: SimilarSolidsState,
  patch: Partial<SolidSketchState> | ((prev: SolidSketchState) => SolidSketchState),
): SimilarSolidsState {
  const source =
    typeof patch === "function" ? patch(state.source) : { ...state.source, ...patch };
  return normalizeSimilarState({ ...state, source });
}
