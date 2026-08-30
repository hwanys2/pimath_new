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
import { formatNiceNumber } from "@/lib/diagrams/math-label";
import { emptyLabel, type MeasLabel, type Vec } from "@/lib/diagrams/polygon/model";
import {
  APEX_INDEX,
  CEVIAN_INDEX,
  DEFAULT_FOOT_NAME,
  fromPolygonState,
  getCevian,
  mapCevian,
  normalizeState,
  toPolygonState,
  vertexLetter,
  type CevianFrom,
  type CevianRole,
  type CevianState,
  type EqualApex,
  type ExtraArcs,
  type IsoscelesState,
  type TickCount,
  type WedgeMark,
} from "./model";

export type IsoHit =
  | { kind: "vertex"; index: number }
  | { kind: "foot"; from: CevianFrom }
  | { kind: "edge"; index: number }
  | { kind: "cevian"; from: CevianFrom }
  | { kind: "part"; from: CevianFrom; which: "left" | "right" }
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string };

export type IsoSelection =
  | { t: "vertex"; i: number }
  | { t: "edge"; i: number }
  | { t: "foot"; from: CevianFrom }
  | { t: "cevian"; from: CevianFrom }
  | { t: "part"; from: CevianFrom; which: "left" | "right" };

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
  const first = state.cevians[0];
  if (!first) return null;
  return CEVIAN_INDEX[first.from];
}

export function footOf(
  state: IsoscelesState,
  cv: { from: CevianFrom; role: CevianRole; t: number },
): Vec {
  const from = CEVIAN_INDEX[cv.from];
  const [i, j] = oppositeSide(from);
  const apex = state.points[from]!;
  const a = state.points[i]!;
  const b = state.points[j]!;
  switch (cv.role) {
    case "midpoint":
      return midpoint(a, b);
    case "altitude":
      return altitudeFoot(apex, a, b);
    case "bisector":
      return angleBisectorFoot(apex, a, b);
    default:
      return lerp(a, b, clamp(cv.t, 0.08, 0.92));
  }
}

export function footPoint(state: IsoscelesState): Vec | null {
  const first = state.cevians[0];
  return first ? footOf(state, first) : null;
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

/** Side opposite the equal apex, or BC when the triangle is not locked isosceles. */
export function floorApex(state: IsoscelesState): 0 | 1 | 2 {
  return state.equalApex === "none" ? 0 : APEX_INDEX[state.equalApex];
}

/** Rotate so the base is horizontal and the third vertex sits above it. */
export function levelOnBase(points: Vec[], apex: 0 | 1 | 2): Vec[] {
  const [i, j] = oppositeSide(apex);
  const B = points[i]!;
  const C = points[j]!;
  const M = midpoint(B, C);
  const along = sub(C, B);
  const ang = Math.atan2(along.y, along.x);
  const c = Math.cos(-ang);
  const s = Math.sin(-ang);
  const rotated = points.map((p) => {
    const q = sub(p, M);
    return { x: M.x + q.x * c - q.y * s, y: M.y + q.x * s + q.y * c };
  });
  const baseY = rotated[i]!.y;
  if (rotated[apex]!.y + 1e-9 >= baseY) return rotated;
  return rotated.map((p) => ({ x: p.x, y: 2 * baseY - p.y }));
}

function syncAngleLabel(label: MeasLabel, deg: number): MeasLabel {
  if (label.mode !== "custom") return label;
  const parsed = parseAngleInput(label.custom);
  if (parsed.kind !== "number") return label;
  return { ...label, custom: `${formatNiceNumber(deg)}°` };
}

function syncLengthLabel(label: MeasLabel, value: number): MeasLabel {
  if (label.mode !== "custom") return label;
  const parsed = parseMeasureInput(label.custom);
  if (parsed.kind !== "number") return label;
  const unit = label.custom.match(/\b(cm|mm)\b/i)?.[1] ?? "";
  const n = formatNiceNumber(value);
  return { ...label, custom: unit ? `${n} ${unit}` : n };
}

function syncMeasuredLabels(state: IsoscelesState): IsoscelesState {
  const vertices = state.vertices.map((v, i) => {
    const { interior, exterior } = vertexAngles(state.points, i);
    return {
      ...v,
      interior: syncAngleLabel(v.interior, interior),
      exterior: syncAngleLabel(v.exterior, exterior),
    };
  });
  const edges = state.edges.map((e, i) => ({
    ...e,
    length: syncLengthLabel(e.length, edgeLength(state.points, i)),
  }));
  let cevians = state.cevians.map((cv) => {
    const D = footOf({ ...state, vertices, edges }, cv);
    const from = CEVIAN_INDEX[cv.from];
    const [li, ri] = oppositeSide(from);
    const apex = state.points[from]!;
    const left = state.points[li]!;
    const right = state.points[ri]!;
    return {
      ...cv,
      apexLeft: {
        ...cv.apexLeft,
        label: syncAngleLabel(cv.apexLeft.label, wedgeDeg(apex, left, D)),
      },
      apexRight: {
        ...cv.apexRight,
        label: syncAngleLabel(cv.apexRight.label, wedgeDeg(apex, right, D)),
      },
      footLeft: {
        ...cv.footLeft,
        label: syncAngleLabel(cv.footLeft.label, wedgeDeg(D, apex, left)),
      },
      footRight: {
        ...cv.footRight,
        label: syncAngleLabel(cv.footRight.label, wedgeDeg(D, apex, right)),
      },
      length: {
        ...cv.length,
        label: syncLengthLabel(cv.length.label, len(sub(D, apex))),
      },
      leftLen: {
        ...cv.leftLen,
        label: syncLengthLabel(cv.leftLen.label, len(sub(D, left))),
      },
      rightLen: {
        ...cv.rightLen,
        label: syncLengthLabel(cv.rightLen.label, len(sub(D, right))),
      },
    };
  });
  return { ...state, vertices, edges, cevians };
}

function validTriangle(points: Vec[]): boolean {
  if (points.length !== 3 || !isConvex(points)) return false;
  for (let i = 0; i < 3; i += 1) {
    if (edgeLength(points, i) < MIN_EDGE) return false;
  }
  return true;
}

export function syncDerived(state: IsoscelesState): IsoscelesState {
  const floor = floorApex(state);
  let points = levelOnBase(state.points, floor);
  if (state.equalApex !== "none" && state.lockEqual) {
    points = snapIsosceles(points, APEX_INDEX[state.equalApex]);
    points = levelOnBase(points, APEX_INDEX[state.equalApex]);
  }
  const leveled = { ...state, points };
  const labeled = syncMeasuredLabels(leveled);
  return normalizeState({
    ...labeled,
    interiorAnglesDeg: [0, 1, 2].map((i) => vertexAngles(labeled.points, i).interior),
    referenceEdgeLength: edgeLength(labeled.points, 0),
  });
}

export function moveVertexIso(
  state: IsoscelesState,
  index: number,
  next: Vec,
): IsoscelesState {
  let target = next;
  if (state.equalApex !== "none" && state.lockEqual) {
    const apex = APEX_INDEX[state.equalApex];
    if (index !== apex) {
      const [i, j] = oppositeSide(apex);
      const other = index === i ? j : i;
      target = { x: next.x, y: state.points[other]!.y };
    }
  }
  const trial = state.points.map((p, i) => (i === index ? target : p));
  let points = trial;
  if (state.equalApex !== "none" && state.lockEqual) {
    points = snapIsosceles(trial, APEX_INDEX[state.equalApex]);
  } else {
    const moved = movePolygonVertex(toPolygonState(state), index, target);
    if (moved.points === state.points && !validTriangle(trial)) return state;
    points = moved.points === state.points ? trial : moved.points;
    if (!validTriangle(points)) return state;
  }
  if (!validTriangle(points)) return state;
  return syncDerived({ ...state, points });
}

export function moveFoot(state: IsoscelesState, from: CevianFrom, next: Vec): IsoscelesState {
  const cv = getCevian(state, from);
  if (!cv) return state;
  const idx = CEVIAN_INDEX[from];
  const [i, j] = oppositeSide(idx);
  const t = projectT(next, state.points[i]!, state.points[j]!);
  return syncDerived(mapCevian(state, from, (c) => ({ ...c, role: "free", t })));
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
  return syncDerived(fromPolygonState(poly, state));
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
  return syncDerived(fromPolygonState(poly, state));
}

function scaleAbout(points: Vec[], center: Vec, s: number): Vec[] {
  return points.map((p) => add(center, mul(sub(p, center), s)));
}

export function applyPartLength(
  state: IsoscelesState,
  from: CevianFrom,
  which: "left" | "right" | "cevian",
  newLength: number,
): IsoscelesState {
  const cv = getCevian(state, from);
  if (!cv) return state;
  const fromIdx = CEVIAN_INDEX[from];
  const D = footOf(state, cv);
  const target = clamp(newLength, MIN_EDGE, 40);
  if (which === "cevian") {
    const apex = state.points[fromIdx]!;
    const dir = norm(sub(apex, D));
    const dist = len(sub(apex, D));
    if (dist < 1e-6) return state;
    const moved = add(D, mul(dir, target));
    const points = state.points.map((p, i) => (i === fromIdx ? moved : p));
    if (state.equalApex !== "none" && state.lockEqual) {
      const snapped = snapIsosceles(points, APEX_INDEX[state.equalApex]);
      if (!validTriangle(snapped)) return state;
      return syncDerived({ ...state, points: snapped });
    }
    if (!validTriangle(points)) return state;
    return syncDerived({ ...state, points });
  }
  const [i, j] = oppositeSide(fromIdx);
  const end = which === "left" ? state.points[i]! : state.points[j]!;
  const current = len(sub(D, end));
  if (current < 1e-6) return state;
  if (cv.role === "free") {
    const side = len(sub(state.points[j]!, state.points[i]!));
    let t = cv.t;
    if (which === "left") t = clamp(target / side, 0.08, 0.92);
    else t = clamp(1 - target / side, 0.08, 0.92);
    return syncDerived(mapCevian(state, from, (c) => ({ ...c, t })));
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
  from: CevianFrom,
  key: "apexLeft" | "apexRight" | "footLeft" | "footRight",
  patch: Partial<WedgeMark>,
): IsoscelesState {
  return mapCevian(state, from, (c) => ({ ...c, [key]: { ...c[key], ...patch } }));
}

function resolveCevianFromId(state: IsoscelesState, raw: string | undefined): CevianFrom | null {
  if (raw === "A" || raw === "B" || raw === "C") return raw;
  return state.cevians[0]?.from ?? null;
}

export function applyEditedLabel(state: IsoscelesState, id: string, text: string): IsoscelesState {
  const nameMatch = /^d:(?:([ABC]):)?name$/.exec(id);
  if (nameMatch) {
    const from = resolveCevianFromId(state, nameMatch[1]);
    if (!from) return state;
    const cv = getCevian(state, from);
    const name = text.trim() || cv?.name || DEFAULT_FOOT_NAME[from];
    return mapCevian(state, from, (c) => ({ ...c, name }));
  }
  const wedgeMatch = /^w:(?:([ABC]):)?(apexLeft|apexRight|footLeft|footRight)$/.exec(id);
  if (wedgeMatch) {
    const from = resolveCevianFromId(state, wedgeMatch[1]);
    if (!from) return state;
    const key = wedgeMatch[2] as "apexLeft" | "apexRight" | "footLeft" | "footRight";
    const parsed = parseAngleInput(text);
    const mark = getCevian(state, from)?.[key];
    if (!mark) return state;
    return patchWedge(state, from, key, { label: labelFromParse(parsed, text, mark.label, true) });
  }
  const cevLenMatch = /^c:(?:([ABC]):)?length$/.exec(id);
  if (cevLenMatch) {
    const from = resolveCevianFromId(state, cevLenMatch[1]);
    if (!from) return state;
    const cv = getCevian(state, from);
    if (!cv) return state;
    const parsed = parseMeasureInput(text);
    if (parsed.kind === "number" && parsed.value != null) {
      const next = applyPartLength(state, from, "cevian", parsed.value);
      return mapCevian(next, from, (c) => ({
        ...c,
        length: { show: true, label: labelFromParse(parsed, text, cv.length.label, false) },
      }));
    }
    return mapCevian(state, from, (c) => ({
      ...c,
      length: {
        show: c.length.show,
        label: labelFromParse(parsed, text, c.length.label, false),
      },
    }));
  }
  const partMatch = /^p:(?:([ABC]):)?(left|right):length$/.exec(id);
  if (partMatch) {
    const from = resolveCevianFromId(state, partMatch[1]);
    if (!from) return state;
    const which = partMatch[2] as "left" | "right";
    const field = which === "left" ? "leftLen" : "rightLen";
    const cv = getCevian(state, from);
    if (!cv) return state;
    const parsed = parseMeasureInput(text);
    if (parsed.kind === "number" && parsed.value != null) {
      const next = applyPartLength(state, from, which, parsed.value);
      return mapCevian(next, from, (c) => ({
        ...c,
        [field]: { show: true, label: labelFromParse(parsed, text, cv[field].label, false) },
      }));
    }
    return mapCevian(state, from, (c) => ({
      ...c,
      [field]: {
        show: c[field].show,
        label: labelFromParse(parsed, text, c[field].label, false),
      },
    }));
  }
  const angMatch = /^v:(\d+):(interior|exterior)$/.exec(id);
  if (angMatch) {
    const i = Number(angMatch[1]);
    const which = angMatch[2] as "interior" | "exterior";
    const parsed = parseAngleInput(text);
    if (parsed.kind === "number" && parsed.value != null) {
      const interiorDeg = which === "interior" ? parsed.value : 180 - parsed.value;
      const next = applyIsoAngle(state, i, interiorDeg);
      return {
        ...next,
        vertices: next.vertices.map((v, idx) =>
          idx !== i ? v : { ...v, [which]: labelFromParse(parsed, text, v[which], true) },
        ),
      };
    }
    return {
      ...state,
      vertices: state.vertices.map((v, idx) =>
        idx !== i ? v : { ...v, [which]: labelFromParse(parsed, text, v[which], true) },
      ),
    };
  }
  const edgeMatch = /^e:(\d+):length$/.exec(id);
  if (edgeMatch) {
    const i = Number(edgeMatch[1]);
    const parsed = parseMeasureInput(text);
    if (parsed.kind === "number" && parsed.value != null) {
      const next = applyIsoLength(state, i, parsed.value);
      return {
        ...next,
        edges: next.edges.map((e, idx) =>
          idx === i ? { ...e, length: labelFromParse(parsed, text, e.length, false) } : e,
        ),
      };
    }
    return {
      ...state,
      edges: state.edges.map((e, idx) =>
        idx === i ? { ...e, length: labelFromParse(parsed, text, e.length, false) } : e,
      ),
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
  const nameMatch = /^d:(?:([ABC]):)?name$/.exec(id);
  if (nameMatch) {
    const from = resolveCevianFromId(state, nameMatch[1]);
    if (!from) return state;
    return mapCevian(state, from, (c) => ({
      ...c,
      nameDx: clamp(c.nameDx + dx, -80, 80),
      nameDy: clamp(c.nameDy + dy, -80, 80),
    }));
  }
  const wedgeMatch = /^w:(?:([ABC]):)?(apexLeft|apexRight|footLeft|footRight)$/.exec(id);
  if (wedgeMatch) {
    const from = resolveCevianFromId(state, wedgeMatch[1]);
    if (!from) return state;
    const key = wedgeMatch[2] as "apexLeft" | "apexRight" | "footLeft" | "footRight";
    const label = getCevian(state, from)?.[key].label;
    if (!label) return state;
    return patchWedge(state, from, key, {
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
  const cevLenMatch = /^c:(?:([ABC]):)?length$/.exec(id);
  if (cevLenMatch) {
    const from = resolveCevianFromId(state, cevLenMatch[1]);
    if (!from) return state;
    return mapCevian(state, from, (c) => ({
      ...c,
      length: { ...c.length, label: nudgeMeas(c.length.label) },
    }));
  }
  const partMatch = /^p:(?:([ABC]):)?(left|right):length$/.exec(id);
  if (partMatch) {
    const from = resolveCevianFromId(state, partMatch[1]);
    if (!from) return state;
    const field = partMatch[2] === "left" ? "leftLen" : "rightLen";
    return mapCevian(state, from, (c) => ({
      ...c,
      [field]: { ...c[field], label: nudgeMeas(c[field].label) },
    }));
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
    return mapCevian(state, sel.from, (c) => ({
      ...c,
      showRightAtD: false,
      showBisectorMarks: false,
      showMidpointTicks: false,
      footLeft: { ...c.footLeft, show: false, fill: false },
      footRight: { ...c.footRight, show: false, fill: false },
    }));
  }
  if (sel.t === "cevian") {
    return { ...state, cevians: state.cevians.filter((c) => c.from !== sel.from) };
  }
  const field = sel.which === "left" ? "leftLen" : "rightLen";
  return mapCevian(state, sel.from, (c) => ({
    ...c,
    [field]: { show: false, label: emptyLabel("auto") },
  }));
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

export function cevianName(state: IsoscelesState, from: CevianFrom): string {
  const cv = getCevian(state, from);
  const idx = CEVIAN_INDEX[from];
  return `${vertexName(state, idx)}${cv?.name.trim() || DEFAULT_FOOT_NAME[from]}`;
}

export function partName(state: IsoscelesState, from: CevianFrom, which: "left" | "right"): string {
  const cv = getCevian(state, from);
  const idx = CEVIAN_INDEX[from];
  const [i, j] = oppositeSide(idx);
  const end = which === "left" ? i : j;
  const d = cv?.name.trim() || DEFAULT_FOOT_NAME[from];
  return `${vertexName(state, end)}${d}`;
}

export function splitAngleName(
  state: IsoscelesState,
  from: CevianFrom,
  which: "apexLeft" | "apexRight" | "footLeft" | "footRight",
): string {
  const cv = getCevian(state, from);
  const idx = CEVIAN_INDEX[from];
  const [i, j] = oppositeSide(idx);
  const d = cv?.name.trim() || DEFAULT_FOOT_NAME[from];
  const apex = vertexName(state, idx);
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

export type CanvasFoot = { from: CevianFrom; index: 0 | 1 | 2; canvas: Vec };

export function hitTestIso(
  canvasPts: Vec[],
  feet: CanvasFoot[],
  texts: { id: string; x: number; y: number }[],
  cmds: { t: string; id?: string; x1?: number; y1?: number; x2?: number; y2?: number }[],
  x: number,
  y: number,
  scale = 1,
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
  let bestFoot: CanvasFoot | null = null;
  let bestFootD = pointR;
  for (const f of feet) {
    const d = Math.hypot(f.canvas.x - x, f.canvas.y - y);
    if (d < bestFootD) {
      bestFootD = d;
      bestFoot = f;
    }
  }
  if (bestFoot) return { kind: "foot", from: bestFoot.from };

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
  let bestCev: IsoHit | null = null;
  let bestCevD = edgeR;
  const splitSides = new Set<number>();
  for (const f of feet) {
    splitSides.add((f.index + 1) % 3);
    const apex = canvasPts[f.index]!;
    const dCev = distToSeg(x, y, apex.x, apex.y, f.canvas.x, f.canvas.y);
    if (dCev < bestCevD) {
      bestCevD = dCev;
      bestCev = { kind: "cevian", from: f.from };
    }
    const [i, j] = oppositeSide(f.index);
    const L = canvasPts[i]!;
    const R = canvasPts[j]!;
    const dL = distToSeg(x, y, L.x, L.y, f.canvas.x, f.canvas.y);
    const dR = distToSeg(x, y, R.x, R.y, f.canvas.x, f.canvas.y);
    if (dL < bestCevD) {
      bestCevD = dL;
      bestCev = { kind: "part", from: f.from, which: "left" };
    }
    if (dR < bestCevD) {
      bestCevD = dR;
      bestCev = { kind: "part", from: f.from, which: "right" };
    }
  }
  if (bestCev) return bestCev;

  let bestE = -1;
  let bestEd = edgeR;
  for (let i = 0; i < 3; i += 1) {
    if (splitSides.has(i)) continue;
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
