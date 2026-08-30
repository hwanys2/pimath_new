import { formatMeasure, formatNiceNumber } from "@/lib/diagrams/math-label";
import {
  add,
  applyEdgeLengthChange,
  applyInteriorAngleChange,
  clamp,
  cross,
  isConvex,
  len,
  mul,
  norm,
  parseAngleInput,
  parseMeasureInput,
  sub,
  vertexAngles,
} from "@/lib/diagrams/polygon/geometry";
import { emptyLabel, type MeasLabel, type PolygonState, type Vec } from "@/lib/diagrams/polygon/model";
import {
  findAng,
  findSeg,
  normalizeState,
  pointIdsFor,
  type AngleMark,
  type SegMark,
  type SimilarTrianglesState,
} from "./model";

export type SimHit =
  | { kind: "point"; id: string }
  | { kind: "seg"; id: string }
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string }
  | { kind: "slide"; id: string };

export type SimSelection =
  | { t: "point"; id: string }
  | { t: "seg"; id: string }
  | { t: "ang"; id: string };

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function midpoint(a: Vec, b: Vec): Vec {
  return mul(add(a, b), 0.5);
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

function triangleArea(A: Vec, B: Vec, C: Vec): number {
  return Math.abs(cross(sub(B, A), sub(C, A))) / 2;
}

export function triangleOk(A: Vec, B: Vec, C: Vec): boolean {
  if (triangleArea(A, B, C) < 0.12) return false;
  return len(sub(A, B)) > 0.35 && len(sub(B, C)) > 0.35 && len(sub(C, A)) > 0.35;
}

export function angleDeg(from: Vec, vertex: Vec, to: Vec): number {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  return (Math.acos(clamp(u.x * w.x + u.y * w.y, -1, 1)) * 180) / Math.PI;
}

function lerpY(xl: number, xn: number, yL: number, yN: number, y: number): number {
  const span = yN - yL;
  if (Math.abs(span) < 1e-9) return xl;
  const t = (y - yL) / span;
  return xl + (xn - xl) * t;
}

export function derivedPoints(state: SimilarTrianglesState): Record<string, Vec> {
  const { A, B, C } = state;
  switch (state.kind) {
    case "nested": {
      const t = state.midpoint ? 0.5 : state.t;
      return { A, B, C, D: lerp(A, B, t), E: lerp(A, C, t) };
    }
    case "adjacent":
      return { A, B, C, D: state.D };
    case "cevian":
      return { A, B, C, D: lerp(A, C, clamp(state.t, 0.08, 0.92)) };
    case "altitude": {
      const t = clamp(projectT(A, B, C), 0.04, 0.96);
      return { A, B, C, D: lerp(B, C, t) };
    }
    case "bowtie": {
      const k = Math.max(state.t, 0.15);
      const m = state.bowtieParallel ? k : Math.max(state.t2, 0.15);
      return {
        A,
        B,
        C,
        D: add(A, mul(sub(A, B), k)),
        E: add(A, mul(sub(A, C), m)),
      };
    }
    case "centroid": {
      const D = midpoint(B, C);
      const E = midpoint(A, C);
      const F = midpoint(A, B);
      const G = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
      return { A, B, C, D, E, F, G };
    }
    case "parallels": {
      const p = state.parallels;
      const trans = p.trans.map((tr, i) => {
        let xl = tr.xl;
        let xn = tr.xn;
        if (p.shareTop && i === 1) xl = p.trans[0]!.xl;
        if (p.meetAtM && i === 2) {
          const t1 = p.trans[1] ?? p.trans[0]!;
          let t1xl = t1.xl;
          if (p.shareTop) t1xl = p.trans[0]!.xl;
          const xm = lerpY(t1xl, t1.xn, p.yL, p.yN, p.yM);
          const tLM = p.yM - p.yL;
          if (Math.abs(tLM) > 1e-9) {
            const vx = (xm - xl) / tLM;
            xn = xl + vx * (p.yN - p.yL);
          }
        }
        const L = { x: xl, y: p.yL };
        const N = { x: xn, y: p.yN };
        const M = { x: lerpY(xl, xn, p.yL, p.yN, p.yM), y: p.yM };
        return { L, M, N };
      });
      const out: Record<string, Vec> = {};
      trans.forEach((t, i) => {
        out[`T${i}L`] = t.L;
        out[`T${i}M`] = t.M;
        out[`T${i}N`] = t.N;
      });
      out._L0 = { x: p.xMin, y: p.yL };
      out._L1 = { x: p.xMax, y: p.yL };
      out._M0 = { x: p.xMin, y: p.yM };
      out._M1 = { x: p.xMax, y: p.yM };
      out._N0 = { x: p.xMin, y: p.yN };
      out._N1 = { x: p.xMax, y: p.yN };
      return out;
    }
  }
}

export function figureStrokes(state: SimilarTrianglesState): [string, string][] {
  switch (state.kind) {
    case "nested":
      return [
        ["A", "B"],
        ["B", "C"],
        ["C", "A"],
        ["D", "E"],
      ];
    case "adjacent":
      return [
        ["A", "B"],
        ["B", "C"],
        ["C", "A"],
        ["A", "D"],
        ["D", "C"],
      ];
    case "cevian":
      return [
        ["A", "B"],
        ["B", "C"],
        ["C", "A"],
        ["B", "D"],
      ];
    case "altitude":
      return [
        ["A", "B"],
        ["B", "C"],
        ["C", "A"],
        ["A", "D"],
      ];
    case "bowtie":
      return [
        ["B", "A"],
        ["A", "D"],
        ["C", "A"],
        ["A", "E"],
        ["B", "C"],
        ["D", "E"],
      ];
    case "centroid": {
      const lines: [string, string][] = [
        ["A", "B"],
        ["B", "C"],
        ["C", "A"],
      ];
      if (state.medianAD) lines.push(["A", "D"]);
      if (state.medianBE) lines.push(["B", "E"]);
      if (state.medianCF) lines.push(["C", "F"]);
      return lines;
    }
    case "parallels": {
      const n = state.parallels.trans.length;
      const lines: [string, string][] = [];
      for (let i = 0; i < n; i += 1) lines.push([`T${i}L`, `T${i}N`]);
      return lines;
    }
  }
}

export function draggableIds(state: SimilarTrianglesState): string[] {
  switch (state.kind) {
    case "nested":
      return state.midpoint ? ["A", "B", "C"] : ["A", "B", "C", "D", "E"];
    case "adjacent":
      return ["A", "B", "C", "D"];
    case "cevian":
      return ["A", "B", "C", "D"];
    case "altitude":
      return ["A", "B", "C"];
    case "bowtie":
      return ["A", "B", "C"];
    case "centroid":
      return ["A", "B", "C"];
    case "parallels": {
      const ids: string[] = [];
      state.parallels.trans.forEach((_, i) => {
        ids.push(`T${i}L`, `T${i}N`);
      });
      return ids;
    }
  }
}

export function displayName(state: SimilarTrianglesState, id: string): string {
  return state.names[id]?.name?.trim() || id;
}

export function segDisplayName(state: SimilarTrianglesState, seg: SegMark): string {
  return `${displayName(state, seg.a)}${displayName(state, seg.b)}`;
}

function abcPolygon(state: SimilarTrianglesState): PolygonState {
  return {
    points: [state.A, state.B, state.C],
    vertices: [
      { name: "A", nameDx: 0, nameDy: 0, showInterior: false, showExterior: false, fillExterior: false, interior: emptyLabel(), exterior: emptyLabel() },
      { name: "B", nameDx: 0, nameDy: 0, showInterior: false, showExterior: false, fillExterior: false, interior: emptyLabel(), exterior: emptyLabel() },
      { name: "C", nameDx: 0, nameDy: 0, showInterior: false, showExterior: false, fillExterior: false, interior: emptyLabel(), exterior: emptyLabel() },
    ],
    edges: [
      { showLength: false, length: emptyLabel() },
      { showLength: false, length: emptyLabel() },
      { showLength: false, length: emptyLabel() },
    ],
    diagonals: [],
    interiorAnglesDeg: [0, 0, 0],
    referenceEdgeLength: len(sub(state.B, state.C)) || 5,
    showVertexNames: true,
    showDots: true,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  };
}

function fromAbc(state: SimilarTrianglesState, poly: PolygonState): SimilarTrianglesState {
  const A = poly.points[0]!;
  const B = poly.points[1]!;
  const C = poly.points[2]!;
  if (!triangleOk(A, B, C)) return state;
  return snapKind({ ...state, A, B, C });
}

export function snapKind(state: SimilarTrianglesState): SimilarTrianglesState {
  if (state.kind !== "altitude") return state;
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
  return { ...state, C };
}

function signedDist(p: Vec, a: Vec, b: Vec): number {
  const n = norm({ x: -(b.y - a.y), y: b.x - a.x });
  return (p.x - a.x) * n.x + (p.y - a.y) * n.y;
}

function scaleFrom(p: Vec, origin: Vec, s: number): Vec {
  return add(origin, mul(sub(p, origin), s));
}

function setLenFrom(origin: Vec, p: Vec, value: number): Vec {
  const d = len(sub(p, origin));
  if (d < 1e-9) return p;
  return add(origin, mul(sub(p, origin), value / d));
}

function scaleState(
  state: SimilarTrianglesState,
  origin: Vec,
  s: number,
): SimilarTrianglesState {
  if (!Number.isFinite(s) || s < 0.04 || s > 50) return state;
  if (state.kind === "parallels") {
    const p = state.parallels;
    return {
      ...state,
      parallels: {
        ...p,
        yL: origin.y + (p.yL - origin.y) * s,
        yM: origin.y + (p.yM - origin.y) * s,
        yN: origin.y + (p.yN - origin.y) * s,
        xMin: origin.x + (p.xMin - origin.x) * s,
        xMax: origin.x + (p.xMax - origin.x) * s,
        trans: p.trans.map((tr) => ({
          xl: origin.x + (tr.xl - origin.x) * s,
          xn: origin.x + (tr.xn - origin.x) * s,
        })),
      },
    };
  }
  const A = scaleFrom(state.A, origin, s);
  const B = scaleFrom(state.B, origin, s);
  const C = scaleFrom(state.C, origin, s);
  if (!triangleOk(A, B, C)) return state;
  return snapKind({ ...state, A, B, C, D: scaleFrom(state.D, origin, s) });
}

function numericCustom(mark: SegMark | AngleMark | undefined, asAngle: boolean): number | null {
  if (!mark || mark.label.mode !== "custom") return null;
  const parsed = asAngle ? parseAngleInput(mark.label.custom) : parseMeasureInput(mark.label.custom);
  if (parsed.kind === "number" && parsed.value != null && parsed.value > 0) return parsed.value;
  return null;
}

function rewriteNumericCustom(
  prev: MeasLabel,
  value: number,
  asAngle: boolean,
  unit: string,
): MeasLabel {
  if (prev.mode !== "custom") return prev;
  const parsed = asAngle ? parseAngleInput(prev.custom) : parseMeasureInput(prev.custom);
  if (parsed.kind !== "number" || parsed.value == null) return prev;
  if (asAngle) {
    const hasDeg = /[°˚]/.test(prev.custom);
    return { ...prev, custom: hasDeg ? `${formatNiceNumber(value)}°` : formatNiceNumber(value) };
  }
  const hasUnit = /cm|mm/i.test(prev.custom);
  return {
    ...prev,
    custom: hasUnit ? formatMeasure(value, unit) : formatNiceNumber(value),
  };
}

export function syncNumericLabels(state: SimilarTrianglesState): SimilarTrianglesState {
  return {
    ...state,
    segs: state.segs.map((s) => {
      if (!s.show) return s;
      const L = segLength(state, s);
      if (!Number.isFinite(L)) return s;
      return { ...s, label: rewriteNumericCustom(s.label, L, false, state.unit) };
    }),
    angles: state.angles.map((a) => {
      if (!a.show) return a;
      const deg = angleValue(state, a);
      if (!Number.isFinite(deg)) return a;
      return { ...a, label: rewriteNumericCustom(a.label, deg, true, state.unit) };
    }),
  };
}

function finishMove(prev: SimilarTrianglesState, next: SimilarTrianglesState): SimilarTrianglesState {
  if (next === prev) return prev;
  return syncNumericLabels(next);
}

export function slideSegments(
  state: SimilarTrianglesState,
  canvasPts: Record<string, Vec>,
): { id: string; a: Vec; b: Vec }[] {
  const out: { id: string; a: Vec; b: Vec }[] = [];
  if (state.kind === "nested" && !state.midpoint && canvasPts.D && canvasPts.E) {
    out.push({ id: "DE", a: canvasPts.D, b: canvasPts.E });
  }
  if (state.kind === "bowtie" && state.bowtieParallel && canvasPts.D && canvasPts.E) {
    out.push({ id: "DE", a: canvasPts.D, b: canvasPts.E });
  }
  if (state.kind === "parallels") {
    if (canvasPts._L0 && canvasPts._L1) out.push({ id: "L", a: canvasPts._L0, b: canvasPts._L1 });
    if (canvasPts._M0 && canvasPts._M1) out.push({ id: "M", a: canvasPts._M0, b: canvasPts._M1 });
    if (canvasPts._N0 && canvasPts._N1) out.push({ id: "N", a: canvasPts._N0, b: canvasPts._N1 });
  }
  return out;
}

function nestedTFromPoint(state: SimilarTrianglesState, p: Vec): number {
  const hA = signedDist(state.A, state.B, state.C);
  if (Math.abs(hA) < 1e-9) return state.t;
  const hP = signedDist(p, state.B, state.C);
  return clamp(1 - hP / hA, 0.08, 0.92);
}

export function moveSlide(
  state: SimilarTrianglesState,
  id: string,
  math: Vec,
): SimilarTrianglesState {
  if (id === "DE" && state.kind === "nested" && !state.midpoint) {
    return finishMove(state, { ...state, t: nestedTFromPoint(state, math) });
  }
  if (id === "DE" && state.kind === "bowtie" && state.bowtieParallel) {
    const u = sub(state.A, state.B);
    const l2 = u.x * u.x + u.y * u.y;
    if (l2 < 1e-12) return state;
    const k = (math.x - state.A.x) * u.x + (math.y - state.A.y) * u.y;
    return finishMove(state, { ...state, t: clamp(k / l2, 0.15, 3) });
  }
  if (state.kind === "parallels" && (id === "L" || id === "M" || id === "N")) {
    const p = state.parallels;
    const gap = 0.22;
    let { yL, yM, yN } = p;
    if (id === "L") yL = Math.max(math.y, yM + gap);
    else if (id === "M") yM = clamp(math.y, yN + gap, yL - gap);
    else yN = Math.min(math.y, yM - gap);
    return finishMove(state, { ...state, parallels: { ...p, yL, yM, yN } });
  }
  return state;
}

function movePointInner(
  state: SimilarTrianglesState,
  id: string,
  next: Vec,
): SimilarTrianglesState {
  if (state.kind === "parallels") {
    const m = /^T(\d)([LN])$/.exec(id);
    if (!m) return state;
    const i = Number(m[1]);
    const which = m[2] as "L" | "N";
    const trans = state.parallels.trans.map((tr, idx) => {
      if (idx !== i) return tr;
      return which === "L" ? { ...tr, xl: next.x } : { ...tr, xn: next.x };
    });
    return { ...state, parallels: { ...state.parallels, trans } };
  }

  if (id === "D" && state.kind === "nested" && !state.midpoint) {
    return { ...state, t: clamp(projectT(next, state.A, state.B), 0.08, 0.92) };
  }
  if (id === "E" && state.kind === "nested" && !state.midpoint) {
    return { ...state, t: clamp(projectT(next, state.A, state.C), 0.08, 0.92) };
  }
  if (id === "D" && state.kind === "cevian") {
    return { ...state, t: clamp(projectT(next, state.A, state.C), 0.08, 0.92) };
  }
  if (id === "D" && state.kind === "adjacent") {
    if (!triangleOk(state.A, state.C, next)) return state;
    return { ...state, D: next };
  }

  if (id === "A" || id === "B" || id === "C") {
    if (state.kind === "altitude") {
      if (id === "A") {
        const d = sub(next, state.A);
        return snapKind({
          ...state,
          A: next,
          B: add(state.B, d),
          C: add(state.C, d),
        });
      }
      if (id === "B") {
        const ac = sub(state.C, state.A);
        const n = norm({ x: -ac.y, y: ac.x });
        const t = (next.x - state.A.x) * n.x + (next.y - state.A.y) * n.y;
        const B = add(state.A, mul(n, t));
        if (!triangleOk(state.A, B, state.C)) return state;
        return { ...state, B };
      }
      const ab = sub(state.B, state.A);
      const n = norm({ x: -ab.y, y: ab.x });
      const t = (next.x - state.A.x) * n.x + (next.y - state.A.y) * n.y;
      const C = add(state.A, mul(n, t));
      if (!triangleOk(state.A, state.B, C)) return state;
      return { ...state, C };
    }
    const A = id === "A" ? next : state.A;
    const B = id === "B" ? next : state.B;
    const C = id === "C" ? next : state.C;
    if (!triangleOk(A, B, C)) return state;
    if (!isConvex([A, B, C])) return state;
    return snapKind({ ...state, A, B, C });
  }
  return state;
}

export function movePoint(
  state: SimilarTrianglesState,
  id: string,
  next: Vec,
): SimilarTrianglesState {
  return finishMove(state, movePointInner(state, id, next));
}

export function hitTestSimilar(
  canvasPts: Record<string, Vec>,
  texts: { id: string; x: number; y: number }[],
  cmds: { t: string; id?: string; x1?: number; y1?: number; x2?: number; y2?: number }[],
  strokes: [string, string][],
  segs: SegMark[],
  x: number,
  y: number,
  scale = 1,
  dragIds: string[],
  slides: { id: string; a: Vec; b: Vec }[] = [],
): SimHit | null {
  const labelR = 22 * Math.max(scale, 0.85);
  let bestText: { id: string; d: number } | null = null;
  for (const text of texts) {
    const d = Math.hypot(text.x - x, text.y - y);
    if (d < labelR && (!bestText || d < bestText.d)) bestText = { id: text.id, d };
  }
  if (bestText) {
    if (bestText.id.endsWith(":line")) {
      return { kind: "dimLine", id: bestText.id.slice(0, -5) };
    }
    return { kind: "label", id: bestText.id };
  }

  const pointR = 14 * Math.max(scale, 0.85);
  let bestP: { id: string; d: number } | null = null;
  for (const id of dragIds) {
    const p = canvasPts[id];
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < pointR && (!bestP || d < bestP.d)) bestP = { id, d };
  }
  if (bestP) return { kind: "point", id: bestP.id };

  const slideR = 11 * Math.max(scale, 0.85);
  let bestSlide: { id: string; d: number } | null = null;
  for (const s of slides) {
    const d = distToSeg({ x, y }, s.a, s.b);
    if (d < slideR && (!bestSlide || d < bestSlide.d)) bestSlide = { id: s.id, d };
  }
  if (bestSlide) return { kind: "slide", id: bestSlide.id };

  const dimR = 10 * Math.max(scale, 0.85);
  let bestDim: SimHit | null = null;
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
      || segs.find((s) => `${s.a}${s.b}` === bestE!.id || `${s.b}${s.a}` === bestE!.id);
    if (seg) return { kind: "seg", id: seg.id };
    return { kind: "seg", id: bestE.id };
  }
  return null;
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

function applyAbcLength(state: SimilarTrianglesState, edgeIndex: 0 | 1 | 2, value: number) {
  const poly = applyEdgeLengthChange(abcPolygon(state), edgeIndex, value);
  return fromAbc(state, poly);
}

function applyAbcAngle(state: SimilarTrianglesState, index: 0 | 1 | 2, deg: number) {
  const poly = applyInteriorAngleChange(abcPolygon(state), index, deg);
  return fromAbc(state, poly);
}

function applyTriAngle(
  state: SimilarTrianglesState,
  P: Vec,
  Q: Vec,
  R: Vec,
  deg: number,
  write: (P: Vec, Q: Vec, R: Vec) => SimilarTrianglesState,
): SimilarTrianglesState {
  const poly = applyInteriorAngleChange(abcPolygon({ ...state, A: P, B: Q, C: R }), 0, deg);
  const p = poly.points[0]!;
  const q = poly.points[1]!;
  const r = poly.points[2]!;
  if (!triangleOk(p, q, r)) return state;
  return write(p, q, r);
}

function currentSegLen(state: SimilarTrianglesState, sid: string): number {
  const mark = findSeg(state, sid);
  if (!mark) return NaN;
  return segLength(state, mark);
}

function scaleToSeg(
  state: SimilarTrianglesState,
  sid: string,
  value: number,
  origin: Vec,
): SimilarTrianglesState {
  const cur = currentSegLen(state, sid);
  if (!(cur > 1e-9)) return state;
  return scaleState(state, origin, value / cur);
}

function applySplitT(
  state: SimilarTrianglesState,
  leftId: string,
  rightId: string,
  editedId: string,
  value: number,
  tMin: number,
  tMax: number,
  originFor: Record<string, Vec>,
): SimilarTrianglesState {
  const origin = originFor[editedId];
  if (!origin) return state;
  const left = findSeg(state, leftId);
  const right = findSeg(state, rightId);
  const sibling = editedId === leftId ? right : left;
  const sibVal = numericCustom(sibling, false);
  if (sibVal != null) {
    const L = editedId === leftId ? value : sibVal;
    const R = editedId === rightId ? value : sibVal;
    const sum = L + R;
    if (sum > 0.2) {
      const next = { ...state, t: clamp(L / sum, tMin, tMax) };
      return scaleToSeg(next, editedId, value, origin);
    }
  }
  return scaleToSeg(state, editedId, value, origin);
}

function applyParallelsSeg(
  state: SimilarTrianglesState,
  sid: string,
  value: number,
): SimilarTrianglesState {
  const m = /^t(\d)([ud])$/.exec(sid);
  if (!m) return state;
  const i = Number(m[1]);
  const upper = m[2] === "u";
  const sibling = findSeg(state, `t${i}${upper ? "d" : "u"}`);
  const sibVal = numericCustom(sibling, false);
  const p = state.parallels;
  let { yL, yM, yN } = p;
  if (sibVal != null) {
    const up = upper ? value : sibVal;
    const down = upper ? sibVal : value;
    const total = up + down;
    if (total > 0.2) {
      yM = yL - (yL - yN) * (up / total);
    }
  }
  const spanY = yL - yN;
  const frac = upper ? Math.abs(yL - yM) / Math.max(Math.abs(spanY), 1e-9)
    : Math.abs(yM - yN) / Math.max(Math.abs(spanY), 1e-9);
  const targetLN = frac > 1e-6 ? value / frac : value * 2;
  const dy = yN - yL;
  let dxAbs = Math.sqrt(Math.max(targetLN * targetLN - dy * dy, 0));
  if (targetLN <= Math.abs(dy) + 1e-9) {
    const shrink = (value * 0.55) / Math.max(Math.abs(upper ? yL - yM : yM - yN), 1e-9);
    yL = yM + (yL - yM) * shrink;
    yN = yM + (yN - yM) * shrink;
    const dy2 = yN - yL;
    const span2 = yL - yN;
    const frac2 = upper
      ? Math.abs(yL - yM) / Math.max(Math.abs(span2), 1e-9)
      : Math.abs(yM - yN) / Math.max(Math.abs(span2), 1e-9);
    const ln2 = frac2 > 1e-6 ? value / frac2 : value * 2;
    dxAbs = Math.sqrt(Math.max(ln2 * ln2 - dy2 * dy2, 0));
  }
  const pts = derivedPoints({ ...state, parallels: { ...p, yL, yM, yN } });
  const M = pts[`T${i}M`];
  const L = pts[`T${i}L`];
  if (!M || !L) return state;
  const sign = Math.sign(L.x - M.x) || (i === 0 ? -1 : 1);
  const tM = (yM - yL) / (yN - yL || 1);
  const dx = sign * dxAbs * Math.sign(yN - yL || 1);
  const xl = M.x - dx * tM;
  const xn = xl + dx;
  const trans = p.trans.map((tr, idx) => (idx === i ? { xl, xn } : tr));
  return { ...state, parallels: { ...p, yL, yM, yN, trans } };
}

export function applySegLength(
  state: SimilarTrianglesState,
  sid: string,
  value: number,
): SimilarTrianglesState {
  if (!(value > 0.05) || value > 80) return state;
  if (sid === "AB") return applyAbcLength(state, 0, value);
  if (sid === "BC") return applyAbcLength(state, 1, value);
  if (sid === "AC") return applyAbcLength(state, 2, value);

  if (state.kind === "nested") {
    if (sid === "AD" || sid === "DB") {
      return applySplitT(state, "AD", "DB", sid, value, 0.08, 0.92, {
        AD: state.A,
        DB: state.B,
      });
    }
    if (sid === "AE" || sid === "EC") {
      return applySplitT(state, "AE", "EC", sid, value, 0.08, 0.92, {
        AE: state.A,
        EC: state.C,
      });
    }
    if (sid === "DE") {
      const bcCustom = numericCustom(findSeg(state, "BC"), false);
      const bc = len(sub(state.B, state.C));
      if (bcCustom != null && bcCustom > 0.2) {
        const next = { ...state, t: clamp(value / bcCustom, 0.08, 0.92) };
        return scaleToSeg(next, "DE", value, next.A);
      }
      if (value < bc * 0.92 && value > bc * 0.08) {
        return { ...state, t: value / bc };
      }
      return scaleToSeg(state, "DE", value, state.A);
    }
  }

  if (state.kind === "adjacent") {
    if (sid === "AD") {
      const D = setLenFrom(state.A, state.D, value);
      if (!triangleOk(state.A, state.C, D)) return state;
      return { ...state, D };
    }
    if (sid === "CD") {
      const D = setLenFrom(state.C, state.D, value);
      if (!triangleOk(state.A, state.C, D)) return state;
      return { ...state, D };
    }
  }

  if (state.kind === "cevian") {
    if (sid === "AD" || sid === "DC") {
      return applySplitT(state, "AD", "DC", sid, value, 0.08, 0.92, {
        AD: state.A,
        DC: state.C,
      });
    }
    if (sid === "BD") {
      const pts = derivedPoints(state);
      const D = pts.D!;
      const B = setLenFrom(D, state.B, value);
      if (!triangleOk(state.A, B, state.C)) return state;
      return { ...state, B };
    }
  }

  if (state.kind === "altitude") {
    const pts = derivedPoints(state);
    if (sid === "AD") return scaleToSeg(state, "AD", value, pts.D!);
    if (sid === "BD") {
      const D = pts.D!;
      const B = setLenFrom(D, state.B, value);
      if (!triangleOk(state.A, B, state.C)) return state;
      return snapKind({ ...state, B });
    }
    if (sid === "DC") {
      const D = pts.D!;
      const C = setLenFrom(D, state.C, value);
      if (!triangleOk(state.A, state.B, C)) return state;
      return snapKind({ ...state, C });
    }
  }

  if (state.kind === "bowtie") {
    const ab = len(sub(state.A, state.B));
    const ac = len(sub(state.A, state.C));
    if (sid === "AD") {
      const abCustom = numericCustom(findSeg(state, "AB"), false);
      if (abCustom != null) {
        const next = { ...state, t: clamp(value / abCustom, 0.15, 3) };
        return scaleToSeg(next, "AD", value, next.A);
      }
      if (ab > 1e-9 && value / ab >= 0.15) return { ...state, t: clamp(value / ab, 0.15, 3) };
      return scaleToSeg(state, "AD", value, state.A);
    }
    if (sid === "AE") {
      const acCustom = numericCustom(findSeg(state, "AC"), false);
      const key = state.bowtieParallel ? "t" : "t2";
      if (acCustom != null) {
        const next = { ...state, [key]: clamp(value / acCustom, 0.15, 3) };
        return scaleToSeg(next, "AE", value, next.A);
      }
      const den = state.bowtieParallel ? ab : ac;
      if (den > 1e-9 && value / (state.bowtieParallel ? ab : ac) >= 0.15) {
        return { ...state, [key]: clamp(value / (state.bowtieParallel ? ab : ac), 0.15, 3) };
      }
      return scaleToSeg(state, "AE", value, state.A);
    }
    if (sid === "DE") {
      const bcCustom = numericCustom(findSeg(state, "BC"), false);
      const bc = len(sub(state.B, state.C));
      if (state.bowtieParallel && bcCustom != null && bcCustom > 0.2) {
        const next = { ...state, t: clamp(value / bcCustom, 0.15, 3) };
        return scaleToSeg(next, "DE", value, next.A);
      }
      if (state.bowtieParallel && bc > 1e-9) {
        return { ...state, t: clamp(value / bc, 0.15, 3) };
      }
      return scaleToSeg(state, "DE", value, state.A);
    }
  }

  if (state.kind === "centroid") {
    if (sid === "BD" || sid === "DC") return applyAbcLength(state, 1, value * 2);
    if (sid === "AF" || sid === "FB") return applyAbcLength(state, 0, value * 2);
    const pts = derivedPoints(state);
    if (sid === "AG") return scaleToSeg(state, "AG", value, pts.D!);
    if (sid === "GD") return scaleToSeg(state, "GD", value, state.A);
    if (sid === "BE") return scaleToSeg(state, "BE", value, pts.E!);
    if (sid === "EG") return scaleToSeg(state, "EG", value, state.B);
    if (sid === "CF") return scaleToSeg(state, "CF", value, pts.F!);
    if (sid === "GC") return scaleToSeg(state, "GC", value, pts.F!);
  }

  if (state.kind === "parallels") return applyParallelsSeg(state, sid, value);
  return state;
}

export function applyAngDeg(
  state: SimilarTrianglesState,
  aid: string,
  deg: number,
): SimilarTrianglesState {
  if (!(deg > 1) || deg >= 179) return state;
  if (aid === "A" || aid === "B" || aid === "C") {
    const idx = aid === "A" ? 0 : aid === "B" ? 1 : 2;
    return applyAbcAngle(state, idx, deg);
  }
  if (state.kind === "nested") {
    if (aid === "ADE" || aid === "ABC") return applyAbcAngle(state, 1, deg);
    if (aid === "AED" || aid === "ACB") return applyAbcAngle(state, 2, deg);
  }
  if (state.kind === "adjacent") {
    if (aid === "BAC") return applyAbcAngle(state, 0, deg);
    if (aid === "B") return applyAbcAngle(state, 1, deg);
    if (aid === "D") {
      return applyTriAngle(state, state.D, state.A, state.C, deg, (D, A, C) =>
        triangleOk(A, state.B, C) ? { ...state, A, C, D } : state,
      );
    }
    if (aid === "DAC") {
      return applyTriAngle(state, state.A, state.D, state.C, deg, (A, D, C) =>
        triangleOk(A, state.B, C) ? { ...state, A, C, D } : state,
      );
    }
  }
  if (state.kind === "cevian") {
    if (aid === "A") return applyAbcAngle(state, 0, deg);
    if (aid === "C") return applyAbcAngle(state, 2, deg);
    if (aid === "ABD" || aid === "DBC") return applyAbcAngle(state, 1, deg);
  }
  if (state.kind === "altitude") {
    if (aid === "B") return applyAbcAngle(state, 1, deg);
    if (aid === "C") return applyAbcAngle(state, 2, deg);
  }
  if (state.kind === "bowtie") {
    if (aid === "BAC" || aid === "DAE") return applyAbcAngle(state, 0, deg);
    if (aid === "B" || (aid === "D" && state.bowtieParallel)) return applyAbcAngle(state, 1, deg);
  }
  if (state.kind === "centroid" && (aid === "A" || aid === "B" || aid === "C")) {
    const idx = aid === "A" ? 0 : aid === "B" ? 1 : 2;
    return applyAbcAngle(state, idx, deg);
  }
  return state;
}

export function applyEditedLabel(
  state: SimilarTrianglesState,
  id: string,
  text: string,
): SimilarTrianglesState {
  const nameMatch = /^n:(.+)$/.exec(id);
  if (nameMatch) {
    const pid = nameMatch[1]!;
    const prev = state.names[pid];
    if (!prev) return state;
    return {
      ...state,
      names: { ...state.names, [pid]: { ...prev, name: text.trim() || prev.name } },
    };
  }
  const angMatch = /^a:(.+)$/.exec(id);
  if (angMatch) {
    const aid = angMatch[1]!;
    const mark = findAng(state, aid);
    if (!mark) return state;
    const parsed = parseAngleInput(text);
    let next = state;
    if (parsed.kind === "number" && parsed.value != null) {
      next = applyAngDeg(state, aid, parsed.value);
    }
    return {
      ...next,
      angles: next.angles.map((a) =>
        a.id === aid ? { ...a, show: true, label: labelFromParse(parsed, text, mark.label, true) } : a,
      ),
    };
  }
  const segMatch = /^s:(.+)$/.exec(id);
  if (segMatch) {
    const sid = segMatch[1]!;
    const mark = findSeg(state, sid);
    if (!mark) return state;
    const parsed = parseMeasureInput(text);
    let next = state;
    if (parsed.kind === "number" && parsed.value != null) {
      next = applySegLength(state, sid, parsed.value);
    }
    return {
      ...next,
      segs: next.segs.map((s) =>
        s.id === sid ? { ...s, show: true, label: labelFromParse(parsed, text, mark.label, false) } : s,
      ),
    };
  }
  return state;
}

export function nudgeLabel(
  state: SimilarTrianglesState,
  id: string,
  dx: number,
  dy: number,
  lineOnly: boolean,
): SimilarTrianglesState {
  const nameMatch = /^n:(.+)$/.exec(id);
  if (nameMatch) {
    const pid = nameMatch[1]!;
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
  function nudgeMeas(label: MeasLabel): MeasLabel {
    if (lineOnly) {
      return { ...label, lineDy: clamp((label.lineDy ?? 0) + dy, -160, 160) };
    }
    return {
      ...label,
      dx: clamp(label.dx + dx, -80, 80),
      dy: clamp(label.dy + dy, -160, 160),
    };
  }
  const angMatch = /^a:(.+)$/.exec(id);
  if (angMatch) {
    const aid = angMatch[1]!;
    return {
      ...state,
      angles: state.angles.map((a) =>
        a.id === aid ? { ...a, label: nudgeMeas(a.label) } : a,
      ),
    };
  }
  const segMatch = /^s:(.+)$/.exec(id);
  if (segMatch) {
    const sid = segMatch[1]!;
    return {
      ...state,
      segs: state.segs.map((s) =>
        s.id === sid ? { ...s, label: nudgeMeas(s.label) } : s,
      ),
    };
  }
  return state;
}

export function toggleSeg(state: SimilarTrianglesState, id: string): SimilarTrianglesState {
  const mark = findSeg(state, id);
  if (!mark) {
    const [a, b] = [id.slice(0, 1), id.slice(1)];
    const found = state.segs.find((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a));
    if (!found) return state;
    return { ...state, segs: state.segs.map((s) => (s.id === found.id ? { ...s, show: !s.show } : s)) };
  }
  return { ...state, segs: state.segs.map((s) => (s.id === id ? { ...s, show: !s.show } : s)) };
}

export function cycleTicks(state: SimilarTrianglesState, id: string): SimilarTrianglesState {
  return {
    ...state,
    segs: state.segs.map((s) => {
      if (s.id !== id) return s;
      const ticks = s.ticks === 0 ? 1 : s.ticks === 1 ? 2 : s.ticks === 2 ? 3 : 0;
      return { ...s, ticks: ticks as SegMark["ticks"] };
    }),
  };
}

export function vertexIndex(id: string): 0 | 1 | 2 | null {
  if (id === "A") return 0;
  if (id === "B") return 1;
  if (id === "C") return 2;
  return null;
}

export function abcAngles(state: SimilarTrianglesState) {
  return {
    A: vertexAngles([state.A, state.B, state.C], 0).interior,
    B: vertexAngles([state.A, state.B, state.C], 1).interior,
    C: vertexAngles([state.A, state.B, state.C], 2).interior,
  };
}

export function angleValue(state: SimilarTrianglesState, mark: AngleMark): number {
  const pts = derivedPoints(state);
  const v = pts[mark.vertex];
  const f = pts[mark.from];
  const t = pts[mark.to];
  if (!v || !f || !t) return NaN;
  return angleDeg(f, v, t);
}

export function segLength(state: SimilarTrianglesState, mark: SegMark): number {
  const pts = derivedPoints(state);
  const a = pts[mark.a];
  const b = pts[mark.b];
  if (!a || !b) return NaN;
  return len(sub(a, b));
}

export { normalizeState, pointIdsFor };
