import { formatNiceNumber } from "@/lib/diagrams/math-label";
import {
  DEFAULT_STYLE,
  defaultVertexName,
  emptyLabel,
  normalizeState as normalizePolygon,
  type DiagramStyle,
  type EdgeMark,
  type MeasLabel,
  type PolygonState,
  type Vec,
  type VertexMark,
} from "@/lib/diagrams/polygon/model";
import { parseMeasureInput, regularPolygon } from "@/lib/diagrams/polygon/geometry";

export type { DiagramStyle, EdgeMark, MeasLabel, Vec, VertexMark };
export { DEFAULT_STYLE, defaultVertexName, emptyLabel };

export type FigureId = "a" | "b";
export type ReflectMode = "none" | "horizontal" | "vertical";

export type SimilarFiguresState = {
  points: Vec[];
  verticesA: VertexMark[];
  edgesA: EdgeMark[];
  verticesB: VertexMark[];
  edgesB: EdgeMark[];
  /** 닮음비 앞항 (도형 A) */
  ratioA: number;
  /** 닮음비 뒷항 (도형 B) */
  ratioB: number;
  rotateDeg: number;
  reflect: ReflectMode;
  /** Extra translation of figure B after auto layout (math units). */
  shiftB: Vec;
  showGrid: boolean;
  snapToGrid: boolean;
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
  state: SimilarFiguresState;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function makeVertex(i: number, patch: Partial<VertexMark> = {}): VertexMark {
  return {
    name: defaultVertexName(i),
    nameDx: 0,
    nameDy: 0,
    showInterior: false,
    showExterior: false,
    fillExterior: false,
    interior: emptyLabel("auto"),
    exterior: emptyLabel("auto"),
    ...patch,
  };
}

function makeEdge(patch: Partial<EdgeMark> = {}): EdgeMark {
  return { showLength: false, length: emptyLabel("auto"), ...patch };
}

function customLength(value: string): MeasLabel {
  return { ...emptyLabel("custom"), custom: value };
}

function customAngle(value: string): MeasLabel {
  return { ...emptyLabel("custom"), custom: value };
}

/** Law of sines: A at index 0, B at 1, C at 2, side BC = sideBC. */
export function triangleFromAngles(
  degA: number,
  degB: number,
  degC: number,
  sideBC = 5,
): Vec[] {
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

export function similarScale(state: Pick<SimilarFiguresState, "ratioA" | "ratioB">): number {
  const a = state.ratioA;
  if (!Number.isFinite(a) || Math.abs(a) < 1e-9) return 1;
  return state.ratioB / a;
}

export function cloneState(state: SimilarFiguresState): SimilarFiguresState {
  return structuredClone(state);
}

export function toPolygonA(state: SimilarFiguresState): PolygonState {
  return normalizePolygon({
    points: state.points,
    vertices: state.verticesA,
    edges: state.edgesA,
    diagonals: [],
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  });
}

export function toPolygonB(
  state: SimilarFiguresState,
  pointsB: Vec[],
): PolygonState {
  return normalizePolygon({
    points: pointsB,
    vertices: state.verticesB,
    edges: state.edgesB,
    diagonals: [],
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  });
}

export function fromPolygonA(
  state: SimilarFiguresState,
  poly: PolygonState,
): SimilarFiguresState {
  return normalizeState({
    ...state,
    points: poly.points,
    verticesA: poly.vertices,
    edgesA: poly.edges,
    style: poly.style,
    showVertexNames: poly.showVertexNames,
    showDots: poly.showDots,
    unit: poly.unit,
    unknownLetter: poly.unknownLetter,
  });
}

export function defaultNames(n: number, start = 0): string[] {
  return Array.from({ length: n }, (_, i) => defaultVertexName(i + start));
}

export function resetVertexNames(state: SimilarFiguresState): SimilarFiguresState {
  const n = state.points.length;
  return {
    ...state,
    verticesA: state.verticesA.map((v, i) => ({
      ...v,
      name: defaultVertexName(i),
    })),
    verticesB: state.verticesB.map((v, i) => ({
      ...v,
      name: defaultVertexName(i + n),
    })),
  };
}

function padMarks(
  n: number,
  vertices: VertexMark[] | undefined,
  edges: EdgeMark[] | undefined,
  nameStart: number,
): { vertices: VertexMark[]; edges: EdgeMark[] } {
  const verts = Array.from({ length: n }, (_, i) =>
    makeVertex(i + nameStart, vertices?.[i] ? { ...vertices[i], name: vertices[i]!.name } : { name: defaultVertexName(i + nameStart) }),
  );
  const eds = Array.from({ length: n }, (_, i) => makeEdge(edges?.[i]));
  return { vertices: verts, edges: eds };
}

export function normalizeState(
  state: Partial<SimilarFiguresState> & Pick<SimilarFiguresState, "points"> | SimilarFiguresState,
): SimilarFiguresState {
  const poly = normalizePolygon({
    points: state.points,
    vertices: state.verticesA,
    edges: state.edgesA,
    diagonals: [],
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: { ...DEFAULT_STYLE, ...state.style },
  });
  const n = poly.points.length;
  const a = padMarks(n, state.verticesA ?? poly.vertices, state.edgesA ?? poly.edges, 0);
  const b = padMarks(n, state.verticesB, state.edgesB, n);
  const ratioA = clamp(
    Number.isFinite(state.ratioA) ? Number(state.ratioA) : 1,
    0.1,
    40,
  );
  const ratioB = clamp(
    Number.isFinite(state.ratioB) ? Number(state.ratioB) : 1,
    0.1,
    40,
  );
  let rotateDeg = Number.isFinite(state.rotateDeg) ? Number(state.rotateDeg) : 0;
  rotateDeg = ((rotateDeg % 360) + 360) % 360;
  const reflect: ReflectMode =
    state.reflect === "horizontal" || state.reflect === "vertical"
      ? state.reflect
      : "none";
  const shiftB = {
    x: Number.isFinite(state.shiftB?.x) ? clamp(state.shiftB!.x, -40, 40) : 0,
    y: Number.isFinite(state.shiftB?.y) ? clamp(state.shiftB!.y, -40, 40) : 0,
  };
  const style = poly.style;
  return {
    points: poly.points,
    verticesA: a.vertices,
    edgesA: a.edges,
    verticesB: b.vertices,
    edgesB: b.edges,
    ratioA,
    ratioB,
    rotateDeg,
    reflect,
    shiftB,
    showGrid: state.showGrid === true,
    snapToGrid: state.snapToGrid !== false && state.showGrid === true
      ? true
      : Boolean(state.snapToGrid),
    showVertexNames: poly.showVertexNames,
    showDots: poly.showDots,
    unit: poly.unit,
    unknownLetter: poly.unknownLetter,
    style: {
      ...style,
      padding: clamp(style.padding, 36, 90),
    },
  };
}

export function withSideCount(state: SimilarFiguresState, n: number): SimilarFiguresState {
  const count = Math.round(clamp(n, 3, 8));
  return resetVertexNames(
    normalizeState({
      ...state,
      points: regularPolygon(count, 4),
      verticesA: [],
      edgesA: [],
      verticesB: [],
      edgesB: [],
      shiftB: { x: 0, y: 0 },
    }),
  );
}

export function setRatio(
  state: SimilarFiguresState,
  ratioA: number,
  ratioB: number,
): SimilarFiguresState {
  return normalizeState({ ...state, ratioA, ratioB });
}

export function numericCustom(label: MeasLabel): number | null {
  if (label.mode !== "custom") return null;
  const parsed = parseMeasureInput(label.custom);
  if (parsed.kind === "number" && parsed.value != null) return parsed.value;
  const ang = label.custom.trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:°|˚|도)?$/);
  if (ang) return Number(ang[1]);
  return null;
}

/** Auto length on B: scale A's custom number, else geometric length of B. */
export function autoLengthB(
  state: SimilarFiguresState,
  index: number,
  geometricB: number,
): number {
  const a = state.edgesA[index];
  if (a?.showLength) {
    const n = numericCustom(a.length);
    if (n != null) return n * similarScale(state);
  }
  return geometricB;
}

export function formatRatio(state: SimilarFiguresState): string {
  return `${formatNiceNumber(state.ratioA)}:${formatNiceNumber(state.ratioB)}`;
}

function baseState(
  points: Vec[],
  patch: Partial<SimilarFiguresState> = {},
): SimilarFiguresState {
  const n = points.length;
  return normalizeState({
    points,
    verticesA: Array.from({ length: n }, (_, i) => makeVertex(i)),
    edgesA: Array.from({ length: n }, () => makeEdge()),
    verticesB: Array.from({ length: n }, (_, i) =>
      makeVertex(i + n, { name: defaultVertexName(i + n) }),
    ),
    edgesB: Array.from({ length: n }, () => makeEdge()),
    ratioA: 1,
    ratioB: 1,
    rotateDeg: 0,
    reflect: "none",
    shiftB: { x: 0, y: 0 },
    showGrid: false,
    snapToGrid: false,
    showVertexNames: true,
    showDots: true,
    unit: "cm",
    unknownLetter: "x",
    style: { ...DEFAULT_STYLE, padding: 48 },
    ...patch,
  });
}

export const SIMILAR_PRESETS: SimilarPreset[] = [
  {
    id: "tri-5-4",
    title: "삼각형 5:4",
    hint: "대응변 · 밑각 60°",
    state: (() => {
      const points = [
        { x: 2.5, y: (5 * Math.sqrt(3)) / 2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ];
      return baseState(points, {
        ratioA: 5,
        ratioB: 4,
        verticesA: [
          makeVertex(0, { name: "A" }),
          makeVertex(1, {
            name: "B",
            showInterior: true,
            interior: customAngle("60°"),
          }),
          makeVertex(2, { name: "C" }),
        ],
        edgesA: [
          makeEdge({ showLength: true, length: customLength("5") }),
          makeEdge({ showLength: true, length: customLength("10") }),
          makeEdge(),
        ],
        verticesB: [
          makeVertex(3, { name: "D" }),
          makeVertex(4, {
            name: "E",
            showInterior: true,
            interior: customAngle("60°"),
          }),
          makeVertex(5, { name: "F" }),
        ],
        edgesB: [
          makeEdge({ showLength: true, length: customLength("4") }),
          makeEdge({ showLength: true, length: customLength("8") }),
          makeEdge(),
        ],
      });
    })(),
  },
  {
    id: "tri-mixed",
    title: "삼각형 각·변",
    hint: "9 cm · 110°",
    state: (() => {
      const points = triangleFromAngles(39, 31, 110, 6);
      return baseState(points, {
        ratioA: 3,
        ratioB: 4,
        verticesA: [
          makeVertex(0, {
            name: "A",
            showInterior: true,
            interior: customAngle("39°"),
          }),
          makeVertex(1, { name: "B" }),
          makeVertex(2, { name: "C" }),
        ],
        edgesA: [
          makeEdge({ showLength: true, length: customLength("9") }),
          makeEdge({ showLength: true, length: customLength("6") }),
          makeEdge(),
        ],
        verticesB: [
          makeVertex(3, { name: "D" }),
          makeVertex(4, { name: "E" }),
          makeVertex(5, {
            name: "F",
            showInterior: true,
            interior: customAngle("110°"),
          }),
        ],
        edgesB: [
          makeEdge(),
          makeEdge({ showLength: true, length: customLength("8") }),
          makeEdge(),
        ],
      });
    })(),
  },
  {
    id: "quad-8-10",
    title: "사각형 8:10",
    hint: "대응변 한 개",
    state: baseState(
      [
        { x: -1.8, y: 3.4 },
        { x: -0.9, y: -1.5 },
        { x: 2.6, y: -1.5 },
        { x: 3.3, y: 1.4 },
      ],
      {
        ratioA: 4,
        ratioB: 5,
        verticesA: [
          makeVertex(0, { name: "A" }),
          makeVertex(1, { name: "B" }),
          makeVertex(2, { name: "C" }),
          makeVertex(3, { name: "D" }),
        ],
        edgesA: [
          makeEdge({ showLength: true, length: customLength("8") }),
          makeEdge(),
          makeEdge(),
          makeEdge(),
        ],
        verticesB: [
          makeVertex(4, { name: "E" }),
          makeVertex(5, { name: "F" }),
          makeVertex(6, { name: "G" }),
          makeVertex(7, { name: "H" }),
        ],
        edgesB: [
          makeEdge({ showLength: true, length: customLength("10") }),
          makeEdge(),
          makeEdge(),
          makeEdge(),
        ],
      },
    ),
  },
  {
    id: "grid-kite",
    title: "모눈 사각형",
    hint: "1:2 · 좌우 대칭",
    state: baseState(
      [
        { x: 1, y: 2 },
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ],
      {
        ratioA: 1,
        ratioB: 2,
        reflect: "horizontal",
        showGrid: true,
        snapToGrid: true,
        showDots: false,
        verticesA: [
          makeVertex(0, { name: "A" }),
          makeVertex(1, { name: "B" }),
          makeVertex(2, { name: "C" }),
          makeVertex(3, { name: "D" }),
        ],
        verticesB: [
          makeVertex(4, { name: "E" }),
          makeVertex(5, { name: "F" }),
          makeVertex(6, { name: "G" }),
          makeVertex(7, { name: "H" }),
        ],
      },
    ),
  },
];

export const DEFAULT_SIMILAR_STATE: SimilarFiguresState = SIMILAR_PRESETS[0]!.state;

export const RATIO_CHIPS: { a: number; b: number; label: string }[] = [
  { a: 1, b: 1, label: "1:1" },
  { a: 1, b: 2, label: "1:2" },
  { a: 2, b: 3, label: "2:3" },
  { a: 3, b: 4, label: "3:4" },
  { a: 4, b: 5, label: "4:5" },
  { a: 5, b: 4, label: "5:4" },
];
