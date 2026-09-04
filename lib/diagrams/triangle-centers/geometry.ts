import {
  add,
  clamp,
  edgeLength,
  isConvex,
  len,
  moveVertex as movePolygonVertex,
  mul,
  norm,
  parseAngleInput,
  parseMeasureInput,
  sub,
  vertexAngles,
} from "@/lib/diagrams/polygon/geometry";
import { emptyLabel, type MeasLabel, type Vec } from "@/lib/diagrams/polygon/model";
import {
  CIRCUMCENTER_NAME,
  EDGE_FEET,
  INCENTER_NAME,
  VERTEX_IDS,
  angleId,
  fromPolygonState,
  lengthId,
  normalizeState,
  toPolygonState,
  triangleFromAngles,
  vertexId,
  vertexIndex,
  type AngleMark,
  type CenterKind,
  type LengthMark,
  type PointId,
  type TriangleCentersState,
} from "./model";

export type CentersHit =
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string }
  | { kind: "vertex"; index: 0 | 1 | 2 }
  | { kind: "center"; which: CenterKind }
  | { kind: "angleWedge"; at: PointId; from: PointId; to: PointId }
  | { kind: "segment"; a: PointId; b: PointId };

export type CentersSelection =
  | { t: "vertex"; i: 0 | 1 | 2 }
  | { t: "center"; which: CenterKind }
  | { t: "angle"; id: string }
  | { t: "length"; id: string };

export type Derived = {
  A: Vec;
  B: Vec;
  C: Vec;
  O: Vec;
  I: Vec;
  circumR: number;
  inR: number;
  cFeet: [Vec, Vec, Vec];
  iFeet: [Vec, Vec, Vec];
  cOnSeg: [boolean, boolean, boolean];
  iOnSeg: [boolean, boolean, boolean];
  vertices: [Vec, Vec, Vec];
};

const MIN_EDGE = 0.35;
const MIN_ANG = 8;
const MAX_ANG = 164;
const RIGHT_EPS = 0.75;

export function isRightDeg(deg: number): boolean {
  return Number.isFinite(deg) && Math.abs(deg - 90) < RIGHT_EPS;
}

export function circumcenter(A: Vec, B: Vec, C: Vec): Vec | null {
  const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
  if (Math.abs(d) < 1e-10) return null;
  const a2 = A.x * A.x + A.y * A.y;
  const b2 = B.x * B.x + B.y * B.y;
  const c2 = C.x * C.x + C.y * C.y;
  return {
    x: (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d,
    y: (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d,
  };
}

export function incenter(A: Vec, B: Vec, C: Vec): Vec {
  const a = len(sub(B, C));
  const b = len(sub(A, C));
  const c = len(sub(A, B));
  const p = a + b + c;
  if (p < 1e-9) return A;
  return {
    x: (a * A.x + b * B.x + c * C.x) / p,
    y: (a * A.y + b * B.y + c * C.y) / p,
  };
}

export function distToLine(P: Vec, A: Vec, B: Vec): number {
  const ab = sub(B, A);
  const l = len(ab);
  if (l < 1e-9) return len(sub(P, A));
  return Math.abs((P.x - A.x) * (B.y - A.y) - (P.y - A.y) * (B.x - A.x)) / l;
}

export function perpFoot(P: Vec, A: Vec, B: Vec): { foot: Vec; t: number } {
  const ab = sub(B, A);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < 1e-12) return { foot: A, t: 0 };
  const t = (sub(P, A).x * ab.x + sub(P, A).y * ab.y) / l2;
  return { foot: add(A, mul(ab, t)), t };
}

export function tangentLengths(A: Vec, B: Vec, C: Vec): [number, number, number] {
  const a = len(sub(B, C));
  const b = len(sub(A, C));
  const c = len(sub(A, B));
  const s = (a + b + c) / 2;
  return [s - a, s - b, s - c];
}

function onSeg(t: number): boolean {
  return t >= -0.04 && t <= 1.04;
}

export function derive(state: TriangleCentersState): Derived | null {
  const [A, B, C] = state.points;
  if (!A || !B || !C) return null;
  const O = circumcenter(A, B, C);
  if (!O) return null;
  const I = incenter(A, B, C);
  const sides: [Vec, Vec][] = [
    [A, B],
    [B, C],
    [C, A],
  ];
  const cFeet: Vec[] = [];
  const iFeet: Vec[] = [];
  const cOnSeg: boolean[] = [];
  const iOnSeg: boolean[] = [];
  for (const [p, q] of sides) {
    const cf = perpFoot(O, p, q);
    const inf = perpFoot(I, p, q);
    cFeet.push(cf.foot);
    iFeet.push(inf.foot);
    cOnSeg.push(onSeg(cf.t));
    iOnSeg.push(onSeg(inf.t));
  }
  return {
    A,
    B,
    C,
    O,
    I,
    circumR: len(sub(O, A)),
    inR: distToLine(I, B, C),
    cFeet: [cFeet[0]!, cFeet[1]!, cFeet[2]!],
    iFeet: [iFeet[0]!, iFeet[1]!, iFeet[2]!],
    cOnSeg: [cOnSeg[0]!, cOnSeg[1]!, cOnSeg[2]!],
    iOnSeg: [iOnSeg[0]!, iOnSeg[1]!, iOnSeg[2]!],
    vertices: [A, B, C],
  };
}

export function pointPos(d: Derived, id: PointId): Vec | null {
  switch (id) {
    case "A":
      return d.A;
    case "B":
      return d.B;
    case "C":
      return d.C;
    case "O":
      return d.O;
    case "I":
      return d.I;
    case "c0":
      return d.cFeet[0];
    case "c1":
      return d.cFeet[1];
    case "c2":
      return d.cFeet[2];
    case "i0":
      return d.iFeet[0];
    case "i1":
      return d.iFeet[1];
    case "i2":
      return d.iFeet[2];
    default:
      return null;
  }
}

export function displayName(state: TriangleCentersState, id: PointId): string {
  const vi = vertexIndex(id);
  if (vi != null) return state.vertexNames[vi] || vertexId(vi);
  if (id === "O") return state.circum.name.trim() || CIRCUMCENTER_NAME;
  if (id === "I") return state.incenter.name.trim() || INCENTER_NAME;
  if (id === "c0") return state.circum.footNames[0] || "D";
  if (id === "c1") return state.circum.footNames[1] || "E";
  if (id === "c2") return state.circum.footNames[2] || "F";
  if (id === "i0") return state.incenter.footNames[0] || "D";
  if (id === "i1") return state.incenter.footNames[1] || "E";
  if (id === "i2") return state.incenter.footNames[2] || "F";
  return id;
}

export function showCircumFootName(state: TriangleCentersState, edge: number): boolean {
  return (
    state.circum.on &&
    state.circum.perps[edge] === true &&
    state.circum.showFeet[edge] === true
  );
}

export function showInFootName(state: TriangleCentersState, edge: number): boolean {
  return (
    state.incenter.on &&
    state.incenter.perps[edge] === true &&
    state.incenter.showFeet[edge] === true
  );
}

export type Ray = { id: PointId; pos: Vec };

export function raysFrom(state: TriangleCentersState, d: Derived, at: PointId): Ray[] {
  const rays: Ray[] = [];
  const push = (id: PointId) => {
    const pos = pointPos(d, id);
    if (pos) rays.push({ id, pos });
  };
  if (at === "A" || at === "B" || at === "C") {
    const i = vertexIndex(at)!;
    push(vertexId((i + 1) % 3));
    push(vertexId((i + 2) % 3));
    if (state.circum.on && state.circum.rays[i]) push("O");
    if (state.incenter.on && state.incenter.rays[i]) push("I");
    return rays;
  }
  if (at === "O" && state.circum.on) {
    if (state.circum.rays[0]) push("A");
    if (state.circum.rays[1]) push("B");
    if (state.circum.rays[2]) push("C");
    return rays;
  }
  if (at === "I" && state.incenter.on) {
    if (state.incenter.rays[0]) push("A");
    if (state.incenter.rays[1]) push("B");
    if (state.incenter.rays[2]) push("C");
  }
  return rays;
}

function normalizeAng(a: number): number {
  let t = a % (Math.PI * 2);
  if (t < 0) t += Math.PI * 2;
  return t;
}

function ccwSpan(from: number, to: number): number {
  let d = normalizeAng(to) - normalizeAng(from);
  if (d < 0) d += Math.PI * 2;
  return d;
}

export function consecutiveWedges(
  at: Vec,
  rays: Ray[],
): { from: PointId; to: PointId }[] {
  if (rays.length < 2) return [];
  const sorted = rays
    .map((r) => ({ ...r, ang: Math.atan2(r.pos.y - at.y, r.pos.x - at.x) }))
    .sort((a, b) => a.ang - b.ang);
  const out: { from: PointId; to: PointId }[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i]!;
    const b = sorted[(i + 1) % sorted.length]!;
    const span = ccwSpan(a.ang, b.ang);
    if (span < 1e-4 || span > Math.PI + 1e-4) continue;
    out.push({ from: a.id, to: b.id });
  }
  return out;
}

export function angleDegAt(d: Derived, at: PointId, from: PointId, to: PointId): number {
  const p = pointPos(d, at);
  const a = pointPos(d, from);
  const b = pointPos(d, to);
  if (!p || !a || !b) return 0;
  return vertexAngles([a, p, b], 1).interior;
}

export function lengthBetween(d: Derived, a: PointId, b: PointId): number {
  const pa = pointPos(d, a);
  const pb = pointPos(d, b);
  if (!pa || !pb) return 0;
  return len(sub(pb, pa));
}

export type VisibleSeg = { a: PointId; b: PointId };

export function visibleSegments(state: TriangleCentersState, d: Derived): VisibleSeg[] {
  const segs: VisibleSeg[] = [];
  const splitIn = state.incenter.on && state.incenter.perps.some(Boolean);
  const splitCirc = state.circum.on && state.circum.perps.some(Boolean) && !splitIn;
  for (let i = 0; i < 3; i += 1) {
    const u = vertexId(i);
    const v = vertexId((i + 1) % 3);
    const inOn = state.incenter.on && state.incenter.perps[i] && d.iOnSeg[i];
    const cOn = state.circum.on && state.circum.perps[i] && d.cOnSeg[i];
    if (inOn) {
      const foot = EDGE_FEET[i]!.in;
      segs.push({ a: u, b: foot }, { a: v, b: foot });
    } else if (cOn && splitCirc) {
      const foot = EDGE_FEET[i]!.circum;
      segs.push({ a: u, b: foot }, { a: v, b: foot });
    } else {
      segs.push({ a: u, b: v });
    }
    void splitCirc;
  }
  if (state.circum.on) {
    for (let i = 0; i < 3; i += 1) {
      if (state.circum.rays[i]) segs.push({ a: "O", b: vertexId(i) });
      if (state.circum.perps[i] && d.cOnSeg[i]) segs.push({ a: "O", b: EDGE_FEET[i]!.circum });
    }
  }
  if (state.incenter.on) {
    for (let i = 0; i < 3; i += 1) {
      if (state.incenter.rays[i]) segs.push({ a: "I", b: vertexId(i) });
      if (state.incenter.perps[i] && d.iOnSeg[i]) segs.push({ a: "I", b: EDGE_FEET[i]!.in });
    }
  }
  return segs;
}

export function isFullVertexAngle(mark: Pick<AngleMark, "at" | "from" | "to">): boolean {
  const at = vertexIndex(mark.at);
  const from = vertexIndex(mark.from);
  const to = vertexIndex(mark.to);
  if (at == null || from == null || to == null) return false;
  const others = new Set([from, to]);
  return others.size === 2 && !others.has(at);
}

export function isFullSide(mark: Pick<LengthMark, "a" | "b">): boolean {
  return vertexIndex(mark.a) != null && vertexIndex(mark.b) != null;
}

export function sideIndex(a: PointId, b: PointId): 0 | 1 | 2 | null {
  const ia = vertexIndex(a);
  const ib = vertexIndex(b);
  if (ia == null || ib == null) return null;
  const d = Math.abs(ia - ib);
  if (d === 1) return Math.min(ia, ib) as 0 | 1;
  if (d === 2) return 2;
  return null;
}

function validTriangle(points: Vec[]): boolean {
  if (points.length !== 3 || !isConvex(points)) return false;
  for (let i = 0; i < 3; i += 1) {
    if (edgeLength(points, i) < MIN_EDGE) return false;
  }
  return circumcenter(points[0]!, points[1]!, points[2]!) != null;
}

export function moveVertex(
  state: TriangleCentersState,
  index: number,
  next: Vec,
): TriangleCentersState {
  const poly = movePolygonVertex(toPolygonState(state), index, next);
  if (!validTriangle(poly.points)) return state;
  return fromPolygonState(poly, state);
}

export function triangleAngles(points: Vec[]): [number, number, number] {
  return [
    vertexAngles(points, 0).interior,
    vertexAngles(points, 1).interior,
    vertexAngles(points, 2).interior,
  ];
}

function oppositeVertex(a: 0 | 1 | 2, b: 0 | 1 | 2): 0 | 1 | 2 {
  return (3 - a - b) as 0 | 1 | 2;
}

export type AngleReshape =
  | { type: "vertex"; index: 0 | 1 | 2 }
  | { type: "circum-half"; opposite: 0 | 1 | 2 }
  | { type: "in-half"; index: 0 | 1 | 2 }
  | { type: "circum-central"; opposite: 0 | 1 | 2 }
  | { type: "in-central"; opposite: 0 | 1 | 2 };

export function angleReshapeKind(mark: AngleMark): AngleReshape | null {
  const atV = vertexIndex(mark.at);
  const fromV = vertexIndex(mark.from);
  const toV = vertexIndex(mark.to);
  if (atV != null && fromV != null && toV != null && fromV !== toV) {
    return { type: "vertex", index: atV };
  }
  if (atV != null) {
    const center =
      mark.from === "O" || mark.to === "O"
        ? "O"
        : mark.from === "I" || mark.to === "I"
          ? "I"
          : null;
    const other = mark.from === "O" || mark.from === "I" ? mark.to : mark.from;
    const side = vertexIndex(other);
    if (center === "O" && side != null && side !== atV) {
      return { type: "circum-half", opposite: oppositeVertex(atV, side) };
    }
    if (center === "I" && side != null && side !== atV) {
      return { type: "in-half", index: atV };
    }
  }
  if (mark.at === "O" && fromV != null && toV != null && fromV !== toV) {
    return { type: "circum-central", opposite: oppositeVertex(fromV, toV) };
  }
  if (mark.at === "I" && fromV != null && toV != null && fromV !== toV) {
    return { type: "in-central", opposite: oppositeVertex(fromV, toV) };
  }
  return null;
}

export function interiorTargetFromDisplayed(
  kind: AngleReshape,
  displayedDeg: number,
): { index: 0 | 1 | 2; deg: number } | null {
  if (kind.type === "vertex") return { index: kind.index, deg: displayedDeg };
  if (kind.type === "circum-half") return { index: kind.opposite, deg: 90 - displayedDeg };
  if (kind.type === "in-half") return { index: kind.index, deg: displayedDeg * 2 };
  if (kind.type === "circum-central") return { index: kind.opposite, deg: displayedDeg / 2 };
  return { index: kind.opposite, deg: 2 * (displayedDeg - 90) };
}

function rebuildOnBase(
  degA: number,
  degB: number,
  degC: number,
  baseBC: number,
): [Vec, Vec, Vec] | null {
  if (degA < MIN_ANG || degB < MIN_ANG || degC < MIN_ANG) return null;
  if (degA > MAX_ANG || degB > MAX_ANG || degC > MAX_ANG) return null;
  const pts = triangleFromAngles(degA, degB, degC, clamp(baseBC, 0.8, 40));
  if (!validTriangle(pts)) return null;
  return pts;
}

function orientationSign(A: Vec, B: Vec, C: Vec): 1 | -1 {
  const cross = (C.x - B.x) * (A.y - B.y) - (C.y - B.y) * (A.x - B.x);
  return cross < 0 ? -1 : 1;
}

function clampTriangleSide(other1: number, other2: number, want: number): number {
  const max = Math.min(40, other1 + other2 - MIN_EDGE);
  const min = Math.max(0.8, Math.abs(other1 - other2) + MIN_EDGE);
  if (!(max > min)) return clamp(want, 0.8, 40);
  return clamp(want, min, max);
}

/** SSS: B at origin, C at (BC, 0), A above or below to match `sign`. */
function triangleFromSides(
  sideBC: number,
  sideCA: number,
  sideAB: number,
  sign: 1 | -1 = 1,
): [Vec, Vec, Vec] | null {
  const a = sideBC;
  const b = sideCA;
  const c = sideAB;
  if (a < MIN_EDGE || b < MIN_EDGE || c < MIN_EDGE) return null;
  if (a + b <= c + 1e-6 || b + c <= a + 1e-6 || c + a <= b + 1e-6) return null;
  const x = (c * c + a * a - b * b) / (2 * a);
  const y2 = c * c - x * x;
  if (y2 < 1e-10) return null;
  const y = sign * Math.sqrt(y2);
  const pts: [Vec, Vec, Vec] = [{ x, y }, { x: 0, y: 0 }, { x: a, y: 0 }];
  if (!validTriangle(pts)) return null;
  return pts;
}

/** Keep BC as the horizontal base. Other two angles keep their current ratio. */
export function applyVertexAngle(
  state: TriangleCentersState,
  index: number,
  deg: number,
): TriangleCentersState {
  const i = index as 0 | 1 | 2;
  if (i !== 0 && i !== 1 && i !== 2) return state;
  const angs = triangleAngles(state.points);
  const target = clamp(deg, MIN_ANG, MAX_ANG);
  const rest = 180 - target;
  const j = ((i + 1) % 3) as 0 | 1 | 2;
  const k = ((i + 2) % 3) as 0 | 1 | 2;
  const sum = Math.max(angs[j] + angs[k], 1e-6);
  let jDeg = rest * (angs[j] / sum);
  let kDeg = rest - jDeg;
  if (jDeg < MIN_ANG) {
    jDeg = MIN_ANG;
    kDeg = rest - MIN_ANG;
  }
  if (kDeg < MIN_ANG) {
    kDeg = MIN_ANG;
    jDeg = rest - MIN_ANG;
  }
  const next: [number, number, number] = [angs[0], angs[1], angs[2]];
  next[i] = target;
  next[j] = jDeg;
  next[k] = kDeg;
  const bc = len(sub(state.points[2]!, state.points[1]!));
  const pts = rebuildOnBase(next[0], next[1], next[2], bc);
  if (!pts) return state;
  return normalizeState({ ...state, points: pts });
}

export function applyDisplayedAngle(
  state: TriangleCentersState,
  mark: AngleMark,
  displayedDeg: number,
): TriangleCentersState {
  const kind = angleReshapeKind(mark);
  if (!kind) return state;
  const target = interiorTargetFromDisplayed(kind, displayedDeg);
  if (!target) return state;
  return applyVertexAngle(state, target.index, target.deg);
}

/** Keep the other two sides; rebuild ABC so this edge matches. BC stays horizontal. */
export function applySideLength(
  state: TriangleCentersState,
  edgeIndex: number,
  length: number,
): TriangleCentersState {
  const [A, B, C] = state.points;
  const ab = len(sub(A, B));
  const bc = len(sub(B, C));
  const ca = len(sub(C, A));
  let a = bc;
  let b = ca;
  let c = ab;
  if (edgeIndex === 0) c = clampTriangleSide(a, b, length);
  else if (edgeIndex === 1) a = clampTriangleSide(b, c, length);
  else if (edgeIndex === 2) b = clampTriangleSide(a, c, length);
  else return state;
  const pts = triangleFromSides(a, b, c, orientationSign(A, B, C));
  if (!pts) return state;
  return normalizeState({ ...state, points: pts, referenceEdgeLength: a });
}

/** Sides: SSS with the other two lengths kept. Other marks: uniform scale. BC stays horizontal. */
export function applyDisplayedLength(
  state: TriangleCentersState,
  mark: Pick<LengthMark, "a" | "b">,
  length: number,
): TriangleCentersState {
  if (isFullSide(mark)) {
    const edge = sideIndex(mark.a, mark.b);
    if (edge != null) return applySideLength(state, edge, length);
  }
  const d = derive(state);
  if (!d) return state;
  const current = lengthBetween(d, mark.a, mark.b);
  if (current < 1e-8) return state;
  const [degA, degB, degC] = triangleAngles(state.points);
  const bc = len(sub(state.points[2]!, state.points[1]!));
  const pts = rebuildOnBase(degA, degB, degC, bc * (clamp(length, 0.35, 40) / current));
  if (!pts) return state;
  return normalizeState({ ...state, points: pts });
}

export function findAngle(
  state: TriangleCentersState,
  at: PointId,
  from: PointId,
  to: PointId,
): AngleMark | undefined {
  const id = angleId(at, from, to);
  return state.angles.find((a) => a.id === id);
}

export function findLength(
  state: TriangleCentersState,
  a: PointId,
  b: PointId,
): LengthMark | undefined {
  const id = lengthId(a, b);
  return state.lengths.find((m) => m.id === id);
}

export function toggleAngle(
  state: TriangleCentersState,
  at: PointId,
  from: PointId,
  to: PointId,
): TriangleCentersState {
  const id = angleId(at, from, to);
  if (state.angles.some((a) => a.id === id)) {
    return { ...state, angles: state.angles.filter((a) => a.id !== id) };
  }
  return {
    ...state,
    angles: [
      ...state.angles,
      { id, at, from, to, label: emptyLabel("auto"), fill: false },
    ],
  };
}

export function toggleLength(
  state: TriangleCentersState,
  a: PointId,
  b: PointId,
): TriangleCentersState {
  const id = lengthId(a, b);
  if (state.lengths.some((m) => m.id === id)) {
    return { ...state, lengths: state.lengths.filter((m) => m.id !== id) };
  }
  return {
    ...state,
    lengths: [...state.lengths, { id, a, b, label: emptyLabel("auto") }],
  };
}

export function toggleFullVertexAngle(
  state: TriangleCentersState,
  i: 0 | 1 | 2,
): TriangleCentersState {
  const at = vertexId(i);
  const from = vertexId((i + 1) % 3);
  const to = vertexId((i + 2) % 3);
  return toggleAngle(state, at, from, to);
}

export function fullVertexOn(state: TriangleCentersState, i: 0 | 1 | 2): boolean {
  const at = vertexId(i);
  const from = vertexId((i + 1) % 3);
  const to = vertexId((i + 2) % 3);
  return Boolean(findAngle(state, at, from, to));
}

function labelFromParse(
  parsed: ReturnType<typeof parseMeasureInput>,
  text: string,
  prev: MeasLabel,
  asAngle: boolean,
): MeasLabel {
  if (parsed.kind === "unknown") {
    return { ...prev, mode: "x", custom: parsed.unknown ?? "x" };
  }
  if (parsed.kind === "number" && parsed.value != null) {
    const custom = asAngle ? `${parsed.value}°` : text.trim() || String(parsed.value);
    return { ...prev, mode: "custom", custom };
  }
  if (!text.trim()) return { ...prev, mode: "hide", custom: "" };
  return { ...prev, mode: "custom", custom: text.trim() };
}

export function applyEditedLabel(
  state: TriangleCentersState,
  id: string,
  text: string,
): TriangleCentersState {
  const nameMatch = /^name:(.+)$/.exec(id);
  if (nameMatch) {
    const key = nameMatch[1]!;
    if (key === "A" || key === "B" || key === "C") {
      const i = vertexIndex(key)!;
      const vertexNames = [...state.vertexNames] as [string, string, string];
      vertexNames[i] = text.trim() || vertexNames[i];
      return { ...state, vertexNames };
    }
    if (key === "O")
      return { ...state, circum: { ...state.circum, name: text.trim() || CIRCUMCENTER_NAME } };
    if (key === "I")
      return { ...state, incenter: { ...state.incenter, name: text.trim() || INCENTER_NAME } };
    const foot = /^(c|i)([012])$/.exec(key);
    if (foot) {
      const idx = Number(foot[2]) as 0 | 1 | 2;
      const which = foot[1] === "c" ? "circum" : "incenter";
      const names = [...state[which].footNames] as [string, string, string];
      names[idx] = text.trim() || names[idx];
      return { ...state, [which]: { ...state[which], footNames: names } };
    }
    return state;
  }
  const angMatch = /^ang:/.exec(id);
  if (angMatch) {
    const mark = state.angles.find((a) => a.id === id);
    if (!mark) return state;
    const parsed = parseAngleInput(text);
    const label = labelFromParse(parsed, text, mark.label, true);
    let next: TriangleCentersState = {
      ...state,
      angles: state.angles.map((a) => (a.id === id ? { ...a, label } : a)),
    };
    if (parsed.kind === "number" && parsed.value != null) {
      next = applyDisplayedAngle(next, { ...mark, label }, parsed.value);
    }
    return next;
  }
  const lenMatch = /^len:/.exec(id);
  if (lenMatch) {
    const mark = state.lengths.find((m) => m.id === id);
    if (!mark) return state;
    const parsed = parseMeasureInput(text);
    const label = labelFromParse(parsed, text, mark.label, false);
    let next: TriangleCentersState = {
      ...state,
      lengths: state.lengths.map((m) => (m.id === id ? { ...m, label } : m)),
    };
    if (parsed.kind === "number" && parsed.value != null) {
      next = applyDisplayedLength(next, mark, parsed.value);
    }
    return next;
  }
  return state;
}

export function nudgeLabel(
  state: TriangleCentersState,
  id: string,
  dx: number,
  dy: number,
  lineOnly: boolean,
): TriangleCentersState {
  const nameMatch = /^name:(.+)$/.exec(id);
  if (nameMatch) {
    const key = nameMatch[1]!;
    const lim = (n: number) => clamp(n, -80, 80);
    if (key === "A" || key === "B" || key === "C") {
      const i = vertexIndex(key)!;
      const vertexNameDx = [...state.vertexNameDx] as [number, number, number];
      const vertexNameDy = [...state.vertexNameDy] as [number, number, number];
      vertexNameDx[i] = lim(vertexNameDx[i]! + dx);
      vertexNameDy[i] = lim(vertexNameDy[i]! + dy);
      return { ...state, vertexNameDx, vertexNameDy };
    }
    if (key === "O") {
      return {
        ...state,
        circum: {
          ...state.circum,
          nameDx: lim(state.circum.nameDx + dx),
          nameDy: lim(state.circum.nameDy + dy),
        },
      };
    }
    if (key === "I") {
      return {
        ...state,
        incenter: {
          ...state.incenter,
          nameDx: lim(state.incenter.nameDx + dx),
          nameDy: lim(state.incenter.nameDy + dy),
        },
      };
    }
    return state;
  }
  if (id.startsWith("ang:")) {
    return {
      ...state,
      angles: state.angles.map((a) =>
        a.id === id
          ? {
              ...a,
              label: {
                ...a.label,
                dx: clamp(a.label.dx + dx, -80, 80),
                dy: clamp(a.label.dy + dy, -80, 80),
              },
            }
          : a,
      ),
    };
  }
  if (id.startsWith("len:")) {
    return {
      ...state,
      lengths: state.lengths.map((m) => {
        if (m.id !== id) return m;
        if (lineOnly) {
          return {
            ...m,
            label: { ...m.label, lineDy: clamp((m.label.lineDy ?? 0) + dy, -160, 160) },
          };
        }
        return {
          ...m,
          label: {
            ...m.label,
            dx: clamp(m.label.dx + dx, -80, 80),
            dy: clamp(m.label.dy + dy, -160, 160),
          },
        };
      }),
    };
  }
  return state;
}

export function patchAngle(
  state: TriangleCentersState,
  id: string,
  patch: Partial<AngleMark>,
): TriangleCentersState {
  return {
    ...state,
    angles: state.angles.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}

export function patchLength(
  state: TriangleCentersState,
  id: string,
  patch: Partial<LengthMark>,
): TriangleCentersState {
  return {
    ...state,
    lengths: state.lengths.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  };
}

export function clearSelectionMarks(
  state: TriangleCentersState,
  sel: CentersSelection | null,
): TriangleCentersState {
  if (!sel) return state;
  if (sel.t === "angle") {
    return { ...state, angles: state.angles.filter((a) => a.id !== sel.id) };
  }
  if (sel.t === "length") {
    return { ...state, lengths: state.lengths.filter((m) => m.id !== sel.id) };
  }
  if (sel.t === "vertex") {
    const next = {
      ...state,
      vertexRights: state.vertexRights.map((v, i) =>
        i === sel.i ? false : v,
      ) as typeof state.vertexRights,
    };
    return fullVertexOn(next, sel.i) ? toggleFullVertexAngle(next, sel.i) : next;
  }
  return state;
}

function distToSeg(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
  return Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t));
}

function inWedge(click: Vec, at: Vec, a: Vec, b: Vec): boolean {
  const t = Math.atan2(click.y - at.y, click.x - at.x);
  const a0 = Math.atan2(a.y - at.y, a.x - at.x);
  const a1 = Math.atan2(b.y - at.y, b.x - at.x);
  const span = ccwSpan(a0, a1) <= Math.PI ? ccwSpan(a0, a1) : ccwSpan(a1, a0);
  const from = ccwSpan(a0, a1) <= Math.PI ? a0 : a1;
  const d = ccwSpan(from, t);
  return d > 1e-4 && d < span - 1e-4;
}

export function hitTestCenters(
  state: TriangleCentersState,
  canvasPts: Record<string, Vec>,
  texts: { id: string; x: number; y: number }[],
  cmds: { t: string; id?: string; x1?: number; y1?: number; x2?: number; y2?: number }[],
  x: number,
  y: number,
  scale = 1,
): CentersHit | null {
  const labelR = 22 * Math.max(scale, 0.85);
  let bestText: { id: string; d: number } | null = null;
  for (const text of texts) {
    const dist = Math.hypot(text.x - x, text.y - y);
    if (dist < labelR && (!bestText || dist < bestText.d)) {
      bestText = { id: text.id, d: dist };
    }
  }
  if (bestText) {
    if (bestText.id.endsWith(":line")) {
      return { kind: "dimLine", id: bestText.id.slice(0, -5) };
    }
    return { kind: "label", id: bestText.id };
  }

  const pointR = 14 * Math.max(scale, 0.85);
  const click = { x, y };
  for (let i = 0; i < 3; i += 1) {
    const p = canvasPts[VERTEX_IDS[i]!];
    if (p && Math.hypot(p.x - x, p.y - y) < pointR) {
      return { kind: "vertex", index: i as 0 | 1 | 2 };
    }
  }
  if (state.circum.on && canvasPts.O) {
    if (Math.hypot(canvasPts.O.x - x, canvasPts.O.y - y) < pointR) {
      return { kind: "center", which: "circum" };
    }
  }
  if (state.incenter.on && canvasPts.I) {
    if (Math.hypot(canvasPts.I.x - x, canvasPts.I.y - y) < pointR) {
      return { kind: "center", which: "in" };
    }
  }

  const dimR = 10 * Math.max(scale, 0.85);
  let bestDim: CentersHit | null = null;
  let bestDimD = dimR;
  for (const cmd of cmds) {
    if (!cmd.id || !cmd.id.endsWith(":line")) continue;
    const id = cmd.id.slice(0, -5);
    if (cmd.t === "line" && cmd.x1 != null && cmd.y1 != null && cmd.x2 != null && cmd.y2 != null) {
      const dist = distToSeg(x, y, cmd.x1, cmd.y1, cmd.x2, cmd.y2);
      if (dist < bestDimD) {
        bestDimD = dist;
        bestDim = { kind: "dimLine", id };
      }
    }
  }
  if (bestDim) return bestDim;

  const d = derive(state);
  if (!d) return null;

  const wedgeMin = 16 * Math.max(scale, 0.85);
  const wedgeMax = 48 * Math.max(scale, 0.85);
  const ats: PointId[] = ["A", "B", "C"];
  if (state.circum.on) ats.push("O");
  if (state.incenter.on) ats.push("I");
  for (const atId of ats) {
    const at = canvasPts[atId];
    if (!at) continue;
    const dist = Math.hypot(click.x - at.x, click.y - at.y);
    if (dist < wedgeMin || dist > wedgeMax) continue;
    const mathRays = raysFrom(state, d, atId);
    const canvasRays: Ray[] = [];
    for (const r of mathRays) {
      const pos = canvasPts[r.id];
      if (pos) canvasRays.push({ id: r.id, pos });
    }
    for (const w of consecutiveWedges(at, canvasRays)) {
      const from = canvasPts[w.from];
      const to = canvasPts[w.to];
      if (!from || !to) continue;
      if (inWedge(click, at, from, to)) {
        return { kind: "angleWedge", at: atId, from: w.from, to: w.to };
      }
    }
  }

  const edgeR = 9 * Math.max(scale, 0.85);
  let bestSeg: VisibleSeg | null = null;
  let bestEd = edgeR;
  for (const seg of visibleSegments(state, d)) {
    const a = canvasPts[seg.a];
    const b = canvasPts[seg.b];
    if (!a || !b) continue;
    const dist = distToSeg(x, y, a.x, a.y, b.x, b.y);
    if (dist < bestEd) {
      bestEd = dist;
      bestSeg = seg;
    }
  }
  if (bestSeg) return { kind: "segment", a: bestSeg.a, b: bestSeg.b };
  return null;
}

export { VERTEX_IDS };
