import { add, len, mul, norm, parseMeasureInput, sub } from "@/lib/diagrams/polygon/geometry";
import {
  cyclePointMode,
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
    const key = cleanId === "DA" ? "AD" : cleanId;
    return (
      state.quad.sides?.[key as keyof typeof state.quad.sides] ??
      state.quad.segs[key as keyof typeof state.quad.segs] ??
      null
    );
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
    const key = cleanId === "DA" ? "AD" : cleanId;
    apply(next.quad.sides?.[key as keyof typeof next.quad.sides]);
    apply(next.quad.segs[key as keyof typeof next.quad.segs]);
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
    if (id === "AB") return len(sub(d.A, d.B));
    if (id === "BC") return len(sub(d.B, d.C));
    if (id === "CD") return len(sub(d.C, d.D));
    if (id === "AD" || id === "DA") return len(sub(d.A, d.D));
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

export function autoAngleValue(
  state: CircleTangentsState,
  id: string,
): number | null {
  if (state.kind !== "two-tangents") return null;
  const d = deriveTwo(state);
  if (!d) return null;
  const cleanId = cleanMeasureId(id);
  if (cleanId === "angP" || cleanId === "P") {
    return angleDeg(d.P, d.A, d.B);
  }
  if (cleanId === "angA" || cleanId === "A") {
    return angleDeg(d.A, d.P, d.B);
  }
  return null;
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

export function pinnedLengthValue(
  state: CircleTangentsState,
  id: string,
  fallback: number,
): number {
  const mark = findLength(state, id);
  if (!mark || !mark.show || mark.label.mode !== "auto") return fallback;
  if (mark.lockedValue != null && mark.lockedValue > 0) return mark.lockedValue;
  return fallback;
}

export function isLengthPinned(
  state: CircleTangentsState,
  id: string,
): boolean {
  const mark = findLength(state, id);
  return Boolean(
    mark?.show &&
      mark.label.mode === "auto" &&
      mark.lockedValue != null &&
      mark.lockedValue > 0,
  );
}

export function toggleLength(
  state: CircleTangentsState,
  id: string,
): CircleTangentsState {
  const mark = findLength(state, id);
  if (!mark) return state;
  return patchLength(state, id, {
    show: !mark.show,
    lockedValue: !mark.show ? undefined : mark.lockedValue,
  });
}

/** Cycle length display: 숨김 → 숫자 → 문자 → 숨김 (직접 입력은 누르면 숨김). */
export function cycleLength(
  state: CircleTangentsState,
  id: string,
): CircleTangentsState {
  const mark = findLength(state, id);
  if (!mark) return state;
  if (!mark.show || mark.label.mode === "hide") {
    return patchLength(state, id, {
      show: true,
      lockedValue: undefined,
      label: { ...mark.label, mode: "auto" },
    });
  }
  if (mark.label.mode === "auto") {
    return patchLength(state, id, {
      show: true,
      lockedValue: undefined,
      label: { ...mark.label, mode: "x" },
    });
  }
  return patchLength(state, id, {
    show: false,
    lockedValue: undefined,
    label: { ...mark.label, mode: "auto" },
  });
}

export function figurePointIds(state: CircleTangentsState): string[] {
  if (state.kind === "two-tangents") return ["O", "P", "A", "B"];
  if (state.kind === "incircle-triangle") {
    return ["A", "B", "C", "O", "P", "Q", "R"];
  }
  if (state.kind === "tangential-quad") {
    return ["A", "B", "C", "D", "O", "P", "Q", "R", "S"];
  }
  return ["A", "B", "C", "O", "D", "E", "F"];
}

export function lengthIdsForKind(state: CircleTangentsState): string[] {
  if (state.kind === "two-tangents") {
    return Object.keys(state.two.lengths);
  }
  if (state.kind === "incircle-triangle") {
    return [...Object.keys(state.tri.sides), ...Object.keys(state.tri.segs)];
  }
  if (state.kind === "tangential-quad") {
    return [
      ...Object.keys(state.quad.sides ?? {}),
      ...Object.keys(state.quad.segs),
    ];
  }
  return Object.keys(state.three.lengths);
}

export function cycleNamedPoint(
  state: CircleTangentsState,
  id: string,
): CircleTangentsState {
  const cur = namedPointOf(state, id);
  if (!cur) return state;
  const nextMode = cyclePointMode(cur.mode);
  let next = setNamedPoint(state, id, { mode: nextMode });
  // Turning a touch point visible should reveal touch-point layer.
  if (nextMode !== "none") {
    if (next.kind === "incircle-triangle" && ["P", "Q", "R"].includes(id)) {
      next = normalizeState({
        ...next,
        tri: { ...next.tri, showTouchPoints: true },
      });
    } else if (
      next.kind === "tangential-quad" &&
      ["P", "Q", "R", "S"].includes(id)
    ) {
      next = normalizeState({
        ...next,
        quad: { ...next.quad, showTouchPoints: true },
      });
    } else if (
      next.kind === "three-tangents" &&
      ["D", "E", "F"].includes(id)
    ) {
      next = normalizeState({
        ...next,
        three: { ...next.three, showTouchPoints: true },
      });
    }
  }
  return next;
}

export function selectableSegIds(state: CircleTangentsState): string[] {
  if (state.kind === "two-tangents") {
    const list = ["PA", "PB"];
    if (state.two.showChordAB) list.push("AB");
    if (state.two.showOA) list.push("OA");
    if (state.two.showOB) list.push("OB");
    if (state.two.showOP) list.push("OP");
    return list;
  }
  if (state.kind === "incircle-triangle") {
    const list = ["AB", "BC", "CA"];
    if (state.tri.showTouchPoints) {
      list.push("AP", "BP", "BQ", "CQ", "CR", "AR");
    }
    return list;
  }
  if (state.kind === "tangential-quad") {
    const list = ["AB", "BC", "CD", "AD"];
    if (state.quad.showTouchPoints) {
      list.push("AP", "BP", "BQ", "CQ", "CR", "DR", "DS", "AS");
    }
    return list;
  }
  if (state.kind === "three-tangents") {
    return ["AD", "AF", "BE", "CE", "BC", "AB", "AC"];
  }
  return [];
}

function finalizeNumericLength(
  next: CircleTangentsState,
  cleanId: string,
  value: number,
): CircleTangentsState {
  const norm = normalizeState(next);
  const mark = findLength(norm, cleanId);
  // Numeric value controls create a geometry constraint. "직접" remains display-only.
  return patchLength(norm, cleanId, {
    show: true,
    lockedValue: value,
    label: {
      ...(mark?.label ?? emptyLabel("auto")),
      mode: "auto",
      custom: "",
    },
  });
}

/** Freeze shown automatic values as geometry constraints before solving another value. */
export function freezeVisibleAutoLengths(
  state: CircleTangentsState,
  exceptId?: string,
): CircleTangentsState {
  const except = exceptId ? cleanMeasureId(exceptId) : null;
  let next = state;
  for (const id of lengthIdsForKind(state)) {
    if (except && id === except) continue;
    if (except && ((except === "AD" && id === "AF") || (except === "AF" && id === "AD"))) {
      continue;
    }
    if (
      except &&
      (except === "PA" || except === "PB") &&
      (id === "PA" || id === "PB")
    ) {
      continue;
    }
    if (
      except &&
      (except === "OA" || except === "OB") &&
      (id === "OA" || id === "OB")
    ) {
      continue;
    }
    const mark = findLength(next, id);
    if (!mark?.show || mark.label.mode !== "auto") continue;
    const auto = autoLengthValue(next, id);
    if (auto == null || !(auto > 0)) continue;
    next = patchLength(next, id, {
      lockedValue: mark.lockedValue ?? auto,
    });
  }
  return next;
}

function placeTriangleSides(
  a: number,
  b: number,
  c: number,
): [Vec, Vec, Vec] | null {
  if (!(a > 0.05 && b > 0.05 && c > 0.05)) return null;
  if (a + b <= c + 1e-6 || b + c <= a + 1e-6 || c + a <= b + 1e-6) return null;
  // Foot of A on BC is at distance yProj from B toward C.
  const yProj = (c * c - b * b + a * a) / (2 * a);
  const h2 = c * c - yProj * yProj;
  if (h2 < 1e-8) return null;
  const h = Math.sqrt(h2);
  const B: Vec = { x: -1.2, y: a / 2 };
  const C: Vec = { x: -1.2, y: -a / 2 };
  const A: Vec = { x: -1.2 - h, y: a / 2 - yProj };
  return [A, B, C];
}

function solveThreeTangentSides(input: {
  a: number | null;
  b: number | null;
  c: number | null;
  s: number | null;
  curA: number;
  curB: number;
  curC: number;
}): { a: number; b: number; c: number } | null {
  let a = input.a;
  let b = input.b;
  let c = input.c;
  let s = input.s;
  const { curA, curB, curC } = input;

  for (let i = 0; i < 6; i += 1) {
    if (s != null && a != null && b != null && c == null) c = 2 * s - a - b;
    if (s != null && a != null && c != null && b == null) b = 2 * s - a - c;
    if (s != null && b != null && c != null && a == null) a = 2 * s - b - c;
    if (a != null && b != null && c != null && s == null) s = (a + b + c) / 2;
  }

  if (a == null && b == null && c == null && s != null) {
    const curS = (curA + curB + curC) / 2;
    if (curS < 1e-6) return null;
    const f = s / curS;
    a = curA * f;
    b = curB * f;
    c = curC * f;
  } else if (s != null) {
    const known = [a, b, c];
    const knownCount = known.filter((v) => v != null).length;
    if (knownCount === 1) {
      const rem = 2 * s - (a ?? b ?? c)!;
      if (rem <= 0.1) return null;
      if (a != null) {
        const sum = curB + curC || 1;
        b = rem * (curB / sum);
        c = rem * (curC / sum);
      } else if (b != null) {
        const sum = curA + curC || 1;
        a = rem * (curA / sum);
        c = rem * (curC / sum);
      } else {
        const sum = curA + curB || 1;
        a = rem * (curA / sum);
        b = rem * (curB / sum);
      }
    } else if (knownCount === 0) {
      return null;
    }
  } else {
    if (a == null) a = curA;
    if (b == null) b = curB;
    if (c == null) c = curC;
  }

  if (a == null || b == null || c == null) return null;
  if (!(a > 0.05 && b > 0.05 && c > 0.05)) return null;
  if (a + b <= c + 1e-6 || b + c <= a + 1e-6 || c + a <= b + 1e-6) return null;
  if (input.s != null) {
    const s2 = (a + b + c) / 2;
    if (Math.abs(s2 - input.s) > 0.05) return null;
  }
  return { a, b, c };
}

export type LengthApplyResult = {
  ok: boolean;
  state: CircleTangentsState;
  message?: string;
};

export function applyLengthNumeric(
  state: CircleTangentsState,
  id: string,
  value: number,
): CircleTangentsState {
  return applyLengthNumericDetailed(state, id, value).state;
}

export function applyLengthNumericDetailed(
  state: CircleTangentsState,
  id: string,
  value: number,
): LengthApplyResult {
  const cleanId = cleanMeasureId(id);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, state, message: "길이는 양수여야 해요." };
  }

  const frozen = freezeVisibleAutoLengths(state, cleanId);

  if (frozen.kind === "two-tangents") {
    const r = frozen.radius;
    const d = frozen.two.opDist;
    const curL = Math.sqrt(Math.max(0, d * d - r * r));

    const isPinRadius = isLengthPinned(frozen, "OA") || isLengthPinned(frozen, "OB");
    const isPinTangent = isLengthPinned(frozen, "PA") || isLengthPinned(frozen, "PB");
    const isPinOP = isLengthPinned(frozen, "OP");

    if (cleanId === "PA" || cleanId === "PB") {
      const targetL = Math.max(0.2, Math.min(60, value));
      if (isPinOP && !isPinRadius) {
        const nextR = Math.max(
          0.5,
          Math.min(d - 0.2, Math.sqrt(Math.max(0.25, d * d - targetL * targetL))),
        );
        if (!(nextR < d - 0.05)) {
          return {
            ok: false,
            state,
            message: "지금 고정된 OP로는 그 접선 길이를 만들 수 없어요.",
          };
        }
        return {
          ok: true,
          state: finalizeNumericLength(
            { ...frozen, radius: nextR },
            cleanId,
            targetL,
          ),
        };
      }
      if (isPinRadius && isPinOP) {
        const need = Math.sqrt(Math.max(0, d * d - r * r));
        if (Math.abs(need - targetL) > 0.05) {
          return {
            ok: false,
            state,
            message: "반지름과 OP가 고정된 상태에서는 그 접선 길이가 불가해요.",
          };
        }
      }
      const nextD = Math.sqrt(targetL * targetL + r * r);
      return {
        ok: true,
        state: finalizeNumericLength(
          { ...frozen, two: { ...frozen.two, opDist: nextD } },
          cleanId,
          targetL,
        ),
      };
    }

    if (cleanId === "OA" || cleanId === "OB") {
      const targetR = Math.max(0.2, Math.min(40, value));
      if (isPinOP && targetR >= d - 0.05) {
        return {
          ok: false,
          state,
          message: "고정된 OP보다 큰 반지름은 불가해요.",
        };
      }
      if (isPinOP && !isPinTangent) {
        return {
          ok: true,
          state: finalizeNumericLength(
            { ...frozen, radius: targetR },
            cleanId,
            targetR,
          ),
        };
      }
      const nextD = Math.sqrt(curL * curL + targetR * targetR);
      return {
        ok: true,
        state: finalizeNumericLength(
          {
            ...frozen,
            radius: targetR,
            two: { ...frozen.two, opDist: nextD },
          },
          cleanId,
          targetR,
        ),
      };
    }

    if (cleanId === "OP") {
      const nextD = Math.max(r + 0.2, Math.min(80, value));
      if (isPinTangent && !isPinRadius) {
        const nextR = Math.sqrt(Math.max(0.25, nextD * nextD - curL * curL));
        return {
          ok: true,
          state: finalizeNumericLength(
            {
              ...frozen,
              radius: nextR,
              two: { ...frozen.two, opDist: nextD },
            },
            cleanId,
            nextD,
          ),
        };
      }
      return {
        ok: true,
        state: finalizeNumericLength(
          { ...frozen, two: { ...frozen.two, opDist: nextD } },
          cleanId,
          nextD,
        ),
      };
    }

    if (cleanId === "AB") {
      const targetW = Math.max(0.2, Math.min(2 * r - 0.1, value));
      const ratio = targetW / (2 * r);
      const denom = Math.sqrt(Math.max(0.001, 1 - ratio * ratio));
      const nextD = r / denom;
      return {
        ok: true,
        state: finalizeNumericLength(
          { ...frozen, two: { ...frozen.two, opDist: nextD } },
          cleanId,
          targetW,
        ),
      };
    }
  }

  if (frozen.kind === "incircle-triangle") {
    const result = applyIncircleTriangleLength(frozen, cleanId, value);
    return result;
  }

  if (frozen.kind === "tangential-quad") {
    const result = applyTangentialQuadLength(frozen, cleanId, value);
    return result;
  }

  if (frozen.kind === "three-tangents") {
    return applyThreeTangentsLength(frozen, cleanId, value);
  }


  return { ok: false, state, message: "이 길이는 숫자로 맞출 수 없어요." };
}

function applyIncircleTriangleLength(
  state: CircleTangentsState,
  cleanId: string,
  value: number,
): LengthApplyResult {
  const d = deriveTri(state);
  if (!d) {
    return { ok: false, state, message: "삼각형을 만들 수 없어요." };
  }

  let tA = pinnedLengthValue(state, "AP", pinnedLengthValue(state, "AR", d.tA));
  let tB = pinnedLengthValue(state, "BP", pinnedLengthValue(state, "BQ", d.tB));
  let tC = pinnedLengthValue(state, "CQ", pinnedLengthValue(state, "CR", d.tC));

  const isPinAB = isLengthPinned(state, "AB");
  const isPinBC = isLengthPinned(state, "BC");
  const isPinCA = isLengthPinned(state, "CA");

  if (cleanId === "AP" || cleanId === "AR") {
    tA = Math.max(0.2, Math.min(50, value));
  } else if (cleanId === "BP" || cleanId === "BQ") {
    tB = Math.max(0.2, Math.min(50, value));
  } else if (cleanId === "CQ" || cleanId === "CR") {
    tC = Math.max(0.2, Math.min(50, value));
  } else if (cleanId === "BC") {
    const targetA = Math.max(0.5, Math.min(60, value));
    if (isPinAB && !isPinCA) {
      tC = Math.max(0.2, targetA - tB);
    } else if (isPinCA && !isPinAB) {
      tB = Math.max(0.2, targetA - tC);
    } else if (isPinAB && isPinCA) {
      const c = tA + tB;
      const b = tC + tA;
      const minA = Math.abs(b - c) + 0.3;
      const maxA = b + c - 0.3;
      if (targetA < minA - 1e-6 || targetA > maxA + 1e-6) {
        return {
          ok: false,
          state,
          message: "고정된 AB·CA로는 그 BC 길이가 불가해요.",
        };
      }
      const clampedA = Math.max(minA, Math.min(maxA, targetA));
      tA = (b + c - clampedA) / 2;
      tB = (clampedA + c - b) / 2;
      tC = (clampedA + b - c) / 2;
    } else {
      const sumBC = tB + tC;
      const ratio = targetA / (sumBC || 1);
      tB = Math.max(0.2, tB * ratio);
      tC = Math.max(0.2, tC * ratio);
    }
  } else if (cleanId === "AB") {
    const targetC = Math.max(0.5, Math.min(60, value));
    if (isPinBC && !isPinCA) {
      tA = Math.max(0.2, targetC - tB);
    } else if (isPinCA && !isPinBC) {
      tB = Math.max(0.2, targetC - tA);
    } else if (isPinBC && isPinCA) {
      const a = tB + tC;
      const b = tC + tA;
      const minC = Math.abs(a - b) + 0.3;
      const maxC = a + b - 0.3;
      if (targetC < minC - 1e-6 || targetC > maxC + 1e-6) {
        return {
          ok: false,
          state,
          message: "고정된 BC·CA로는 그 AB 길이가 불가해요.",
        };
      }
      const clampedC = Math.max(minC, Math.min(maxC, targetC));
      tA = (b + clampedC - a) / 2;
      tB = (a + clampedC - b) / 2;
      tC = (a + b - clampedC) / 2;
    } else {
      const sumAB = tA + tB;
      const ratio = targetC / (sumAB || 1);
      tA = Math.max(0.2, tA * ratio);
      tB = Math.max(0.2, tB * ratio);
    }
  } else if (cleanId === "CA") {
    const targetB = Math.max(0.5, Math.min(60, value));
    if (isPinBC && !isPinAB) {
      tA = Math.max(0.2, targetB - tC);
    } else if (isPinAB && !isPinBC) {
      tC = Math.max(0.2, targetB - tA);
    } else if (isPinBC && isPinAB) {
      const a = tB + tC;
      const c = tA + tB;
      const minB = Math.abs(a - c) + 0.3;
      const maxB = a + c - 0.3;
      if (targetB < minB - 1e-6 || targetB > maxB + 1e-6) {
        return {
          ok: false,
          state,
          message: "고정된 AB·BC로는 그 CA 길이가 불가해요.",
        };
      }
      const clampedB = Math.max(minB, Math.min(maxB, targetB));
      tA = (clampedB + c - a) / 2;
      tB = (a + c - clampedB) / 2;
      tC = (a + clampedB - c) / 2;
    } else {
      const sumCA = tC + tA;
      const ratio = targetB / (sumCA || 1);
      tC = Math.max(0.2, tC * ratio);
      tA = Math.max(0.2, tA * ratio);
    }
  } else {
    return { ok: false, state, message: "이 길이는 숫자로 맞출 수 없어요." };
  }

  const a = tB + tC;
  const b = tC + tA;
  const c = tA + tB;
  if (a + b <= c || b + c <= a || c + a <= b) {
    return {
      ok: false,
      state,
      message: "고정된 길이로는 그런 삼각형이 존재하지 않아요.",
    };
  }

  const x = (c * c + a * a - b * b) / (2 * a);
  const y2 = c * c - x * x;
  if (y2 < 1e-6) {
    return {
      ok: false,
      state,
      message: "고정된 길이로는 그런 삼각형이 존재하지 않아요.",
    };
  }
  const y = Math.sqrt(y2);
  const centroidX = (x - a / 2) / 3;
  const B: Vec = { x: -a / 2 - centroidX, y: -y / 3 };
  const C: Vec = { x: a / 2 - centroidX, y: -y / 3 };
  const A: Vec = { x: x - a / 2 - centroidX, y: (2 * y) / 3 };
  return {
    ok: true,
    state: finalizeNumericLength(
      { ...state, tri: { ...state.tri, verts: [A, B, C] } },
      cleanId,
      value,
    ),
  };
}

function applyTangentialQuadLength(
  state: CircleTangentsState,
  cleanId: string,
  value: number,
): LengthApplyResult {
  const d = deriveQuad(state);
  if (!d) {
    return { ok: false, state, message: "접선사각형을 만들 수 없어요." };
  }
  let r = state.radius;

  const sidePairs: Record<string, [number, number]> = {
    AB: [3, 0],
    BC: [0, 1],
    CD: [1, 2],
    AD: [2, 3],
    DA: [2, 3],
  };
  const isSide = cleanId in sidePairs;

  let targetIdx = -1;
  if (cleanId === "BP" || cleanId === "BQ") targetIdx = 0;
  else if (cleanId === "CQ" || cleanId === "CR") targetIdx = 1;
  else if (cleanId === "DR" || cleanId === "DS") targetIdx = 2;
  else if (cleanId === "AP" || cleanId === "AS") targetIdx = 3;

  if (targetIdx < 0 && !isSide) {
    return { ok: false, state, message: "이 길이는 숫자로 맞출 수 없어요." };
  }

  const curT = [
    pinnedLengthValue(state, "BP", pinnedLengthValue(state, "BQ", d.tB)),
    pinnedLengthValue(state, "CQ", pinnedLengthValue(state, "CR", d.tC)),
    pinnedLengthValue(state, "DR", pinnedLengthValue(state, "DS", d.tD)),
    pinnedLengthValue(state, "AP", pinnedLengthValue(state, "AS", d.tA)),
  ];

  const targetT = [...curT];
  const isPinned = [false, false, false, false];

  if (isSide) {
    const [idx1, idx2] = sidePairs[cleanId]!;
    const targetL = Math.max(0.4, Math.min(80, value));

    const pin1 =
      isLengthPinned(state, idx1 === 0 ? "BP" : idx1 === 1 ? "CQ" : idx1 === 2 ? "DR" : "AP") ||
      isLengthPinned(state, idx1 === 0 ? "BQ" : idx1 === 1 ? "CR" : idx1 === 2 ? "DS" : "AS");
    const pin2 =
      isLengthPinned(state, idx2 === 0 ? "BP" : idx2 === 1 ? "CQ" : idx2 === 2 ? "DR" : "AP") ||
      isLengthPinned(state, idx2 === 0 ? "BQ" : idx2 === 1 ? "CR" : idx2 === 2 ? "DS" : "AS");

    if (pin1 && pin2) {
      const sum = targetT[idx1]! + targetT[idx2]!;
      if (Math.abs(sum - targetL) > 0.05) {
        return {
          ok: false,
          state,
          message: "고정된 접선 조각으로는 그 변 길이가 불가해요.",
        };
      }
    } else if (pin1 && !pin2) {
      targetT[idx2] = Math.max(0.2, targetL - targetT[idx1]!);
    } else if (pin2 && !pin1) {
      targetT[idx1] = Math.max(0.2, targetL - targetT[idx2]!);
    } else {
      const sum = targetT[idx1]! + targetT[idx2]! || 1;
      const ratio = targetL / sum;
      targetT[idx1] = Math.max(0.2, targetT[idx1]! * ratio);
      targetT[idx2] = Math.max(0.2, targetL - targetT[idx1]!);
    }
    isPinned[idx1] = true;
    isPinned[idx2] = true;
  } else {
    targetT[targetIdx] = Math.max(0.2, Math.min(50, value));
    isPinned[0] = targetIdx !== 0 && (isLengthPinned(state, "BP") || isLengthPinned(state, "BQ"));
    isPinned[1] = targetIdx !== 1 && (isLengthPinned(state, "CQ") || isLengthPinned(state, "CR"));
    isPinned[2] = targetIdx !== 2 && (isLengthPinned(state, "DR") || isLengthPinned(state, "DS"));
    isPinned[3] = targetIdx !== 3 && (isLengthPinned(state, "AP") || isLengthPinned(state, "AS"));
    isPinned[targetIdx] = true;
  }

  const unpinned: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (!isPinned[i]) unpinned.push(i);
  }
  if (unpinned.length === 0) {
    // all pinned — only check consistency via rebuild attempt
  }

  const fixed = [0, 1, 2, 3].filter((i) => !unpinned.includes(i));
  const maxAllowedFixedSum = 360 - 15 * Math.max(unpinned.length, 1);
  let fixedSum = 0;
  for (const idx of fixed) {
    fixedSum += 2 * Math.atan(targetT[idx]! / r) * (180 / Math.PI);
  }
  if (fixedSum >= maxAllowedFixedSum) {
    const need = Math.tan(((360 - 15 * Math.max(unpinned.length, 1)) * Math.PI) / 360);
    r = Math.max(
      0.5,
      Math.max(...fixed.map((i) => targetT[i]!)) / Math.max(need, 0.2),
    );
    fixedSum = 0;
    for (const idx of fixed) {
      fixedSum += 2 * Math.atan(targetT[idx]! / r) * (180 / Math.PI);
    }
    if (fixedSum >= 350) {
      return {
        ok: false,
        state,
        message: "고정된 접선 길이로는 그런 접선사각형이 존재하지 않아요.",
      };
    }
  }

  const remAngle = Math.max(10 * Math.max(unpinned.length, 1), 360 - fixedSum);
  const prevUnpinnedSpans = unpinned.map(
    (idx) => 2 * Math.atan(curT[idx]! / state.radius) * (180 / Math.PI),
  );
  const totalPrevUnpinned = prevUnpinnedSpans.reduce((a, b) => a + b, 0) || 1;

  const spans = [0, 0, 0, 0];
  for (const idx of fixed) {
    spans[idx] = 2 * Math.atan(targetT[idx]! / r) * (180 / Math.PI);
  }
  for (let k = 0; k < unpinned.length; k++) {
    const idx = unpinned[k]!;
    spans[idx] = remAngle * (prevUnpinnedSpans[k]! / totalPrevUnpinned);
    targetT[idx] = r * Math.tan(((spans[idx]! / 2) * Math.PI) / 180);
  }

  const degs = [...state.quad.touchDeg].sort((a, b) => a - b) as [
    number,
    number,
    number,
    number,
  ];
  const newDegs: [number, number, number, number] = [
    degs[0],
    (degs[0] + spans[0]) % 360,
    (degs[0] + spans[0] + spans[1]) % 360,
    (degs[0] + spans[0] + spans[1] + spans[2]) % 360,
  ];

  const nextState = finalizeNumericLength(
    {
      ...state,
      radius: r,
      quad: { ...state.quad, touchDeg: newDegs },
    },
    cleanId,
    value,
  );
  const d2 = deriveQuad(nextState);
  if (!d2) {
    return {
      ok: false,
      state,
      message: "고정된 길이로는 그런 접선사각형이 존재하지 않아요.",
    };
  }
  return { ok: true, state: nextState };
}

function applyThreeTangentsLength(
  state: CircleTangentsState,
  cleanId: string,
  value: number,
): LengthApplyResult {
  const d = deriveThree(state);
  if (!d) {
    return { ok: false, state, message: "세 접선 삼각형을 만들 수 없어요." };
  }

  const curA = len(sub(d.B, d.C));
  const curB = len(sub(d.A, d.C));
  const curC = len(sub(d.A, d.B));
  const curS = (curA + curB + curC) / 2;

  const editing = cleanId;
  const pinOf = (id: string): number | null => {
    if (editing === id) return null;
    if ((editing === "AD" || editing === "AF") && (id === "AD" || id === "AF")) {
      return null;
    }
    if (!isLengthPinned(state, id)) return null;
    return pinnedLengthValue(state, id, autoLengthValue(state, id) ?? 0);
  };

  let a: number | null = pinOf("BC");
  let b: number | null = pinOf("AC");
  let c: number | null = pinOf("AB");
  let s: number | null = pinOf("AD") ?? pinOf("AF");
  const pinBE = pinOf("BE");
  const pinCE = pinOf("CE");

  if (editing === "BC") a = Math.max(0.5, value);
  else if (editing === "AC") b = Math.max(0.5, value);
  else if (editing === "AB") c = Math.max(0.5, value);
  else if (editing === "AD" || editing === "AF") s = Math.max(0.5, value);
  else if (editing === "BE") {
    const be = Math.max(0.2, value);
    if (s != null) c = s - be;
    else if (c != null) s = c + be;
    else {
      s = curS;
      c = s - be;
    }
  } else if (editing === "CE") {
    const ce = Math.max(0.2, value);
    if (s != null) b = s - ce;
    else if (b != null) s = b + ce;
    else {
      s = curS;
      b = s - ce;
    }
  } else {
    return { ok: false, state, message: "이 길이는 숫자로 맞출 수 없어요." };
  }

  if (pinBE != null) {
    if (s != null && c != null && Math.abs(s - c - pinBE) > 0.05) {
      return {
        ok: false,
        state,
        message: "고정된 BE와 다른 길이가 서로 모순돼요.",
      };
    }
    if (s != null && c == null) c = s - pinBE;
    else if (c != null && s == null) s = c + pinBE;
  }
  if (pinCE != null) {
    if (s != null && b != null && Math.abs(s - b - pinCE) > 0.05) {
      return {
        ok: false,
        state,
        message: "고정된 CE와 다른 길이가 서로 모순돼요.",
      };
    }
    if (s != null && b == null) b = s - pinCE;
    else if (b != null && s == null) s = b + pinCE;
  }

  const solved = solveThreeTangentSides({
    a,
    b,
    c,
    s,
    curA,
    curB,
    curC,
  });
  if (!solved) {
    return {
      ok: false,
      state,
      message: "고정된 길이로는 그런 세 접선 그림이 존재하지 않아요.",
    };
  }

  if (pinBE != null && Math.abs(solved.a + solved.b + solved.c) > 0) {
    const s2 = (solved.a + solved.b + solved.c) / 2;
    if (Math.abs(s2 - solved.c - pinBE) > 0.08) {
      return {
        ok: false,
        state,
        message: "고정된 BE를 지키면서는 그 길이를 만들 수 없어요.",
      };
    }
  }
  if (pinCE != null) {
    const s2 = (solved.a + solved.b + solved.c) / 2;
    if (Math.abs(s2 - solved.b - pinCE) > 0.08) {
      return {
        ok: false,
        state,
        message: "고정된 CE를 지키면서는 그 길이를 만들 수 없어요.",
      };
    }
  }

  const verts = placeTriangleSides(solved.a, solved.b, solved.c);
  if (!verts) {
    return {
      ok: false,
      state,
      message: "고정된 길이로는 그런 세 접선 그림이 존재하지 않아요.",
    };
  }

  return {
    ok: true,
    state: finalizeNumericLength(
      { ...state, three: { ...state.three, verts } },
      cleanId,
      value,
    ),
  };
}


export function applyAngleNumeric(
  state: CircleTangentsState,
  id: string,
  value: number,
): CircleTangentsState {
  if (state.kind !== "two-tangents") return state;
  const cleanId = cleanMeasureId(id);
  const r = state.radius;

  if (cleanId === "angP" || cleanId === "P") {
    const deg = Math.max(5, Math.min(170, value));
    const halfRad = (deg / 2) * (Math.PI / 180);
    const nextD = r / Math.sin(halfRad);
    return normalizeState({
      ...state,
      two: { ...state.two, opDist: nextD },
    });
  }

  if (cleanId === "angA" || cleanId === "A") {
    const deg = Math.max(5, Math.min(85, value));
    const angP_deg = 180 - 2 * deg;
    const halfRad = (angP_deg / 2) * (Math.PI / 180);
    const nextD = r / Math.sin(halfRad);
    return normalizeState({
      ...state,
      two: { ...state.two, opDist: nextD },
    });
  }

  return state;
}

export function applyEditedLabel(
  state: CircleTangentsState,
  id: string,
  raw: string,
): CircleTangentsState {
  return applyEditedLabelDetailed(state, id, raw).state;
}

export function applyEditedLabelDetailed(
  state: CircleTangentsState,
  id: string,
  raw: string,
): LengthApplyResult {
  const text = raw.trim();
  if (id.startsWith("pt:")) {
    const pid = id.slice(3);
    return {
      ok: true,
      state: setNamedPoint(state, pid, {
        name: text || namedPointOf(state, pid)?.name || pid,
      }),
    };
  }

  const cleanId = cleanMeasureId(id);
  if (cleanId === "angP" || cleanId === "P" || cleanId === "angA" || cleanId === "A") {
    const which = cleanId.includes("P") ? "P" : "A";
    const mark = state.two.angles[which];
    if (!mark) return { ok: true, state };

    if (mark.label.mode === "custom") {
      return {
        ok: true,
        state: patchAngle(state, which, {
          label: { ...mark.label, custom: text },
        }),
      };
    }
    if (!text || text === "x" || text === "$x$") {
      return {
        ok: true,
        state: patchAngle(state, which, {
          label: { ...emptyLabel("x"), custom: "x" },
        }),
      };
    }

    const numMatch = /^([0-9]+(?:\.[0-9]+)?)\s*°?$/.exec(text);
    if (numMatch) {
      const num = Number(numMatch[1]);
      const next = applyAngleNumeric(state, which, num);
      return {
        ok: true,
        state: patchAngle(next, which, {
          label: { ...mark.label, mode: "auto", custom: "" },
        }),
      };
    }

    return {
      ok: true,
      state: patchAngle(state, which, {
        label: {
          ...emptyLabel("custom"),
          custom: text.includes("°") ? text : `${text}°`,
        },
      }),
    };
  }

  const mark = findLength(state, cleanId);
  if (!mark) return { ok: true, state };

  if (mark.label.mode === "custom") {
    return {
      ok: true,
      state: patchLength(state, cleanId, {
        show: true,
        lockedValue: undefined,
        label: { ...mark.label, custom: text },
      }),
    };
  }
  if (!text || text === "x" || text === "$x$") {
    return {
      ok: true,
      state: patchLength(state, cleanId, {
        show: true,
        label: { ...emptyLabel("x"), custom: "x" },
      }),
    };
  }

  const parsed = parseMeasureInput(text);
  if (parsed.kind === "number" && parsed.value != null && parsed.value > 0) {
    const result = applyLengthNumericDetailed(state, cleanId, parsed.value);
    if (!result.ok) {
      return {
        ok: false,
        state,
        message:
          result.message ??
          "고정된 길이로는 그런 그림이 존재하지 않아요.",
      };
    }
    return result;
  }

  return {
    ok: true,
    state: patchLength(state, cleanId, {
      show: true,
      label: { ...emptyLabel("custom"), custom: text },
    }),
  };
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
    if (id === "AB") return [d.A, d.B];
    if (id === "BC") return [d.B, d.C];
    if (id === "CD") return [d.C, d.D];
    if (id === "AD" || id === "DA") return [d.A, d.D];
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
