import { formatMeasure, normalizeSqrtLabel } from "@/lib/diagrams/math-label";
import {
  add,
  applyEdgeLengthChange,
  applyInteriorAngleChange,
  clamp,
  edgeLength,
  isConvex,
  len,
  mul,
  norm,
  parseAngleInput,
  parseMeasureInput,
  sub,
  vertexAngles,
} from "@/lib/diagrams/polygon/geometry";
import {
  emptyLabel,
  labelUnknownLetter,
  type MeasLabel,
  type Vec,
} from "@/lib/diagrams/polygon/model";
import {
  exactRadicalLabel,
  formatHypotenuseLabel,
} from "@/lib/diagrams/pythagorean/radical";
import {
  altitudeFootId,
  defaultQuadPoints,
  findSeg,
  formatThetaLabel,
  patchQuadDiagAngle,
  patchSegState,
  roundThetaDeg,
  wrapRotateDeg,
  snapRotateDeg,
  trigTriangleForRightVertex,
  type AltitudeVertex,
  type AngleMark,
  type QuadFamily,
  type TrigRatiosState,
  type SegMark,
} from "./model";
import {
  movePoint as pythMovePoint,
  syncLegFields,
  type PythSelection,
} from "@/lib/diagrams/pythagorean/geometry";
import type { PythagoreanState } from "@/lib/diagrams/pythagorean/model";

export type TrigHit =
  | { kind: "point"; id: string }
  | { kind: "seg"; id: string }
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string }
  | { kind: "ang"; id: string };

type HitCmd = {
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
};

export type TrigSelection = PythSelection | { t: "ang"; id: string };

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

export function angleDeg(from: Vec, vertex: Vec, to: Vec): number {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  return (Math.acos(clamp(u.x * w.x + u.y * w.y, -1, 1)) * 180) / Math.PI;
}

const RIGHT_ANGLE_EPS = 0.75;

export function isNearRightAngle(deg: number): boolean {
  return Number.isFinite(deg) && Math.abs(deg - 90) < RIGHT_ANGLE_EPS;
}

export function footToLine(p: Vec, a: Vec, b: Vec, clampToSegment = true): Vec {
  const t = clampToSegment ? clamp(projectT(p, a, b), 0, 1) : projectT(p, a, b);
  return lerp(a, b, t);
}

export function rotateAround(p: Vec, origin: Vec, deg: number): Vec {
  if (Math.abs(deg) < 1e-9) return p;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const v = sub(p, origin);
  return add(origin, { x: v.x * c - v.y * s, y: v.x * s + v.y * c });
}

export function worldRightTriangle(state: TrigRatiosState): { A: Vec; B: Vec; C: Vec } {
  const { A, B, C } = state;
  const deg = wrapRotateDeg(state.rotateDeg);
  if (deg < 1e-9) return { A, B, C };
  const O = mul(add(add(A, B), C), 1 / 3);
  return {
    A: rotateAround(A, O, deg),
    B: rotateAround(B, O, deg),
    C: rotateAround(C, O, deg),
  };
}

export function worldQuadPoints(state: TrigRatiosState): Vec[] {
  const pts = state.quadPoints;
  const deg = wrapRotateDeg(state.rotateDeg);
  if (deg < 1e-9) return pts;
  const O = mul(add(add(pts[0]!, pts[2]!), add(pts[1]!, pts[3]!)), 0.25);
  return pts.map((p) => rotateAround(p, O, deg));
}

export function quadDiagonalIntersection(points: Vec[]): Vec {
  const a = points[0]!;
  const b = points[1]!;
  const c = points[2]!;
  const d = points[3]!;
  const r = sub(c, a);
  const s = sub(d, b);
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) {
    return mul(add(a, c), 0.5);
  }
  const ca = sub(b, a);
  const t = (ca.x * s.y - ca.y * s.x) / den;
  return add(a, mul(r, t));
}

export function quadDiagAngleDeg(points: Vec[], angId: string): number {
  const [A, B, C, D] = points;
  if (!A || !B || !C || !D) return 90;
  const O = quadDiagonalIntersection(points);
  switch (angId) {
    case "AOB":
      return angleDeg(A, O, B);
    case "BOC":
      return angleDeg(B, O, C);
    case "COD":
      return angleDeg(C, O, D);
    case "DOA":
      return angleDeg(D, O, A);
    default:
      return 90;
  }
}

export function unitCirclePoints(state: TrigRatiosState): Record<string, Vec> {
  const rad = (state.thetaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const tan = Math.tan(rad);
  return {
    O: { x: 0, y: 0 },
    A: { x: cos, y: 0 },
    B: { x: cos, y: sin },
    C: { x: 1, y: 0 },
    D: { x: 1, y: tan },
  };
}

export function trianglePoints(state: TrigRatiosState): Record<string, Vec> {
  const { triA: A0, triB: B0, triC: C0 } = state;
  const deg = wrapRotateDeg(state.rotateDeg);
  let A = A0;
  let B = B0;
  let C = C0;
  if (deg >= 1e-9) {
    const O = mul(add(add(A0, B0), C0), 1 / 3);
    A = rotateAround(A0, O, deg);
    B = rotateAround(B0, O, deg);
    C = rotateAround(C0, O, deg);
  }
  const out: Record<string, Vec> = { A, B, C };
  const alts = state.altitudes ?? [];
  if (alts.includes("A")) out.Ha = footToLine(A, B, C, false);
  if (alts.includes("B")) out.Hb = footToLine(B, A, C, false);
  if (alts.includes("C")) out.H = footToLine(C, A, B, false);
  return out;
}

export function altitudeBase(
  from: AltitudeVertex,
  A: Vec,
  B: Vec,
  C: Vec,
): { a: Vec; b: Vec; aId: "A" | "B" | "C"; bId: "A" | "B" | "C"; apex: Vec } {
  if (from === "A") return { a: B, b: C, aId: "B", bId: "C", apex: A };
  if (from === "B") return { a: A, b: C, aId: "A", bId: "C", apex: B };
  return { a: A, b: B, aId: "A", bId: "B", apex: C };
}

export function isObtuseAtA(state: TrigRatiosState): boolean {
  const { A, B, C } = trianglePoints(state);
  return angleDeg(B, A, C) > 90 + 0.5;
}

export function derivedPoints(state: TrigRatiosState): Record<string, Vec> {
  switch (state.kind) {
    case "right":
      return worldRightTriangle(state);
    case "unit-circle":
      return unitCirclePoints(state);
    case "triangle-area":
      return trianglePoints(state);
    case "quad-area":
      return Object.fromEntries(
        worldQuadPoints(state).map((p, i) => [
          String.fromCharCode(65 + i),
          p,
        ]),
      );
    default:
      return {};
  }
}

export function figureStrokes(state: TrigRatiosState): [string, string][] {
  switch (state.kind) {
    case "right":
      return [
        ["A", "B"],
        ["B", "C"],
        ["A", "C"],
      ];
    case "unit-circle": {
      const strokes: [string, string][] = [
        ["A", "B"],
        ["C", "D"],
        ["O", "B"],
        ["B", "D"],
        ["O", "A"],
      ];
      const pts = unitCirclePoints(state);
      return strokes.filter(([a, b]) => {
        if (!pts[a] || !pts[b]) return false;
        const s = findSeg(state, `${a}${b}`) ?? findSeg(state, `${b}${a}`);
        return s?.lineStyle !== "hidden" && !s?.hidden;
      });
    }
    case "triangle-area": {
      const segs: [string, string][] = [
        ["A", "B"],
        ["B", "C"],
        ["A", "C"],
      ];
      for (const from of state.altitudes) {
        segs.push([from, altitudeFootId(from)]);
      }
      return segs;
    }
    case "quad-area":
      return [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
        ["D", "A"],
      ];
    default:
      return [];
  }
}

export function draggableIds(state: TrigRatiosState): string[] {
  switch (state.kind) {
    case "right":
      return ["A", "B", "C"];
    case "unit-circle":
      return ["B", "D"];
    case "triangle-area":
      return ["A", "B", "C"];
    case "quad-area":
      return ["A", "B", "C", "D"];
    default:
      return [];
  }
}

export function displayName(state: TrigRatiosState, id: string): string {
  if (state.kind === "triangle-area") {
    return state.triNames[id]?.name?.trim() || id;
  }
  if (state.kind === "quad-area") {
    const i = "ABCD".indexOf(id);
    if (i >= 0) return state.quadVertices[i]?.name?.trim() || id;
  }
  return state.names[id]?.name?.trim() || id;
}

export function segDisplayName(state: TrigRatiosState, seg: SegMark): string {
  return `${displayName(state, seg.a)}${displayName(state, seg.b)}`;
}

export function segLength(state: TrigRatiosState, seg: SegMark): number {
  const pts = derivedPoints(state);
  const a = pts[seg.a];
  const b = pts[seg.b];
  if (!a || !b) return 0;
  return len(sub(b, a));
}

function toPythState(state: TrigRatiosState): PythagoreanState {
  return {
    kind: "triangle",
    A: state.A,
    B: state.B,
    C: state.C,
    rightVertex: state.rightVertex,
    legLeft: state.legLeft,
    legRight: state.legRight,
    isoscelesRight: state.isoscelesRight,
    altitudes: [],
    names: state.names,
    segs: state.segs,
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    showRightAngle: state.showRightAngle,
    showGrid: false,
    gridCols: 8,
    gridRows: 8,
    gridMargin: 1,
    showFill: false,
    showSquareLabels: false,
    showDissection: false,
    squareLabelMode: "korean",
    proofView: "both",
    proofLegA: 3,
    proofLegB: 4,
    coordXMin: -1,
    coordXMax: 8,
    coordYMin: -1,
    coordYMax: 8,
    coordPadding: 0.5,
    showAxisDrops: false,
    rectWidth: 6,
    rectHeight: 8,
    rectSquare: false,
    showDiagonal: true,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  };
}

function fromPythTriangle(state: TrigRatiosState, p: PythagoreanState): TrigRatiosState {
  return {
    ...state,
    A: p.A,
    B: p.B,
    C: p.C,
    legLeft: p.legLeft,
    legRight: p.legRight,
  };
}

export function rebuildTriangleFromLegs(
  state: TrigRatiosState,
  legLeft: number,
  legRight: number,
): TrigRatiosState {
  return unlockShownNumeric(setRightLegs(state, legLeft, legRight));
}

function setRightLegs(state: TrigRatiosState, legLeft: number, legRight: number): TrigRatiosState {
  let ll = Math.max(0.5, legLeft);
  let lr = Math.max(0.5, legRight);
  if (state.isoscelesRight) {
    ll = Math.max(ll, lr);
    lr = ll;
  }
  const t = trigTriangleForRightVertex(ll, lr, state.rightVertex);
  return normalizeRight({
    ...state,
    A: t.A,
    B: t.B,
    C: t.C,
    legLeft: ll,
    legRight: lr,
  });
}

export function movePoint(state: TrigRatiosState, id: string, pos: Vec): TrigRatiosState {
  switch (state.kind) {
    case "right": {
      const next = fromPythTriangle(state, pythMovePoint(toPythState(state), id, pos));
      return unlockShownNumeric(
        syncLegFields(next as unknown as PythagoreanState) as unknown as TrigRatiosState,
      );
    }
    case "unit-circle": {
      if (id !== "B" && id !== "D") return state;
      const ang =
        id === "D"
          ? (Math.atan2(pos.y, 1) * 180) / Math.PI
          : (Math.atan2(pos.y, pos.x) * 180) / Math.PI;
      return unlockShownNumeric(setThetaDeg(state, ang));
    }
    case "triangle-area": {
      const key = id as "A" | "B" | "C";
      if (key !== "A" && key !== "B" && key !== "C") return state;
      const deg = wrapRotateDeg(state.rotateDeg);
      let localPos = pos;
      if (deg >= 1e-9) {
        const { triA: A0, triB: B0, triC: C0 } = state;
        const O = mul(add(add(A0, B0), C0), 1 / 3);
        localPos = rotateAround(pos, O, -deg);
      }
      const patch = { [`tri${key}`]: localPos } as Partial<TrigRatiosState>;
      const next = { ...state, ...patch };
      const pts = [next.triA, next.triB, next.triC];
      if (!isConvex(pts) || edgeLength(pts, 0) < 0.4) return state;
      return unlockShownNumeric(next);
    }
    case "quad-area": {
      const i = "ABCD".indexOf(id);
      if (i < 0) return state;
      const deg = wrapRotateDeg(state.rotateDeg);
      let localPos = pos;
      if (deg >= 1e-9) {
        const pts0 = state.quadPoints;
        const O = mul(add(add(pts0[0]!, pts0[2]!), add(pts0[1]!, pts0[3]!)), 0.25);
        localPos = rotateAround(pos, O, -deg);
      }
      if (state.quadFamily === "parallelogram") {
        const pts = state.quadPoints.slice();
        let [A, B, C, D] = pts as [Vec, Vec, Vec, Vec];
        if (i === 0) {
          A = localPos;
          D = add(A, sub(C, B));
        } else if (i === 2) {
          C = localPos;
          D = add(A, sub(C, B));
        } else if (i === 3) {
          D = localPos;
          A = add(B, sub(D, C));
        } else if (i === 1) {
          const delta = sub(localPos, B);
          B = localPos;
          A = add(A, delta);
          C = add(C, delta);
          D = add(D, delta);
        }
        const newPts = [A, B, C, D];
        if (!isConvex(newPts) || edgeLength(newPts, 0) < 0.4 || edgeLength(newPts, 1) < 0.4) {
          return state;
        }
        return unlockShownNumeric(syncParallelogramLabels({ ...state, quadPoints: newPts }));
      }
      const pts = state.quadPoints.slice();
      pts[i] = localPos;
      if (!validQuad(state, pts)) return state;
      return unlockShownNumeric({ ...state, quadPoints: pts });
    }
    default:
      return state;
  }
}

function validQuad(state: TrigRatiosState, points: Vec[]): boolean {
  if (points.length !== 4 || !isConvex(points)) return false;
  for (let i = 0; i < 4; i += 1) {
    if (edgeLength(points, i) < 0.4) return false;
  }
  if (state.quadFamily === "parallelogram") {
    const diag1 = sub(points[2]!, points[0]!);
    const diag2 = sub(points[3]!, points[1]!);
    const mid1 = mul(add(points[0]!, points[2]!), 0.5);
    const mid2 = mul(add(points[1]!, points[3]!), 0.5);
    if (len(sub(mid1, mid2)) > 0.15) return false;
    const ab = sub(points[1]!, points[0]!);
    const dc = sub(points[2]!, points[3]!);
    const ad = sub(points[3]!, points[0]!);
    const bc = sub(points[2]!, points[1]!);
    if (Math.abs(cross2(ab, dc)) > 0.2) return false;
    if (Math.abs(cross2(ad, bc)) > 0.2) return false;
  }
  return true;
}

function cross2(a: Vec, b: Vec): number {
  return a.x * b.y - a.y * b.x;
}

export function syncParallelogramLabels(state: TrigRatiosState): TrigRatiosState {
  const pts = state.quadPoints;
  if (pts.length !== 4) return state;
  const thetaB = Math.round(interiorAngleDeg(pts, 1) * 10) / 10;
  const thetaA = Math.round((180 - thetaB) * 10) / 10;
  const angleValues = [thetaA, thetaB, thetaA, thetaB];

  const lenBC = Math.round(len(sub(pts[2]!, pts[1]!)) * 10) / 10;
  const lenAB = Math.round(len(sub(pts[0]!, pts[1]!)) * 10) / 10;
  const edgeValues = [lenAB, lenBC, lenAB, lenBC];

  const quadVertices = state.quadVertices.map((v, i) => {
    if (!v.showInterior) return v;
    if (v.interior.mode === "x" || v.interior.mode === "hide") return v;
    const str = `${angleValues[i]}°`;
    return {
      ...v,
      interior: { ...v.interior, mode: "custom" as const, custom: str },
    };
  });

  const quadEdges = state.quadEdges.map((e, i) => {
    if (!e.showLength) return e;
    if (e.length.mode === "x" || e.length.mode === "hide") return e;
    const hasCm = e.length.mode === "custom" && /cm$/i.test(e.length.custom.trim());
    const hasMm = e.length.mode === "custom" && /mm$/i.test(e.length.custom.trim());
    const unitSuffix = hasCm ? "cm" : hasMm ? "mm" : "";
    const str = `${edgeValues[i]}${unitSuffix}`;
    return {
      ...e,
      length: { ...e.length, mode: "custom" as const, custom: str },
    };
  });

  return { ...state, quadVertices, quadEdges };
}

export function setQuadFamily(state: TrigRatiosState, family: QuadFamily): TrigRatiosState {
  if (state.quadFamily === family) return state;
  if (family === "general") {
    return { ...state, quadFamily: "general" };
  }
  let pts = state.quadPoints;
  if (pts.length !== 4 || !isConvex(pts)) {
    pts = defaultQuadPoints("parallelogram");
  }
  const B = pts[1]!;
  const C = pts[2]!;
  const A = pts[0]!;
  const D = add(A, sub(C, B));
  let newPts = [A, B, C, D];
  if (!isConvex(newPts) || edgeLength(newPts, 0) < 0.4 || edgeLength(newPts, 1) < 0.4) {
    newPts = defaultQuadPoints("parallelogram");
  }
  return syncParallelogramLabels({
    ...state,
    quadFamily: "parallelogram",
    quadPoints: newPts,
  });
}

export function setRotateDeg(
  state: TrigRatiosState,
  deg: number,
  opts?: { snap?: boolean },
): TrigRatiosState {
  const next = opts?.snap === false ? wrapRotateDeg(deg) : snapRotateDeg(deg);
  return { ...state, rotateDeg: next };
}

export function setThetaDeg(state: TrigRatiosState, deg: number): TrigRatiosState {
  return { ...state, thetaDeg: roundThetaDeg(deg) };
}

export function toggleSeg(state: TrigRatiosState, id: string): TrigRatiosState {
  const seg = findSeg(state, id);
  if (!seg) return state;
  return patchSegState(state, id, { show: !seg.show });
}

export function cycleUnitSeg(state: TrigRatiosState, id: string): TrigRatiosState {
  const seg = findSeg(state, id);
  const isDashed = seg?.lineStyle === "dashed" || seg?.dashed === true;
  const nextStyle = isDashed ? "solid" : "dashed";
  return patchSegState(state, id, {
    lineStyle: nextStyle,
    dashed: nextStyle === "dashed",
    hidden: false,
  });
}

function formatComputedLength(length: number, unit: string): string {
  return exactRadicalLabel(length, unit) ?? formatMeasure(length, unit);
}

function formatRightSegComputed(state: TrigRatiosState, seg: SegMark, length: number): string {
  if (state.kind === "right" && rightSegRole(state, seg.id) === "hyp") {
    const { left, right } = legSides(state);
    return formatHypotenuseLabel(left, right, state.unit, length);
  }
  return formatComputedLength(length, state.unit);
}

export function resolveLengthText(
  state: Pick<TrigRatiosState, "unit" | "unknownLetter">,
  label: MeasLabel,
  length: number,
): string | null {
  if (label.mode === "hide") return null;
  if (label.mode === "x") return `$${labelUnknownLetter(label, state.unknownLetter)}$`;
  if (label.mode === "custom") {
    const text = label.custom.trim();
    return text ? normalizeSqrtLabel(text) : null;
  }
  return formatComputedLength(length, state.unit);
}

export function resolveSegText(state: TrigRatiosState, seg: SegMark): string | null {
  if (!seg.show) return null;
  const length = segLength(state, seg);
  const { label } = seg;
  if (label.mode === "hide") return null;
  if (label.mode === "x") return `$${labelUnknownLetter(label, state.unknownLetter)}$`;
  if (label.mode === "custom") {
    const text = label.custom.trim();
    return text ? normalizeSqrtLabel(text) : null;
  }
  return formatRightSegComputed(state, seg, length);
}

export function resolveAngleLabel(
  state: TrigRatiosState,
  mark: { label: MeasLabel; vertex: string; from: string; to: string },
  deg: number,
): string | null {
  const { label } = mark;
  if (label.mode === "hide") return null;
  if (label.mode === "custom") {
    const text = label.custom.trim();
    return text ? normalizeSqrtLabel(text) : `${Math.round(deg * 10) / 10}°`;
  }
  if (label.mode === "x") return `$${labelUnknownLetter(label, state.unknownLetter)}$`;
  return `${Math.round(deg * 10) / 10}°`;
}

export function resolveUnitAngleLabel(
  state: TrigRatiosState,
  label: MeasLabel,
  deg: number,
): string | null {
  if (label.mode === "hide") return null;
  if (label.mode === "x") return `$${labelUnknownLetter(label, state.unknownLetter)}$`;
  if (label.mode === "custom") {
    const text = label.custom.trim();
    return text ? normalizeSqrtLabel(text) : formatThetaLabel(deg);
  }
  return formatThetaLabel(deg);
}

export function angleIdFromSceneId(id: string): string | null {
  if (id.startsWith("a:")) return id.slice(2);
  if (id.startsWith("v:")) {
    const i = Number(id.split(":")[1]);
    return Number.isFinite(i) ? `v:${i}` : null;
  }
  return null;
}

function labelFromMeasureParse(
  parsed: ReturnType<typeof parseMeasureInput>,
  text: string,
  prev: MeasLabel,
): MeasLabel {
  if (parsed.kind === "unknown") {
    return { ...prev, mode: "x", custom: parsed.unknown ?? "x" };
  }
  if (parsed.kind === "number" && parsed.value != null) {
    return { ...prev, mode: "custom", custom: text.trim() || String(parsed.value) };
  }
  if (!text.trim()) {
    return { ...prev, mode: prev.mode === "custom" ? "custom" : "hide", custom: "" };
  }
  return { ...prev, mode: "custom", custom: text.trim() };
}

function labelFromAngleParse(
  parsed: ReturnType<typeof parseAngleInput>,
  text: string,
  prev: MeasLabel,
): MeasLabel {
  if (parsed.kind === "unknown") {
    return { ...prev, mode: "x", custom: parsed.unknown ?? "x" };
  }
  if (parsed.kind === "number" && parsed.value != null) {
    return { ...prev, mode: "custom", custom: `${parsed.value}°` };
  }
  if (!text.trim()) {
    return { ...prev, mode: prev.mode === "custom" ? "custom" : "hide", custom: "" };
  }
  return { ...prev, mode: "custom", custom: text.trim() };
}

function measureNumber(text: string): number | null {
  const parsed = parseMeasureInput(text);
  if (parsed.kind === "number" && parsed.value != null && Number.isFinite(parsed.value)) {
    return parsed.value;
  }
  const raw = text.trim();
  const latex = raw.match(
    /^\$?\s*(\d+(?:\.\d+)?)?\s*\\sqrt\{(\d+)\}\s*\$?(?:\s*(?:cm|mm))?$/i,
  );
  if (latex) {
    const coeff = latex[1] ? Number(latex[1]) : 1;
    const rad = Number(latex[2]);
    if (coeff > 0 && rad >= 0) return coeff * Math.sqrt(rad);
  }
  const uni = raw.match(/^\$?\s*(\d+(?:\.\d+)?)?\s*√\s*(\d+)\s*\$?(?:\s*(?:cm|mm))?$/);
  if (uni) {
    const coeff = uni[1] ? Number(uni[1]) : 1;
    const rad = Number(uni[2]);
    if (coeff > 0 && rad >= 0) return coeff * Math.sqrt(rad);
  }
  return null;
}

function isPreserveCustomLength(label: MeasLabel): boolean {
  if (label.mode === "x") return true;
  if (label.mode === "custom") {
    // Free text like "4m" or "$b$" stays. Numeric/radical customs unlock to auto
    // when the figure changes so the shown value stays honest.
    if (measureNumber(label.custom) != null) return false;
    return label.custom.trim().length > 0;
  }
  return false;
}

function autoLengthLabel(label: MeasLabel): MeasLabel {
  if (isPreserveCustomLength(label) || label.mode === "hide") return label;
  return { ...label, mode: "auto", custom: "" };
}

function autoAngleLabel(label: MeasLabel): MeasLabel {
  if (label.mode === "x" || label.mode === "hide") return label;
  const parsed = parseAngleInput(label.custom);
  if (label.mode === "custom" && parsed.kind !== "number") return label;
  return { ...label, mode: "auto", custom: "" };
}

function customLengthValue(label: MeasLabel): number | null {
  if (label.mode !== "custom") return null;
  // Letter unknowns and free-text units ("4m") do not lock geometry.
  const parsed = parseMeasureInput(label.custom);
  if (parsed.kind === "unknown") return null;
  return measureNumber(label.custom);
}

function customAngleValue(label: MeasLabel): number | null {
  if (label.mode !== "custom") return null;
  const parsed = parseAngleInput(label.custom);
  if (parsed.kind === "number" && parsed.value != null) return parsed.value;
  return null;
}

type MeasureLock =
  | { t: "seg"; id: string; value: number }
  | { t: "ang"; id: string; value: number }
  | { t: "qang"; index: number; value: number };

function lockKey(lock: MeasureLock): string {
  if (lock.t === "seg") return `s:${lock.id}`;
  if (lock.t === "qang") return `v:${lock.index}`;
  return `a:${lock.id}`;
}

function unlockShownNumeric(state: TrigRatiosState): TrigRatiosState {
  return {
    ...reconcileNumericLabels(state, new Set()),
    lockOrder: [],
  };
}

function reconcileNumericLabels(state: TrigRatiosState, keep: Set<string>): TrigRatiosState {
  const segs = (s: SegMark) =>
    s.show && !keep.has(`s:${s.id}`) ? { ...s, label: autoLengthLabel(s.label) } : s;
  const angs = (a: AngleMark): AngleMark =>
    a.show && !keep.has(`a:${a.id}`) ? { ...a, label: autoAngleLabel(a.label) } : a;

  if (state.kind === "unit-circle") {
    return {
      ...state,
      thetaLabel: keep.has("a:theta") ? state.thetaLabel : autoAngleLabel(state.thetaLabel),
      yAngleLabel: keep.has("a:y") ? state.yAngleLabel : autoAngleLabel(state.yAngleLabel),
      zAngleLabel: keep.has("a:z") ? state.zAngleLabel : autoAngleLabel(state.zAngleLabel),
    };
  }
  if (state.kind === "quad-area") {
    const quadDiagEdges = state.quadDiagEdges
      ? {
          AC:
            state.quadDiagEdges.AC?.showLength && !keep.has("s:AC")
              ? { ...state.quadDiagEdges.AC, length: autoLengthLabel(state.quadDiagEdges.AC.length) }
              : state.quadDiagEdges.AC,
          BD:
            state.quadDiagEdges.BD?.showLength && !keep.has("s:BD")
              ? { ...state.quadDiagEdges.BD, length: autoLengthLabel(state.quadDiagEdges.BD.length) }
              : state.quadDiagEdges.BD,
        }
      : state.quadDiagEdges;
    return {
      ...state,
      quadEdges: state.quadEdges.map((e, i) => {
        const id = ["AB", "BC", "CD", "DA"][i]!;
        if (!e.showLength || keep.has(`s:${id}`)) return e;
        return { ...e, length: autoLengthLabel(e.length) };
      }),
      quadVertices: state.quadVertices.map((v, i) =>
        v.showInterior && !keep.has(`v:${i}`) ? { ...v, interior: autoAngleLabel(v.interior) } : v,
      ),
      quadDiagAngles: state.quadDiagAngles.map((a) =>
        a.show && !keep.has(`a:${a.id}`) ? { ...a, label: autoAngleLabel(a.label) } : a,
      ),
      quadDiagEdges,
    };
  }
  if (state.kind === "triangle-area") {
    return {
      ...state,
      triSegs: state.triSegs.map(segs),
      triAngles: state.triAngles.map(angs),
    };
  }
  return {
    ...state,
    segs: state.segs.map(segs),
    angles: state.angles.map(angs),
  };
}

function touchLockOrder(state: TrigRatiosState, id: string): TrigRatiosState {
  return { ...state, lockOrder: [...state.lockOrder.filter((x) => x !== id), id] };
}

function collectLocks(state: TrigRatiosState, except?: string): MeasureLock[] {
  const out: MeasureLock[] = [];
  if (state.kind === "right") {
    for (const s of state.segs) {
      const key = `s:${s.id}`;
      if (!s.show || key === except) continue;
      const value = customLengthValue(s.label);
      if (value != null) out.push({ t: "seg", id: s.id, value });
    }
    for (const a of state.angles) {
      const key = `a:${a.id}`;
      if (!a.show || key === except || a.vertex === state.rightVertex) continue;
      const value = customAngleValue(a.label);
      if (value != null) out.push({ t: "ang", id: a.id, value });
    }
  } else if (state.kind === "triangle-area") {
    for (const s of state.triSegs) {
      const key = `s:${s.id}`;
      if (!s.show || key === except) continue;
      const value = customLengthValue(s.label);
      if (value != null) out.push({ t: "seg", id: s.id, value });
    }
    for (const a of state.triAngles) {
      if (a.id !== "A" && a.id !== "B" && a.id !== "C") continue;
      const key = `a:${a.id}`;
      if (!a.show || key === except) continue;
      const value = customAngleValue(a.label);
      if (value != null) out.push({ t: "ang", id: a.id, value });
    }
  } else if (state.kind === "quad-area") {
    for (const [i, id] of ["AB", "BC", "CD", "DA"].entries()) {
      const e = state.quadEdges[i];
      const key = `s:${id}`;
      if (!e?.showLength || key === except) continue;
      const value = customLengthValue(e.length);
      if (value != null) out.push({ t: "seg", id, value });
    }
    for (const id of ["AC", "BD"] as const) {
      const e = state.quadDiagEdges?.[id];
      const key = `s:${id}`;
      if (!e?.showLength || key === except) continue;
      const value = customLengthValue(e.length);
      if (value != null) out.push({ t: "seg", id, value });
    }
    for (const a of state.quadDiagAngles ?? []) {
      const key = `a:${a.id}`;
      if (!a.show || key === except) continue;
      const value = customAngleValue(a.label);
      if (value != null) out.push({ t: "ang", id: a.id, value });
    }
    for (const [i, v] of state.quadVertices.entries()) {
      const key = `v:${i}`;
      if (!v.showInterior || key === except) continue;
      const value = customAngleValue(v.interior);
      if (value != null) out.push({ t: "qang", index: i, value });
    }
  }
  const order = state.lockOrder;
  out.sort((a, b) => {
    const ia = order.indexOf(lockKey(a));
    const ib = order.indexOf(lockKey(b));
    return (ia < 0 ? -1 : ia) - (ib < 0 ? -1 : ib);
  });
  return out;
}

function pickLockSubset(
  required: MeasureLock,
  previous: MeasureLock[],
  viable: (locks: MeasureLock[]) => boolean,
): MeasureLock[] | null {
  const n = Math.min(previous.length, 8);
  let best: MeasureLock[] | null = null;
  let bestScore = -1;
  for (let mask = 0; mask < 1 << n; mask += 1) {
    const subset: MeasureLock[] = [required];
    let score = 0;
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) {
        const lock = previous[i]!;
        subset.push(lock);
        const kindBonus = lock.t === required.t ? 10 : 1000;
        score += kindBonus + (n - i);
      }
    }
    if (!viable(subset)) continue;
    if (score > bestScore) {
      best = subset;
      bestScore = score;
    }
  }
  return best;
}

const LEN_TOL = 0.2;
const ANG_TOL = 0.6;

function applyMeasureConstraint(state: TrigRatiosState, required: MeasureLock): TrigRatiosState {
  const previous = collectLocks(state, lockKey(required));
  const chosen = pickLockSubset(required, previous, (locks) =>
    constraintSetFits(state, locks),
  );
  if (!chosen) return state;
  const nextGeom = applyLockSet(state, chosen, required);
  if (!nextGeom) return state;
  const keep = new Set(chosen.map(lockKey));
  return touchLockOrder(reconcileNumericLabels(nextGeom, keep), lockKey(required));
}

function constraintSetFits(state: TrigRatiosState, locks: MeasureLock[]): boolean {
  if (state.kind === "right") return solveRightLegs(state, locks) != null;
  const applied = applyLockSet(state, locks, locks[0]!);
  if (!applied) return false;
  return lockSetHolds(applied, locks);
}

function applyLockSet(
  state: TrigRatiosState,
  locks: MeasureLock[],
  required: MeasureLock,
): TrigRatiosState | null {
  if (state.kind === "right") {
    const legs = solveRightLegs(state, locks);
    if (!legs) return null;
    return setRightLegs(state, legs.left, legs.right);
  }
  if (state.kind === "triangle-area") {
    if (required.t === "seg" && ALTITUDE_SEGS[required.id]) {
      return applyAltitudeLength(state, ALTITUDE_SEGS[required.id]!, required.value);
    }
    const poly = trianglePolyWithLocks(state, locks);
    const next =
      required.t === "seg"
        ? applyEdgeLengthChange(poly, TRI_SIDE_IDS.indexOf(required.id as (typeof TRI_SIDE_IDS)[number]), required.value)
        : required.t === "ang"
          ? applyInteriorAngleChange(poly, { A: 0, B: 1, C: 2 }[required.id as "A" | "B" | "C"] ?? -1, required.value)
          : poly;
    return fromPolygonTri(state, next);
  }
  if (state.kind === "quad-area") {
    if (required.t === "seg") {
      return applySegNumeric(state, required.id, required.value);
    }
    if (required.t === "qang") {
      return applyQuadAngleNumeric(state, required.index, required.value);
    }
    return state;
  }
  return null;
}

function lockSetHolds(state: TrigRatiosState, locks: MeasureLock[]): boolean {
  for (const lock of locks) {
    if (lock.t === "seg") {
      const seg = findSeg(state, lock.id);
      if (!seg) continue;
      if (Math.abs(segLength(state, seg) - lock.value) > LEN_TOL) return false;
    } else if (lock.t === "ang") {
      const pts =
        state.kind === "triangle-area"
          ? [state.triA, state.triB, state.triC]
          : [state.A, state.B, state.C];
      const idx = { A: 0, B: 1, C: 2 }[lock.id as "A" | "B" | "C"];
      if (idx == null) continue;
      if (Math.abs(interiorAngleDeg(pts, idx) - lock.value) > ANG_TOL) return false;
    } else {
      const pts = state.quadPoints;
      if (Math.abs(vertexAngles(pts, lock.index).interior - lock.value) > ANG_TOL) return false;
    }
  }
  return true;
}

function solveRightLegs(
  state: TrigRatiosState,
  locks: MeasureLock[],
): { left: number; right: number } | null {
  const roles = new Map<"left" | "right" | "hyp", number>();
  const angs = new Map<string, number>();
  for (const lock of locks) {
    if (lock.t === "seg") {
      const role = rightSegRole(state, lock.id);
      if (!role) continue;
      const prev = roles.get(role);
      if (prev != null && Math.abs(prev - lock.value) > LEN_TOL) return null;
      roles.set(role, lock.value);
    } else if (lock.t === "ang") {
      if (lock.id === state.rightVertex) continue;
      angs.set(lock.id, clamp(lock.value, 1, 89.5));
    }
  }
  if (angs.size === 2) {
    const vals = [...angs.values()];
    if (Math.abs(vals[0]! + vals[1]! - 90) > ANG_TOL) return null;
  }

  let left = roles.get("left") ?? null;
  let right = roles.get("right") ?? null;
  const hyp = roles.get("hyp") ?? null;

  if (left != null && right != null) {
    const h = Math.hypot(left, right);
    if (hyp != null && Math.abs(hyp - h) > LEN_TOL) return null;
    if (!rightAnglesMatch(state, left, right, angs)) return null;
    return { left, right };
  }
  if (hyp != null && left != null) {
    if (hyp <= left + 1e-6) return null;
    right = Math.sqrt(hyp * hyp - left * left);
    if (!rightAnglesMatch(state, left, right, angs)) return null;
    return { left, right };
  }
  if (hyp != null && right != null) {
    if (hyp <= right + 1e-6) return null;
    left = Math.sqrt(hyp * hyp - right * right);
    if (!rightAnglesMatch(state, left, right, angs)) return null;
    return { left, right };
  }

  const angEntry = angs.size ? [...angs.entries()][0]! : null;
  const lengthRole = left != null ? "left" : right != null ? "right" : hyp != null ? "hyp" : null;
  const lengthVal = left ?? right ?? hyp ?? null;

  if (angEntry && lengthVal != null && lengthRole) {
    const solved = legsFromAngleAndLength(state, angEntry[0], angEntry[1], lengthRole, lengthVal);
    if (!solved || !rightAnglesMatch(state, solved.left, solved.right, angs)) return null;
    return solved;
  }
  if (angEntry && lengthVal == null) {
    const { hyp: h0 } = legSides(state);
    const solved = legsFromAngleAndLength(state, angEntry[0], angEntry[1], "hyp", h0);
    if (!solved || !rightAnglesMatch(state, solved.left, solved.right, angs)) return null;
    return solved;
  }
  if (lengthVal != null && angs.size === 0 && lengthRole) {
    const cur = legSides(state);
    const k =
      lengthRole === "left"
        ? lengthVal / Math.max(cur.left, 1e-6)
        : lengthRole === "right"
          ? lengthVal / Math.max(cur.right, 1e-6)
          : lengthVal / Math.max(cur.hyp, 1e-6);
    return { left: cur.left * k, right: cur.right * k };
  }
  return null;
}

function rightAnglesMatch(
  state: TrigRatiosState,
  left: number,
  right: number,
  angs: Map<string, number>,
): boolean {
  if (angs.size === 0) return true;
  const tri = trigTriangleForRightVertex(left, right, state.rightVertex);
  const pts = [tri.A, tri.B, tri.C];
  for (const [id, deg] of angs) {
    const mark = state.angles.find((a) => a.id === id);
    if (!mark) continue;
    const idx = { A: 0, B: 1, C: 2 }[mark.vertex as "A" | "B" | "C"];
    if (idx == null) continue;
    if (Math.abs(interiorAngleDeg(pts, idx) - deg) > ANG_TOL) return false;
  }
  return true;
}

function legsFromAngleAndLength(
  state: TrigRatiosState,
  angId: string,
  deg: number,
  role: "left" | "right" | "hyp",
  value: number,
): { left: number; right: number } | null {
  const t = Math.tan((deg * Math.PI) / 180);
  if (!(t > 1e-6) || !Number.isFinite(t)) return null;
  const leftOverRight = tanIsLeftOverRight(state, angId);
  let left: number;
  let right: number;
  if (leftOverRight) {
    if (role === "left") {
      left = value;
      right = value / t;
    } else if (role === "right") {
      right = value;
      left = value * t;
    } else {
      right = value / Math.sqrt(t * t + 1);
      left = right * t;
    }
  } else if (role === "left") {
    left = value;
    right = value * t;
  } else if (role === "right") {
    right = value;
    left = value / t;
  } else {
    left = value / Math.sqrt(t * t + 1);
    right = left * t;
  }
  if (left < 0.4 || right < 0.4) return null;
  return { left, right };
}

function tanIsLeftOverRight(state: TrigRatiosState, angId: string): boolean {
  const mark = state.angles.find((a) => a.id === angId);
  if (!mark) return true;
  const { left, right } = legSides(state);
  const idx = { A: 0, B: 1, C: 2 }[mark.vertex as "A" | "B" | "C"];
  if (idx == null) return true;
  const deg = interiorAngleDeg([state.A, state.B, state.C], idx);
  const tan = Math.tan((deg * Math.PI) / 180);
  return Math.abs(tan - left / right) <= Math.abs(tan - right / left);
}

/** 길이 표시 '직접': 글씨만 바꾸고 도형은 그대로 둔다. */
export function setLengthDisplayText(
  state: TrigRatiosState,
  segId: string,
  text: string,
): TrigRatiosState {
  const prev =
    state.kind === "quad-area"
      ? segId === "AC" || segId === "BD"
        ? state.quadDiagEdges?.[segId]?.length
        : state.quadEdges[["AB", "BC", "CD", "DA"].indexOf(segId)]?.length
      : findSeg(state, segId)?.label;
  if (!prev) return state;
  return patchShownLength(state, segId, { ...prev, mode: "custom", custom: text });
}

function patchShownLength(
  state: TrigRatiosState,
  segId: string,
  label: MeasLabel,
): TrigRatiosState {
  if (state.kind === "quad-area") {
    if (segId === "AC" || segId === "BD") {
      const prevEdge = state.quadDiagEdges?.[segId] ?? { showLength: false, length: { mode: "auto", custom: "" } };
      return {
        ...state,
        quadDiagEdges: {
          ...state.quadDiagEdges,
          [segId]: {
            ...prevEdge,
            showLength: true,
            length: label,
          },
        },
      };
    }
    const i = ["AB", "BC", "CD", "DA"].indexOf(segId);
    if (i >= 0) {
      return {
        ...state,
        quadEdges: state.quadEdges.map((e, idx) =>
          idx === i ? { ...e, showLength: true, length: label } : e,
        ),
      };
    }
  }
  const seg = findSeg(state, segId);
  if (!seg) return state;
  return patchSegState(state, segId, { show: true, label });
}

export function applyEditedLabel(
  state: TrigRatiosState,
  labelId: string,
  raw: string,
): TrigRatiosState {
  const trimmed = raw.trim();
  if (labelId.startsWith("s:")) {
    const segId = labelId.slice(2);
    const prev =
      state.kind === "quad-area"
        ? (segId === "AC" || segId === "BD"
            ? state.quadDiagEdges?.[segId]?.length
            : state.quadEdges[["AB", "BC", "CD", "DA"].indexOf(segId)]?.length)
        : findSeg(state, segId)?.label;
    if (!prev) return state;
    const parsed = parseMeasureInput(trimmed);
    const numeric = measureNumber(trimmed);
    const targetLabel = labelFromMeasureParse(parsed, trimmed, prev);
    let next = patchShownLength(state, segId, targetLabel);
    if (numeric != null && numeric > 0) {
      next = applySegNumeric(next, segId, numeric);
      next = patchShownLength(next, segId, targetLabel);
    }
    return next;
  }
  if (labelId.startsWith("a:")) {
    const angId = labelId.slice(2);
    if (state.kind === "unit-circle" && (angId === "theta" || angId === "y" || angId === "z")) {
      const parsed = parseAngleInput(trimmed);
      const key =
        angId === "theta" ? "thetaLabel" : angId === "y" ? "yAngleLabel" : "zAngleLabel";
      const prev = state[key];
      if (parsed.kind === "number" && parsed.value != null) {
        const next =
          angId === "theta" ? setThetaDeg(state, parsed.value) : setThetaDeg(state, 90 - parsed.value);
        return { ...next, [key]: labelFromAngleParse(parsed, trimmed, prev) };
      }
      return { ...state, [key]: labelFromAngleParse(parsed, trimmed, prev) };
    }
    if (state.kind === "quad-area" && ["AOB", "BOC", "COD", "DOA"].includes(angId)) {
      const mark = state.quadDiagAngles.find((a) => a.id === angId);
      if (!mark) return state;
      const parsed = parseAngleInput(trimmed);
      let labeled = patchQuadDiagAngle(state, angId, {
        show: true,
        label: labelFromAngleParse(parsed, trimmed, mark.label),
      });
      if (parsed.kind === "number" && parsed.value != null) {
        labeled = applyQuadDiagAngleNumeric(labeled, angId, parsed.value);
      }
      return labeled;
    }
    const pool = state.kind === "triangle-area" ? state.triAngles : state.angles;
    const mark = pool.find((a) => a.id === angId);
    if (!mark) return state;
    const parsed = parseAngleInput(trimmed);
    const key = state.kind === "triangle-area" ? "triAngles" : "angles";
    const labeled = {
      ...state,
      [key]: state[key].map((a) =>
        a.id === angId
          ? { ...a, show: true, label: labelFromAngleParse(parsed, trimmed, a.label) }
          : a,
      ),
    } as TrigRatiosState;
    if (parsed.kind === "number" && parsed.value != null) {
      return applyAngleNumeric(labeled, angId, parsed.value);
    }
    return labeled;
  }
  if (labelId.startsWith("v:")) {
    const parts = labelId.split(":");
    const vi = Number(parts[1]);
    const parsed = parseAngleInput(trimmed);
    if (state.kind === "quad-area" && Number.isFinite(vi)) {
      const labeled = {
        ...state,
        quadVertices: state.quadVertices.map((v, i) =>
          i === vi
            ? {
                ...v,
                showInterior: true,
                interior: labelFromAngleParse(parsed, trimmed, v.interior),
              }
            : v,
        ),
      };
      if (parsed.kind === "number" && parsed.value != null) {
        return applyQuadAngleNumeric(labeled, vi, parsed.value);
      }
      return labeled;
    }
  }
  if (labelId.startsWith("n:")) {
    const id = labelId.slice(2);
    return setPointName(state, id, trimmed);
  }
  if (labelId === "theta") {
    const n = Number(trimmed.replace("°", ""));
    if (Number.isFinite(n)) return setThetaDeg(state, n);
  }
  if (labelId === "axis:Ax") {
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0 && n <= 1) {
      return setThetaDeg(state, (Math.acos(n) * 180) / Math.PI);
    }
  }
  if (labelId === "axis:By") {
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0 && n <= 1) {
      return setThetaDeg(state, (Math.asin(n) * 180) / Math.PI);
    }
  }
  if (labelId === "axis:Dy") {
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0) {
      return setThetaDeg(state, (Math.atan(n) * 180) / Math.PI);
    }
  }
  return state;
}

export function applySegNumeric(state: TrigRatiosState, segId: string, value: number): TrigRatiosState {
  const target = clamp(value, 0.4, 40);
  if (state.kind === "quad-area") {
    if (segId === "AC" || segId === "BD") {
      return applyQuadDiagLengthNumeric(state, segId, target);
    }
    if (state.quadFamily === "parallelogram") {
      return applyParallelogramEdge(state, segId, target);
    }
    return applyGeneralQuadEdge(state, segId, target);
  }
  return applyMeasureConstraint(state, { t: "seg", id: segId, value: target });
}

function rightSegRole(
  state: TrigRatiosState,
  segId: string,
): "left" | "right" | "hyp" | null {
  const rv = state.rightVertex;
  const hyp = ({ C: "AB", A: "BC", B: "AC" } as const)[rv];
  const left = ({ C: "BC", A: "AB", B: "AB" } as const)[rv];
  const right = ({ C: "AC", A: "AC", B: "BC" } as const)[rv];
  if (segId === hyp) return "hyp";
  if (segId === left) return "left";
  if (segId === right) return "right";
  return null;
}

const TRI_SIDE_IDS = ["AB", "BC", "AC"] as const;
const ALTITUDE_SEGS: Record<string, AltitudeVertex> = {
  CH: "C",
  AHa: "A",
  BHb: "B",
};

function applyAltitudeLength(
  state: TrigRatiosState,
  from: AltitudeVertex,
  value: number,
): TrigRatiosState {
  const math = trianglePoints(state);
  const apex = math[from];
  if (!apex || !math.A || !math.B || !math.C) return state;
  const footId = altitudeFootId(from);
  const foot =
    math[footId] ??
    (() => {
      const base = altitudeBase(from, math.A, math.B, math.C);
      return footToLine(apex, base.a, base.b, false);
    })();
  const dir = sub(apex, foot);
  if (len(dir) < 1e-6) return state;
  const moved = add(foot, mul(norm(dir), value));
  const next =
    from === "A"
      ? { ...state, triA: moved }
      : from === "B"
        ? { ...state, triB: moved }
        : { ...state, triC: moved };
  const pts = [next.triA, next.triB, next.triC];
  if (!isConvex(pts) || edgeLength(pts, 0) < 0.4) return state;
  return next;
}

function legSides(state: TrigRatiosState): { left: number; right: number; hyp: number } {
  const pts = derivedPoints(state);
  const { A, B, C } = pts;
  const rv = state.rightVertex;
  if (rv === "C") {
    return {
      left: len(sub(B!, C!)),
      right: len(sub(A!, C!)),
      hyp: len(sub(A!, B!)),
    };
  }
  if (rv === "A") {
    return {
      left: len(sub(B!, A!)),
      right: len(sub(C!, A!)),
      hyp: len(sub(B!, C!)),
    };
  }
  return {
    left: len(sub(A!, B!)),
    right: len(sub(C!, B!)),
    hyp: len(sub(A!, C!)),
  };
}

function applyAngleNumeric(state: TrigRatiosState, angId: string, value: number): TrigRatiosState {
  const deg = clamp(value, 1, 179);
  if (state.kind === "right") {
    const mark = state.angles.find((a) => a.id === angId);
    if (!mark || mark.vertex === state.rightVertex) return state;
    return applyMeasureConstraint(state, { t: "ang", id: angId, value: clamp(deg, 1, 89.5) });
  }
  if (state.kind === "triangle-area") {
    if (angId !== "A" && angId !== "B" && angId !== "C") return state;
    return applyMeasureConstraint(state, { t: "ang", id: angId, value: deg });
  }
  return state;
}

export function applyParallelogramAngle(
  state: TrigRatiosState,
  vi: number,
  deg: number,
): TrigRatiosState {
  const clampedDeg = clamp(Math.round(deg * 10) / 10, 10, 170);
  const thetaB = vi === 1 || vi === 3 ? clampedDeg : Math.round((180 - clampedDeg) * 10) / 10;
  const thetaA = Math.round((180 - thetaB) * 10) / 10;
  const angleValues = [thetaA, thetaB, thetaA, thetaB];

  const pts = state.quadPoints;
  const B = pts[1] ?? { x: -3.6, y: 0 };
  const C = pts[2] ?? { x: 1.2, y: 0 };
  const A_old = pts[0] ?? { x: -2.2, y: 2.4 };

  const bcVec = sub(C, B);
  const beta = Math.atan2(bcVec.y, bcVec.x);
  const lab = Math.max(0.5, len(sub(A_old, B)));

  const angleBA = beta + (thetaB * Math.PI) / 180;
  const A = add(B, { x: lab * Math.cos(angleBA), y: lab * Math.sin(angleBA) });
  const D = add(A, bcVec);
  const newPoints = [A, B, C, D];

  const quadVertices = state.quadVertices.map((v, i) => {
    const isTarget = i === vi;
    if (!v.showInterior && !isTarget) return v;
    const str = `${angleValues[i]}°`;
    return {
      ...v,
      showInterior: isTarget ? true : v.showInterior,
      interior: { ...v.interior, mode: "custom" as const, custom: str },
    };
  });

  return touchLockOrder(
    {
      ...state,
      quadPoints: newPoints,
      quadVertices,
    },
    `v:${vi}`,
  );
}

export function applyParallelogramEdge(
  state: TrigRatiosState,
  segId: string,
  newLength: number,
): TrigRatiosState {
  const target = clamp(Math.round(newLength * 10) / 10, 0.5, 40);
  const pts = state.quadPoints;
  const B = pts[1] ?? { x: -3.6, y: 0 };
  const C = pts[2] ?? { x: 1.2, y: 0 };
  const A = pts[0] ?? { x: -2.2, y: 2.4 };

  let newA = A;
  let newC = C;

  if (segId === "AB" || segId === "CD") {
    const ba = sub(A, B);
    const uBA = norm(ba);
    newA = add(B, mul(uBA, target));
  } else if (segId === "BC" || segId === "DA") {
    const bc = sub(C, B);
    const uBC = norm(bc);
    newC = add(B, mul(uBC, target));
  }
  const newD = add(newA, sub(newC, B));
  const newPoints = [newA, B, newC, newD];

  const lenStr = `${target}`;
  const isPairAB = segId === "AB" || segId === "CD";
  const quadEdges = state.quadEdges.map((e, idx) => {
    const id = ["AB", "BC", "CD", "DA"][idx]!;
    const match = isPairAB ? (id === "AB" || id === "CD") : (id === "BC" || id === "DA");
    if (!match) return e;
    const preserve = id === segId && e.length.mode === "custom" && e.length.custom.trim().length > 0;
    return {
      ...e,
      showLength: id === segId ? true : e.showLength,
      length: preserve ? e.length : { ...e.length, mode: "custom" as const, custom: lenStr },
    };
  });

  return touchLockOrder(
    {
      ...state,
      quadPoints: newPoints,
      quadEdges,
    },
    `s:${segId}`,
  );
}

function buildQuadFromAngles(
  state: TrigRatiosState,
  targetAngles: [number, number, number, number],
): Vec[] {
  const [thetaA, thetaB, thetaC] = targetAngles;
  const pts = state.quadPoints;
  const B = pts[1] ?? { x: -3.2, y: 0 };
  const C = pts[2] ?? { x: 2.8, y: 0 };
  const A_old = pts[0] ?? { x: -0.8, y: 2.8 };

  const bcVec = sub(C, B);
  const beta = Math.atan2(bcVec.y, bcVec.x);
  const angBA = beta + (thetaB * Math.PI) / 180;
  const uBA = { x: Math.cos(angBA), y: Math.sin(angBA) };

  const alphaAD = beta + ((thetaB + thetaA - 180) * Math.PI) / 180;
  const uAD = { x: Math.cos(alphaAD), y: Math.sin(alphaAD) };

  const alphaCD = beta + ((180 - thetaC) * Math.PI) / 180;
  const uCD = { x: Math.cos(alphaCD), y: Math.sin(alphaCD) };

  const cr = cross2(uAD, uCD);
  const labPreferred = Math.max(0.5, len(sub(A_old, B)));

  if (Math.abs(cr) < 1e-4) {
    const A = add(B, mul(uBA, labPreferred));
    const D = add(A, bcVec);
    return [A, B, C, D];
  }

  const num_t_const = cross2(bcVec, uCD);
  const num_t_lab = cross2(uBA, uCD);
  const num_s_const = -cross2(uAD, bcVec);
  const num_s_lab = cross2(uAD, uBA);

  let minLab = 0.5;
  let maxLab = 25.0;

  const coeff_t = -num_t_lab / cr;
  const const_t = num_t_const / cr;
  if (Math.abs(coeff_t) > 1e-7) {
    const bound = (0.4 - const_t) / coeff_t;
    if (coeff_t > 0) minLab = Math.max(minLab, bound);
    else maxLab = Math.min(maxLab, bound);
  }

  const coeff_s = num_s_lab / cr;
  const const_s = num_s_const / cr;
  if (Math.abs(coeff_s) > 1e-7) {
    const bound = (0.4 - const_s) / coeff_s;
    if (coeff_s > 0) minLab = Math.max(minLab, bound);
    else maxLab = Math.min(maxLab, bound);
  }

  let chosenLab = labPreferred;
  if (minLab < maxLab) {
    chosenLab = Math.min(maxLab - 0.1, Math.max(minLab + 0.1, labPreferred));
  } else {
    chosenLab = Math.max(0.5, (minLab + maxLab) / 2);
  }

  const t = (num_t_const - chosenLab * num_t_lab) / cr;
  const A = add(B, mul(uBA, chosenLab));
  const D = add(A, mul(uAD, t));
  const candidate = [A, B, C, D];

  if (isConvex(candidate) && edgeLength(candidate, 0) >= 0.4 && edgeLength(candidate, 2) >= 0.4) {
    return candidate;
  }
  return pts;
}

export function applyGeneralQuadAngle(
  state: TrigRatiosState,
  vi: number,
  value: number,
): TrigRatiosState {
  const newDeg = clamp(Math.round(value * 10) / 10, 15, 165);
  const curAngles = [0, 1, 2, 3].map((i) =>
    Math.round(interiorAngleDeg(state.quadPoints, i) * 10) / 10,
  );

  const lockOrderVertices: number[] = [];
  for (const id of state.lockOrder) {
    if (id.startsWith("v:")) {
      const idx = Number(id.slice(2));
      if (idx !== vi && idx >= 0 && idx < 4 && state.quadVertices[idx]?.showInterior) {
        if (!lockOrderVertices.includes(idx)) lockOrderVertices.push(idx);
      }
    }
  }
  for (let i = 0; i < 4; i += 1) {
    if (
      i !== vi &&
      state.quadVertices[i]?.showInterior &&
      customAngleValue(state.quadVertices[i]!.interior) != null
    ) {
      if (!lockOrderVertices.includes(i)) lockOrderVertices.push(i);
    }
  }

  const lockedValues: Record<number, number> = {};
  for (const idx of lockOrderVertices) {
    const val = customAngleValue(state.quadVertices[idx]!.interior) ?? curAngles[idx]!;
    lockedValues[idx] = clamp(Math.round(val * 10) / 10, 15, 165);
  }

  const target: [number, number, number, number] = [0, 0, 0, 0];
  let updatedLockOrder = state.lockOrder.filter((id) => id !== `v:${vi}`);

  if (lockOrderVertices.length === 0) {
    target[vi] = newDeg;
    const rem = 360 - newDeg;
    const unlocked = [0, 1, 2, 3].filter((i) => i !== vi);
    const sumCur = unlocked.reduce((acc, i) => acc + curAngles[i]!, 0);
    let allocated = 0;
    unlocked.forEach((k, idx) => {
      if (idx === unlocked.length - 1) {
        target[k] = Math.round((rem - allocated) * 10) / 10;
      } else {
        const val = Math.round(((rem * curAngles[k]!) / sumCur) * 10) / 10;
        target[k] = val;
        allocated += val;
      }
    });
  } else if (lockOrderVertices.length === 1) {
    const p1 = lockOrderVertices[0]!;
    const val1 = lockedValues[p1]!;
    let actualDeg = newDeg;
    if (actualDeg + val1 > 330) actualDeg = 330 - val1;
    if (actualDeg + val1 < 30) actualDeg = 30 - val1;
    actualDeg = Math.round(actualDeg * 10) / 10;
    target[p1] = val1;
    target[vi] = actualDeg;
    const rem = 360 - (actualDeg + val1);
    const unlocked = [0, 1, 2, 3].filter((i) => i !== vi && i !== p1);
    const sumCur = unlocked.reduce((acc, i) => acc + curAngles[i]!, 0);
    let allocated = 0;
    unlocked.forEach((k, idx) => {
      if (idx === unlocked.length - 1) {
        target[k] = Math.round((rem - allocated) * 10) / 10;
      } else {
        const val = Math.round(((rem * curAngles[k]!) / sumCur) * 10) / 10;
        target[k] = val;
        allocated += val;
      }
    });
  } else if (lockOrderVertices.length === 2) {
    const [p1, p2] = lockOrderVertices as [number, number];
    const val1 = lockedValues[p1]!;
    const val2 = lockedValues[p2]!;
    let actualDeg = newDeg;
    const sumPrev = val1 + val2;
    if (actualDeg + sumPrev > 345) actualDeg = 345 - sumPrev;
    if (actualDeg + sumPrev < 195) actualDeg = 195 - sumPrev;
    actualDeg = Math.round(actualDeg * 10) / 10;
    target[p1] = val1;
    target[p2] = val2;
    target[vi] = actualDeg;
    const p3 = [0, 1, 2, 3].find((i) => i !== vi && i !== p1 && i !== p2)!;
    target[p3] = Math.round((360 - (actualDeg + sumPrev)) * 10) / 10;
  } else {
    const oldest = lockOrderVertices[0]!;
    const [p1, p2] = lockOrderVertices.slice(1) as [number, number];
    const val1 = lockedValues[p1]!;
    const val2 = lockedValues[p2]!;
    let actualDeg = newDeg;
    const sumPrev = val1 + val2;
    if (actualDeg + sumPrev > 345) actualDeg = 345 - sumPrev;
    if (actualDeg + sumPrev < 195) actualDeg = 195 - sumPrev;
    actualDeg = Math.round(actualDeg * 10) / 10;
    target[p1] = val1;
    target[p2] = val2;
    target[vi] = actualDeg;
    target[oldest] = Math.round((360 - (actualDeg + sumPrev)) * 10) / 10;
    updatedLockOrder = updatedLockOrder.filter((id) => id !== `v:${oldest}`);
  }

  updatedLockOrder.push(`v:${vi}`);

  const newPoints = buildQuadFromAngles(state, target);

  const quadVertices = state.quadVertices.map((v, i) => {
    const isTarget = i === vi;
    const valStr = `${target[i]}°`;
    if (isTarget) {
      return {
        ...v,
        showInterior: true,
        interior: { ...v.interior, mode: "custom" as const, custom: valStr },
      };
    }
    if (v.showInterior) {
      return {
        ...v,
        interior: { ...v.interior, mode: "custom" as const, custom: valStr },
      };
    }
    return v;
  });

  return {
    ...state,
    quadPoints: newPoints,
    quadVertices,
    lockOrder: updatedLockOrder,
  };
}

export function applyGeneralQuadEdge(
  state: TrigRatiosState,
  segId: string,
  newLength: number,
): TrigRatiosState {
  const target = clamp(Math.round(newLength * 10) / 10, 0.5, 40);
  const pts = state.quadPoints;
  const B = pts[1] ?? { x: -3.2, y: 0 };
  const C = pts[2] ?? { x: 2.8, y: 0 };
  const A = pts[0] ?? { x: -0.8, y: 2.8 };

  let newPoints = pts;
  if (segId === "BC") {
    const uBC = norm(sub(C, B));
    const newC = add(B, mul(uBC, target));
    const angles = [0, 1, 2, 3].map((i) =>
      interiorAngleDeg(pts, i),
    ) as [number, number, number, number];
    const tempState = { ...state, quadPoints: [A, B, newC, pts[3]!] };
    newPoints = buildQuadFromAngles(tempState, angles);
  } else if (segId === "AB") {
    const uBA = norm(sub(A, B));
    const newA = add(B, mul(uBA, target));
    const angles = [0, 1, 2, 3].map((i) =>
      interiorAngleDeg(pts, i),
    ) as [number, number, number, number];
    const tempState = { ...state, quadPoints: [newA, B, C, pts[3]!] };
    newPoints = buildQuadFromAngles(tempState, angles);
  } else {
    const poly = quadPolyWithLocks(state, [{ t: "seg", id: segId, value: target }]);
    const next = applyEdgeLengthChange(poly, ["AB", "BC", "CD", "DA"].indexOf(segId), target);
    newPoints = next.points.slice(0, 4);
  }

  const quadEdges = state.quadEdges.map((e, idx) => {
    const id = ["AB", "BC", "CD", "DA"][idx]!;
    if (id !== segId) return e;
    const preserve = e.length.mode === "custom" && e.length.custom.trim().length > 0;
    return {
      ...e,
      showLength: true,
      length: preserve ? e.length : { ...e.length, mode: "custom" as const, custom: `${target}` },
    };
  });

  return touchLockOrder(
    {
      ...state,
      quadPoints: newPoints,
      quadEdges,
    },
    `s:${segId}`,
  );
}

function applyQuadAngleNumeric(state: TrigRatiosState, vi: number, value: number): TrigRatiosState {
  if (state.quadFamily === "parallelogram") {
    return applyParallelogramAngle(state, vi, value);
  }
  return applyGeneralQuadAngle(state, vi, value);
}

function targetAOBFromDiagAngle(angId: string, value: number): number {
  const v = clamp(Math.round(value * 10) / 10, 10, 170);
  switch (angId) {
    case "AOB":
    case "COD":
      return v;
    case "BOC":
    case "DOA":
      return Math.round((180 - v) * 10) / 10;
    default:
      return v;
  }
}

function syncQuadDiagAngleLabels(state: TrigRatiosState): TrigRatiosState {
  const pts = state.quadPoints;
  if (pts.length !== 4) return state;
  const quadDiagAngles = state.quadDiagAngles.map((a) => {
    if (!a.show) return a;
    const deg = Math.round(quadDiagAngleDeg(pts, a.id) * 10) / 10;
    if (a.label.mode === "custom") {
      const parsed = parseAngleInput(a.label.custom);
      if (parsed.kind === "number") {
        return {
          ...a,
          label: { ...a.label, custom: `${deg}°` },
        };
      }
    }
    return a;
  });
  return { ...state, quadDiagAngles };
}

function applyParallelogramDiagAngle(
  state: TrigRatiosState,
  angId: string,
  value: number,
): TrigRatiosState {
  const targetAOB = targetAOBFromDiagAngle(angId, value);
  const pts = state.quadPoints;
  if (pts.length !== 4) return state;

  let [A, B, C, D] = pts as [Vec, Vec, Vec, Vec];
  if (!A || !B || !C || !D) return state;

  D = add(A, sub(C, B));

  const d1 = len(sub(C, A));
  const d2 = len(sub(D, B));
  const r1 = Math.max(0.5, d1 / 2);
  const r2 = Math.max(0.5, d2 / 2);

  const phi = (clamp(targetAOB, 10, 170) * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const L = Math.sqrt(Math.max(1e-6, r1 * r1 + r2 * r2 + 2 * r1 * r2 * cosPhi));
  const h = Math.max(0.1, (r1 * r2 * sinPhi) / L);
  const uAx = -(r1 * (r1 + r2 * cosPhi)) / L;
  const uBx = -(r2 * (r2 + r1 * cosPhi)) / L;

  const Ox = (A.x + B.x + C.x + D.x) / 4;
  const newA: Vec = { x: Ox + uAx, y: 2 * h };
  const newB: Vec = { x: Ox + uBx, y: 0 };
  const newC: Vec = { x: Ox - uAx, y: 0 };
  const newD: Vec = { x: Ox - uBx, y: 2 * h };

  const newPoints = [newA, newB, newC, newD];
  const synced = syncParallelogramLabels({
    ...state,
    quadPoints: newPoints,
  });
  return syncQuadDiagAngleLabels(synced);
}

function applyGeneralQuadDiagAngle(
  state: TrigRatiosState,
  angId: string,
  value: number,
): TrigRatiosState {
  const targetAOB = targetAOBFromDiagAngle(angId, value);
  const pts = state.quadPoints;
  if (pts.length !== 4) return state;

  const [A, B, C, D] = pts as [Vec, Vec, Vec, Vec];
  if (!A || !B || !C || !D) return state;

  const O = quadDiagonalIntersection(pts);
  const rA = len(sub(A, O));
  const rC = len(sub(C, O));
  const rB = len(sub(B, O));
  const rD = len(sub(D, O));

  if (rA < 1e-4 || rC < 1e-4 || rB < 1e-4 || rD < 1e-4) return state;

  const psiA = Math.atan2(A.y - O.y, A.x - O.x);
  const cross = (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  const sign = cross >= 0 ? 1 : -1;

  const phi = (clamp(targetAOB, 10, 170) * Math.PI) / 180;
  const newPsiB = psiA + sign * phi;

  const uB: Vec = { x: Math.cos(newPsiB), y: Math.sin(newPsiB) };
  const newB = add(O, mul(uB, rB));
  const newD = sub(O, mul(uB, rD));

  const newPoints = [A, newB, C, newD];
  if (!isConvex(newPoints)) return state;

  const next = {
    ...state,
    quadPoints: newPoints,
  };
  return syncQuadDiagAngleLabels(next);
}

export function applyQuadDiagAngleNumeric(
  state: TrigRatiosState,
  angId: string,
  value: number,
): TrigRatiosState {
  if (state.kind !== "quad-area") return state;
  if (state.quadFamily === "parallelogram") {
    return applyParallelogramDiagAngle(state, angId, value);
  }
  return applyGeneralQuadDiagAngle(state, angId, value);
}

function applyParallelogramDiagLength(
  state: TrigRatiosState,
  segId: "AC" | "BD" | string,
  newLength: number,
): TrigRatiosState {
  const target = clamp(Math.round(newLength * 10) / 10, 0.5, 40);
  const pts = state.quadPoints;
  if (pts.length !== 4) return state;

  let [A, B, C, D] = pts as [Vec, Vec, Vec, Vec];
  if (!A || !B || !C || !D) return state;

  D = add(A, sub(C, B));

  const d1 = len(sub(C, A));
  const d2 = len(sub(D, B));

  const r1 = segId === "AC" ? Math.max(0.25, target / 2) : Math.max(0.25, d1 / 2);
  const r2 = segId === "BD" ? Math.max(0.25, target / 2) : Math.max(0.25, d2 / 2);

  const phiDeg = clamp(quadDiagAngleDeg([A, B, C, D], "AOB"), 10, 170);
  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const L = Math.sqrt(Math.max(1e-6, r1 * r1 + r2 * r2 + 2 * r1 * r2 * cosPhi));
  const h = Math.max(0.1, (r1 * r2 * sinPhi) / L);
  const uAx = -(r1 * (r1 + r2 * cosPhi)) / L;
  const uBx = -(r2 * (r2 + r1 * cosPhi)) / L;

  const Ox = (A.x + B.x + C.x + D.x) / 4;
  const newA: Vec = { x: Ox + uAx, y: 2 * h };
  const newB: Vec = { x: Ox + uBx, y: 0 };
  const newC: Vec = { x: Ox - uAx, y: 0 };
  const newD: Vec = { x: Ox - uBx, y: 2 * h };

  const newPoints = [newA, newB, newC, newD];

  const diagAC = state.quadDiagEdges?.AC ?? { showLength: false, length: { mode: "auto", custom: "" } };
  const diagBD = state.quadDiagEdges?.BD ?? { showLength: false, length: { mode: "auto", custom: "" } };

  const quadDiagEdges = {
    ...state.quadDiagEdges,
    AC: segId === "AC"
      ? {
          ...diagAC,
          showLength: true,
          length:
            diagAC.length.mode === "custom" && diagAC.length.custom.trim().length > 0
              ? diagAC.length
              : { ...diagAC.length, mode: "custom" as const, custom: `${target}` },
        }
      : diagAC,
    BD: segId === "BD"
      ? {
          ...diagBD,
          showLength: true,
          length:
            diagBD.length.mode === "custom" && diagBD.length.custom.trim().length > 0
              ? diagBD.length
              : { ...diagBD.length, mode: "custom" as const, custom: `${target}` },
        }
      : diagBD,
  };

  const synced = syncParallelogramLabels({
    ...state,
    quadPoints: newPoints,
    quadDiagEdges,
  });
  return touchLockOrder(syncQuadDiagAngleLabels(synced), `s:${segId}`);
}

function applyGeneralQuadDiagLength(
  state: TrigRatiosState,
  segId: "AC" | "BD" | string,
  newLength: number,
): TrigRatiosState {
  const target = clamp(Math.round(newLength * 10) / 10, 0.5, 40);
  const pts = state.quadPoints;
  if (pts.length !== 4) return state;

  const [A, B, C, D] = pts as [Vec, Vec, Vec, Vec];
  if (!A || !B || !C || !D) return state;

  const O = quadDiagonalIntersection(pts);
  let newPoints: Vec[] = pts;

  if (segId === "AC") {
    const d1 = len(sub(C, A));
    if (d1 < 1e-4) return state;
    const k = target / d1;
    const newA = add(O, mul(sub(A, O), k));
    const newC = add(O, mul(sub(C, O), k));
    newPoints = [newA, B, newC, D];
  } else if (segId === "BD") {
    const d2 = len(sub(D, B));
    if (d2 < 1e-4) return state;
    const k = target / d2;
    const newB = add(O, mul(sub(B, O), k));
    const newD = add(O, mul(sub(D, O), k));
    newPoints = [A, newB, C, newD];
  }

  if (!isConvex(newPoints)) return state;

  const diagAC = state.quadDiagEdges?.AC ?? { showLength: false, length: { mode: "auto", custom: "" } };
  const diagBD = state.quadDiagEdges?.BD ?? { showLength: false, length: { mode: "auto", custom: "" } };

  const quadDiagEdges = {
    ...state.quadDiagEdges,
    AC: segId === "AC"
      ? {
          ...diagAC,
          showLength: true,
          length:
            diagAC.length.mode === "custom" && diagAC.length.custom.trim().length > 0
              ? diagAC.length
              : { ...diagAC.length, mode: "custom" as const, custom: `${target}` },
        }
      : diagAC,
    BD: segId === "BD"
      ? {
          ...diagBD,
          showLength: true,
          length:
            diagBD.length.mode === "custom" && diagBD.length.custom.trim().length > 0
              ? diagBD.length
              : { ...diagBD.length, mode: "custom" as const, custom: `${target}` },
        }
      : diagBD,
  };

  const synced = syncQuadDiagAngleLabels({
    ...state,
    quadPoints: newPoints,
    quadDiagEdges,
  });
  return touchLockOrder(synced, `s:${segId}`);
}

export function applyQuadDiagLengthNumeric(
  state: TrigRatiosState,
  segId: "AC" | "BD" | string,
  newLength: number,
): TrigRatiosState {
  if (state.kind !== "quad-area" || (segId !== "AC" && segId !== "BD")) return state;
  const target = clamp(Math.round(newLength * 10) / 10, 0.5, 40);
  const stateWithDiag: TrigRatiosState = {
    ...state,
    ...(segId === "AC"
      ? { showQuadDiagAC: true }
      : { showQuadDiagBD: true, showQuadDiagonal: true }),
  };
  if (state.quadFamily === "parallelogram") {
    return applyParallelogramDiagLength(stateWithDiag, segId, target);
  }
  return applyGeneralQuadDiagLength(stateWithDiag, segId, target);
}

function polygonFromTri(state: TrigRatiosState) {
  return {
    points: [state.triA, state.triB, state.triC],
    vertices: state.triVertices.map((v, i) => {
      const id = ["A", "B", "C"][i]!;
      const ang = state.triAngles.find((a) => a.id === id);
      const locked = ang ? customAngleValue(ang.label) : null;
      return {
        name: v.name,
        nameDx: v.nameDx,
        nameDy: v.nameDy,
        showInterior: Boolean(ang?.show && locked != null),
        showExterior: false,
        fillExterior: false,
        interior:
          locked != null
            ? { ...emptyLabel("custom"), custom: `${locked}°` }
            : emptyLabel("auto"),
        exterior: emptyLabel("auto"),
      };
    }),
    edges: TRI_SIDE_IDS.map((id) => {
      const seg = findSeg(state, id);
      const locked = seg?.show ? customLengthValue(seg.label) : null;
      return {
        showLength: locked != null,
        length:
          locked != null
            ? { ...emptyLabel("custom"), custom: String(locked) }
            : emptyLabel("auto"),
      };
    }),
    diagonals: [] as [number, number][],
    dashedDiagonals: false,
    interiorAnglesDeg: [0, 0, 0],
    referenceEdgeLength: edgeLength([state.triA, state.triB, state.triC], 0),
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  };
}

function trianglePolyWithLocks(state: TrigRatiosState, locks: MeasureLock[]) {
  const base = polygonFromTri(state);
  return {
    ...base,
    vertices: base.vertices.map((v, i) => {
      const id = ["A", "B", "C"][i]!;
      const lock = locks.find((l) => l.t === "ang" && l.id === id);
      if (!lock) return { ...v, showInterior: false, interior: emptyLabel("auto") };
      return {
        ...v,
        showInterior: true,
        interior: { ...emptyLabel("custom"), custom: `${lock.value}°` },
      };
    }),
    edges: base.edges.map((e, i) => {
      const id = TRI_SIDE_IDS[i]!;
      const lock = locks.find((l) => l.t === "seg" && l.id === id);
      if (!lock) return { ...e, showLength: false, length: emptyLabel("auto") };
      return {
        showLength: true,
        length: { ...emptyLabel("custom"), custom: String(lock.value) },
      };
    }),
  };
}

function fromPolygonTri(state: TrigRatiosState, poly: ReturnType<typeof polygonFromTri>): TrigRatiosState {
  return {
    ...state,
    triA: poly.points[0]!,
    triB: poly.points[1]!,
    triC: poly.points[2]!,
    triVertices: state.triVertices.map((v, i) => ({
      ...v,
      name: poly.vertices[i]?.name ?? v.name,
    })),
  };
}

function quadPolygonState(state: TrigRatiosState) {
  return {
    points: state.quadPoints,
    vertices: state.quadVertices.map((v) => ({
      name: v.name,
      nameDx: v.nameDx,
      nameDy: v.nameDy,
      showInterior: v.showInterior && customAngleValue(v.interior) != null,
      showExterior: false,
      fillExterior: false,
      interior: v.interior,
      exterior: emptyLabel("auto"),
    })),
    edges: state.quadEdges.map((e) => ({
      showLength: e.showLength && customLengthValue(e.length) != null,
      length: e.length,
    })),
    diagonals: [] as [number, number][],
    dashedDiagonals: false,
    interiorAnglesDeg: [0, 0, 0, 0],
    referenceEdgeLength: edgeLength(state.quadPoints, 0),
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  };
}

function quadPolyWithLocks(state: TrigRatiosState, locks: MeasureLock[]) {
  const base = quadPolygonState(state);
  return {
    ...base,
    vertices: base.vertices.map((v, i) => {
      const lock = locks.find((l) => l.t === "qang" && l.index === i);
      if (!lock) return { ...v, showInterior: false, interior: emptyLabel("auto") };
      return {
        ...v,
        showInterior: true,
        interior: { ...emptyLabel("custom"), custom: `${lock.value}°` },
      };
    }),
    edges: base.edges.map((e, i) => {
      const id = ["AB", "BC", "CD", "DA"][i]!;
      const lock = locks.find((l) => l.t === "seg" && l.id === id);
      if (!lock) return { ...e, showLength: false, length: emptyLabel("auto") };
      return {
        showLength: true,
        length: { ...emptyLabel("custom"), custom: String(lock.value) },
      };
    }),
  };
}

function fromQuadPolygon(
  state: TrigRatiosState,
  poly: ReturnType<typeof quadPolygonState>,
): TrigRatiosState {
  return { ...state, quadPoints: poly.points.slice(0, 4) };
}

export function setPointName(
  state: TrigRatiosState,
  id: string,
  nameValue: string,
): TrigRatiosState {
  if (state.kind === "triangle-area") {
    const prev = state.triNames[id] ?? { name: id, dx: 0, dy: 0, showName: true, showDot: true };
    return {
      ...state,
      triNames: {
        ...state.triNames,
        [id]: { ...prev, name: nameValue.trim() || prev.name },
      },
    };
  }
  if (state.kind === "quad-area") {
    const i = "ABCD".indexOf(id);
    if (i >= 0) {
      return {
        ...state,
        quadVertices: state.quadVertices.map((v, idx) =>
          idx === i ? { ...v, name: nameValue.trim() || v.name } : v,
        ),
      };
    }
  }
  const prev = state.names[id] ?? { name: id, dx: 0, dy: 0, showName: true, showDot: true };
  return {
    ...state,
    names: { ...state.names, [id]: { ...prev, name: nameValue.trim() || prev.name } },
  };
}

export function nudgeLabel(
  state: TrigRatiosState,
  labelId: string,
  dx: number,
  dy: number,
  lineOnly = false,
  canvasPts?: Record<string, Vec>,
): TrigRatiosState {
  if (labelId.startsWith("n:")) {
    const id = labelId.slice(2);
    if (state.kind === "triangle-area") {
      const prev = state.triNames[id] ?? { name: id, dx: 0, dy: 0, showName: true, showDot: true };
      return {
        ...state,
        triNames: {
          ...state.triNames,
          [id]: { ...prev, dx: prev.dx + dx, dy: prev.dy + dy },
        },
      };
    }
    if (state.kind === "quad-area") {
      const i = "ABCD".indexOf(id);
      if (i >= 0) {
        return {
          ...state,
          quadVertices: state.quadVertices.map((v, idx) =>
            idx === i ? { ...v, nameDx: v.nameDx + dx, nameDy: v.nameDy + dy } : v,
          ),
        };
      }
    }
    const prev = state.names[id] ?? { name: id, dx: 0, dy: 0, showName: true, showDot: true };
    return {
      ...state,
      names: { ...state.names, [id]: { ...prev, dx: prev.dx + dx, dy: prev.dy + dy } },
    };
  }
  if (labelId.startsWith("s:")) {
    const segId = labelId.slice(2);
    const axes = lengthDimAxes(state, canvasPts, segId);
    const alongAmt = axes ? dx * axes.along.x + dy * axes.along.y : dx;
    const perpAmt = axes ? dx * axes.outward.x + dy * axes.outward.y : dy;
    return patchLengthLabel(state, segId, (label) => {
      if (lineOnly) {
        return { ...label, lineDy: clamp((label.lineDy ?? 0) + perpAmt, -160, 160) };
      }
      return {
        ...label,
        dx: clamp(label.dx + alongAmt, -80, 80),
        dy: clamp(label.dy + perpAmt, -160, 160),
      };
    });
  }
  if (labelId.startsWith("a:")) {
    const angId = labelId.slice(2);
    if (state.kind === "unit-circle") {
      if (angId === "theta") return { ...state, thetaLabel: nudgeMeas(state.thetaLabel, dx, dy, lineOnly) };
      if (angId === "y") return { ...state, yAngleLabel: nudgeMeas(state.yAngleLabel, dx, dy, lineOnly) };
      if (angId === "z") return { ...state, zAngleLabel: nudgeMeas(state.zAngleLabel, dx, dy, lineOnly) };
    }
    if (state.kind === "quad-area" && ["AOB", "BOC", "COD", "DOA"].includes(angId)) {
      const mark = state.quadDiagAngles.find((a) => a.id === angId);
      return patchQuadDiagAngle(state, angId, {
        label: nudgeMeas(mark?.label ?? emptyLabel("auto"), dx, dy, lineOnly),
      });
    }
    const key = state.kind === "triangle-area" ? "triAngles" : "angles";
    return {
      ...state,
      [key]: state[key].map((a) =>
        a.id === angId ? { ...a, label: nudgeMeas(a.label, dx, dy, lineOnly) } : a,
      ),
    };
  }
  if (labelId.startsWith("v:")) {
    const vi = Number(labelId.split(":")[1]);
    if (state.kind === "quad-area" && Number.isFinite(vi)) {
      return {
        ...state,
        quadVertices: state.quadVertices.map((v, i) =>
          i === vi ? { ...v, interior: nudgeMeas(v.interior, dx, dy, lineOnly) } : v,
        ),
      };
    }
  }
  return state;
}

function nudgeMeas(
  label: MeasLabel,
  dx: number,
  dy: number,
  lineOnly: boolean,
): MeasLabel {
  if (lineOnly) return label;
  return {
    ...label,
    dx: clamp(label.dx + dx, -80, 80),
    dy: clamp(label.dy + dy, -80, 80),
  };
}

export function nudgeDimLine(
  state: TrigRatiosState,
  labelId: string,
  dx: number,
  dy: number,
  canvasPts?: Record<string, Vec>,
): TrigRatiosState {
  return nudgeLabel(state, labelId, dx, dy, true, canvasPts);
}

function patchLengthLabel(
  state: TrigRatiosState,
  segId: string,
  updater: (label: MeasLabel) => MeasLabel,
): TrigRatiosState {
  if (segId === "radius") {
    return { ...state, radiusLabel: updater(state.radiusLabel) };
  }
  if (state.kind === "quad-area") {
    if (segId === "AC" || segId === "BD") {
      const prevEdge = state.quadDiagEdges?.[segId] ?? { showLength: false, length: { mode: "auto", custom: "" } };
      return {
        ...state,
        quadDiagEdges: {
          ...state.quadDiagEdges,
          [segId]: {
            ...prevEdge,
            length: updater(prevEdge.length),
          },
        },
      };
    }
    const i = ["AB", "BC", "CD", "DA"].indexOf(segId);
    if (i >= 0) {
      return {
        ...state,
        quadEdges: state.quadEdges.map((e, idx) =>
          idx === i ? { ...e, length: updater(e.length) } : e,
        ),
      };
    }
  }
  const seg = findSeg(state, segId);
  if (!seg) return state;
  return patchSegState(state, segId, { label: updater(seg.label) });
}

export function canvasCentroid(canvas: Record<string, Vec>, ids: string[]): Vec {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const id of ids) {
    const p = canvas[id];
    if (!p) continue;
    x += p.x;
    y += p.y;
    n += 1;
  }
  if (n === 0) return { x: 0, y: 0 };
  return { x: x / n, y: y / n };
}

function perpToward(along: Vec, toward: Vec): Vec {
  const dir = norm(along);
  let p: Vec = { x: -dir.y, y: dir.x };
  if (p.x * toward.x + p.y * toward.y < 0) p = { x: -p.x, y: -p.y };
  return p;
}

export function lengthDimAxes(
  state: TrigRatiosState,
  canvasPts: Record<string, Vec> | undefined,
  segId: string,
): { along: Vec; outward: Vec } | null {
  if (!canvasPts) return null;
  if (segId === "radius") {
    if (!canvasPts.O) return null;
    return { along: { x: 0, y: -1 }, outward: { x: -1, y: 0 } };
  }
  const ends = lengthEndpoints(state, segId);
  if (!ends) return null;
  const a = canvasPts[ends.a];
  const b = canvasPts[ends.b];
  if (!a || !b) return null;
  const along = norm(sub(b, a));
  if (len(along) < 1e-6) return null;
  const mid = mul(add(a, b), 0.5);
  if (state.kind === "quad-area" && (segId === "AC" || segId === "BD")) {
    const towardId = segId === "AC" ? "D" : "A";
    const toward = canvasPts[towardId] ? sub(canvasPts[towardId]!, mid) : { x: -along.y, y: along.x };
    return { along, outward: perpToward(along, toward) };
  }
  const ids =
    state.kind === "unit-circle"
      ? ["O", "A", "B", "C", "D"]
      : state.kind === "quad-area"
        ? ["A", "B", "C", "D"]
        : ["A", "B", "C"];
  const face = canvasCentroid(canvasPts, ids);
  return { along, outward: perpToward(along, sub(mid, face)) };
}

function lengthEndpoints(state: TrigRatiosState, segId: string): { a: string; b: string } | null {
  if (segId === "radius") return { a: "O", b: "O" };
  const seg = findSeg(state, segId);
  if (seg) return { a: seg.a, b: seg.b };
  if (["AB", "BC", "CD", "DA", "AC", "BD"].includes(segId)) {
    return { a: segId[0]!, b: segId[1]! };
  }
  return null;
}

export function dimResizeCursor(along: Vec): string {
  const perpX = -along.y;
  const perpY = along.x;
  return Math.abs(perpX) >= Math.abs(perpY) ? "ew-resize" : "ns-resize";
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

export function hitTestTrig(
  canvasPts: Record<string, Vec>,
  texts: { id: string; x: number; y: number }[],
  cmds: HitCmd[],
  strokes: [string, string][],
  segs: SegMark[],
  x: number,
  y: number,
  scale: number,
  dragIds: string[],
): TrigHit | null {
  const labelR = 18 * scale;
  const rPoint = 16 * scale;
  const dimR = 12 * scale;
  const rSeg = 12 * scale;

  let bestText: { id: string; d: number } | null = null;
  for (const text of texts) {
    if (text.id.endsWith(":line")) continue;
    const d = Math.hypot(text.x - x, text.y - y);
    if (d < labelR && (!bestText || d < bestText.d)) bestText = { id: text.id, d };
  }

  let bestDim: { id: string; d: number } | null = null;
  for (const cmd of cmds) {
    if (!cmd.id || !cmd.id.endsWith(":line")) continue;
    const id = cmd.id.slice(0, -5);
    let d = Infinity;
    if (cmd.t === "line" && cmd.x1 != null && cmd.y1 != null && cmd.x2 != null && cmd.y2 != null) {
      d = distToSeg({ x, y }, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 });
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

  let bestP: { id: string; d: number } | null = null;
  for (const id of dragIds) {
    const p = canvasPts[id];
    if (p && Math.hypot(p.x - x, p.y - y) < rPoint) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (!bestP || d < bestP.d) bestP = { id, d };
    }
  }

  if (bestText && (bestText.id.startsWith("a:") || bestText.id.startsWith("v:"))) {
    if (!bestP || bestText.d <= bestP.d + 10) {
      return { kind: "label", id: bestText.id };
    }
  }
  if (bestP && (!bestText || bestP.d <= bestText.d) && (!bestDim || bestP.d <= bestDim.d + 6)) {
    return { kind: "point", id: bestP.id };
  }
  if (bestText && bestDim) {
    if (bestDim.d <= bestText.d) return { kind: "dimLine", id: bestDim.id };
    return { kind: "label", id: bestText.id };
  }
  if (bestDim) return { kind: "dimLine", id: bestDim.id };
  if (bestText) return { kind: "label", id: bestText.id };
  if (bestP) return { kind: "point", id: bestP.id };

  const angR = 12 * scale;
  let bestAng: { id: string; d: number } | null = null;
  for (const cmd of cmds) {
    if (cmd.t !== "arc" || !cmd.id) continue;
    if (!(cmd.id.startsWith("a:") || cmd.id.startsWith("v:"))) continue;
    if (cmd.id.endsWith(":line")) continue;
    if (cmd.cx == null || cmd.cy == null || cmd.r == null || cmd.a0 == null || cmd.a1 == null) continue;
    const d = distToArc(x, y, cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw === true);
    if (d < angR && (!bestAng || d < bestAng.d)) bestAng = { id: cmd.id, d };
  }
  if (bestAng) return { kind: "ang", id: bestAng.id };

  for (const [a, b] of strokes) {
    const pa = canvasPts[a];
    const pb = canvasPts[b];
    if (!pa || !pb) continue;
    if (distToSeg({ x, y }, pa, pb) < rSeg) {
      const id = `${a}${b}`;
      const rev = `${b}${a}`;
      if (segs.some((s) => s.id === id || s.id === rev)) {
        return { kind: "seg", id: segs.find((s) => s.id === id)?.id ?? rev };
      }
      return { kind: "seg", id };
    }
  }

  return null;
}

export function rebuildRightForRightVertex(state: TrigRatiosState, rv: "A" | "B" | "C"): TrigRatiosState {
  const t = trigTriangleForRightVertex(state.legLeft, state.legRight, rv);
  return normalizeRight({
    ...state,
    rightVertex: rv,
    A: t.A,
    B: t.B,
    C: t.C,
    rotateDeg: 0,
  });
}

function normalizeRight(state: TrigRatiosState): TrigRatiosState {
  return syncLegFields(state as unknown as PythagoreanState) as unknown as TrigRatiosState;
}

export function interiorAngleDeg(points: Vec[], i: number): number {
  const n = points.length;
  const prev = points[(i + n - 1) % n]!;
  const cur = points[i]!;
  const next = points[(i + 1) % n]!;
  return angleDeg(prev, cur, next);
}

export function extensionPoint(from: Vec, to: Vec, ext: number): Vec {
  const dir = norm(sub(to, from));
  return add(to, mul(dir, ext));
}

export { findSeg, patchSegState };
