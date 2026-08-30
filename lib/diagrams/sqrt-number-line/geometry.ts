import { normalizeSqrtLabel } from "@/lib/diagrams/math-label";
import {
  applyLegs,
  normalizeState,
  radicand,
  sqrtLength,
  type SqrtNumberLineState,
} from "./model";
import type { SqrtLayout, SqrtNumberLineScene } from "./scene";
import {
  canvasFromLocal,
  localFromCanvas,
  valueFromCanvasX,
} from "./scene";

export type Vec = { x: number; y: number };

export type FigureVertices = {
  O: Vec;
  A: Vec;
  B?: Vec;
  C?: Vec;
};

export type SqrtHit =
  | { kind: "label"; id: string }
  | { kind: "point"; id: "O" | "A" | "B" | "C" | "P" | "Q" }
  | { kind: "axis"; value: number };

export function figureVertices(state: SqrtNumberLineState): FigureVertices {
  const { legA, legB, kind, shapeSide } = state;
  const O: Vec = { x: 0, y: 0 };
  if (kind === "square") {
    const A: Vec = { x: legA, y: legB };
    const C: Vec = { x: -legB, y: legA };
    const B: Vec = { x: legA - legB, y: legA + legB };
    return { O, A, B, C };
  }
  const bx = shapeSide === "left" ? -legA : legA;
  const B: Vec = { x: bx, y: 0 };
  const A: Vec = { x: bx, y: legB };
  return { O, A, B };
}

export function axisPointValues(state: SqrtNumberLineState): { P: number; Q: number } {
  const r = sqrtLength(state);
  return { P: state.origin + r, Q: state.origin - r };
}

export function parseLabelId(
  id: string,
):
  | { key: "O" | "A" | "B" | "C" | "P" | "Q" | "posValue" | "negValue" | "posCombined" | "negCombined" }
  | null {
  if (id === "label:pos") return { key: "posCombined" };
  if (id === "label:neg") return { key: "negCombined" };
  const m = id.match(/^name:(O|A|B|C|P|Q)$/) ?? id.match(/^value:(pos|neg)$/);
  if (!m) return null;
  if (m[0].startsWith("value:")) {
    return { key: m[1] === "pos" ? "posValue" : "negValue" };
  }
  return { key: m[1] as "O" | "A" | "B" | "C" | "P" | "Q" };
}

function distToSeg(
  p: Vec,
  a: Vec,
  b: Vec,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

type Candidate = { hit: SqrtHit; weight: number };

function consider(
  best: Candidate | null,
  hit: SqrtHit,
  d: number,
  max: number,
  bias: number,
): Candidate | null {
  if (d > max) return best;
  const weight = d + bias;
  if (best && weight >= best.weight) return best;
  return { hit, weight };
}

export function hitTestSqrtNumberLine(
  state: SqrtNumberLineState,
  scene: SqrtNumberLineScene,
  x: number,
  y: number,
  hitScale = 1,
): SqrtHit | null {
  const s = Number.isFinite(hitScale) && hitScale > 0 ? hitScale : 1;
  const layout = scene.layout;
  let best: Candidate | null = null;

  for (const text of scene.texts) {
    const parsed = parseLabelId(text.id);
    if (!parsed) continue;
    best = consider(
      best,
      { kind: "label", id: text.id },
      Math.hypot(text.x - x, text.y - y),
      20 * s,
      3,
    );
  }

  const verts = figureVertices(state);
  const { P: pVal, Q: qVal } = axisPointValues(state);
  const O = canvasFromLocal(layout, state.origin, verts.O);
  best = consider(
    best,
    { kind: "point", id: "O" },
    Math.hypot(x - O.x, y - O.y),
    16 * s,
    0,
  );

  const A = canvasFromLocal(layout, state.origin, verts.A);
  best = consider(
    best,
    { kind: "point", id: "A" },
    Math.hypot(x - A.x, y - A.y),
    16 * s,
    2,
  );

  if (verts.B) {
    const B = canvasFromLocal(layout, state.origin, verts.B);
    best = consider(best, { kind: "point", id: "B" }, Math.hypot(x - B.x, y - B.y), 16 * s, 2);
  }
  if (verts.C) {
    const C = canvasFromLocal(layout, state.origin, verts.C);
    best = consider(best, { kind: "point", id: "C" }, Math.hypot(x - C.x, y - C.y), 16 * s, 2);
  }

  if (state.showPosPoint) {
    const px = layout.axisX(pVal);
    best = consider(best, { kind: "point", id: "P" }, Math.hypot(x - px, y - layout.axisY), 16 * s, 1);
  }
  if (state.showNegPoint) {
    const qx = layout.axisX(qVal);
    best = consider(best, { kind: "point", id: "Q" }, Math.hypot(x - qx, y - layout.axisY), 16 * s, 1);
  }

  const axisD = Math.abs(y - layout.axisY);
  if (axisD < 12 * s && x >= layout.left && x <= layout.right) {
    best = consider(
      best,
      { kind: "axis", value: valueFromCanvasX(x, layout) },
      axisD,
      12 * s,
      6,
    );
  }

  if (state.showShape && state.kind === "triangle" && verts.B) {
    const Bc = canvasFromLocal(layout, state.origin, verts.B);
    const d = distToSeg({ x, y }, O, A);
    best = consider(best, { kind: "point", id: "A" }, d, 10 * s, 8);
    const d2 = distToSeg({ x, y }, O, Bc);
    best = consider(best, { kind: "point", id: "B" }, d2, 10 * s, 8);
  }

  return best?.hit ?? null;
}

export function moveOrigin(
  state: SqrtNumberLineState,
  value: number,
): SqrtNumberLineState {
  return normalizeState({
    ...state,
    origin: value,
    posValueRaw: "",
    negValueRaw: "",
  });
}

export function moveVertexA(
  state: SqrtNumberLineState,
  local: Vec,
): SqrtNumberLineState {
  const snapped = {
    x: Math.min(8, Math.max(-8, Math.round(local.x))),
    y: Math.min(8, Math.max(1, Math.round(local.y))),
  };
  if (state.kind === "square") {
    if (snapped.x === 0 && snapped.y === 0) return state;
    const legA = Math.abs(snapped.x);
    const legB = snapped.y;
    if (!Number.isFinite(legA) || !Number.isFinite(legB)) return state;
    return applyLegs(state, legA, legB);
  }
  const legA = Math.abs(snapped.x);
  const legB = snapped.y;
  if (legA < 1 || legB < 1) return state;
  const shapeSide = snapped.x < 0 ? "left" : "right";
  return normalizeState({
    ...applyLegs(state, legA, legB),
    shapeSide,
  });
}

export function nudgeLabel(
  state: SqrtNumberLineState,
  id: string,
  dx: number,
  dy: number,
): SqrtNumberLineState {
  const parsed = parseLabelId(id);
  if (!parsed) return state;
  if (parsed.key === "posValue" || parsed.key === "negValue") return state;
  const nameKey =
    parsed.key === "posCombined" ? "P" : parsed.key === "negCombined" ? "Q" : parsed.key;
  const names = { ...state.names };
  const cur = names[nameKey];
  names[nameKey] = {
    ...cur,
    dx: cur.dx + dx,
    dy: cur.dy + dy,
  };
  return { ...state, names };
}

export function applyEditedLabel(
  state: SqrtNumberLineState,
  id: string,
  raw: string,
): SqrtNumberLineState {
  const text = normalizeSqrtLabel(raw.trim());
  const parsed = parseLabelId(id);
  if (!parsed) return state;
  if (parsed.key === "posValue") return { ...state, posValueRaw: text };
  if (parsed.key === "negValue") return { ...state, negValueRaw: text };
  if (parsed.key === "posCombined") {
    const m = text.match(/^([A-Za-z])\((.+)\)$/);
    if (m) {
      return {
        ...state,
        posPointName: m[1]!,
        posValueRaw: m[2]!.startsWith("$") ? m[2]! : `$${m[2]!}$`,
      };
    }
    return { ...state, posValueRaw: text };
  }
  if (parsed.key === "negCombined") {
    const m = text.match(/^([A-Za-z])\((.+)\)$/);
    if (m) {
      return {
        ...state,
        negPointName: m[1]!,
        negValueRaw: m[2]!.startsWith("$") ? m[2]! : `$${m[2]!}$`,
      };
    }
    return { ...state, negValueRaw: text };
  }
  const names = { ...state.names };
  names[parsed.key] = { ...names[parsed.key], name: text || parsed.key };
  return { ...state, names };
}

export function snapLocalFromCanvas(
  state: SqrtNumberLineState,
  layout: SqrtLayout,
  canvasX: number,
  canvasY: number,
): Vec {
  return localFromCanvas(layout, state.origin, canvasX, canvasY);
}

export function gridRowsNeeded(state: SqrtNumberLineState): number {
  const verts = figureVertices(state);
  let maxY = state.legB;
  if (verts.B) maxY = Math.max(maxY, verts.B.y);
  if (verts.C) maxY = Math.max(maxY, verts.C.y);
  return Math.ceil(maxY) + 1;
}

export function suggestedAxisRange(state: SqrtNumberLineState): { min: number; max: number } {
  const r = sqrtLength(state);
  const pad = 1;
  return {
    min: Math.floor(state.origin - r - pad),
    max: Math.ceil(state.origin + r + pad),
  };
}

export function posValueNumber(state: SqrtNumberLineState): number {
  return state.origin + sqrtLength(state);
}

export function negValueNumber(state: SqrtNumberLineState): number {
  return state.origin - sqrtLength(state);
}

export function matchesRadicand(state: SqrtNumberLineState, n: number): boolean {
  return radicand(state) === Math.round(n);
}
