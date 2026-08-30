import {
  add,
  applyEdgeLengthChange,
  applyInteriorAngleChange,
  applyEditedLabel as applyPolygonLabel,
  clamp,
  edgeLength,
  extensionEnd,
  isConvex,
  len,
  mul,
  nextIndex,
  norm,
  nudgeLabel as nudgePolygonLabel,
  parseAngleInput,
  parseMeasureInput,
  prevIndex,
  sub,
  vertexAngles,
} from "@/lib/diagrams/polygon/geometry";
import { emptyLabel, type MeasLabel, type Vec } from "@/lib/diagrams/polygon/model";
import {
  fromPolygonState,
  normalizeState,
  toPolygonState,
  vertexLetter,
  type AngleFill,
  type AngleMark,
  type DiagSegId,
  type ExtraArcs,
  type FaceFill,
  type QuadExtension,
  type QuadFamily,
  type QuadState,
  type TickCount,
  type WedgeMark,
  makeExtension,
  nextExtName,
} from "./model";

export type QuadHit =
  | { kind: "vertex"; index: number }
  | { kind: "edge"; index: number }
  | { kind: "o" }
  | { kind: "extension"; index: number }
  | { kind: "seg"; id: DiagSegId }
  | { kind: "diag"; which: "AC" | "BD" }
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string };

export type QuadSelection =
  | { t: "vertex"; i: number }
  | { t: "edge"; i: number }
  | { t: "o" }
  | { t: "extension"; i: number }
  | { t: "seg"; id: DiagSegId }
  | { t: "diag"; which: "AC" | "BD" };

const MIN_EDGE = 0.4;
const RIGHT_EPS = 0.75;

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function midpoint(a: Vec, b: Vec): Vec {
  return mul(add(a, b), 0.5);
}

export function unitPerp(v: Vec): Vec {
  return norm({ x: -v.y, y: v.x });
}

function cross(a: Vec, b: Vec): number {
  return a.x * b.y - a.y * b.x;
}

function rotate(v: Vec, deg: number): Vec {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export function validQuad(points: Vec[]): boolean {
  if (points.length !== 4 || !isConvex(points)) return false;
  for (let i = 0; i < 4; i += 1) {
    if (edgeLength(points, i) < MIN_EDGE) return false;
  }
  return true;
}

export function intersection(a: Vec, b: Vec, c: Vec, d: Vec): Vec {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-9) return midpoint(a, b);
  const t = cross(sub(c, a), s) / den;
  return add(a, mul(r, t));
}

export function diagonalMeet(points: Vec[]): Vec {
  return intersection(points[0]!, points[2]!, points[1]!, points[3]!);
}

export function extensionPointAt(state: QuadState, ext: QuadExtension): Vec {
  const i = ext.vertex;
  const p = state.points[i]!;
  const other =
    ext.dir === "out" ? state.points[nextIndex(i, 4)]! : state.points[prevIndex(i, 4)]!;
  let avg = 0;
  for (let k = 0; k < 4; k += 1) avg += edgeLength(state.points, k);
  return extensionEnd(other, p, (avg / 4) * 0.55);
}

export function extensionPoints(state: QuadState): Vec[] {
  return state.extensions.map((ext) => extensionPointAt(state, ext));
}

export function hasExtension(
  state: QuadState,
  vertex: 0 | 1 | 2 | 3,
  dir: QuadExtension["dir"],
): boolean {
  return state.extensions.some((e) => e.vertex === vertex && e.dir === dir);
}

export function toggleExtension(
  state: QuadState,
  vertex: 0 | 1 | 2 | 3,
  dir: QuadExtension["dir"],
): QuadState {
  const index = state.extensions.findIndex((e) => e.vertex === vertex && e.dir === dir);
  if (index >= 0) {
    return {
      ...state,
      extensions: state.extensions.filter((_, i) => i !== index),
    };
  }
  return {
    ...state,
    extensions: [
      ...state.extensions,
      makeExtension({
        vertex,
        dir,
        name: nextExtName(state.extensions),
      }),
    ],
  };
}

function keepSide(n: Vec, toward: Vec): Vec {
  if (n.x * toward.x + n.y * toward.y < 0) return mul(n, -1);
  return n;
}

function snapParallelogram(pts: Vec[], dragged: number): Vec[] {
  const A = pts[0]!;
  const B = pts[1]!;
  const C = pts[2]!;
  const D = pts[3]!;
  if (dragged === 3) {
    return [A, B, add(B, sub(D, A)), D];
  }
  return [A, B, C, add(A, sub(C, B))];
}

function snapRectangle(pts: Vec[], dragged: number): Vec[] {
  const A0 = pts[0]!;
  const B0 = pts[1]!;
  const C0 = pts[2]!;
  const D0 = pts[3]!;
  if (dragged === 0) {
    const delta = sub(A0, add(B0, sub(D0, C0)));
    const A = A0;
    const B = add(B0, delta);
    const C = add(C0, delta);
    const D = add(D0, delta);
    return snapRectangle([A, B, C, D], 1);
  }
  if (dragged === 2) {
    const A = A0;
    const u = sub(C0, A);
    const w = Math.max(Math.abs(u.x) < Math.abs(u.y) ? 0 : u.x, MIN_EDGE);
    const h = Math.max(Math.abs(u.y), MIN_EDGE);
    const signW = u.x >= 0 ? 1 : -1;
    const signH = D0.y >= A.y ? 1 : -1;
    const dir = norm(sub(B0, A));
    const useAxis = Math.abs(dir.x) < 0.2 || Math.abs(dir.y) < 0.2;
    if (useAxis || Math.abs(dir.x) > 0.95 || Math.abs(dir.y) > 0.95) {
      const B = { x: A.x, y: A.y - signH * h };
      const D = { x: A.x + signW * w, y: A.y };
      const C = { x: D.x, y: B.y };
      if (validQuad([A, B, C, D])) return [A, B, C, D];
    }
    const along = norm(sub(B0, A0));
    const n = keepSide(unitPerp(along), sub(D0, A0));
    const width = Math.max(Math.abs(dot2(sub(C0, A), along)), MIN_EDGE);
    const height = Math.max(Math.abs(dot2(sub(C0, A), n)), MIN_EDGE);
    const B = add(A, mul(along, width));
    const D = add(A, mul(n, height));
    const C = add(B, sub(D, A));
    return validQuad([A, B, C, D]) ? [A, B, C, D] : pts;
  }
  const A = A0;
  const B = B0;
  const along = norm(sub(B, A));
  if (len(along) < 1e-9) return pts;
  const n = keepSide(unitPerp(along), sub(D0, A));
  const heightSrc = dragged === 3 ? D0 : C0;
  const height = Math.max(Math.abs(dot2(sub(heightSrc, A), n)), MIN_EDGE);
  const D = add(A, mul(n, height));
  const C = add(B, sub(D, A));
  return validQuad([A, B, C, D]) ? [A, B, C, D] : pts;
}

function dot2(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}

function snapRhombus(pts: Vec[], dragged: number): Vec[] {
  const A = pts[0]!;
  const B = pts[1]!;
  const C = pts[2]!;
  const D = pts[3]!;
  const sideSrc = dragged === 3 || dragged === 2 ? sub(D, A) : sub(B, A);
  const s = Math.max(len(dragged === 2 ? sub(B, A) : sideSrc), MIN_EDGE);
  if (dragged === 2) {
    const ad = sub(C, B);
    if (len(ad) < 1e-9) return pts;
    const D2 = add(A, mul(norm(ad), s));
    const C2 = add(B, sub(D2, A));
    return validQuad([A, B, C2, D2]) ? [A, B, C2, D2] : pts;
  }
  const ab = sub(B, A);
  if (len(ab) < 1e-9) return pts;
  const u = norm(ab);
  const ad = dragged === 3 ? sub(D, A) : sub(D, A);
  const toward = len(ad) > 1e-9 ? ad : { x: -u.y, y: u.x };
  const ang = Math.acos(clamp(dot2(u, norm(toward)), -1, 1));
  const sign = Math.sign(cross(u, toward)) || 1;
  const w = rotate(u, sign * clamp((ang * 180) / Math.PI, 8, 172));
  const sAB = Math.max(len(ab), MIN_EDGE);
  const D2 = add(A, mul(w, sAB));
  const C2 = add(B, sub(D2, A));
  return validQuad([A, B, C2, D2]) ? [A, B, C2, D2] : pts;
}

function snapSquare(pts: Vec[], dragged: number): Vec[] {
  const A = pts[0]!;
  const B0 = pts[1]!;
  const C0 = pts[2]!;
  const D0 = pts[3]!;
  if (dragged === 2) {
    const M = midpoint(A, C0);
    const v = mul(sub(C0, A), 0.5);
    let n = { x: -v.y, y: v.x };
    const Btry = add(M, n);
    if (dot2(sub(Btry, M), sub(B0, M)) < 0) n = mul(n, -1);
    const B = add(M, n);
    const D = sub(M, n);
    return validQuad([A, B, C0, D]) ? [A, B, C0, D] : pts;
  }
  const along = norm(sub(B0, A));
  if (len(along) < 1e-9) return pts;
  const s = Math.max(len(sub(B0, A)), MIN_EDGE);
  const n = keepSide(unitPerp(along), sub(D0, A));
  const B = add(A, mul(along, s));
  const D = add(A, mul(n, s));
  const C = add(B, sub(D, A));
  return validQuad([A, B, C, D]) ? [A, B, C, D] : pts;
}

function snapTrapezoid(pts: Vec[], dragged: number): Vec[] {
  const A = pts[0]!;
  const B = pts[1]!;
  const C = pts[2]!;
  const D = pts[3]!;
  if (dragged === 0 || dragged === 3) {
    const along = norm(sub(C, B));
    if (len(along) < 1e-9) return pts;
    if (dragged === 0) {
      const D2 = add(A, mul(along, dot2(sub(D, A), along)));
      return validQuad([A, B, C, D2]) ? [A, B, C, D2] : pts;
    }
    const A2 = add(D, mul(along, dot2(sub(A, D), along)));
    return validQuad([A2, B, C, D]) ? [A2, B, C, D] : pts;
  }
  const along = norm(sub(D, A));
  if (len(along) < 1e-9) return pts;
  if (dragged === 1) {
    const C2 = add(B, mul(along, dot2(sub(C, B), along)));
    return validQuad([A, B, C2, D]) ? [A, B, C2, D] : pts;
  }
  const B2 = add(C, mul(along, dot2(sub(B, C), along)));
  return validQuad([A, B2, C, D]) ? [A, B2, C, D] : pts;
}

export function snapFamily(points: Vec[], family: QuadFamily, dragged = 1): Vec[] {
  switch (family) {
    case "rectangle":
      return snapRectangle(points, dragged);
    case "rhombus":
      return snapRhombus(points, dragged);
    case "square":
      return snapSquare(points, dragged);
    case "trapezoid":
      return snapTrapezoid(points, dragged);
    default:
      return snapParallelogram(points, dragged);
  }
}

export function syncDerived(state: QuadState): QuadState {
  return normalizeState({
    ...state,
    interiorAnglesDeg: [0, 1, 2, 3].map((i) => vertexAngles(state.points, i).interior),
    referenceEdgeLength: edgeLength(state.points, 0),
  });
}

export function moveVertexQuad(state: QuadState, index: number, next: Vec): QuadState {
  const trial = state.points.map((p, i) => (i === index ? next : p));
  const points = snapFamily(trial, state.family, index);
  if (!validQuad(points)) return state;
  return syncDerived({ ...state, points });
}

function setAngleAtA(pts: Vec[], deg: number, equalSides: boolean): Vec[] | null {
  const A = pts[0]!;
  const B = pts[1]!;
  const D = pts[3]!;
  const u = norm(sub(B, A));
  if (len(u) < 1e-9) return null;
  const dist = equalSides ? len(sub(B, A)) : Math.max(len(sub(D, A)), MIN_EDGE);
  const sign = Math.sign(cross(u, sub(D, A))) || 1;
  const D2 = add(A, mul(rotate(u, sign * deg), dist));
  const C2 = add(B, sub(D2, A));
  const next = [A, B, C2, D2];
  return validQuad(next) ? next : null;
}

export function applyQuadAngle(state: QuadState, index: number, deg: number): QuadState {
  const target = clamp(deg, 8, 172);
  if (state.family === "rectangle" || state.family === "square") {
    return state;
  }
  if (state.family === "parallelogram" || state.family === "rhombus") {
    const atA = index === 0 || index === 2 ? target : 180 - target;
    const points = setAngleAtA(state.points, clamp(atA, 8, 172), state.family === "rhombus");
    if (!points) return state;
    const got = vertexAngles(points, index).interior;
    if (Math.abs(got - target) > 4) return state;
    return syncDerived({ ...state, points });
  }
  const poly = applyInteriorAngleChange(toPolygonState(state), index, target);
  const next = fromPolygonState(poly, state);
  const snapped = snapFamily(next.points, state.family, index);
  if (!validQuad(snapped)) return state;
  return syncDerived({ ...next, points: snapped });
}

export function applyWedgeAngle(state: QuadState, index: number, deg: number): QuadState {
  const target = clamp(deg, 4, 170);
  if (state.family === "rectangle" || state.family === "square") return state;
  if (state.family === "rhombus") {
    return applyQuadAngle(state, index, clamp(target * 2, 8, 172));
  }
  const asInterior = target > 40 ? target : target * 2;
  return applyQuadAngle(state, index, clamp(asInterior, 8, 172));
}

export function applyQuadLength(
  state: QuadState,
  edgeIndex: number,
  newLength: number,
): QuadState {
  const target = clamp(newLength, MIN_EDGE, 40);
  if (state.family === "rhombus" || state.family === "square") {
    const current = edgeLength(state.points, 0);
    if (current < 1e-6) return state;
    const c = {
      x: (state.points[0]!.x + state.points[2]!.x) / 2,
      y: (state.points[0]!.y + state.points[2]!.y) / 2,
    };
    const points = state.points.map((p) => add(c, mul(sub(p, c), target / current)));
    if (!validQuad(points)) return state;
    return syncDerived({ ...state, points });
  }
  if (state.family === "parallelogram") {
    const a = state.points[edgeIndex]!;
    const b = state.points[nextIndex(edgeIndex, 4)]!;
    const dir = norm(sub(b, a));
    const moved = add(a, mul(dir, target));
    const trial = state.points.map((p, i) => (i === nextIndex(edgeIndex, 4) ? moved : p));
    const points = snapFamily(trial, "parallelogram", nextIndex(edgeIndex, 4));
    if (!validQuad(points)) return state;
    return syncDerived({ ...state, points });
  }
  const poly = applyEdgeLengthChange(toPolygonState(state), edgeIndex, target);
  const next = fromPolygonState(poly, state);
  const snapped = snapFamily(next.points, state.family, nextIndex(edgeIndex, 4));
  if (!validQuad(snapped)) return state;
  return syncDerived({ ...next, points: snapped });
}

export function diagSegPoints(state: QuadState, id: DiagSegId): [Vec, Vec] {
  const A = state.points[0]!;
  const B = state.points[1]!;
  const C = state.points[2]!;
  const D = state.points[3]!;
  const O = diagonalMeet(state.points);
  switch (id) {
    case "AO":
      return [A, O];
    case "OC":
      return [O, C];
    case "BO":
      return [B, O];
    case "OD":
      return [O, D];
    case "AC":
      return [A, C];
    default:
      return [B, D];
  }
}

export function applyDiagLength(state: QuadState, id: DiagSegId, newLength: number): QuadState {
  const [a, b] = diagSegPoints(state, id);
  const current = len(sub(b, a));
  if (current < 1e-6) return state;
  const target = clamp(newLength, MIN_EDGE, 40);
  const c = diagonalMeet(state.points);
  const points = state.points.map((p) => add(c, mul(sub(p, c), target / current)));
  if (!validQuad(points)) return state;
  return syncDerived({ ...state, points });
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
    const custom = asAngle ? `${parsed.value}°` : String(parsed.value);
    return { ...prev, mode: "custom", custom };
  }
  if (!text.trim()) return { ...prev, mode: "hide", custom: "" };
  return { ...prev, mode: "custom", custom: text.trim() };
}

export function applyEditedLabel(state: QuadState, id: string, text: string): QuadState {
  if (id === "o:name") {
    return { ...state, oName: text.trim() || state.oName };
  }
  const extName = /^e:(\d+):name$/.exec(id);
  if (extName) {
    const i = Number(extName[1]);
    return {
      ...state,
      extensions: state.extensions.map((ext, idx) =>
        idx === i ? { ...ext, name: text.trim() || ext.name } : ext,
      ),
    };
  }
  if (id === "guide:top") {
    return { ...state, guideTopName: text.trim() || state.guideTopName };
  }
  if (id === "guide:bottom") {
    return { ...state, guideBottomName: text.trim() || state.guideBottomName };
  }
  const angMatch = /^v:(\d+):(interior|exterior)$/.exec(id);
  if (angMatch) {
    const i = Number(angMatch[1]);
    const which = angMatch[2] as "interior" | "exterior";
    const parsed = parseAngleInput(text);
    let next = state;
    if (parsed.kind === "number" && parsed.value != null) {
      const interiorDeg = which === "interior" ? parsed.value : 180 - parsed.value;
      next = applyQuadAngle(state, i, interiorDeg);
    }
    return {
      ...next,
      vertices: next.vertices.map((v, idx) =>
        idx === i
          ? { ...v, [which]: labelFromParse(parsed, text, v[which], true) }
          : v,
      ),
    };
  }
  const wedgeMatch = /^w:(\d+):(prev|next)$/.exec(id);
  if (wedgeMatch) {
    const i = Number(wedgeMatch[1]);
    const which = wedgeMatch[2] === "prev" ? "wedgePrev" : "wedgeNext";
    const parsed = parseAngleInput(text);
    const mark = state.vertices[i]![which];
    let next = state;
    if (parsed.kind === "number" && parsed.value != null) {
      next = applyWedgeAngle(state, i, parsed.value);
    }
    return {
      ...next,
      vertices: next.vertices.map((v, idx) =>
        idx === i
          ? { ...v, [which]: { ...mark, label: labelFromParse(parsed, text, mark.label, true) } }
          : v,
      ),
    };
  }
  const segMatch = /^d:(AO|OC|BO|OD|AC|BD)$/.exec(id);
  if (segMatch) {
    const seg = segMatch[1] as DiagSegId;
    const parsed = parseMeasureInput(text);
    if (parsed.kind === "number" && parsed.value != null) {
      const next = applyDiagLength(state, seg, parsed.value);
      return {
        ...next,
        diagSegs: {
          ...next.diagSegs,
          [seg]: {
            show: true,
            label: labelFromParse(parsed, text, state.diagSegs[seg].label, false),
          },
        },
      };
    }
    return {
      ...state,
      diagSegs: {
        ...state.diagSegs,
        [seg]: {
          show: state.diagSegs[seg].show,
          label: labelFromParse(parsed, text, state.diagSegs[seg].label, false),
        },
      },
    };
  }
  const poly = applyPolygonLabel(toPolygonState(state), id, text);
  return fromPolygonState(poly, state);
}

export function nudgeLabel(
  state: QuadState,
  id: string,
  dx: number,
  dy: number,
  lineOnly: boolean,
): QuadState {
  if (id === "o:name") {
    return {
      ...state,
      oDx: clamp(state.oDx + dx, -80, 80),
      oDy: clamp(state.oDy + dy, -80, 80),
    };
  }
  if (id === "e:name" || id.startsWith("e:")) {
    const extName = /^e:(\d+):name$/.exec(id);
    if (extName) {
      const i = Number(extName[1]);
      return {
        ...state,
        extensions: state.extensions.map((ext, idx) =>
          idx === i
            ? {
                ...ext,
                nameDx: clamp(ext.nameDx + dx, -80, 80),
                nameDy: clamp(ext.nameDy + dy, -80, 80),
              }
            : ext,
        ),
      };
    }
  }
  if (id === "guide:top") {
    return {
      ...state,
      guideTopDx: clamp(state.guideTopDx + dx, -80, 80),
      guideTopDy: clamp(state.guideTopDy + dy, -80, 80),
    };
  }
  if (id === "guide:bottom") {
    return {
      ...state,
      guideBottomDx: clamp(state.guideBottomDx + dx, -80, 80),
      guideBottomDy: clamp(state.guideBottomDy + dy, -80, 80),
    };
  }
  const wedgeMatch = /^w:(\d+):(prev|next)$/.exec(id);
  if (wedgeMatch) {
    const i = Number(wedgeMatch[1]);
    const which = wedgeMatch[2] === "prev" ? "wedgePrev" : "wedgeNext";
    return {
      ...state,
      vertices: state.vertices.map((v, idx) => {
        if (idx !== i) return v;
        const label = v[which].label;
        return {
          ...v,
          [which]: {
            ...v[which],
            label: {
              ...label,
              dx: clamp(label.dx + dx, -80, 80),
              dy: clamp(label.dy + dy, -80, 80),
            },
          },
        };
      }),
    };
  }
  const segMatch = /^d:(AO|OC|BO|OD|AC|BD)$/.exec(id);
  if (segMatch) {
    const seg = segMatch[1] as DiagSegId;
    const label = state.diagSegs[seg].label;
    const nextLabel = lineOnly
      ? { ...label, lineDy: clamp((label.lineDy ?? 0) + dy, -160, 160) }
      : {
          ...label,
          dx: clamp(label.dx + dx, -80, 80),
          dy: clamp(label.dy + dy, -160, 160),
        };
    return {
      ...state,
      diagSegs: { ...state.diagSegs, [seg]: { ...state.diagSegs[seg], label: nextLabel } },
    };
  }
  const poly = nudgePolygonLabel(toPolygonState(state), id, dx, dy, lineOnly);
  return fromPolygonState(poly, state);
}

export function clearSelectionMarks(state: QuadState, sel: QuadSelection | null): QuadState {
  if (!sel) return state;
  if (sel.t === "vertex") {
    return {
      ...state,
      vertices: state.vertices.map((v, i) =>
        i === sel.i
          ? {
              ...v,
              showInterior: false,
              fillInterior: "none",
              showExterior: false,
              fillExterior: false,
              interior: emptyLabel("auto"),
              exterior: emptyLabel("auto"),
              extraArcs: 0,
              angleMark: "none",
              wedgePrev: { ...v.wedgePrev, show: false, fill: "none", showDot: false, showX: false },
              wedgeNext: { ...v.wedgeNext, show: false, fill: "none", showDot: false, showX: false },
            }
          : v,
      ),
    };
  }
  if (sel.t === "edge") {
    return {
      ...state,
      edges: state.edges.map((e, i) =>
        i === sel.i
          ? { ...e, showLength: false, ticks: 0, parallel: false, length: emptyLabel("auto") }
          : e,
      ),
    };
  }
  if (sel.t === "o") {
    return { ...state, showO: false, showRightAtO: false };
  }
  if (sel.t === "extension") {
    return {
      ...state,
      extensions: state.extensions.filter((_, i) => i !== sel.i),
    };
  }
  if (sel.t === "seg") {
    return {
      ...state,
      diagSegs: {
        ...state.diagSegs,
        [sel.id]: { show: false, label: emptyLabel("auto") },
      },
    };
  }
  if (sel.which === "AC") return { ...state, showDiagAC: false };
  return { ...state, showDiagBD: false };
}

export function wedgeDeg(vertex: Vec, from: Vec, to: Vec): number {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  return (Math.acos(clamp(u.x * w.x + u.y * w.y, -1, 1)) * 180) / Math.PI;
}

export function isRightAngle(deg: number): boolean {
  return Number.isFinite(deg) && Math.abs(deg - 90) < RIGHT_EPS;
}

export function vertexName(state: QuadState, i: number): string {
  return state.vertices[i]?.name.trim() || vertexLetter(i);
}

export function edgeName(state: QuadState, i: number): string {
  return `${vertexName(state, i)}${vertexName(state, (i + 1) % 4)}`;
}

export function segName(state: QuadState, id: DiagSegId): string {
  const o = state.oName.trim() || "O";
  if (id === "AO") return `${vertexName(state, 0)}${o}`;
  if (id === "OC") return `${o}${vertexName(state, 2)}`;
  if (id === "BO") return `${vertexName(state, 1)}${o}`;
  if (id === "OD") return `${o}${vertexName(state, 3)}`;
  if (id === "AC") return `${vertexName(state, 0)}${vertexName(state, 2)}`;
  return `${vertexName(state, 1)}${vertexName(state, 3)}`;
}

export function wedgeName(state: QuadState, i: number, which: "prev" | "next"): string {
  const o = state.oName.trim() || "O";
  const v = vertexName(state, i);
  const prev = vertexName(state, prevIndex(i, 4));
  const next = vertexName(state, nextIndex(i, 4));
  return which === "prev" ? `${o}${v}${prev}` : `${o}${v}${next}`;
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

function distToArc(
  x: number,
  y: number,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  ccw: boolean,
): number {
  let sweep = a1 - a0;
  if (ccw) {
    while (sweep > 0) sweep -= Math.PI * 2;
    while (sweep > -1e-9) sweep -= Math.PI * 2;
    sweep = -sweep;
    if (sweep < 1e-9) sweep += Math.PI * 2;
  } else {
    while (sweep < 0) sweep += Math.PI * 2;
    if (sweep < 1e-9) sweep += Math.PI * 2;
  }
  const n = Math.max(12, Math.ceil(sweep / (Math.PI / 18)));
  let best = Infinity;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const ang = a0 + (ccw ? -sweep : sweep) * t;
    const px = cx + r * Math.cos(ang);
    const py = cy + r * Math.sin(ang);
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

export function hitTestQuad(
  canvasPts: Vec[],
  o: Vec | null,
  exts: Vec[],
  texts: { id: string; x: number; y: number }[],
  cmds: {
    t: string;
    id?: string;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    cx?: number;
    cy?: number;
    r?: number;
    a0?: number;
    a1?: number;
    ccw?: boolean;
  }[],
  x: number,
  y: number,
  scale = 1,
  showDiagAC: boolean,
  showDiagBD: boolean,
): QuadHit | null {
  const labelR = 22 * Math.max(scale, 0.85);
  let bestText: { id: string; d: number } | null = null;
  for (const text of texts) {
    if (text.id.endsWith(":line")) continue;
    const d = Math.hypot(text.x - x, text.y - y);
    if (d < labelR && (!bestText || d < bestText.d)) bestText = { id: text.id, d };
  }

  const dimR = 12 * Math.max(scale, 0.85);
  let bestDim: { id: string; d: number } | null = null;
  for (const cmd of cmds) {
    if (!cmd.id || !cmd.id.endsWith(":line")) continue;
    const id = cmd.id.slice(0, -5);
    let d = Infinity;
    if (cmd.t === "line" && cmd.x1 != null && cmd.y1 != null && cmd.x2 != null && cmd.y2 != null) {
      d = distToSeg(x, y, cmd.x1, cmd.y1, cmd.x2, cmd.y2);
    } else if (
      cmd.t === "arc" &&
      cmd.cx != null &&
      cmd.cy != null &&
      cmd.r != null &&
      cmd.a0 != null &&
      cmd.a1 != null
    ) {
      d = distToArc(x, y, cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw === true);
    }
    if (d < dimR && (!bestDim || d < bestDim.d)) bestDim = { id, d };
  }

  if (bestText && bestDim) {
    if (bestDim.d <= bestText.d) return { kind: "dimLine", id: bestDim.id };
    return { kind: "label", id: bestText.id };
  }
  if (bestDim) return { kind: "dimLine", id: bestDim.id };
  if (bestText) return { kind: "label", id: bestText.id };

  const pointR = 14 * Math.max(scale, 0.85);
  if (o) {
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < pointR) return { kind: "o" };
  }
  let bestExt = -1;
  let bestExtD = pointR;
  exts.forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestExtD) {
      bestExtD = d;
      bestExt = i;
    }
  });
  if (bestExt >= 0) return { kind: "extension", index: bestExt };
  let bestV = -1;
  let bestVd = pointR;
  canvasPts.forEach((p, i) => {
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist < bestVd) {
      bestVd = dist;
      bestV = i;
    }
  });
  if (bestV >= 0) return { kind: "vertex", index: bestV };

  const edgeR = 9 * Math.max(scale, 0.85);
  if (o && (showDiagAC || showDiagBD)) {
    const segs: { id: DiagSegId; a: Vec; b: Vec }[] = [];
    if (showDiagAC) {
      segs.push({ id: "AO", a: canvasPts[0]!, b: o });
      segs.push({ id: "OC", a: o, b: canvasPts[2]! });
    }
    if (showDiagBD) {
      segs.push({ id: "BO", a: canvasPts[1]!, b: o });
      segs.push({ id: "OD", a: o, b: canvasPts[3]! });
    }
    let bestSeg: DiagSegId | null = null;
    let bestSd = edgeR;
    for (const s of segs) {
      const d = distToSeg(x, y, s.a.x, s.a.y, s.b.x, s.b.y);
      if (d < bestSd) {
        bestSd = d;
        bestSeg = s.id;
      }
    }
    if (bestSeg) return { kind: "seg", id: bestSeg };
  }

  if (showDiagAC) {
    const d = distToSeg(x, y, canvasPts[0]!.x, canvasPts[0]!.y, canvasPts[2]!.x, canvasPts[2]!.y);
    if (d < edgeR) return { kind: "diag", which: "AC" };
  }
  if (showDiagBD) {
    const d = distToSeg(x, y, canvasPts[1]!.x, canvasPts[1]!.y, canvasPts[3]!.x, canvasPts[3]!.y);
    if (d < edgeR) return { kind: "diag", which: "BD" };
  }

  let bestE = -1;
  let bestEd = edgeR;
  for (let i = 0; i < 4; i += 1) {
    const a = canvasPts[i]!;
    const b = canvasPts[(i + 1) % 4]!;
    const d = distToSeg(x, y, a.x, a.y, b.x, b.y);
    if (d < bestEd) {
      bestEd = d;
      bestE = i;
    }
  }
  if (bestE >= 0) return { kind: "edge", index: bestE };
  return null;
}

export function cycleTicks(current: TickCount): TickCount {
  if (current === 0) return 1;
  if (current === 1) return 2;
  if (current === 2) return 3;
  return 0;
}

export function cycleExtraArcs(current: ExtraArcs): ExtraArcs {
  if (current === 0) return 1;
  if (current === 1) return 2;
  return 0;
}

export function patchWedge(
  state: QuadState,
  i: number,
  which: "wedgePrev" | "wedgeNext",
  patch: Partial<WedgeMark>,
): QuadState {
  return {
    ...state,
    vertices: state.vertices.map((v, idx) =>
      idx === i ? { ...v, [which]: { ...v[which], ...patch } } : v,
    ),
  };
}

export function anyDiagonalOn(state: QuadState): boolean {
  return state.showDiagAC || state.showDiagBD || state.showO;
}

export function setDiagonals(state: QuadState, on: boolean): QuadState {
  return {
    ...state,
    showDiagAC: on,
    showDiagBD: on,
    showO: on,
  };
}

export function oppositeEdgesParallel(points: Vec[], pair: 0 | 1): boolean {
  const a = sub(points[(pair + 1) % 4]!, points[pair]!);
  const b = sub(points[(pair + 2) % 4]!, points[(pair + 3) % 4]!);
  const cr = Math.abs(cross(norm(a), norm(b)));
  return cr < 0.08;
}

export function sidesEqual(points: Vec[], eps = 1e-3): boolean {
  const s0 = edgeLength(points, 0);
  for (let i = 1; i < 4; i += 1) {
    if (Math.abs(edgeLength(points, i) - s0) > eps) return false;
  }
  return true;
}

export function isRectangleAngles(points: Vec[], eps = 1.2): boolean {
  for (let i = 0; i < 4; i += 1) {
    if (Math.abs(vertexAngles(points, i).interior - 90) > eps) return false;
  }
  return true;
}

export { extensionEnd, vertexAngles, edgeLength, clamp, prevIndex, nextIndex };
export type { AngleFill, AngleMark, FaceFill, TickCount, WedgeMark };
