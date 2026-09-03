import { formatMeasure, normalizeSqrtLabel } from "@/lib/diagrams/math-label";
import {
  add,
  clamp,
  isConvex,
  len,
  mul,
  norm,
  parseMeasureInput,
  sub,
} from "@/lib/diagrams/polygon/geometry";
import {
  emptyLabel,
  labelUnknownLetter,
  type MeasLabel,
  type Vec,
} from "@/lib/diagrams/polygon/model";
import {
  formatHypotenuseLabel,
} from "./radical";
import {
  altitudeBaseIds,
  altitudeFootId,
  altitudeTriangleFromLegs,
  altitudeVerticesFor,
  findSeg,
  isLockedRight,
  kindSupportsAltitude,
  normalizeState,
  patchSegState,
  triangleForRightVertex,
  type AltitudeVertex,
  type PythagoreanKind,
  type PythagoreanState,
  type SegMark,
} from "./model";

export type PythHit =
  | { kind: "point"; id: string }
  | { kind: "seg"; id: string }
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string };

export type PythSelection =
  | { t: "point"; id: string }
  | { t: "seg"; id: string };

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function projectT(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < 1e-12) return 0.5;
  return (ap.x * ab.x + ap.y * ab.y) / l2;
}

export function distToSeg(p: Vec, a: Vec, b: Vec): number {
  const t = clamp(projectT(p, a, b), 0, 1);
  const q = lerp(a, b, t);
  return len(sub(p, q));
}

export function angleAt(from: Vec, vertex: Vec, to: Vec): number {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  return (Math.acos(clamp(u.x * w.x + u.y * w.y, -1, 1)) * 180) / Math.PI;
}

export function footToLine(p: Vec, a: Vec, b: Vec, clampToSegment = true): Vec {
  const t = clampToSegment ? clamp(projectT(p, a, b), 0, 1) : projectT(p, a, b);
  return lerp(a, b, t);
}

export function extensionPoint(from: Vec, to: Vec, ext: number): Vec {
  const dir = norm(sub(to, from));
  return add(to, mul(dir, ext));
}

export function altitudeBase(
  from: AltitudeVertex,
  A: Vec,
  B: Vec,
  C: Vec,
): { a: Vec; b: Vec; aId: AltitudeVertex; bId: AltitudeVertex; apex: Vec } {
  const ids = altitudeBaseIds(from);
  const pts = { A, B, C };
  return {
    a: pts[ids.a],
    b: pts[ids.b],
    aId: ids.a,
    bId: ids.b,
    apex: pts[from],
  };
}

const RIGHT_ANGLE_EPS = 0.75;

export function isNearRightAngle(deg: number): boolean {
  return Number.isFinite(deg) && Math.abs(deg - 90) < RIGHT_ANGLE_EPS;
}

function addAltitudeFeet(
  out: Record<string, Vec>,
  A: Vec,
  B: Vec,
  C: Vec,
  state: PythagoreanState,
): void {
  const allowed = new Set(altitudeVerticesFor(state.kind));
  for (const from of state.altitudes ?? []) {
    if (!allowed.has(from)) continue;
    const base = altitudeBase(from, A, B, C);
    out[altitudeFootId(from)] = footToLine(base.apex, base.a, base.b, false);
  }
}

export function derivedPoints(state: PythagoreanState): Record<string, Vec> {
  if (state.kind === "rectangle") {
    const w = state.rectWidth;
    const h = state.rectSquare ? w : state.rectHeight;
    const A = { x: 0, y: 0 };
    const B = { x: w, y: 0 };
    const C = { x: w, y: h };
    const out: Record<string, Vec> = {
      A,
      B,
      C,
      D: { x: 0, y: h },
    };
    addAltitudeFeet(out, A, B, C, state);
    return out;
  }
  const { A, B, C } = state;
  const out: Record<string, Vec> = { A, B, C };
  if (state.kind === "altitude" && state.rightVertex === "A") {
    out.D = footToLine(A, B, C, false);
  }
  if (kindSupportsAltitude(state.kind)) {
    addAltitudeFeet(out, A, B, C, state);
  }
  return out;
}

function altitudeStrokePairs(state: PythagoreanState): [string, string][] {
  const allowed = new Set(altitudeVerticesFor(state.kind));
  const segs: [string, string][] = [];
  for (const from of state.altitudes ?? []) {
    if (!allowed.has(from)) continue;
    segs.push([from, altitudeFootId(from)]);
  }
  return segs;
}

export function figureStrokes(state: PythagoreanState): [string, string][] {
  switch (state.kind) {
    case "triangle": {
      return [
        ["A", "B"],
        ["B", "C"],
        ["A", "C"],
        ...altitudeStrokePairs(state),
      ];
    }
    case "squares":
      return [
        ["A", "B"],
        ["B", "C"],
        ["A", "C"],
        ...altitudeStrokePairs(state),
      ];
    case "altitude":
      return [
        ["A", "B"],
        ["B", "C"],
        ["A", "C"],
        ["A", "D"],
        ...altitudeStrokePairs(state),
      ];
    case "rectangle":
      return state.showDiagonal
        ? [
            ["A", "B"],
            ["B", "C"],
            ["C", "D"],
            ["D", "A"],
            ["A", "C"],
            ...altitudeStrokePairs(state),
          ]
        : [
            ["A", "B"],
            ["B", "C"],
            ["C", "D"],
            ["D", "A"],
            ...altitudeStrokePairs(state),
          ];
    default:
      return [];
  }
}

export function draggableIds(state: PythagoreanState): string[] {
  switch (state.kind) {
    case "proof":
      return [];
    case "rectangle":
      return ["A", "B", "C"];
    default:
      return ["A", "B", "C"];
  }
}

export function displayName(state: PythagoreanState, id: string): string {
  return state.names[id]?.name?.trim() || id;
}

export function segDisplayName(state: PythagoreanState, seg: SegMark): string {
  return `${displayName(state, seg.a)}${displayName(state, seg.b)}`;
}

export function segLength(state: PythagoreanState, seg: SegMark): number {
  const pts = derivedPoints(state);
  const a = pts[seg.a];
  const b = pts[seg.b];
  if (!a || !b) return 0;
  return len(sub(b, a));
}

function legLengths(state: PythagoreanState): { left: number; right: number; hyp: number } {
  const pts = derivedPoints(state);
  const { A, B, C } = pts;
  const rv = state.rightVertex;
  if (!isLockedRight(rv)) {
    const left = len(sub(B!, C!));
    const right = len(sub(A!, C!));
    return { left, right, hyp: len(sub(A!, B!)) };
  }
  if (rv === "C") {
    const left = len(sub(B!, C!));
    const right = len(sub(A!, C!));
    return { left, right, hyp: len(sub(A!, B!)) };
  }
  if (rv === "A") {
    const left = len(sub(B!, A!));
    const right = len(sub(C!, A!));
    return { left, right, hyp: len(sub(B!, C!)) };
  }
  const left = len(sub(A!, B!));
  const right = len(sub(C!, B!));
  return { left, right, hyp: len(sub(A!, C!)) };
}

export function syncLegFields(state: PythagoreanState): PythagoreanState {
  const { left, right } = legLengths(state);
  return {
    ...state,
    legLeft: Number(left.toFixed(4)),
    legRight: Number(right.toFixed(4)),
  };
}

export function rebuildTriangleFromLegs(
  state: PythagoreanState,
  legLeft: number,
  legRight: number,
): PythagoreanState {
  let ll = legLeft;
  let lr = legRight;
  if (state.isoscelesRight) {
    ll = Math.max(ll, lr);
    lr = ll;
  }
  const rv = state.kind === "altitude" ? "A" : state.rightVertex;
  let t: { A: Vec; B: Vec; C: Vec };
  if (rv === "none") {
    return syncLegFields({ ...state, legLeft: ll, legRight: lr, isoscelesRight: false });
  }
  if (state.kind === "altitude" || rv === "A") {
    t = altitudeTriangleFromLegs(ll, lr);
  } else {
    t = triangleForRightVertex(ll, lr, rv);
  }
  const patch: PythagoreanState = {
    ...state,
    A: t.A,
    B: t.B,
    C: t.C,
    legLeft: ll,
    legRight: lr,
    rightVertex: rv,
  };
  if (state.kind === "altitude") {
    return snapAltitude(patch);
  }
  return syncLegFields(patch);
}

function segLegRole(
  state: PythagoreanState,
  segId: string,
): "left" | "right" | "hyp" | null {
  if (state.kind === "rectangle") {
    if (segId === "AB") return "left";
    if (segId === "BC") return "right";
    if (segId === "AC") return "hyp";
    return null;
  }
  const rv = state.kind === "altitude" ? "A" : state.rightVertex;
  if (!isLockedRight(rv)) return null;
  const hyp = ({ C: "AB", A: "BC", B: "AC" } as const)[rv];
  const left = ({ C: "BC", A: "AB", B: "AB" } as const)[rv];
  const right = ({ C: "AC", A: "AC", B: "BC" } as const)[rv];
  if (segId === hyp) return "hyp";
  if (segId === left) return "left";
  if (segId === right) return "right";
  return null;
}

function setLegFromEdit(
  state: PythagoreanState,
  which: "left" | "right" | "hyp",
  value: number,
): PythagoreanState {
  const legs = legLengths(state);
  let left = legs.left;
  let right = legs.right;
  if (which === "left") left = value;
  else if (which === "right") right = value;
  else {
    const ratio = value / Math.max(legs.hyp, 1e-6);
    left *= ratio;
    right *= ratio;
  }
  if (state.isoscelesRight) {
    const avg = which === "hyp" ? value / Math.SQRT2 : value;
    left = avg;
    right = avg;
  }
  return rebuildTriangleFromLegs(state, left, right);
}

function applyRectangleDimEdit(
  state: PythagoreanState,
  which: "left" | "right" | "hyp",
  value: number,
): PythagoreanState {
  let rectWidth = state.rectWidth;
  let rectHeight = state.rectHeight;
  if (which === "left") rectWidth = value;
  else if (which === "right") rectHeight = value;
  else {
    rectHeight = Math.sqrt(Math.max(0, value ** 2 - rectWidth ** 2));
  }
  return normalizeState({
    ...state,
    rectWidth,
    rectHeight,
    rectSquare: state.rectSquare && which !== "right",
  });
}

function rebuildTriangle(state: PythagoreanState, legLeft: number, legRight: number): PythagoreanState {
  return rebuildTriangleFromLegs(state, legLeft, legRight);
}

function labelFromParse(
  parsed: ReturnType<typeof parseMeasureInput>,
  text: string,
  prev: MeasLabel,
): MeasLabel {
  if (parsed.kind === "unknown") {
    return { ...prev, mode: "x", custom: parsed.unknown ?? "x" };
  }
  if (parsed.kind === "number" && parsed.value != null) {
    return { ...prev, mode: "custom", custom: String(parsed.value) };
  }
  if (!text.trim()) return { ...prev, mode: "hide", custom: "" };
  return { ...prev, mode: "custom", custom: text.trim() };
}

export function applyEditedLabel(state: PythagoreanState, labelId: string, text: string): PythagoreanState {
  const trimmed = text.trim();
  if (labelId.startsWith("s:")) {
    const segId = labelId.slice(2);
    const seg = findSeg(state, segId);
    if (!seg) return state;
    const parsed = parseMeasureInput(trimmed);
    let next = {
      ...state,
      segs: state.segs.map((s) =>
        s.id === segId
          ? { ...s, show: true, label: labelFromParse(parsed, trimmed, seg.label) }
          : s,
      ),
    };
    if (parsed.kind === "number" && parsed.value != null) {
      const role = segLegRole(next, segId);
      if (
        role
        && (state.kind === "triangle"
          || state.kind === "squares"
          || state.kind === "altitude")
      ) {
        next = setLegFromEdit(next, role, parsed.value);
      } else if (state.kind === "rectangle" && role) {
        next = applyRectangleDimEdit(next, role, parsed.value);
      }
    }
    return next;
  }
  return state;
}

function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}

const MIN_LEG = 0.35;

/** Grid cell size in math units when 모눈 is on (matches scene grid pitch for typical figures). */
export function gridStep(state: PythagoreanState): number {
  return state.showGrid ? 1 : 0;
}

export function snapMathPoint(state: PythagoreanState, p: Vec): Vec {
  const step = gridStep(state);
  if (step <= 0) return p;
  return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
}

function dist2(a: Vec, b: Vec): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function snapCandidates(state: PythagoreanState, raw: Vec): Vec[] {
  const step = gridStep(state);
  if (step <= 0) return [raw];
  const snapped = snapMathPoint(state, raw);
  const out: Vec[] = [snapped];
  for (let dx = -step; dx <= step; dx += step) {
    for (let dy = -step; dy <= step; dy += step) {
      if (dx === 0 && dy === 0) continue;
      out.push({ x: snapped.x + dx, y: snapped.y + dy });
    }
  }
  out.sort((a, b) => dist2(a, raw) - dist2(b, raw));
  return out;
}

function perpToward(from: Vec, leg: Vec, hint: Vec): Vec {
  const left = { x: -leg.y, y: leg.x };
  const right = { x: leg.y, y: -leg.x };
  const dl = dot(left, sub(hint, from));
  const dr = dot(right, sub(hint, from));
  const pick = dl >= dr ? left : right;
  const l = len(pick);
  if (l < 1e-9) return { x: 0, y: 1 };
  return mul(pick, 1 / l);
}

function rightAngleOk(at: Vec, leg1: Vec, leg2: Vec): boolean {
  const u = sub(leg1, at);
  const v = sub(leg2, at);
  if (len(u) < MIN_LEG || len(v) < MIN_LEG) return false;
  const c = dot(norm(u), norm(v));
  return Math.abs(c) < 0.02;
}

type RightDrag = "vertex" | "leg1" | "leg2";

function moveRightTriangle(
  vertex: Vec,
  leg1: Vec,
  leg2: Vec,
  moved: RightDrag,
  pos: Vec,
): { vertex: Vec; leg1: Vec; leg2: Vec } | null {
  if (moved === "leg1") {
    const vf = vertex;
    const l1 = pos;
    const len2 = len(sub(leg2, vf));
    const d = sub(l1, vf);
    if (len(d) < MIN_LEG || len2 < MIN_LEG) return null;
    const l2 = add(vf, mul(perpToward(vf, d, leg2), len2));
    if (!rightAngleOk(vf, l1, l2)) return null;
    return { vertex: vf, leg1: l1, leg2: l2 };
  }
  if (moved === "leg2") {
    const vf = vertex;
    const l2 = pos;
    const len1 = len(sub(leg1, vf));
    const d = sub(l2, vf);
    if (len(d) < MIN_LEG || len1 < MIN_LEG) return null;
    const l1 = add(vf, mul(perpToward(vf, d, leg1), len1));
    if (!rightAngleOk(vf, l1, l2)) return null;
    return { vertex: vf, leg1: l1, leg2: l2 };
  }
  const l1f = leg1;
  const vn = pos;
  const len2 = len(sub(leg2, vertex));
  const d = sub(l1f, vn);
  if (len(d) < MIN_LEG || len2 < MIN_LEG) return null;
  const l2 = add(vn, mul(perpToward(vn, d, leg2), len2));
  if (!rightAngleOk(vn, l1f, l2)) return null;
  return { vertex: vn, leg1: l1f, leg2: l2 };
}

function enforceIsosceles(
  vertex: Vec,
  leg1: Vec,
  leg2: Vec,
): { leg1: Vec; leg2: Vec } {
  const l1 = len(sub(leg1, vertex));
  const l2 = len(sub(leg2, vertex));
  const target = (l1 + l2) / 2;
  return {
    leg1: add(vertex, mul(norm(sub(leg1, vertex)), target)),
    leg2: add(vertex, mul(norm(sub(leg2, vertex)), target)),
  };
}

function mapRightTriangle(
  state: PythagoreanState,
  A: Vec,
  B: Vec,
  C: Vec,
): { vertex: Vec; leg1: Vec; leg2: Vec; mapBack: (v: Vec, l1: Vec, l2: Vec) => { A: Vec; B: Vec; C: Vec } } | null {
  const rv = state.rightVertex;
  if (rv === "C") {
    return {
      vertex: C,
      leg1: B,
      leg2: A,
      mapBack: (v, l1, l2) => ({ A: l2, B: l1, C: v }),
    };
  }
  if (rv === "A") {
    return {
      vertex: A,
      leg1: B,
      leg2: C,
      mapBack: (v, l1, l2) => ({ A: v, B: l1, C: l2 }),
    };
  }
  if (rv === "B") {
    return {
      vertex: B,
      leg1: A,
      leg2: C,
      mapBack: (v, l1, l2) => ({ A: l1, B: v, C: l2 }),
    };
  }
  return null;
}

function dragRole(state: PythagoreanState, moved: string): RightDrag | null {
  const rv = state.rightVertex;
  if (!isLockedRight(rv)) return null;
  if (rv === "C") {
    if (moved === "C") return "vertex";
    if (moved === "B") return "leg1";
    if (moved === "A") return "leg2";
  }
  if (rv === "A") {
    if (moved === "A") return "vertex";
    if (moved === "B") return "leg1";
    if (moved === "C") return "leg2";
  }
  if (rv === "B") {
    if (moved === "B") return "vertex";
    if (moved === "A") return "leg1";
    if (moved === "C") return "leg2";
  }
  return null;
}

function applyIsoscelesIfNeeded(
  state: PythagoreanState,
  A: Vec,
  B: Vec,
  C: Vec,
): { A: Vec; B: Vec; C: Vec } {
  if (!state.isoscelesRight) return { A, B, C };
  const mapped = mapRightTriangle(state, A, B, C);
  if (!mapped) return { A, B, C };
  const { vertex, leg1, leg2, mapBack } = mapped;
  const eq = enforceIsosceles(vertex, leg1, leg2);
  return mapBack(vertex, eq.leg1, eq.leg2);
}
function triangleOk(A: Vec, B: Vec, C: Vec): boolean {
  const ab = len(sub(B, A));
  const ac = len(sub(C, A));
  const bc = len(sub(C, B));
  return ab >= 0.4 && ac >= 0.4 && bc >= 0.4;
}

function snapAltitude(state: PythagoreanState): PythagoreanState {
  const { A, B } = state;
  let { C } = state;
  const ab = sub(B, A);
  const ac = sub(C, A);
  const abLen = len(ab);
  const acLen = len(ac);
  if (abLen < 0.4 || acLen < 0.4) return state;
  const n = norm({ x: -ab.y, y: ab.x });
  const sign = ac.x * n.x + ac.y * n.y >= 0 ? 1 : -1;
  C = add(A, mul(n, sign * acLen));
  if (!triangleOk(A, B, C)) return state;
  return syncLegFields({ ...state, rightVertex: "A", C });
}

function moveAltitudePoint(
  state: PythagoreanState,
  moved: string,
  pos: Vec,
): PythagoreanState {
  if (moved === "A") {
    const d = sub(pos, state.A);
    return snapAltitude({
      ...state,
      A: pos,
      B: add(state.B, d),
      C: add(state.C, d),
    });
  }
  if (moved === "B") {
    const ac = sub(state.C, state.A);
    const n = norm({ x: -ac.y, y: ac.x });
    const t = (pos.x - state.A.x) * n.x + (pos.y - state.A.y) * n.y;
    const B = add(state.A, mul(n, t));
    if (!triangleOk(state.A, B, state.C)) return state;
    return snapAltitude({ ...state, B });
  }
  if (moved === "C") {
    const ab = sub(state.B, state.A);
    const n = norm({ x: -ab.y, y: ab.x });
    const t = (pos.x - state.A.x) * n.x + (pos.y - state.A.y) * n.y;
    const C = add(state.A, mul(n, t));
    if (!triangleOk(state.A, state.B, C)) return state;
    return snapAltitude({ ...state, C });
  }
  return state;
}

function maintainRightAngle(
  state: PythagoreanState,
  moved: string,
  pos: Vec,
): PythagoreanState {
  const pts = derivedPoints(state);
  let A = pts.A!;
  let B = pts.B!;
  let C = pts.C!;

  if (state.kind === "altitude") {
    return moveAltitudePoint(state, moved, pos);
  }

  if (state.kind === "rectangle") {
    const snapped = snapMathPoint(state, pos);
    if (moved === "A") {
      A = snapped;
      B = { x: A.x + state.rectWidth, y: A.y };
      C = { x: B.x, y: B.y + state.rectHeight };
    } else if (moved === "B") {
      B = snapped;
      A = { x: B.x - state.rectWidth, y: B.y };
      C = { x: B.x, y: B.y + state.rectHeight };
    } else if (moved === "C") {
      C = snapped;
      B = { x: C.x, y: C.y - state.rectHeight };
      A = { x: B.x - state.rectWidth, y: B.y };
    }
    return { ...state, A, B, C };
  }

  if (!isLockedRight(state.rightVertex) && (moved === "A" || moved === "B" || moved === "C")) {
    const next = { ...state, [moved]: pos } as PythagoreanState;
    const ptsNext = [next.A, next.B, next.C];
    if (!isConvex(ptsNext) || !triangleOk(next.A, next.B, next.C)) return state;
    return syncLegFields(next);
  }

  const role = dragRole(state, moved);
  if (!role) return state;

  const mapped = mapRightTriangle(state, A, B, C);
  if (!mapped) return state;
  const result = moveRightTriangle(mapped.vertex, mapped.leg1, mapped.leg2, role, pos);
  if (!result) return state;

  let next = mapped.mapBack(result.vertex, result.leg1, result.leg2);
  next = applyIsoscelesIfNeeded(state, next.A, next.B, next.C);
  return syncLegFields({ ...state, ...next });
}

export function movePoint(state: PythagoreanState, id: string, p: Vec): PythagoreanState {
  if (!draggableIds(state).includes(id)) return state;
  for (const candidate of snapCandidates(state, p)) {
    const next = maintainRightAngle(state, id, candidate);
    if (next !== state) return next;
  }
  return state;
}

function canvasCentroid(canvasPts: Record<string, Vec>, ids: string[]): Vec {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const id of ids) {
    const p = canvasPts[id];
    if (!p) continue;
    x += p.x;
    y += p.y;
    n += 1;
  }
  if (n === 0) return { x: 0, y: 0 };
  return { x: x / n, y: y / n };
}

function perpOutward(along: Vec, toward: Vec): Vec {
  const dir = norm(along);
  let p: Vec = { x: -dir.y, y: dir.x };
  if (p.x * toward.x + p.y * toward.y < 0) p = { x: -p.x, y: -p.y };
  return p;
}

/** Canvas-space axes for a length mark: `dx` along the side, `dy` outward. */
export function segDimAxes(
  state: PythagoreanState,
  canvasPts: Record<string, Vec>,
  aId: string,
  bId: string,
): { along: Vec; outward: Vec } | null {
  const a = canvasPts[aId];
  const b = canvasPts[bId];
  if (!a || !b) return null;
  const along = norm(sub(b, a));
  if (len(along) < 1e-6) return null;
  const mid = mul(add(a, b), 0.5);
  const face = canvasCentroid(canvasPts, ["A", "B", "C"]);
  return { along, outward: perpOutward(along, sub(mid, face)) };
}

export function nudgeLabel(
  state: PythagoreanState,
  id: string,
  dx: number,
  dy: number,
  lineOnly = false,
  canvasPts?: Record<string, Vec>,
): PythagoreanState {
  if (id.startsWith("n:")) {
    const pid = id.slice(2);
    const prev = state.names[pid];
    if (!prev) return state;
    return {
      ...state,
      names: {
        ...state.names,
        [pid]: {
          ...prev,
          dx: clamp(prev.dx + dx, -80, 80),
          dy: clamp(prev.dy + dy, -80, 80),
        },
      },
    };
  }

  const segMatch = /^s:(.+)$/.exec(id);
  if (!segMatch) return state;
  const segId = segMatch[1]!;
  const seg = findSeg(state, segId);
  let alongAmt = dx;
  let perpAmt = dy;
  if (seg && canvasPts) {
    const axes = segDimAxes(state, canvasPts, seg.a, seg.b);
    if (axes) {
      alongAmt = dx * axes.along.x + dy * axes.along.y;
      perpAmt = dx * axes.outward.x + dy * axes.outward.y;
    }
  }
  function nudgeMeas(label: MeasLabel): MeasLabel {
    if (lineOnly) {
      return { ...label, lineDy: clamp((label.lineDy ?? 0) + perpAmt, -160, 160) };
    }
    return {
      ...label,
      dx: clamp(label.dx + alongAmt, -80, 80),
      dy: clamp(label.dy + perpAmt, -160, 160),
    };
  }
  return {
    ...state,
    segs: state.segs.map((s) =>
      s.id === segId ? { ...s, label: nudgeMeas(s.label) } : s,
    ),
  };
}

export function toggleSeg(state: PythagoreanState, id: string): PythagoreanState {
  const seg = findSeg(state, id);
  if (!seg) return state;
  return patchSegState(state, id, { show: !seg.show });
}

export function hitTestPythagorean(
  canvasPts: Record<string, Vec>,
  texts: { id: string; x: number; y: number }[],
  cmds: { t: string; id?: string; x1?: number; y1?: number; x2?: number; y2?: number }[],
  strokes: [string, string][],
  segs: SegMark[],
  x: number,
  y: number,
  scale = 1,
  dragIds: string[],
): PythHit | null {
  const labelR = 22 * Math.max(scale, 0.85);
  let bestText: { id: string; d: number } | null = null;
  for (const text of texts) {
    if (text.id.endsWith(":line")) continue;
    const d = Math.hypot(text.x - x, text.y - y);
    if (d < labelR && (!bestText || d < bestText.d)) bestText = { id: text.id, d };
  }
  if (bestText) return { kind: "label", id: bestText.id };

  const pointR = 14 * Math.max(scale, 0.85);
  let bestP: { id: string; d: number } | null = null;
  for (const id of dragIds) {
    const p = canvasPts[id];
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < pointR && (!bestP || d < bestP.d)) bestP = { id, d };
  }
  if (bestP) return { kind: "point", id: bestP.id };

  const dimR = 10 * Math.max(scale, 0.85);
  let bestDim: PythHit | null = null;
  let bestDimD = dimR;
  for (const cmd of cmds) {
    if (!cmd.id || !cmd.id.endsWith(":line")) continue;
    if (cmd.t === "line" && cmd.x1 != null && cmd.y1 != null && cmd.x2 != null && cmd.y2 != null) {
      const d = distToSeg({ x, y }, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 });
      if (d < bestDimD) {
        bestDimD = d;
        bestDim = { kind: "dimLine", id: cmd.id.slice(0, -5) };
      }
    }
    if (
      cmd.t === "arc"
      && "cx" in cmd
      && "cy" in cmd
      && "r" in cmd
      && typeof cmd.cx === "number"
      && typeof cmd.cy === "number"
      && typeof cmd.r === "number"
    ) {
      const d = Math.abs(Math.hypot(x - cmd.cx, y - cmd.cy) - cmd.r);
      if (d < bestDimD) {
        bestDimD = d;
        bestDim = { kind: "dimLine", id: cmd.id.slice(0, -5) };
      }
    }
  }
  if (bestDim) return bestDim;

  const edgeR = 9 * Math.max(scale, 0.85);
  let bestE: { id: string; d: number } | null = null;
  const candidates = [
    ...segs.filter((s) => s.show).map((s) => ({ id: s.id, a: s.a, b: s.b })),
    ...strokes.map(([a, b]) => ({ id: `${a}${b}`, a, b })),
  ];
  for (const c of candidates) {
    const pa = canvasPts[c.a];
    const pb = canvasPts[c.b];
    if (!pa || !pb) continue;
    const d = distToSeg({ x, y }, pa, pb);
    if (d < edgeR && (!bestE || d < bestE.d)) bestE = { id: c.id, d };
  }
  if (bestE) {
    const seg = segs.find((s) => s.id === bestE!.id)
      ?? segs.find((s) => `${s.a}${s.b}` === bestE!.id || `${s.b}${s.a}` === bestE!.id);
    if (seg) return { kind: "seg", id: seg.id };
    return { kind: "seg", id: bestE.id };
  }
  return null;
}

export function formatLeg(n: number, unit: string): string {
  return formatMeasure(n, unit);
}

export function resolveSegText(state: PythagoreanState, seg: SegMark): string | null {
  const auto = segLength(state, seg);
  const label = seg.label;
  if (label.mode === "hide") return null;
  if (label.mode === "x") {
    const u = state.unit.trim();
    const math = `$${labelUnknownLetter(label, state.unknownLetter)}$`;
    return u ? `${math} ${u}` : math;
  }
  if (label.mode === "custom") {
    const t = normalizeSqrtLabel(label.custom.trim());
    return t.length > 0 ? t : null;
  }
  const role = segLegRole(state, seg.id);
  if (
    role === "hyp"
    && (state.kind === "triangle"
      || state.kind === "squares"
      || state.kind === "rectangle"
      || state.kind === "altitude")
  ) {
    const { left, right } = legLengths(state);
    return formatHypotenuseLabel(left, right, state.unit, auto);
  }
  return formatMeasure(auto, state.unit);
}

export function pointIdsFor(state: PythagoreanState | PythagoreanKind): string[] {
  const kind = typeof state === "string" ? state : state.kind;
  const ids =
    kind === "altitude" || kind === "rectangle" ? ["A", "B", "C", "D"] : ["A", "B", "C"];
  if (typeof state !== "string") {
    for (const from of state.altitudes ?? []) {
      const foot = altitudeFootId(from);
      if (!ids.includes(foot)) ids.push(foot);
    }
  }
  return ids;
}

export function normalizeAndSync(state: PythagoreanState): PythagoreanState {
  return syncLegFields(normalizeState(state));
}
