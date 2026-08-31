import {
  add,
  clamp,
  len,
  mul,
  norm,
  sub,
} from "@/lib/diagrams/polygon/geometry";
import type { Vec } from "@/lib/diagrams/polygon/model";
import {
  angleId,
  arcId,
  edgeId,
  emptyLabel,
  findPoint,
  newId,
  nextPointName,
  normalizeDeg,
  pairKey,
  type AngleDraft,
  type AngleFill,
  type ArcDraft,
  type CircPoint,
  type EdgeDraft,
  type InscribedState,
  type MeasLabel,
} from "@/lib/diagrams/inscribed-angles/model";

export type { Vec };

export const CENTER_ID = "O";
export const T_PLUS = "T+";
export const T_MINUS = "T-";
export const EXT_ID = "E";

export function polar(radius: number, deg: number): Vec {
  const a = (deg * Math.PI) / 180;
  return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
}

export function angleDegOf(p: Vec): number {
  return normalizeDeg((Math.atan2(p.y, p.x) * 180) / Math.PI);
}

export function projectOnCircle(p: Vec, radius: number): Vec {
  const l = Math.hypot(p.x, p.y);
  if (l < 1e-9) return { x: radius, y: 0 };
  const s = radius / l;
  return { x: p.x * s, y: p.y * s };
}

export function pointPos(state: InscribedState, id: string): Vec | null {
  if (id === CENTER_ID) return { x: 0, y: 0 };
  const pt = findPoint(state, id);
  if (!pt) return null;
  return polar(state.radius, pt.angleDeg);
}

export function tangentDirs(at: Vec): { plus: Vec; minus: Vec } {
  const u = norm(at);
  return { plus: { x: -u.y, y: u.x }, minus: { x: u.y, y: -u.x } };
}

export function tangentPoint(state: InscribedState): Vec | null {
  const t = state.tangent;
  if (!t?.show) return null;
  const at = pointPos(state, t.at);
  if (!at) return null;
  const { plus } = tangentDirs(at);
  return add(at, mul(plus, state.radius * t.span));
}

export function extensionPoint(state: InscribedState): Vec | null {
  const ext = state.extension;
  if (!ext?.show) return null;
  const a = pointPos(state, ext.from);
  const b = pointPos(state, ext.through);
  if (!a || !b) return null;
  const dir = sub(b, a);
  if (len(dir) < 1e-6) return null;
  return add(b, mul(norm(dir), state.radius * ext.extraT));
}

/** Resolve an angle arm: circumference point, center, tangent direction, or extension. */
export function armPos(state: InscribedState, vertexId: string, armId: string): Vec | null {
  if (armId === CENTER_ID) return { x: 0, y: 0 };
  if (armId === EXT_ID) return extensionPoint(state);
  if (armId === T_PLUS || armId === T_MINUS) {
    const vertex = pointPos(state, vertexId);
    if (!vertex) return null;
    const { plus, minus } = tangentDirs(vertex);
    const dir = armId === T_PLUS ? plus : minus;
    return add(vertex, mul(dir, state.radius));
  }
  return pointPos(state, armId);
}

export function namedPos(state: InscribedState, id: string): Vec | null {
  if (id === CENTER_ID) return { x: 0, y: 0 };
  if (id === EXT_ID) return extensionPoint(state);
  if (id === "T" || id === T_PLUS) return tangentPoint(state);
  return pointPos(state, id);
}

export function ccwSpanDeg(from: number, to: number): number {
  let d = normalizeDeg(to) - normalizeDeg(from);
  if (d < 0) d += 360;
  return d;
}

export function smallerSpanDeg(from: number, to: number): number {
  const d = ccwSpanDeg(from, to);
  return Math.min(d, 360 - d);
}

/** Interior (or reflex) angle at vertex between two arms, in degrees. */
export function angleDegAt(
  vertex: Vec,
  from: Vec,
  to: Vec,
  reflex: boolean,
): number {
  const u = sub(from, vertex);
  const w = sub(to, vertex);
  if (len(u) < 1e-9 || len(w) < 1e-9) return 0;
  const a0 = Math.atan2(u.y, u.x);
  const a1 = Math.atan2(w.y, w.x);
  let d = a1 - a0;
  while (d <= -Math.PI) d += Math.PI * 2;
  while (d > Math.PI) d -= Math.PI * 2;
  const small = (Math.abs(d) * 180) / Math.PI;
  if (reflex) return 360 - small;
  return small;
}

export function isRightDeg(deg: number): boolean {
  return Math.abs(deg - 90) < 3.5;
}

export function cycleFill(fill: AngleFill): AngleFill {
  if (fill === "none") return "pink";
  if (fill === "pink") return "blue";
  return "none";
}

export function hasEdge(state: InscribedState, a: string, b: string): boolean {
  const key = pairKey(a, b);
  return state.edges.some((e) => e.show && pairKey(e.a, e.b) === key);
}

export function toggleEdge(state: InscribedState, a: string, b: string): InscribedState {
  if (a === b) return state;
  const id = edgeId(a, b);
  const existing = state.edges.find((e) => e.id === id);
  if (existing) {
    return {
      ...state,
      edges: state.edges.map((e) => (e.id === id ? { ...e, show: !e.show } : e)),
    };
  }
  const next: EdgeDraft = { id, a, b, show: true };
  return { ...state, edges: [...state.edges, next] };
}

export function toggleRadius(state: InscribedState, pointId: string): InscribedState {
  if (pointId === CENTER_ID) return state;
  if (!findPoint(state, pointId)) return state;
  return toggleEdge(state, CENTER_ID, pointId);
}

export function movePoint(
  state: InscribedState,
  id: string,
  target: Vec,
): InscribedState {
  const deg = angleDegOf(target);
  const pair = state.diameterPair;
  return {
    ...state,
    points: state.points.map((p) => {
      if (p.id === id) return { ...p, angleDeg: deg };
      if (pair && (pair[0] === id || pair[1] === id) && (p.id === pair[0] || p.id === pair[1])) {
        return { ...p, angleDeg: normalizeDeg(deg + 180) };
      }
      return p;
    }),
  };
}

export const MAX_POINTS = 8;

export function addPointAt(state: InscribedState, target: Vec): InscribedState | null {
  if (state.points.length >= MAX_POINTS) return null;
  const id = newId("p");
  const point: CircPoint = {
    id,
    name: nextPointName(state),
    angleDeg: angleDegOf(target),
    dx: 0,
    dy: 0,
    showName: true,
  };
  return { ...state, points: [...state.points, point] };
}

export function deletePoint(state: InscribedState, id: string): InscribedState {
  const points = state.points.filter((p) => p.id !== id);
  const edges = state.edges.filter((e) => e.a !== id && e.b !== id);
  const angles = state.angles.filter(
    (a) => a.vertex !== id && a.from !== id && a.to !== id,
  );
  const arcs = state.arcs.filter((a) => a.a !== id && a.b !== id);
  let diameterPair = state.diameterPair;
  if (diameterPair && (diameterPair[0] === id || diameterPair[1] === id)) {
    diameterPair = null;
  }
  let tangent = state.tangent;
  if (tangent?.at === id) tangent = { ...tangent, show: false };
  let extension = state.extension;
  if (extension && (extension.from === id || extension.through === id)) {
    extension = { ...extension, show: false };
  }
  return { ...state, points, edges, angles, arcs, diameterPair, tangent, extension };
}

export function deleteSelected(
  state: InscribedState,
  sel: InscribedSelection | null,
): InscribedState {
  if (!sel) return state;
  if (sel.t === "point") return deletePoint(state, sel.id);
  if (sel.t === "edge") {
    return {
      ...state,
      edges: state.edges.map((e) => (e.id === sel.id ? { ...e, show: false } : e)),
    };
  }
  if (sel.t === "angle") {
    return { ...state, angles: state.angles.filter((a) => a.id !== sel.id) };
  }
  if (sel.t === "arc") {
    return { ...state, arcs: state.arcs.filter((a) => a.id !== sel.id) };
  }
  return state;
}

export type InscribedSelection =
  | { t: "point"; id: string }
  | { t: "edge"; id: string }
  | { t: "angle"; id: string }
  | { t: "arc"; id: string }
  | { t: "center" }
  | { t: "tangent" }
  | { t: "extension" };

/** Circumference points connected to `id` by a visible edge, plus O / T / E. */
export function connectedIds(state: InscribedState, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  function push(other: string) {
    if (other === id || seen.has(other)) return;
    seen.add(other);
    out.push(other);
  }
  for (const e of state.edges) {
    if (!e.show) continue;
    if (e.a === id) push(e.b);
    else if (e.b === id) push(e.a);
  }
  if (state.tangent?.show && state.tangent.at === id) {
    push(T_PLUS);
    push(T_MINUS);
  }
  if (state.extension?.show) {
    if (state.extension.through === id) push(EXT_ID);
    if (state.extension.from === id) push(state.extension.through);
  }
  return out;
}

export function possibleAngles(state: InscribedState, vertexId: string): {
  from: string;
  to: string;
}[] {
  const arms = connectedIds(state, vertexId);
  const pairs: { from: string; to: string }[] = [];
  for (let i = 0; i < arms.length; i += 1) {
    for (let j = i + 1; j < arms.length; j += 1) {
      pairs.push({ from: arms[i]!, to: arms[j]! });
    }
  }
  return pairs;
}

export function upsertAngle(
  state: InscribedState,
  vertex: string,
  from: string,
  to: string,
  patch: Partial<AngleDraft> = {},
): InscribedState {
  const id = angleId(vertex, from, to);
  const existing = state.angles.find((a) => a.id === id && !a.reflex);
  if (existing) {
    return {
      ...state,
      angles: state.angles.map((a) =>
        a.id === existing.id ? { ...a, show: !a.show, ...patch } : a,
      ),
    };
  }
  const next: AngleDraft = {
    id,
    vertex,
    from,
    to,
    show: true,
    fill: "none",
    reflex: false,
    right: false,
    label: emptyLabel("auto"),
    ...patch,
  };
  return { ...state, angles: [...state.angles, next] };
}

export function upsertArc(
  state: InscribedState,
  a: string,
  b: string,
  ccw: boolean,
): InscribedState {
  const id = arcId(a, b, ccw);
  const existing = state.arcs.find((x) => x.id === id);
  if (existing) {
    return {
      ...state,
      arcs: state.arcs.map((x) =>
        x.id === id ? { ...x, show: !x.show } : x,
      ),
    };
  }
  const next: ArcDraft = {
    id,
    a,
    b,
    ccw,
    show: true,
    highlight: false,
    label: emptyLabel("auto"),
  };
  return { ...state, arcs: [...state.arcs, next] };
}

export function patchPoint(
  state: InscribedState,
  id: string,
  patch: Partial<CircPoint>,
): InscribedState {
  return {
    ...state,
    points: state.points.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

export function patchAngle(
  state: InscribedState,
  id: string,
  patch: Partial<AngleDraft>,
): InscribedState {
  return {
    ...state,
    angles: state.angles.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}

export function patchArc(
  state: InscribedState,
  id: string,
  patch: Partial<ArcDraft>,
): InscribedState {
  return {
    ...state,
    arcs: state.arcs.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}

export function patchEdge(
  state: InscribedState,
  id: string,
  patch: Partial<EdgeDraft>,
): InscribedState {
  return {
    ...state,
    edges: state.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  };
}

export function cycleLabelMode(label: MeasLabel): MeasLabel {
  if (label.mode === "auto") return { ...label, mode: "x" };
  if (label.mode === "x") return { ...label, mode: "hide" };
  if (label.mode === "hide") return { ...label, mode: "custom" };
  return { ...label, mode: "auto" };
}

export function nudgeMeasureLabel(
  label: MeasLabel,
  canvasDx: number,
  canvasDy: number,
  along: Vec,
  outward: Vec,
  halfSpan: number,
): MeasLabel {
  const alongAmt = canvasDx * along.x + canvasDy * along.y;
  const perpAmt = canvasDx * outward.x + canvasDy * outward.y;
  const maxAlong = Math.max(halfSpan - 18, 4);
  return {
    ...label,
    dx: clamp(label.dx + alongAmt, -maxAlong, maxAlong),
    dy: clamp(label.dy + perpAmt, -160, 160),
  };
}

export function nudgeMeasureLine(
  label: MeasLabel,
  canvasDx: number,
  canvasDy: number,
  _along: Vec,
  outward: Vec,
  _halfSpan: number,
): MeasLabel {
  const perpAmt = canvasDx * outward.x + canvasDy * outward.y;
  return {
    ...label,
    lineDy: clamp((label.lineDy ?? 0) + perpAmt, -160, 160),
  };
}

export function parseMeasureInput(text: string): {
  kind: "number" | "unknown" | "text";
  value?: number;
  unknown?: string;
  raw: string;
} {
  const raw = text.trim();
  if (!raw) return { kind: "text", raw };
  const unknown = raw.match(/^([A-Za-z])(?:\s*(?:cm|mm|°)?)?$/);
  if (unknown) return { kind: "unknown", unknown: unknown[1], raw };
  const num = raw.match(/^(-?\d+(?:\.\d+)?)\s*(?:cm|mm|°)?$/i);
  if (num) return { kind: "number", value: Number(num[1]), raw };
  return { kind: "text", raw };
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
    const n = Number.isInteger(parsed.value)
      ? String(parsed.value)
      : String(Math.round(parsed.value * 100) / 100);
    return {
      ...prev,
      mode: "custom",
      custom: asAngle ? `${n}°` : text.trim() || n,
    };
  }
  const trimmed = text.trim();
  if (!trimmed) return { ...prev, mode: "hide" };
  return { ...prev, mode: "custom", custom: trimmed };
}

export function applyEditedLabel(
  state: InscribedState,
  id: string,
  text: string,
): InscribedState {
  const parsed = parseMeasureInput(text);
  if (id === "center-name") {
    return { ...state, centerName: text.trim() || "O" };
  }
  if (id === "tangent-name") {
    if (!state.tangent) return state;
    return { ...state, tangent: { ...state.tangent, tName: text.trim() || "T" } };
  }
  if (id === "ext-name") {
    if (!state.extension) return state;
    return {
      ...state,
      extension: { ...state.extension, extraName: text.trim() || "E" },
    };
  }
  if (id.startsWith("pt:") && id.endsWith(":name")) {
    const pid = id.slice(3, -5);
    return patchPoint(state, pid, { name: text.trim() });
  }

  const angle = state.angles.find((a) => a.id === id);
  if (angle) {
    return patchAngle(state, id, {
      label: labelFromParse(parsed, text, angle.label, true),
    });
  }
  const arcMark = state.arcs.find((a) => a.id === id);
  if (arcMark) {
    return patchArc(state, id, {
      label: labelFromParse(parsed, text, arcMark.label, false),
    });
  }
  return state;
}

export function nudgeById(
  state: InscribedState,
  id: string,
  dx: number,
  dy: number,
): InscribedState {
  if (id === "center-name") {
    return {
      ...state,
      centerDx: state.centerDx + dx,
      centerDy: state.centerDy + dy,
    };
  }
  if (id === "tangent-name" && state.tangent) {
    return {
      ...state,
      tangent: {
        ...state.tangent,
        tDx: state.tangent.tDx + dx,
        tDy: state.tangent.tDy + dy,
      },
    };
  }
  if (id === "ext-name" && state.extension) {
    return {
      ...state,
      extension: {
        ...state.extension,
        extraDx: state.extension.extraDx + dx,
        extraDy: state.extension.extraDy + dy,
      },
    };
  }
  if (id.startsWith("pt:") && id.endsWith(":name")) {
    const pid = id.slice(3, -5);
    const p = findPoint(state, pid);
    if (!p) return state;
    return patchPoint(state, pid, { dx: p.dx + dx, dy: p.dy + dy });
  }
  const angle = state.angles.find((a) => a.id === id);
  if (angle) {
    return patchAngle(state, id, {
      label: { ...angle.label, dx: angle.label.dx + dx, dy: angle.label.dy + dy },
    });
  }
  const arcMark = state.arcs.find((a) => a.id === id);
  if (arcMark) {
    return patchArc(state, id, {
      label: { ...arcMark.label, dx: arcMark.label.dx + dx, dy: arcMark.label.dy + dy },
    });
  }
  return state;
}
