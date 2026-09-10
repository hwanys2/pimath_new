import { add, len, mul, norm, sub } from "@/lib/diagrams/polygon/geometry";
import {
  emptyLabel,
  normalizeState,
  resolveAngleText,
  resolveLengthText,
  type AngleMark,
  type CircleTangentsState,
  type LengthMark,
  type MeasLabel,
  type NamedPoint,
  type PointDisplayMode,
  type TangentKind,
  type Vec,
} from "@/lib/diagrams/circle-tangents/model";

export type DerivedTwo = {
  O: Vec;
  P: Vec;
  A: Vec;
  B: Vec;
  r: number;
  tangentLen: number;
  opDist: number;
};

export type DerivedTri = {
  A: Vec;
  B: Vec;
  C: Vec;
  O: Vec;
  r: number;
  /** Touch on AB, BC, CA. */
  P: Vec;
  Q: Vec;
  R: Vec;
  /** Tangent lengths from A, B, C. */
  tA: number;
  tB: number;
  tC: number;
};

export type DerivedQuad = {
  O: Vec;
  r: number;
  A: Vec;
  B: Vec;
  C: Vec;
  D: Vec;
  /** Touch on AB, BC, CD, DA. */
  P: Vec;
  Q: Vec;
  R: Vec;
  S: Vec;
  /** Equal tangent segments from each vertex. */
  tA: number;
  tB: number;
  tC: number;
  tD: number;
};

export type DerivedThree = {
  A: Vec;
  B: Vec;
  C: Vec;
  O: Vec;
  r: number;
  /** Touch on AB-extension (beyond B), BC, AC-extension (beyond C). */
  D: Vec;
  E: Vec;
  F: Vec;
  tA: number;
  tB: number;
  tC: number;
};

export type TangentsSelection =
  | { t: "point"; id: string }
  | { t: "length"; id: string }
  | { t: "angle"; id: string };

function polar(angDeg: number, dist: number): Vec {
  const a = (angDeg * Math.PI) / 180;
  return { x: Math.cos(a) * dist, y: Math.sin(a) * dist };
}

function lineIntersect(p: Vec, d1: Vec, q: Vec, d2: Vec): Vec | null {
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 1e-10) return null;
  const t = ((q.x - p.x) * d2.y - (q.y - p.y) * d2.x) / cross;
  return add(p, mul(d1, t));
}

function perpFoot(P: Vec, A: Vec, B: Vec): Vec {
  const ab = sub(B, A);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < 1e-12) return A;
  const t = (sub(P, A).x * ab.x + sub(P, A).y * ab.y) / l2;
  return add(A, mul(ab, t));
}

function distToLine(P: Vec, A: Vec, B: Vec): number {
  const ab = sub(B, A);
  const l = len(ab);
  if (l < 1e-9) return len(sub(P, A));
  return Math.abs((P.x - A.x) * (B.y - A.y) - (P.y - A.y) * (B.x - A.x)) / l;
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

export function tangentLengths(A: Vec, B: Vec, C: Vec): [number, number, number] {
  const a = len(sub(B, C));
  const b = len(sub(A, C));
  const c = len(sub(A, B));
  const s = (a + b + c) / 2;
  return [s - a, s - b, s - c];
}

/** Excircle opposite A (touches BC and AB·AC extensions). */
export function excenterA(A: Vec, B: Vec, C: Vec): Vec {
  const a = len(sub(B, C));
  const b = len(sub(A, C));
  const c = len(sub(A, B));
  const den = -a + b + c;
  if (Math.abs(den) < 1e-9) return incenter(A, B, C);
  return {
    x: (-a * A.x + b * B.x + c * C.x) / den,
    y: (-a * A.y + b * B.y + c * C.y) / den,
  };
}

export function deriveTwo(state: CircleTangentsState): DerivedTwo | null {
  const r = state.radius;
  const d = Math.max(r + 0.4, state.two.opDist);
  const O: Vec = { x: 0, y: 0 };
  const P = polar(state.two.pAngleDeg, d);
  const beta = (Math.acos(Math.min(1, Math.max(-1, r / d))) * 180) / Math.PI;
  const A = polar(state.two.pAngleDeg + beta, r);
  const B = polar(state.two.pAngleDeg - beta, r);
  return {
    O,
    P,
    A,
    B,
    r,
    tangentLen: Math.sqrt(Math.max(0, d * d - r * r)),
    opDist: d,
  };
}

export function deriveTri(state: CircleTangentsState): DerivedTri | null {
  const [A, B, C] = state.tri.verts;
  if (!A || !B || !C) return null;
  const area =
    Math.abs(A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y)) / 2;
  if (area < 0.05) return null;
  const O = incenter(A, B, C);
  const r = distToLine(O, B, C);
  if (r < 0.15) return null;
  const [tA, tB, tC] = tangentLengths(A, B, C);
  const ab = norm(sub(B, A));
  const bc = norm(sub(C, B));
  const ca = norm(sub(A, C));
  return {
    A,
    B,
    C,
    O,
    r,
    P: add(A, mul(ab, tA)),
    Q: add(B, mul(bc, tB)),
    R: add(C, mul(ca, tC)),
    tA,
    tB,
    tC,
  };
}

/** Tangential quad from touch angles on a circle at origin. */
export function deriveQuad(state: CircleTangentsState): DerivedQuad | null {
  const r = state.radius;
  const O: Vec = { x: 0, y: 0 };
  const degs = [...state.quad.touchDeg].sort((a, b) => a - b) as [
    number,
    number,
    number,
    number,
  ];
  const touches = degs.map((d) => polar(d, r)) as [Vec, Vec, Vec, Vec];
  const dirs = touches.map((T) => {
    const radial = norm(T);
    return { x: -radial.y, y: radial.x };
  });
  const verts: Vec[] = [];
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 3) % 4;
    const hit = lineIntersect(touches[j]!, dirs[j]!, touches[i]!, dirs[i]!);
    if (!hit) return null;
    verts.push(hit);
  }
  const [A, B, C, D] = verts as [Vec, Vec, Vec, Vec];
  const [P, Q, R, S] = touches;
  const tA = len(sub(A, P));
  const tB = len(sub(B, P));
  const tC = len(sub(C, Q));
  const tD = len(sub(D, R));
  return { O, r, A, B, C, D, P, Q, R, S, tA, tB, tC, tD };
}

export function deriveThree(state: CircleTangentsState): DerivedThree | null {
  const [A, B, C] = state.three.verts;
  if (!A || !B || !C) return null;
  const area =
    Math.abs(A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y)) / 2;
  if (area < 0.05) return null;
  const O = excenterA(A, B, C);
  const r = distToLine(O, B, C);
  if (r < 0.15) return null;
  const a = len(sub(B, C));
  const b = len(sub(A, C));
  const c = len(sub(A, B));
  const s = (a + b + c) / 2;
  /** Excircle opposite A: tangent lengths. */
  const tA = s;
  const tB = s - c;
  const tC = s - b;
  const ab = norm(sub(B, A));
  const ac = norm(sub(C, A));
  const bc = norm(sub(C, B));
  const D = add(A, mul(ab, tA));
  const F = add(A, mul(ac, tA));
  const E = add(B, mul(bc, tB));
  return { A, B, C, O, r, D, E, F, tA, tB, tC };
}

export function pointPos(
  state: CircleTangentsState,
  id: string,
): Vec | null {
  if (state.kind === "two-tangents") {
    const d = deriveTwo(state);
    if (!d) return null;
    if (id === "O") return d.O;
    if (id === "P") return d.P;
    if (id === "A") return d.A;
    if (id === "B") return d.B;
    return null;
  }
  if (state.kind === "incircle-triangle") {
    const d = deriveTri(state);
    if (!d) return null;
    const map: Record<string, Vec> = {
      A: d.A,
      B: d.B,
      C: d.C,
      O: d.O,
      P: d.P,
      Q: d.Q,
      R: d.R,
    };
    return map[id] ?? null;
  }
  if (state.kind === "tangential-quad") {
    const d = deriveQuad(state);
    if (!d) return null;
    const map: Record<string, Vec> = {
      A: d.A,
      B: d.B,
      C: d.C,
      D: d.D,
      O: d.O,
      P: d.P,
      Q: d.Q,
      R: d.R,
      S: d.S,
    };
    return map[id] ?? null;
  }
  const d = deriveThree(state);
  if (!d) return null;
  const map: Record<string, Vec> = {
    A: d.A,
    B: d.B,
    C: d.C,
    O: d.O,
    D: d.D,
    E: d.E,
    F: d.F,
  };
  return map[id] ?? null;
}

export function namedPointOf(
  state: CircleTangentsState,
  id: string,
): NamedPoint | null {
  if (state.kind === "two-tangents") {
    return state.two.points[id as keyof typeof state.two.points] ?? null;
  }
  if (state.kind === "incircle-triangle") {
    return state.tri.points[id as keyof typeof state.tri.points] ?? null;
  }
  if (state.kind === "tangential-quad") {
    return state.quad.points[id as keyof typeof state.quad.points] ?? null;
  }
  return state.three.points[id as keyof typeof state.three.points] ?? null;
}

export function setNamedPoint(
  state: CircleTangentsState,
  id: string,
  patch: Partial<NamedPoint>,
): CircleTangentsState {
  const next = structuredClone(state);
  if (next.kind === "two-tangents" && id in next.two.points) {
    next.two.points[id as keyof typeof next.two.points] = {
      ...next.two.points[id as keyof typeof next.two.points],
      ...patch,
    };
  } else if (next.kind === "incircle-triangle" && id in next.tri.points) {
    next.tri.points[id as keyof typeof next.tri.points] = {
      ...next.tri.points[id as keyof typeof next.tri.points],
      ...patch,
    };
  } else if (next.kind === "tangential-quad" && id in next.quad.points) {
    next.quad.points[id as keyof typeof next.quad.points] = {
      ...next.quad.points[id as keyof typeof next.quad.points],
      ...patch,
    };
  } else if (next.kind === "three-tangents" && id in next.three.points) {
    next.three.points[id as keyof typeof next.three.points] = {
      ...next.three.points[id as keyof typeof next.three.points],
      ...patch,
    };
  }
  return normalizeState(next);
}

function cleanMeasureId(id: string): string {
  return id.endsWith(":line") ? id.slice(0, -5) : id;
}

export function findLength(
  state: CircleTangentsState,
  id: string,
): LengthMark | null {
  const cleanId = cleanMeasureId(id);
  if (state.kind === "two-tangents") {
    return state.two.lengths[cleanId as keyof typeof state.two.lengths] ?? null;
  }
  if (state.kind === "incircle-triangle") {
    return (
      state.tri.sides[cleanId as keyof typeof state.tri.sides] ??
      state.tri.segs[cleanId as keyof typeof state.tri.segs] ??
      null
    );
  }
  if (state.kind === "tangential-quad") {
    return state.quad.segs[cleanId as keyof typeof state.quad.segs] ?? null;
  }
  return state.three.lengths[cleanId as keyof typeof state.three.lengths] ?? null;
}

export function patchLength(
  state: CircleTangentsState,
  id: string,
  patch: Partial<LengthMark>,
): CircleTangentsState {
  const cleanId = cleanMeasureId(id);
  const next = structuredClone(state);
  const apply = (mark: LengthMark | undefined) => {
    if (!mark) return;
    Object.assign(mark, patch);
    if (patch.label) mark.label = { ...mark.label, ...patch.label };
  };
  if (next.kind === "two-tangents") {
    apply(next.two.lengths[cleanId as keyof typeof next.two.lengths]);
  } else if (next.kind === "incircle-triangle") {
    apply(next.tri.sides[cleanId as keyof typeof next.tri.sides]);
    apply(next.tri.segs[cleanId as keyof typeof next.tri.segs]);
  } else if (next.kind === "tangential-quad") {
    apply(next.quad.segs[cleanId as keyof typeof next.quad.segs]);
  } else {
    apply(next.three.lengths[cleanId as keyof typeof next.three.lengths]);
  }
  return normalizeState(next);
}

export function findAngle(
  state: CircleTangentsState,
  id: string,
): AngleMark | null {
  if (state.kind !== "two-tangents") return null;
  const cleanId = cleanMeasureId(id);
  if (cleanId === "angP" || cleanId === "P") return state.two.angles.P;
  if (cleanId === "angA" || cleanId === "A") return state.two.angles.A;
  return null;
}

export function patchAngle(
  state: CircleTangentsState,
  id: string,
  patch: Partial<AngleMark>,
): CircleTangentsState {
  if (state.kind !== "two-tangents") return state;
  const cleanId = cleanMeasureId(id);
  const next = structuredClone(state);
  const key =
    cleanId === "angP" || cleanId === "P"
      ? "P"
      : cleanId === "angA" || cleanId === "A"
        ? "A"
        : null;
  if (!key) return state;
  next.two.angles[key] = {
    ...next.two.angles[key],
    ...patch,
    label: patch.label
      ? { ...next.two.angles[key].label, ...patch.label }
      : next.two.angles[key].label,
  };
  return normalizeState(next);
}

export function autoLengthValue(
  state: CircleTangentsState,
  id: string,
): number | null {
  if (state.kind === "two-tangents") {
    const d = deriveTwo(state);
    if (!d) return null;
    if (id === "PA" || id === "PB") return d.tangentLen;
    if (id === "OA" || id === "OB") return d.r;
    if (id === "OP") return d.opDist;
    if (id === "AB") return len(sub(d.A, d.B));
    return null;
  }
  if (state.kind === "incircle-triangle") {
    const d = deriveTri(state);
    if (!d) return null;
    if (id === "AB") return len(sub(d.A, d.B));
    if (id === "BC") return len(sub(d.B, d.C));
    if (id === "CA") return len(sub(d.C, d.A));
    if (id === "AP" || id === "AR") return d.tA;
    if (id === "BP" || id === "BQ") return d.tB;
    if (id === "CQ" || id === "CR") return d.tC;
    return null;
  }
  if (state.kind === "tangential-quad") {
    const d = deriveQuad(state);
    if (!d) return null;
    if (id === "AP" || id === "AS") return d.tA;
    if (id === "BP" || id === "BQ") return d.tB;
    if (id === "CQ" || id === "CR") return d.tC;
    if (id === "DR" || id === "DS") return d.tD;
    return null;
  }
  const d = deriveThree(state);
  if (!d) return null;
  if (id === "AD" || id === "AF") return d.tA;
  if (id === "AB") return len(sub(d.A, d.B));
  if (id === "AC") return len(sub(d.A, d.C));
  if (id === "BC") return len(sub(d.B, d.C));
  if (id === "BE") return d.tB;
  if (id === "CE") return d.tC;
  return null;
}

export function lengthText(
  state: CircleTangentsState,
  id: string,
): string | null {
  const mark = findLength(state, id);
  if (!mark || !mark.show) return null;
  const auto = autoLengthValue(state, id);
  if (auto == null) return null;
  return resolveLengthText(mark.label, auto, state.unit, state.unknownLetter);
}

export function angleText(
  state: CircleTangentsState,
  which: "P" | "A",
): string | null {
  if (state.kind !== "two-tangents") return null;
  const mark = state.two.angles[which];
  if (!mark.show) return null;
  const d = deriveTwo(state);
  if (!d) return null;
  let deg: number;
  if (which === "P") {
    deg = angleDeg(d.P, d.A, d.B);
  } else {
    deg = angleDeg(d.A, d.P, d.B);
  }
  return resolveAngleText(mark.label, deg, state.unknownLetter);
}

export function angleDeg(vertex: Vec, from: Vec, to: Vec): number {
  const u = sub(from, vertex);
  const w = sub(to, vertex);
  const lu = len(u) || 1;
  const lw = len(w) || 1;
  const c = (u.x * w.x + u.y * w.y) / (lu * lw);
  return (Math.acos(Math.min(1, Math.max(-1, c))) * 180) / Math.PI;
}

export function moveExternalPoint(
  state: CircleTangentsState,
  math: Vec,
): CircleTangentsState {
  if (state.kind !== "two-tangents") return state;
  const d = Math.max(state.radius + 0.5, len(math));
  const ang = (Math.atan2(math.y, math.x) * 180) / Math.PI;
  return normalizeState({
    ...state,
    two: { ...state.two, opDist: d, pAngleDeg: ang },
  });
}

export function moveTriangleVertex(
  state: CircleTangentsState,
  index: 0 | 1 | 2,
  math: Vec,
): CircleTangentsState {
  if (state.kind === "incircle-triangle") {
    const verts = [...state.tri.verts] as [Vec, Vec, Vec];
    verts[index] = math;
    return normalizeState({ ...state, tri: { ...state.tri, verts } });
  }
  if (state.kind === "three-tangents") {
    const verts = [...state.three.verts] as [Vec, Vec, Vec];
    verts[index] = math;
    return normalizeState({ ...state, three: { ...state.three, verts } });
  }
  return state;
}

export function moveQuadTouch(
  state: CircleTangentsState,
  index: 0 | 1 | 2 | 3,
  math: Vec,
): CircleTangentsState {
  if (state.kind !== "tangential-quad") return state;
  const ang = (Math.atan2(math.y, math.x) * 180) / Math.PI;
  const touchDeg = [...state.quad.touchDeg] as [number, number, number, number];
  touchDeg[index] = ang;
  return normalizeState({ ...state, quad: { ...state.quad, touchDeg } });
}

export function nudgePointLabel(
  state: CircleTangentsState,
  id: string,
  dx: number,
  dy: number,
): CircleTangentsState {
  const np = namedPointOf(state, id);
  if (!np) return state;
  return setNamedPoint(state, id, { dx: np.dx + dx, dy: np.dy + dy });
}

function clampNum(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function nudgeMeasureLabel(
  state: CircleTangentsState,
  id: string,
  dx: number,
  dy: number,
  along?: Vec,
  outward?: Vec,
  halfSpan?: number,
): CircleTangentsState {
  const mark = findLength(state, id) ?? findAngle(state, id);
  if (!mark) return state;

  let deltaX = dx;
  let deltaY = dy;
  if (along && outward) {
    deltaX = dx * along.x + dy * along.y;
    deltaY = dx * outward.x + dy * outward.y;
  }

  const maxAlong = halfSpan !== undefined ? Math.max(halfSpan - 18, 4) : 160;
  const label = {
    ...mark.label,
    dx: clampNum(mark.label.dx + deltaX, -maxAlong, maxAlong),
    dy: clampNum(mark.label.dy + deltaY, -160, 160),
  };
  if (findLength(state, id)) return patchLength(state, id, { label });
  return patchAngle(state, id, { label });
}

export function nudgeMeasureLine(
  state: CircleTangentsState,
  id: string,
  dx: number,
  dy: number,
  _along?: Vec,
  outward?: Vec,
): CircleTangentsState {
  const mark = findLength(state, id);
  if (!mark) return state;

  let perpAmt = dy;
  if (outward) {
    perpAmt = dx * outward.x + dy * outward.y;
  }

  const label = {
    ...mark.label,
    lineDy: clampNum((mark.label.lineDy ?? 0) + perpAmt, -160, 160),
  };
  return patchLength(state, id, { label });
}

export function applyEditedLabel(
  state: CircleTangentsState,
  id: string,
  raw: string,
): CircleTangentsState {
  const text = raw.trim();
  if (id.startsWith("pt:")) {
    const pid = id.slice(3);
    return setNamedPoint(state, pid, { name: text || namedPointOf(state, pid)?.name || pid });
  }
  if (id.startsWith("ang")) {
    const which = id.includes("P") ? "P" : "A";
    const mark = state.two.angles[which];
    if (!mark) return state;
    if (!text || text === "x" || text === "$x$") {
      return patchAngle(state, which, { label: { ...emptyLabel("x"), custom: "x" } });
    }
    return patchAngle(state, which, {
      label: { ...emptyLabel("custom"), custom: text.includes("°") ? text : `${text}°` },
    });
  }
  const mark = findLength(state, id);
  if (!mark) return state;
  if (!text || text === "x" || text === "$x$") {
    return patchLength(state, id, { show: true, label: { ...emptyLabel("x"), custom: "x" } });
  }
  return patchLength(state, id, {
    show: true,
    label: { ...emptyLabel("custom"), custom: text },
  });
}

export function setAllPointModes(
  state: CircleTangentsState,
  mode: PointDisplayMode,
): CircleTangentsState {
  const next = structuredClone(state);
  const apply = (pts: Record<string, NamedPoint>) => {
    for (const k of Object.keys(pts)) {
      pts[k] = { ...pts[k]!, mode };
    }
  };
  if (next.kind === "two-tangents") apply(next.two.points);
  else if (next.kind === "incircle-triangle") apply(next.tri.points);
  else if (next.kind === "tangential-quad") apply(next.quad.points);
  else apply(next.three.points);
  return normalizeState(next);
}

export function kindLabel(kind: TangentKind): string {
  if (kind === "two-tangents") return "한 점에서 두 접선";
  if (kind === "incircle-triangle") return "삼각형 내접원";
  if (kind === "tangential-quad") return "접선사각형";
  return "세 접선 삼각형";
}

export function lengthEndpoints(
  state: CircleTangentsState,
  id: string,
): [Vec, Vec] | null {
  if (state.kind === "two-tangents") {
    const d = deriveTwo(state);
    if (!d) return null;
    if (id === "PA") return [d.P, d.A];
    if (id === "PB") return [d.P, d.B];
    if (id === "OA") return [d.O, d.A];
    if (id === "OB") return [d.O, d.B];
    if (id === "OP") return [d.O, d.P];
    if (id === "AB") return [d.A, d.B];
    return null;
  }
  if (state.kind === "incircle-triangle") {
    const d = deriveTri(state);
    if (!d) return null;
    if (id === "AB") return [d.A, d.B];
    if (id === "BC") return [d.B, d.C];
    if (id === "CA") return [d.C, d.A];
    if (id === "AP") return [d.A, d.P];
    if (id === "BP") return [d.B, d.P];
    if (id === "BQ") return [d.B, d.Q];
    if (id === "CQ") return [d.C, d.Q];
    if (id === "CR") return [d.C, d.R];
    if (id === "AR") return [d.A, d.R];
    return null;
  }
  if (state.kind === "tangential-quad") {
    const d = deriveQuad(state);
    if (!d) return null;
    if (id === "AP") return [d.A, d.P];
    if (id === "BP") return [d.B, d.P];
    if (id === "BQ") return [d.B, d.Q];
    if (id === "CQ") return [d.C, d.Q];
    if (id === "CR") return [d.C, d.R];
    if (id === "DR") return [d.D, d.R];
    if (id === "DS") return [d.D, d.S];
    if (id === "AS") return [d.A, d.S];
    return null;
  }
  const d = deriveThree(state);
  if (!d) return null;
  if (id === "AD") return [d.A, d.D];
  if (id === "AF") return [d.A, d.F];
  if (id === "AB") return [d.A, d.B];
  if (id === "AC") return [d.A, d.C];
  if (id === "BC") return [d.B, d.C];
  if (id === "BE") return [d.B, d.E];
  if (id === "CE") return [d.C, d.E];
  return null;
}

export type { MeasLabel };
