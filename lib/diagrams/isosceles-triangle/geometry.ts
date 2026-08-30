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
  moveVertex as movePolygonVertex,
  mul,
  norm,
  nudgeLabel as nudgePolygonLabel,
  parseAngleInput,
  parseMeasureInput,
  sub,
  vertexAngles,
} from "@/lib/diagrams/polygon/geometry";
import { emptyLabel, type MeasLabel, type Vec } from "@/lib/diagrams/polygon/model";
import {
  APEX_INDEX,
  CEVIAN_INDEX,
  fromPolygonState,
  normalizeState,
  toPolygonState,
  vertexLetter,
  type CevianFrom,
  type EqualApex,
  type ExtraArcs,
  type IsoscelesState,
  type TickCount,
  type WedgeMark,
} from "./model";

export type IsoHit =
  | { kind: "vertex"; index: number }
  | { kind: "foot" }
  | { kind: "edge"; index: number }
  | { kind: "cevian" }
  | { kind: "part"; which: "left" | "right" }
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string };

export type IsoSelection =
  | { t: "vertex"; i: number }
  | { t: "edge"; i: number }
  | { t: "foot" }
  | { t: "cevian" }
  | { t: "part"; which: "left" | "right" };

const MIN_EDGE = 0.35;
const RIGHT_EPS = 0.75;

export function oppositeSide(from: 0 | 1 | 2): [number, number] {
  return [((from + 1) % 3) as 0 | 1 | 2, ((from + 2) % 3) as 0 | 1 | 2];
}

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function midpoint(a: Vec, b: Vec): Vec {
  return mul(add(a, b), 0.5);
}

function projectT(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < 1e-12) return 0.5;
  return clamp((ap.x * ab.x + ap.y * ab.y) / l2, 0.08, 0.92);
}

export function altitudeFoot(apex: Vec, a: Vec, b: Vec): Vec {
  return lerp(a, b, projectT(apex, a, b));
}

export function angleBisectorFoot(apex: Vec, a: Vec, b: Vec): Vec {
  const da = len(sub(apex, a));
  const db = len(sub(apex, b));
  const t = da / (da + db || 1);
  return lerp(a, b, clamp(t, 0.08, 0.92));
}

export function unitPerp(v: Vec): Vec {
  return norm({ x: -v.y, y: v.x });
}

export function cevianFromIndex(state: IsoscelesState): 0 | 1 | 2 | null {
  if (state.cevian.from === "none") return null;
  return CEVIAN_INDEX[state.cevian.from];
}

export function footPoint(state: IsoscelesState): Vec | null {
  const from = cevianFromIndex(state);
  if (from == null) return null;
  const [i, j] = oppositeSide(from);
  const apex = state.points[from]!;
  const a = state.points[i]!;
  const b = state.points[j]!;
  switch (state.cevian.role) {
    case "midpoint":
      return midpoint(a, b);
    case "altitude":
      return altitudeFoot(apex, a, b);
    case "bisector":
      return angleBisectorFoot(apex, a, b);
    default:
      return lerp(a, b, clamp(state.cevian.t, 0.08, 0.92));
  }
}

export function snapIsosceles(points: Vec[], apex: 0 | 1 | 2): Vec[] {
  const [i, j] = oppositeSide(apex);
  const B = points[i]!;
  const C = points[j]!;
  const A = points[apex]!;
  const M = midpoint(B, C);
  let n = unitPerp(sub(C, B));
  const am = sub(A, M);
  if (am.x * n.x + am.y * n.y < 0) n = mul(n, -1);
  const h = Math.max(Math.abs(am.x * n.x + am.y * n.y), 0.5);
  const nextA = add(M, mul(n, h));
  return points.map((p, k) => (k === apex ? nextA : p));
}

export function setIsoscelesVertexAngle(
  points: Vec[],
  apex: 0 | 1 | 2,
  vertexDeg: number,
): Vec[] {
  const [i, j] = oppositeSide(apex);
  const B = points[i]!;
  const C = points[j]!;
  const M = midpoint(B, C);
  const base = len(sub(C, B));
  const deg = clamp(vertexDeg, 8, 170);
  const h = base / 2 / Math.tan((deg * Math.PI) / 360);
  let n = unitPerp(sub(C, B));
  const am = sub(points[apex]!, M);
  if (am.x * n.x + am.y * n.y < 0) n = mul(n, -1);
  const nextA = add(M, mul(n, Math.max(h, 0.5)));
  return points.map((p, k) => (k === apex ? nextA : p));
}

function validTriangle(points: Vec[]): boolean {
  if (points.length !== 3 || !isConvex(points)) return false;
  for (let i = 0; i < 3; i += 1) {
    if (edgeLength(points, i) < MIN_EDGE) return false;
  }
  return true;
}

export function syncDerived(state: IsoscelesState): IsoscelesState {
  return normalizeState({
    ...state,
    interiorAnglesDeg: [0, 1, 2].map((i) => vertexAngles(state.points, i).interior),
    referenceEdgeLength: edgeLength(state.points, 0),
  });
}

export function moveVertexIso(
  state: IsoscelesState,
  index: number,
  next: Vec,
): IsoscelesState {
  const trial = state.points.map((p, i) => (i === index ? next : p));
  let points = trial;
  if (state.equalApex !== "none" && state.lockEqual) {
    points = snapIsosceles(trial, APEX_INDEX[state.equalApex]);
  } else {
    const moved = movePolygonVertex(toPolygonState(state), index, next);
    if (moved.points === state.points && !validTriangle(trial)) return state;
    points = moved.points === state.points ? trial : moved.points;
    if (!validTriangle(points)) return state;
  }
  if (!validTriangle(points)) return state;
  return syncDerived({ ...state, points });
}

export function moveFoot(state: IsoscelesState, next: Vec): IsoscelesState {
  const from = cevianFromIndex(state);
  if (from == null) return state;
  const [i, j] = oppositeSide(from);
  const t = projectT(next, state.points[i]!, state.points[j]!);
  return syncDerived({
    ...state,
    cevian: { ...state.cevian, role: "free", t },
  });
}

export function applyIsoAngle(
  state: IsoscelesState,
  index: number,
  deg: number,
): IsoscelesState {
  if (state.equalApex !== "none" && state.lockEqual) {
    const apex = APEX_INDEX[state.equalApex];
    const vertexDeg = index === apex ? deg : 180 - 2 * deg;
    const points = setIsoscelesVertexAngle(state.points, apex, vertexDeg);
    if (!validTriangle(points)) return state;
    return syncDerived({ ...state, points });
  }
  const poly = applyInteriorAngleChange(toPolygonState(state), index, deg);
  return fromPolygonState(poly, state);
}

export function applyIsoLength(
  state: IsoscelesState,
  edgeIndex: number,
  newLength: number,
): IsoscelesState {
  const target = clamp(newLength, MIN_EDGE, 40);
  if (state.equalApex !== "none" && state.lockEqual) {
    const current = edgeLength(state.points, edgeIndex);
    if (current < 1e-6) return state;
    const s = target / current;
    const c = {
      x: (state.points[0]!.x + state.points[1]!.x + state.points[2]!.x) / 3,
      y: (state.points[0]!.y + state.points[1]!.y + state.points[2]!.y) / 3,
    };
    const points = state.points.map((p) => add(c, mul(sub(p, c), s)));
    if (!validTriangle(points)) return state;
    return syncDerived({ ...state, points });
  }
  const poly = applyEdgeLengthChange(toPolygonState(state), edgeIndex, target);
  return fromPolygonState(poly, state);
}

function scaleAbout(points: Vec[], center: Vec, s: number): Vec[] {
  return points.map((p) => add(center, mul(sub(p, center), s)));
}

export function applyPartLength(
  state: IsoscelesState,
  which: "left" | "right" | "cevian",
  newLength: number,
): IsoscelesState {
  const from = cevianFromIndex(state);
  const D = footPoint(state);
  if (from == null || !D) return state;
  const target = clamp(newLength, MIN_EDGE, 40);
  if (which === "cevian") {
    const apex = state.points[from]!;
    const dir = norm(sub(apex, D));
    const dist = len(sub(apex, D));
    if (dist < 1e-6) return state;
    const moved = add(D, mul(dir, target));
    const points = state.points.map((p, i) => (i === from ? moved : p));
    if (state.equalApex !== "none" && state.lockEqual) {
      const snapped = snapIsosceles(points, APEX_INDEX[state.equalApex]);
      if (!validTriangle(snapped)) return state;
      return syncDerived({ ...state, points: snapped });
    }
    if (!validTriangle(points)) return state;
    return syncDerived({ ...state, points });
  }
  const [i, j] = oppositeSide(from);
  const end = which === "left" ? state.points[i]! : state.points[j]!;
  const current = len(sub(D, end));
  if (current < 1e-6) return state;
  if (state.cevian.role === "free") {
    const side = len(sub(state.points[j]!, state.points[i]!));
    let t = state.cevian.t;
    if (which === "left") t = clamp(target / side, 0.08, 0.92);
    else t = clamp(1 - target / side, 0.08, 0.92);
    return syncDerived({ ...state, cevian: { ...state.cevian, t } });
  }
  const s = target / current;
  const points = scaleAbout(state.points, midpoint(state.points[i]!, state.points[j]!), s);
  if (!validTriangle(points)) return state;
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

function patchWedge(
  state: IsoscelesState,
  key: "apexLeft" | "apexRight" | "footLeft" | "footRight",
  patch: Partial<WedgeMark>,
): IsoscelesState {
  return {
    ...state,
    cevian: { ...state.cevian, [key]: { ...state.cevian[key], ...patch } },
  };
}

export function applyEditedLabel(state: IsoscelesState, id: string, text: string): IsoscelesState {
  if (id === "d:name") {
    const name = text.trim() || state.cevian.name;
    return { ...state, cevian: { ...state.cevian, name } };
  }
  const wedgeMatch = /^w:(apexLeft|apexRight|footLeft|footRight)$/.exec(id);
  if (wedgeMatch) {
    const key = wedgeMatch[1] as "apexLeft" | "apexRight" | "footLeft" | "footRight";
    const parsed = parseAngleInput(text);
    const mark = state.cevian[key];
    return patchWedge(state, key, { label: labelFromParse(parsed, text, mark.label, true) });
  }
  if (id === "c:length") {
    const parsed = parseMeasureInput(text);
    if (parsed.kind === "number" && parsed.value != null) {
      const next = applyPartLength(state, "cevian", parsed.value);
      return {
        ...next,
        cevian: {
          ...next.cevian,
          length: {
            show: true,
            label: labelFromParse(parsed, text, state.cevian.length.label, false),
          },
        },
      };
    }
    return {
      ...state,
      cevian: {
        ...state.cevian,
        length: {
          show: state.cevian.length.show,
          label: labelFromParse(parsed, text, state.cevian.length.label, false),
        },
      },
    };
  }
  const partMatch = /^p:(left|right):length$/.exec(id);
  if (partMatch) {
    const which = partMatch[1] as "left" | "right";
    const field = which === "left" ? "leftLen" : "rightLen";
    const parsed = parseMeasureInput(text);
    if (parsed.kind === "number" && parsed.value != null) {
      const next = applyPartLength(state, which, parsed.value);
      return {
        ...next,
        cevian: {
          ...next.cevian,
          [field]: {
            show: true,
            label: labelFromParse(parsed, text, state.cevian[field].label, false),
          },
        },
      };
    }
    return {
      ...state,
      cevian: {
        ...state.cevian,
        [field]: {
          show: state.cevian[field].show,
          label: labelFromParse(parsed, text, state.cevian[field].label, false),
        },
      },
    };
  }
  const poly = applyPolygonLabel(toPolygonState(state), id, text);
  return fromPolygonState(poly, state);
}

export function nudgeLabel(
  state: IsoscelesState,
  id: string,
  dx: number,
  dy: number,
  lineOnly: boolean,
): IsoscelesState {
  if (id === "d:name") {
    return {
      ...state,
      cevian: {
        ...state.cevian,
        nameDx: clamp(state.cevian.nameDx + dx, -80, 80),
        nameDy: clamp(state.cevian.nameDy + dy, -80, 80),
      },
    };
  }
  const wedgeMatch = /^w:(apexLeft|apexRight|footLeft|footRight)$/.exec(id);
  if (wedgeMatch) {
    const key = wedgeMatch[1] as "apexLeft" | "apexRight" | "footLeft" | "footRight";
    const label = state.cevian[key].label;
    return patchWedge(state, key, {
      label: {
        ...label,
        dx: clamp(label.dx + dx, -80, 80),
        dy: clamp(label.dy + dy, -80, 80),
      },
    });
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
  if (id === "c:length") {
    return {
      ...state,
      cevian: { ...state.cevian, length: { ...state.cevian.length, label: nudgeMeas(state.cevian.length.label) } },
    };
  }
  if (id === "p:left:length") {
    return {
      ...state,
      cevian: { ...state.cevian, leftLen: { ...state.cevian.leftLen, label: nudgeMeas(state.cevian.leftLen.label) } },
    };
  }
  if (id === "p:right:length") {
    return {
      ...state,
      cevian: { ...state.cevian, rightLen: { ...state.cevian.rightLen, label: nudgeMeas(state.cevian.rightLen.label) } },
    };
  }
  const poly = nudgePolygonLabel(toPolygonState(state), id, dx, dy, lineOnly);
  return fromPolygonState(poly, state);
}

export function clearSelectionMarks(
  state: IsoscelesState,
  sel: IsoSelection | null,
): IsoscelesState {
  if (!sel) return state;
  if (sel.t === "vertex") {
    return {
      ...state,
      vertices: state.vertices.map((v, i) =>
        i === sel.i
          ? {
              ...v,
              showInterior: false,
              fillInterior: false,
              showExterior: false,
              fillExterior: false,
              interior: emptyLabel("auto"),
              exterior: emptyLabel("auto"),
              extraArcs: 0,
              showDot: false,
            }
          : v,
      ),
    };
  }
  if (sel.t === "edge") {
    return {
      ...state,
      edges: state.edges.map((e, i) =>
        i === sel.i ? { ...e, showLength: false, ticks: 0, length: emptyLabel("auto") } : e,
      ),
    };
  }
  if (sel.t === "foot") {
    return {
      ...state,
      cevian: {
        ...state.cevian,
        showRightAtD: false,
        footLeft: { ...state.cevian.footLeft, show: false, fill: false },
        footRight: { ...state.cevian.footRight, show: false, fill: false },
      },
    };
  }
  if (sel.t === "cevian") {
    return {
      ...state,
      cevian: { ...state.cevian, from: "none" },
    };
  }
  const field = sel.which === "left" ? "leftLen" : "rightLen";
  return {
    ...state,
    cevian: {
      ...state.cevian,
      [field]: { show: false, label: emptyLabel("auto") },
    },
  };
}

export function wedgeDeg(
  vertex: Vec,
  from: Vec,
  to: Vec,
): number {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  return (Math.acos(clamp(u.x * w.x + u.y * w.y, -1, 1)) * 180) / Math.PI;
}

export function isRightAngle(deg: number): boolean {
  return Number.isFinite(deg) && Math.abs(deg - 90) < RIGHT_EPS;
}

export function vertexName(state: IsoscelesState, i: number): string {
  return state.vertices[i]?.name.trim() || vertexLetter(i);
}

export function edgeName(state: IsoscelesState, i: number): string {
  return `${vertexName(state, i)}${vertexName(state, (i + 1) % 3)}`;
}

export function cevianName(state: IsoscelesState): string {
  const from = cevianFromIndex(state);
  if (from == null) return "";
  return `${vertexName(state, from)}${state.cevian.name.trim() || "D"}`;
}

export function partName(state: IsoscelesState, which: "left" | "right"): string {
  const from = cevianFromIndex(state);
  if (from == null) return "";
  const [i, j] = oppositeSide(from);
  const end = which === "left" ? i : j;
  const d = state.cevian.name.trim() || "D";
  return `${vertexName(state, end)}${d}`;
}

export function splitAngleName(
  state: IsoscelesState,
  which: "apexLeft" | "apexRight" | "footLeft" | "footRight",
): string {
  const from = cevianFromIndex(state);
  if (from == null) return "";
  const [i, j] = oppositeSide(from);
  const d = state.cevian.name.trim() || "D";
  const apex = vertexName(state, from);
  const left = vertexName(state, i);
  const right = vertexName(state, j);
  if (which === "apexLeft") return `${left}${apex}${d}`;
  if (which === "apexRight") return `${right}${apex}${d}`;
  if (which === "footLeft") return `${apex}${d}${left}`;
  return `${apex}${d}${right}`;
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

export function hitTestIso(
  canvasPts: Vec[],
  foot: Vec | null,
  texts: { id: string; x: number; y: number }[],
  cmds: { t: string; id?: string; x1?: number; y1?: number; x2?: number; y2?: number }[],
  x: number,
  y: number,
  scale = 1,
  cevianFrom: 0 | 1 | 2 | null,
): IsoHit | null {
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
  if (foot) {
    const d = Math.hypot(foot.x - x, foot.y - y);
    if (d < pointR) return { kind: "foot" };
  }
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

  const dimR = 10 * Math.max(scale, 0.85);
  let bestDim: IsoHit | null = null;
  let bestDimD = dimR;
  for (const cmd of cmds) {
    if (!cmd.id || !cmd.id.endsWith(":line")) continue;
    const id = cmd.id.slice(0, -5);
    if (cmd.t === "line" && cmd.x1 != null && cmd.y1 != null && cmd.x2 != null && cmd.y2 != null) {
      const d = distToSeg(x, y, cmd.x1, cmd.y1, cmd.x2, cmd.y2);
      if (d < bestDimD) {
        bestDimD = d;
        bestDim = { kind: "dimLine", id };
      }
    }
  }
  if (bestDim) return bestDim;

  const edgeR = 9 * Math.max(scale, 0.85);
  if (cevianFrom != null && foot) {
    const apex = canvasPts[cevianFrom]!;
    const dCev = distToSeg(x, y, apex.x, apex.y, foot.x, foot.y);
    if (dCev < edgeR) return { kind: "cevian" };
    const [i, j] = oppositeSide(cevianFrom);
    const L = canvasPts[i]!;
    const R = canvasPts[j]!;
    const dL = distToSeg(x, y, L.x, L.y, foot.x, foot.y);
    const dR = distToSeg(x, y, R.x, R.y, foot.x, foot.y);
    if (dL < edgeR && dL <= dR) return { kind: "part", which: "left" };
    if (dR < edgeR) return { kind: "part", which: "right" };
  }

  let bestE = -1;
  let bestEd = edgeR;
  for (let i = 0; i < 3; i += 1) {
    if (cevianFrom != null && i === (cevianFrom + 1) % 3) continue;
    const a = canvasPts[i]!;
    const b = canvasPts[(i + 1) % 3]!;
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

export { extensionEnd, vertexAngles, edgeLength, clamp };
