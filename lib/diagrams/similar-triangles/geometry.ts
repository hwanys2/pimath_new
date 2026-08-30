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
  | { kind: "dimLine"; id: string };

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
      return state.midpoint ? ["A", "B", "C"] : ["A", "B", "C", "D"];
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

export function movePoint(
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
    const t = clamp(projectT(next, state.A, state.B), 0.08, 0.92);
    return { ...state, t };
  }
  if (id === "D" && state.kind === "cevian") {
    const t = clamp(projectT(next, state.A, state.C), 0.08, 0.92);
    return { ...state, t };
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

function updateTFromParts(
  state: SimilarTrianglesState,
  leftId: string,
  rightId: string,
  editedId: string,
  value: number,
): SimilarTrianglesState {
  const pts = derivedPoints(state);
  const left = findSeg(state, leftId);
  const right = findSeg(state, rightId);
  const leftAuto = left ? len(sub(pts[left.a]!, pts[left.b]!)) : value;
  const rightAuto = right ? len(sub(pts[right.a]!, pts[right.b]!)) : value;
  const parseCustom = (seg: SegMark | undefined, auto: number) => {
    if (!seg) return auto;
    if (seg.label.mode === "custom") {
      const n = Number(seg.label.custom.replace(/[^\d.+-]/g, ""));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return auto;
  };
  const L = editedId === leftId ? value : parseCustom(left, leftAuto);
  const R = editedId === rightId ? value : parseCustom(right, rightAuto);
  const sum = L + R;
  if (!(sum > 0.2)) return state;
  return { ...state, t: clamp(L / sum, 0.08, 0.92) };
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
      if (aid === "A" || aid === "B" || aid === "C") {
        const idx = aid === "A" ? 0 : aid === "B" ? 1 : 2;
        next = applyAbcAngle(state, idx, parsed.value);
      }
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
      if (sid === "AB") next = applyAbcLength(state, 0, parsed.value);
      else if (sid === "BC") next = applyAbcLength(state, 1, parsed.value);
      else if (sid === "AC") next = applyAbcLength(state, 2, parsed.value);
      else if (state.kind === "nested" && (sid === "AD" || sid === "DB")) {
        next = updateTFromParts(state, "AD", "DB", sid, parsed.value);
      } else if (state.kind === "nested" && (sid === "AE" || sid === "EC")) {
        next = updateTFromParts(state, "AE", "EC", sid, parsed.value);
      } else if (state.kind === "cevian" && (sid === "AD" || sid === "DC")) {
        next = updateTFromParts(state, "AD", "DC", sid, parsed.value);
      }
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
