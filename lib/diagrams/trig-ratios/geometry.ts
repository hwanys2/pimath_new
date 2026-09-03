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
  formatHypotenuseLabel,
  formatRadicalLength,
  simplifySqrtInt,
} from "@/lib/diagrams/pythagorean/radical";
import {
  altitudeFootId,
  findSeg,
  formatThetaLabel,
  patchSegState,
  roundThetaDeg,
  wrapRotateDeg,
  type AltitudeVertex,
  type AngleMark,
  type TrigRatiosState,
  type SegMark,
} from "./model";
import {
  altitudeTriangleFromLegs,
  triangleForRightVertex,
} from "@/lib/diagrams/pythagorean/model";
import {
  rebuildTriangleFromLegs as pythRebuild,
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
  const { triA: A, triB: B, triC: C } = state;
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
        ["O", "A"],
        ["A", "B"],
        ["O", "B"],
        ["C", "D"],
        ["O", "C"],
        ["O", "D"],
      ];
      const pts = unitCirclePoints(state);
      return strokes.filter(([a, b]) => pts[a] && pts[b]);
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
  return fromPythTriangle(state, pythRebuild(toPythState(state), legLeft, legRight));
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
      const patch = { [`tri${key}`]: pos } as Partial<TrigRatiosState>;
      const next = { ...state, ...patch };
      const pts = [next.triA, next.triB, next.triC];
      if (!isConvex(pts) || edgeLength(pts, 0) < 0.4) return state;
      return unlockShownNumeric(next);
    }
    case "quad-area": {
      const i = "ABCD".indexOf(id);
      if (i < 0) return state;
      const pts = state.quadPoints.slice();
      pts[i] = pos;
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

export function setRotateDeg(state: TrigRatiosState, deg: number): TrigRatiosState {
  return { ...state, rotateDeg: wrapRotateDeg(deg) };
}

export function setThetaDeg(state: TrigRatiosState, deg: number): TrigRatiosState {
  return { ...state, thetaDeg: roundThetaDeg(deg) };
}

export function toggleSeg(state: TrigRatiosState, id: string): TrigRatiosState {
  const seg = findSeg(state, id);
  if (!seg) return state;
  return patchSegState(state, id, { show: !seg.show });
}

function formatComputedLength(length: number, unit: string): string {
  const radical = exactRadicalLength(length, unit);
  return radical ?? formatMeasure(length, unit);
}

function exactRadicalLength(length: number, unit: string): string | null {
  if (!(length > 0) || !Number.isFinite(length)) return null;
  const sq = length * length;
  const intSq = Math.round(sq);
  if (intSq > 0 && Math.abs(sq - intSq) < 1e-3) {
    const { coeff, radicand } = simplifySqrtInt(intSq);
    if (coeff > 0 && radicand > 1) return formatRadicalLength(coeff, radicand, unit);
  }
  for (let rad = 2; rad <= 15; rad += 1) {
    const q = length / Math.sqrt(rad);
    const coeff = Math.round(q);
    if (coeff < 1) continue;
    if (Math.abs(q - coeff) < 1e-3) {
      const { coeff: c, radicand } = simplifySqrtInt(coeff * coeff * rad);
      if (c > 0 && radicand > 1) return formatRadicalLength(c, radicand, unit);
    }
  }
  return null;
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
  const computed = formatComputedLength(length, state.unit);
  if (label.mode === "custom") {
    const text = label.custom.trim();
    if (!text) return null;
    if (isSymbolicLengthLabel(label)) return normalizeSqrtLabel(text);
    return computed;
  }
  return computed;
}

export function resolveSegText(state: TrigRatiosState, seg: SegMark): string | null {
  if (!seg.show) return null;
  const length = segLength(state, seg);
  const { label } = seg;
  if (label.mode === "hide") return null;
  if (label.mode === "x") return `$${labelUnknownLetter(label, state.unknownLetter)}$`;
  const computed = formatRightSegComputed(state, seg, length);
  if (label.mode === "custom") {
    const text = label.custom.trim();
    if (!text) return null;
    if (isSymbolicLengthLabel(label)) return normalizeSqrtLabel(text);
    return computed;
  }
  return computed;
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
    const parsed = parseAngleInput(text);
    if (parsed.kind === "number") return `${Math.round(deg * 10) / 10}°`;
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
    const parsed = parseAngleInput(text);
    if (parsed.kind === "number") return formatThetaLabel(deg);
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
    return { ...prev, mode: "custom", custom: String(parsed.value) };
  }
  if (!text.trim()) return { ...prev, mode: "hide", custom: "" };
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
  if (!text.trim()) return { ...prev, mode: "hide", custom: "" };
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

function isSymbolicLengthLabel(label: MeasLabel): boolean {
  if (label.mode === "x") return true;
  if (label.mode === "custom") {
    if (measureNumber(label.custom) != null) return false;
    return parseMeasureInput(label.custom).kind === "unknown";
  }
  return false;
}

function autoLengthLabel(label: MeasLabel): MeasLabel {
  if (isSymbolicLengthLabel(label) || label.mode === "hide") return label;
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
  if (isSymbolicLengthLabel(label)) return null;
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
    const poly = quadPolyWithLocks(state, locks);
    const next =
      required.t === "seg"
        ? applyEdgeLengthChange(poly, ["AB", "BC", "CD", "DA"].indexOf(required.id), required.value)
        : required.t === "qang"
          ? applyInteriorAngleChange(poly, required.index, required.value)
          : poly;
    return fromQuadPolygon(state, next);
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
  const tri = triangleForRightVertex(left, right, state.rightVertex);
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

function patchShownLength(
  state: TrigRatiosState,
  segId: string,
  label: MeasLabel,
): TrigRatiosState {
  if (state.kind === "quad-area") {
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
        ? state.quadEdges[["AB", "BC", "CD", "DA"].indexOf(segId)]?.length
        : findSeg(state, segId)?.label;
    if (!prev) return state;
    const parsed = parseMeasureInput(trimmed);
    const numeric = measureNumber(trimmed);
    let next = patchShownLength(state, segId, labelFromMeasureParse(parsed, trimmed, prev));
    if (numeric != null && numeric > 0) {
      next = applySegNumeric(next, segId, numeric);
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

function applySegNumeric(state: TrigRatiosState, segId: string, value: number): TrigRatiosState {
  const target = clamp(value, 0.4, 40);
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

function applyQuadAngleNumeric(state: TrigRatiosState, vi: number, value: number): TrigRatiosState {
  return applyMeasureConstraint(state, { t: "qang", index: vi, value: clamp(value, 1, 179) });
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
  if (["AB", "BC", "CD", "DA"].includes(segId)) {
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
  const t = triangleForRightVertex(state.legLeft, state.legRight, rv);
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
