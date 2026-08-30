import {
  applyEditedLabel as applyPolygonLabel,
  applyEdgeLengthChange,
  applyInteriorAngleChange,
  centroid,
  edgeLength,
  hitTestPolygon,
  isConvex,
  moveVertex,
  nudgeLabel as nudgePolygonLabel,
} from "@/lib/diagrams/polygon/geometry";
import { emptyLabel, type PolygonState } from "@/lib/diagrams/polygon/model";
import {
  fromPolygonA,
  similarScale,
  toPolygonA,
  toPolygonB,
  type FigureId,
  type SimilarFiguresState,
  type Vec,
} from "./model";

export type SimilarHit =
  | { figure: FigureId; kind: "vertex"; index: number }
  | { figure: FigureId; kind: "edge"; index: number }
  | { figure: "b"; kind: "body" }
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string };

export type SimilarSelection =
  | { figure: FigureId; t: "vertex"; i: number }
  | { figure: FigureId; t: "edge"; i: number };

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

export function bbox(pts: Vec[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  return { minX, minY, maxX, maxY };
}

function rotateVec(v: Vec, deg: number): Vec {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function transformOrigin(state: SimilarFiguresState): Vec {
  if (state.showGrid && state.points[0]) return state.points[0]!;
  return centroid(state.points);
}

/** Figure B in math coords, still at the transform origin (not yet placed). */
export function figureBLocal(state: SimilarFiguresState): Vec[] {
  const origin = transformOrigin(state);
  const scale = similarScale(state);
  return state.points.map((p) => {
    let x = (p.x - origin.x) * scale;
    let y = (p.y - origin.y) * scale;
    if (state.reflect === "horizontal") x = -x;
    if (state.reflect === "vertical") y = -y;
    const r = rotateVec({ x, y }, state.rotateDeg);
    return { x: origin.x + r.x, y: origin.y + r.y };
  });
}

function layoutGap(state: SimilarFiguresState, boxA: BBox): number {
  if (state.showGrid) return 2;
  return Math.max(1.4, 0.38 * Math.max(boxA.maxX - boxA.minX, 1));
}

/** Figure B after scale / reflect / rotate and side-by-side placement. */
export function figureBPoints(state: SimilarFiguresState): Vec[] {
  const local = figureBLocal(state);
  const boxA = bbox(state.points);
  const boxB = bbox(local);
  const gap = layoutGap(state, boxA);
  let dx = boxA.maxX + gap - boxB.minX;
  let dy = (boxA.minY + boxA.maxY) / 2 - (boxB.minY + boxB.maxY) / 2;
  if (state.showGrid) {
    dx = Math.round(dx);
    dy = Math.round(dy);
  }
  dx += state.shiftB.x;
  dy += state.shiftB.y;
  return local.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function snapPoint(p: Vec, on: boolean): Vec {
  if (!on) return p;
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

export function moveSourceVertex(
  state: SimilarFiguresState,
  index: number,
  next: Vec,
): SimilarFiguresState {
  const snapped = snapPoint(next, state.snapToGrid);
  const poly = toPolygonA(state);
  const moved = moveVertex(poly, index, snapped);
  return fromPolygonA(state, moved);
}

export function shiftFigureB(
  state: SimilarFiguresState,
  dx: number,
  dy: number,
): SimilarFiguresState {
  return {
    ...state,
    shiftB: {
      x: Math.min(40, Math.max(-40, state.shiftB.x + dx)),
      y: Math.min(40, Math.max(-40, state.shiftB.y + dy)),
    },
  };
}

export function snapShiftB(state: SimilarFiguresState): SimilarFiguresState {
  if (!state.snapToGrid) return state;
  return {
    ...state,
    shiftB: {
      x: Math.round(state.shiftB.x),
      y: Math.round(state.shiftB.y),
    },
  };
}

export function parseFigureId(id: string): { figure: FigureId; rest: string } | null {
  if (id.startsWith("a:")) return { figure: "a", rest: id.slice(2) };
  if (id.startsWith("b:")) return { figure: "b", rest: id.slice(2) };
  return null;
}

function pointInPolygon(pts: Vec[], x: number, y: number): boolean {
  let inside = false;
  const n = pts.length;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const pi = pts[i]!;
    const pj = pts[j]!;
    const intersect =
      pi.y > y !== pj.y > y &&
      x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y + 1e-12) + pi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function hitTestSimilar(
  canvasA: Vec[],
  canvasB: Vec[],
  texts: { id: string; x: number; y: number }[],
  cmds: {
    t: string;
    id?: string;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }[],
  x: number,
  y: number,
  scale = 1,
): SimilarHit | null {
  const labels = hitTestPolygon([], texts, cmds, x, y, scale);
  if (labels?.kind === "label" || labels?.kind === "dimLine") return labels;

  const aHit = hitTestPolygon(canvasA, [], [], x, y, scale);
  const bHit = hitTestPolygon(canvasB, [], [], x, y, scale);

  if (aHit?.kind === "vertex" && bHit?.kind === "vertex") {
    const da = Math.hypot(canvasA[aHit.index]!.x - x, canvasA[aHit.index]!.y - y);
    const db = Math.hypot(canvasB[bHit.index]!.x - x, canvasB[bHit.index]!.y - y);
    return da <= db
      ? { figure: "a", kind: "vertex", index: aHit.index }
      : { figure: "b", kind: "vertex", index: bHit.index };
  }
  if (aHit?.kind === "vertex") return { figure: "a", kind: "vertex", index: aHit.index };
  if (bHit?.kind === "vertex") return { figure: "b", kind: "vertex", index: bHit.index };

  const dim = hitTestPolygon([], [], cmds, x, y, scale);
  if (dim?.kind === "dimLine") return dim;

  if (aHit?.kind === "edge") return { figure: "a", kind: "edge", index: aHit.index };
  if (bHit?.kind === "edge") return { figure: "b", kind: "edge", index: bHit.index };

  if (pointInPolygon(canvasB, x, y)) return { figure: "b", kind: "body" };
  return null;
}

export function applySimilarLabel(
  state: SimilarFiguresState,
  id: string,
  text: string,
): SimilarFiguresState {
  const parsed = parseFigureId(id);
  if (!parsed) return state;
  if (parsed.figure === "a") {
    const next = applyPolygonLabel(toPolygonA(state), parsed.rest, text);
    return fromPolygonA(state, next);
  }
  const pointsB = figureBPoints(state);
  const next = applyPolygonLabel(toPolygonB(state, pointsB), parsed.rest, text);
  return { ...state, verticesB: next.vertices, edgesB: next.edges };
}

export function nudgeSimilarLabel(
  state: SimilarFiguresState,
  id: string,
  dx: number,
  dy: number,
  lineOnly: boolean,
): SimilarFiguresState {
  const parsed = parseFigureId(id);
  if (!parsed) return state;
  if (parsed.figure === "a") {
    const next = nudgePolygonLabel(toPolygonA(state), parsed.rest, dx, dy, lineOnly);
    return fromPolygonA(state, next);
  }
  const pointsB = figureBPoints(state);
  const next = nudgePolygonLabel(toPolygonB(state, pointsB), parsed.rest, dx, dy, lineOnly);
  return { ...state, verticesB: next.vertices, edgesB: next.edges };
}

export function applySourceAngle(
  state: SimilarFiguresState,
  index: number,
  deg: number,
): SimilarFiguresState {
  const next = applyInteriorAngleChange(toPolygonA(state), index, deg);
  return fromPolygonA(state, next);
}

export function applySourceLength(
  state: SimilarFiguresState,
  index: number,
  length: number,
): SimilarFiguresState {
  const next = applyEdgeLengthChange(toPolygonA(state), index, length);
  return fromPolygonA(state, next);
}

export function toggleEdgeLength(
  state: SimilarFiguresState,
  figure: FigureId,
  index: number,
): SimilarFiguresState {
  if (figure === "a") {
    return {
      ...state,
      edgesA: state.edgesA.map((e, i) =>
        i === index ? { ...e, showLength: !e.showLength } : e,
      ),
    };
  }
  return {
    ...state,
    edgesB: state.edgesB.map((e, i) =>
      i === index ? { ...e, showLength: !e.showLength } : e,
    ),
  };
}

export function toggleInterior(
  state: SimilarFiguresState,
  figure: FigureId,
  index: number,
): SimilarFiguresState {
  const key = figure === "a" ? "verticesA" : "verticesB";
  return {
    ...state,
    [key]: state[key].map((v, i) =>
      i === index ? { ...v, showInterior: !v.showInterior } : v,
    ),
  };
}

export function mirrorCorresponding(
  state: SimilarFiguresState,
  sel: SimilarSelection,
): SimilarFiguresState {
  if (sel.figure === "a") {
    if (sel.t === "vertex") {
      const src = state.verticesA[sel.i];
      if (!src) return state;
      return {
        ...state,
        verticesB: state.verticesB.map((v, i) =>
          i === sel.i
            ? {
                ...v,
                showInterior: src.showInterior,
                interior: { ...src.interior, dx: 0, dy: 0 },
              }
            : v,
        ),
      };
    }
    const src = state.edgesA[sel.i];
    if (!src) return state;
    return {
      ...state,
      edgesB: state.edgesB.map((e, i) =>
        i === sel.i
          ? {
              ...e,
              showLength: src.showLength,
              length: { ...src.length, dx: 0, dy: 0, lineDx: 0, lineDy: 0 },
            }
          : e,
      ),
    };
  }
  if (sel.t === "vertex") {
    const src = state.verticesB[sel.i];
    if (!src) return state;
    return {
      ...state,
      verticesA: state.verticesA.map((v, i) =>
        i === sel.i
          ? {
              ...v,
              showInterior: src.showInterior,
              interior: { ...src.interior, dx: 0, dy: 0 },
            }
          : v,
      ),
    };
  }
  const src = state.edgesB[sel.i];
  if (!src) return state;
  return {
    ...state,
    edgesA: state.edgesA.map((e, i) =>
      i === sel.i
        ? {
            ...e,
            showLength: src.showLength,
            length: { ...src.length, dx: 0, dy: 0, lineDx: 0, lineDy: 0 },
          }
        : e,
    ),
  };
}

export function clearSelectionMarks(
  state: SimilarFiguresState,
  sel: SimilarSelection | null,
): SimilarFiguresState {
  if (!sel) return state;
  if (sel.t === "vertex") {
    const key = sel.figure === "a" ? "verticesA" : "verticesB";
    return {
      ...state,
      [key]: state[key].map((v, i) =>
        i === sel.i
          ? {
              ...v,
              showInterior: false,
              showExterior: false,
              fillExterior: false,
              interior: emptyLabel("auto"),
              exterior: emptyLabel("auto"),
            }
          : v,
      ),
    };
  }
  const key = sel.figure === "a" ? "edgesA" : "edgesB";
  return {
    ...state,
    [key]: state[key].map((e, i) =>
      i === sel.i ? { ...e, showLength: false, length: emptyLabel("auto") } : e,
    ),
  };
}

export function correspondingOn(
  state: SimilarFiguresState,
  sel: SimilarSelection,
): boolean {
  if (sel.t === "vertex") {
    const a = state.verticesA[sel.i];
    const b = state.verticesB[sel.i];
    return Boolean(a?.showInterior && b?.showInterior);
  }
  const a = state.edgesA[sel.i];
  const b = state.edgesB[sel.i];
  return Boolean(a?.showLength && b?.showLength);
}

export function sourceEdgeLength(state: SimilarFiguresState, i: number): number {
  return edgeLength(state.points, i);
}

export function figureBEdgeLength(state: SimilarFiguresState, i: number): number {
  return edgeLength(figureBPoints(state), i);
}

export function isConvexSource(state: SimilarFiguresState): boolean {
  return isConvex(state.points);
}

export function asPolygonForDraw(
  state: SimilarFiguresState,
  figure: FigureId,
): PolygonState {
  if (figure === "a") return toPolygonA(state);
  return toPolygonB(state, figureBPoints(state));
}
