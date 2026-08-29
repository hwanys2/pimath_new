import {
  emptyLabel,
  type MeasLabel,
  type PolygonState,
  type Vec,
} from "./model";

export type PolygonHit =
  | { kind: "vertex"; index: number }
  | { kind: "edge"; index: number }
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string };

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(a: Vec, s: number): Vec {
  return { x: a.x * s, y: a.y * s };
}

export function len(a: Vec): number {
  return Math.hypot(a.x, a.y);
}

export function norm(a: Vec): Vec {
  const l = len(a);
  if (l < 1e-9) return { x: 1, y: 0 };
  return { x: a.x / l, y: a.y / l };
}

export function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Vec, b: Vec): number {
  return a.x * b.y - a.y * b.x;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function centroid(pts: Vec[]): Vec {
  if (pts.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

export function meanRadius(pts: Vec[]): number {
  if (pts.length === 0) return 4;
  const c = centroid(pts);
  let s = 0;
  for (const p of pts) s += len(sub(p, c));
  return Math.max(s / pts.length, 1.2);
}

/** Clockwise from the top, y-up. */
export function regularPolygon(n: number, radius = 4, startDeg = 90): Vec[] {
  const count = Math.round(clamp(n, 3, 8));
  const pts: Vec[] = [];
  for (let i = 0; i < count; i += 1) {
    const a = ((startDeg - (i * 360) / count) * Math.PI) / 180;
    pts.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  return pts;
}

export function signedArea(pts: Vec[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function isConvex(pts: Vec[]): boolean {
  const n = pts.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i += 1) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    const c = pts[(i + 2) % n]!;
    const cr = cross(sub(b, a), sub(c, b));
    if (Math.abs(cr) < 1e-8) return false;
    const s = Math.sign(cr);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

export function prevIndex(i: number, n: number): number {
  return (i - 1 + n) % n;
}

export function nextIndex(i: number, n: number): number {
  return (i + 1) % n;
}

export function interiorAngleDeg(prev: Vec, p: Vec, next: Vec): number {
  const u = norm(sub(prev, p));
  const w = norm(sub(next, p));
  return (Math.acos(clamp(dot(u, w), -1, 1)) * 180) / Math.PI;
}

export function exteriorAngleDeg(prev: Vec, p: Vec, next: Vec): number {
  return 180 - interiorAngleDeg(prev, p, next);
}

export function vertexAngles(pts: Vec[], i: number): { interior: number; exterior: number } {
  const n = pts.length;
  const p = pts[i]!;
  const prev = pts[prevIndex(i, n)]!;
  const next = pts[nextIndex(i, n)]!;
  const interior = interiorAngleDeg(prev, p, next);
  return { interior, exterior: 180 - interior };
}

export function edgeLength(pts: Vec[], i: number): number {
  const a = pts[i]!;
  const b = pts[nextIndex(i, pts.length)]!;
  return len(sub(b, a));
}

export function isDiagonalPair(n: number, a: number, b: number): boolean {
  if (a === b || a < 0 || b < 0 || a >= n || b >= n) return false;
  const d = Math.abs(a - b);
  return d !== 1 && d !== n - 1;
}

export function allDiagonalPairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      if (isDiagonalPair(n, a, b)) out.push([a, b]);
    }
  }
  return out;
}

export function diagonalCount(n: number): number {
  return (n * (n - 3)) / 2;
}

export function diagonalKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function parseDiagonalKey(key: string): [number, number] | null {
  const dash = key.indexOf("-");
  if (dash < 1) return null;
  const a = Number(key.slice(0, dash));
  const b = Number(key.slice(dash + 1));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return [a, b];
}

export function hasDiagonal(diags: [number, number][], a: number, b: number): boolean {
  const key = diagonalKey(a, b);
  return diags.some(([i, j]) => diagonalKey(i, j) === key);
}

export function toggleDiagonal(
  diags: [number, number][],
  a: number,
  b: number,
): [number, number][] {
  const key = diagonalKey(a, b);
  const exists = diags.some(([i, j]) => diagonalKey(i, j) === key);
  if (exists) return diags.filter(([i, j]) => diagonalKey(i, j) !== key);
  const pair: [number, number] = a < b ? [a, b] : [b, a];
  return [...diags, pair];
}

export function vertexDiagonalsOn(state: PolygonState, i: number): boolean {
  const n = state.points.length;
  const needed = allDiagonalPairs(n).filter(([a, b]) => a === i || b === i);
  if (needed.length === 0) return false;
  return needed.every(([a, b]) => hasDiagonal(state.diagonals, a, b));
}

export function toggleVertexDiagonals(state: PolygonState, i: number): PolygonState {
  const n = state.points.length;
  const needed = allDiagonalPairs(n).filter(([a, b]) => a === i || b === i);
  const allOn = needed.every(([a, b]) => hasDiagonal(state.diagonals, a, b));
  let diagonals = state.diagonals.filter(([a, b]) => a !== i && b !== i);
  if (!allOn) diagonals = [...diagonals, ...needed];
  return { ...state, diagonals };
}

export function allDiagonalsOn(state: PolygonState): boolean {
  const all = allDiagonalPairs(state.points.length);
  if (all.length === 0) return false;
  return all.every(([a, b]) => hasDiagonal(state.diagonals, a, b));
}

export function toggleAllDiagonals(state: PolygonState): PolygonState {
  if (allDiagonalsOn(state)) return { ...state, diagonals: [] };
  return { ...state, diagonals: allDiagonalPairs(state.points.length) };
}

export function moveVertex(
  state: PolygonState,
  index: number,
  next: Vec,
): PolygonState {
  const points = state.points.map((p, i) => (i === index ? next : p));
  if (!isConvex(points)) return state;
  const minSpan = 0.35;
  for (let i = 0; i < points.length; i += 1) {
    if (edgeLength(points, i) < minSpan) return state;
  }
  return syncShapeFromPoints({ ...state, points });
}

export function extensionEnd(prev: Vec, p: Vec, length: number): Vec {
  return add(p, mul(norm(sub(p, prev)), length));
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

export function hitTestPolygon(
  canvasPts: Vec[],
  texts: { id: string; x: number; y: number }[],
  cmds: { t: string; id?: string; x1?: number; y1?: number; x2?: number; y2?: number; cx?: number; cy?: number; r?: number }[],
  x: number,
  y: number,
  scale = 1,
): PolygonHit | null {
  const labelR = 22 * Math.max(scale, 0.85);
  let bestText: { id: string; d: number } | null = null;
  for (const text of texts) {
    const d = Math.hypot(text.x - x, text.y - y);
    if (d < labelR && (!bestText || d < bestText.d)) {
      bestText = { id: text.id, d };
    }
  }
  if (bestText) {
    if (bestText.id.endsWith(":line")) {
      return { kind: "dimLine", id: bestText.id.slice(0, -5) };
    }
    return { kind: "label", id: bestText.id };
  }

  const pointR = 14 * Math.max(scale, 0.85);
  let bestV = -1;
  let bestVd = pointR;
  canvasPts.forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestVd) {
      bestVd = d;
      bestV = i;
    }
  });
  if (bestV >= 0) return { kind: "vertex", index: bestV };

  const dimR = 10 * Math.max(scale, 0.85);
  let bestDim: PolygonHit | null = null;
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
  let bestE = -1;
  let bestEd = edgeR;
  const n = canvasPts.length;
  for (let i = 0; i < n; i += 1) {
    const a = canvasPts[i]!;
    const b = canvasPts[(i + 1) % n]!;
    const d = distToSeg(x, y, a.x, a.y, b.x, b.y);
    if (d < bestEd) {
      bestEd = d;
      bestE = i;
    }
  }
  if (bestE >= 0) return { kind: "edge", index: bestE };
  return null;
}

export function parseAngleInput(text: string): {
  kind: "number" | "unknown" | "text";
  value?: number;
  unknown?: string;
  raw: string;
} {
  const raw = text.trim();
  if (!raw) return { kind: "text", raw };
  const unknown = raw.match(/^\$?([A-Za-z])\$?\s*(?:°|˚)?$/);
  if (unknown) return { kind: "unknown", unknown: unknown[1], raw };
  const num = raw.match(/^(-?\d+(?:\.\d+)?)\s*(?:°|˚|도)?$/);
  if (num) return { kind: "number", value: Number(num[1]), raw };
  return { kind: "text", raw };
}

export function parseMeasureInput(text: string): {
  kind: "number" | "unknown" | "text";
  value?: number;
  unknown?: string;
  raw: string;
} {
  const raw = text.trim();
  if (!raw) return { kind: "text", raw };
  const unknown = raw.match(/^\$?([A-Za-z])\$?(?:\s*(?:cm|mm))?$/);
  if (unknown) return { kind: "unknown", unknown: unknown[1], raw };
  const num = raw.match(/^(-?\d+(?:\.\d+)?)\s*(?:cm|mm)?$/i);
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
    const custom = asAngle ? `${parsed.value}°` : String(parsed.value);
    return { ...prev, mode: "custom", custom };
  }
  if (!text.trim()) return { ...prev, mode: "hide", custom: "" };
  return { ...prev, mode: "custom", custom: text.trim() };
}

export function applyEditedLabel(
  state: PolygonState,
  id: string,
  text: string,
): PolygonState {
  const nameMatch = /^v:(\d+):name$/.exec(id);
  if (nameMatch) {
    const i = Number(nameMatch[1]);
    const vertices = state.vertices.map((v, idx) =>
      idx === i ? { ...v, name: text.trim() || v.name } : v,
    );
    return { ...state, vertices };
  }
  const angMatch = /^v:(\d+):(interior|exterior)$/.exec(id);
  if (angMatch) {
    const i = Number(angMatch[1]);
    const which = angMatch[2] as "interior" | "exterior";
    const parsed = parseAngleInput(text);
    if (parsed.kind === "number" && parsed.value != null) {
      const interiorDeg =
        which === "interior" ? parsed.value : 180 - parsed.value;
      const updated = applyInteriorAngleChange(state, i, interiorDeg);
      const vertices = updated.vertices.map((v, idx) => {
        if (idx !== i) return v;
        return { ...v, [which]: labelFromParse(parsed, text, v[which], true) };
      });
      return { ...updated, vertices };
    }
    const vertices = state.vertices.map((v, idx) => {
      if (idx !== i) return v;
      return { ...v, [which]: labelFromParse(parsed, text, v[which], true) };
    });
    return { ...state, vertices };
  }
  const edgeMatch = /^e:(\d+):length$/.exec(id);
  if (edgeMatch) {
    const i = Number(edgeMatch[1]);
    const parsed = parseMeasureInput(text);
    if (parsed.kind === "number" && parsed.value != null) {
      const scaled = applyEdgeLengthChange(state, i, parsed.value);
      const edges = scaled.edges.map((e, idx) =>
        idx === i ? { ...e, length: labelFromParse(parsed, text, e.length, false) } : e,
      );
      return { ...scaled, edges };
    }
    const edges = state.edges.map((e, idx) =>
      idx === i ? { ...e, length: labelFromParse(parsed, text, e.length, false) } : e,
    );
    return { ...state, edges };
  }
  return state;
}

export function nudgeLabel(
  state: PolygonState,
  id: string,
  dx: number,
  dy: number,
  lineOnly: boolean,
): PolygonState {
  const nameMatch = /^v:(\d+):name$/.exec(id);
  if (nameMatch) {
    const i = Number(nameMatch[1]);
    const vertices = state.vertices.map((v, idx) =>
      idx === i
        ? {
            ...v,
            nameDx: clamp(v.nameDx + dx, -80, 80),
            nameDy: clamp(v.nameDy + dy, -80, 80),
          }
        : v,
    );
    return { ...state, vertices };
  }
  const angMatch = /^v:(\d+):(interior|exterior)$/.exec(id);
  if (angMatch) {
    const i = Number(angMatch[1]);
    const which = angMatch[2] as "interior" | "exterior";
    const vertices = state.vertices.map((v, idx) => {
      if (idx !== i) return v;
      const label = v[which];
      return {
        ...v,
        [which]: {
          ...label,
          dx: clamp(label.dx + dx, -80, 80),
          dy: clamp(label.dy + dy, -80, 80),
        },
      };
    });
    return { ...state, vertices };
  }
  const edgeMatch = /^e:(\d+):length$/.exec(id);
  if (edgeMatch) {
    const i = Number(edgeMatch[1]);
    const edges = state.edges.map((e, idx) => {
      if (idx !== i) return e;
      if (lineOnly) {
        return {
          ...e,
          length: { ...e.length, lineDy: clamp((e.length.lineDy ?? 0) + dy, -160, 160) },
        };
      }
      return {
        ...e,
        length: {
          ...e.length,
          dx: clamp(e.length.dx + dx, -80, 80),
          dy: clamp(e.length.dy + dy, -160, 160),
        },
      };
    });
    return { ...state, edges };
  }
  return state;
}

export function clearSelectionMarks(
  state: PolygonState,
  sel: { t: "vertex"; i: number } | { t: "edge"; i: number } | null,
): PolygonState {
  if (!sel) return state;
  if (sel.t === "vertex") {
    const vertices = state.vertices.map((v, i) =>
      i === sel.i
        ? {
            ...v,
            showInterior: false,
            showExterior: false,
            fillExterior: false,
            interior: emptyLabel("auto"),
            exterior: emptyLabel("auto"),
          }
        : v,
    );
    const diagonals = state.diagonals.filter(([a, b]) => a !== sel.i && b !== sel.i);
    return { ...state, vertices, diagonals };
  }
  const edges = state.edges.map((e, i) =>
    i === sel.i ? { ...e, showLength: false, length: emptyLabel("auto") } : e,
  );
  return { ...state, edges };
}

export function interiorAngleSumTarget(n: number): number {
  return (n - 2) * 180;
}

export function anglesFromPoints(points: Vec[]): number[] {
  return points.map((_, i) => vertexAngles(points, i).interior);
}

export function syncShapeFromPoints(state: PolygonState): PolygonState {
  return {
    ...state,
    interiorAnglesDeg: anglesFromPoints(state.points),
    referenceEdgeLength: edgeLength(state.points, 0),
  };
}

const MIN_EDGE = 0.35;
const CONSTRAINT_TOL = 0.2;

type ShapeConstraints = {
  interiorAngles: Map<number, number>;
  edgeLengths: Map<number, number>;
};

type ConstraintEdit =
  | { kind: "interior"; index: number; value: number }
  | { kind: "exterior"; index: number; value: number }
  | { kind: "length"; index: number; value: number };

function lockedNumericFromLabel(text: string, asAngle: boolean): number | null {
  const parsed = asAngle ? parseAngleInput(text) : parseMeasureInput(text);
  if (parsed.kind === "number" && parsed.value != null) return parsed.value;
  return null;
}

/** 숫자로 고정된 각·길이 라벨(직접 입력)을 제약으로 모은다. */
export function collectLockedConstraints(
  state: PolygonState,
  edit?: ConstraintEdit,
): ShapeConstraints {
  const interiorAngles = new Map<number, number>();
  const edgeLengths = new Map<number, number>();
  const n = state.points.length;

  for (let i = 0; i < n; i += 1) {
    const v = state.vertices[i]!;
    if (edit?.kind === "interior" && edit.index === i) continue;
    if (edit?.kind === "exterior" && edit.index === i) continue;

    if (v.showInterior && v.interior.mode === "custom") {
      const val = lockedNumericFromLabel(v.interior.custom, true);
      if (val != null) interiorAngles.set(i, val);
    }
    if (v.showExterior && v.exterior.mode === "custom" && !interiorAngles.has(i)) {
      const val = lockedNumericFromLabel(v.exterior.custom, true);
      if (val != null) interiorAngles.set(i, 180 - val);
    }
  }

  for (let i = 0; i < n; i += 1) {
    if (edit?.kind === "length" && edit.index === i) continue;
    const e = state.edges[i]!;
    if (e.showLength && e.length.mode === "custom") {
      const val = lockedNumericFromLabel(e.length.custom, false);
      if (val != null) edgeLengths.set(i, val);
    }
  }

  if (edit?.kind === "interior") {
    interiorAngles.set(edit.index, clamp(edit.value, 1, 179));
  } else if (edit?.kind === "exterior") {
    interiorAngles.set(edit.index, clamp(180 - edit.value, 1, 179));
  } else if (edit?.kind === "length") {
    edgeLengths.set(edit.index, clamp(edit.value, MIN_EDGE, 40));
  }

  return { interiorAngles, edgeLengths };
}

function constraintError(points: Vec[], constraints: ShapeConstraints): number {
  let err = 0;
  for (const [i, deg] of constraints.interiorAngles) {
    const delta = vertexAngles(points, i).interior - deg;
    err += delta * delta;
  }
  for (const [i, target] of constraints.edgeLengths) {
    const delta = edgeLength(points, i) - target;
    err += delta * delta;
  }
  return err;
}

function satisfiesConstraints(points: Vec[], constraints: ShapeConstraints): boolean {
  if (!isValidPolygon(points)) return false;
  return constraintError(points, constraints) <= CONSTRAINT_TOL * CONSTRAINT_TOL;
}

function displacementCost(a: Vec[], b: Vec[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) {
    const dx = a[i]!.x - b[i]!.x;
    const dy = a[i]!.y - b[i]!.y;
    s += dx * dx + dy * dy;
  }
  return s;
}

function pickBestCandidate(candidates: Vec[][], start: Vec[]): Vec[] | null {
  let best: Vec[] | null = null;
  let bestCost = Infinity;
  for (const candidate of candidates) {
    const cost = displacementCost(candidate, start);
    if (cost < bestCost) {
      best = candidate;
      bestCost = cost;
    }
  }
  return best;
}

function isValidPolygon(points: Vec[]): boolean {
  if (!isConvex(points)) return false;
  for (let i = 0; i < points.length; i += 1) {
    if (edgeLength(points, i) < MIN_EDGE) return false;
  }
  return true;
}

function rotateVec2(v: Vec, deg: number): Vec {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function trySetInteriorAngle(
  points: Vec[],
  vIndex: number,
  moveIndex: number,
  targetDeg: number,
): Vec[] | null {
  const n = points.length;
  const V = points[vIndex]!;
  const prev = prevIndex(vIndex, n);
  const next = nextIndex(vIndex, n);
  if (moveIndex !== prev && moveIndex !== next) return null;

  const target = clamp(targetDeg, 1, 179);

  if (moveIndex === next) {
    const P = points[prev]!;
    const N = points[next]!;
    const u = norm(sub(P, V));
    const w = sub(N, V);
    const dist = len(w);
    if (dist < 1e-9) return null;
    const sign = Math.sign(cross(u, norm(w))) || 1;
    const wDir = rotateVec2(u, sign * target);
    const moved = add(V, mul(wDir, dist));
    const newPoints = points.map((p, i) => (i === next ? moved : p));
    return isValidPolygon(newPoints) ? newPoints : null;
  }

  const P = points[prev]!;
  const N = points[next]!;
  const w = norm(sub(N, V));
  const u = sub(P, V);
  const dist = len(u);
  if (dist < 1e-9) return null;
  const sign = Math.sign(cross(norm(u), w)) || 1;
  const uDir = rotateVec2(w, -sign * target);
  const moved = add(V, mul(uDir, dist));
  const newPoints = points.map((p, i) => (i === prev ? moved : p));
  return isValidPolygon(newPoints) ? newPoints : null;
}

function trySetEdgeLength(
  points: Vec[],
  edgeIndex: number,
  moveEndIndex: number,
  targetLength: number,
): Vec[] | null {
  const n = points.length;
  const start = edgeIndex;
  const end = nextIndex(edgeIndex, n);
  if (moveEndIndex !== start && moveEndIndex !== end) return null;

  const A = points[start]!;
  const B = points[end]!;
  const target = clamp(targetLength, MIN_EDGE, 40);
  const dir = norm(sub(B, A));

  if (moveEndIndex === end) {
    const moved = add(A, mul(dir, target));
    const newPoints = points.map((p, i) => (i === end ? moved : p));
    return isValidPolygon(newPoints) ? newPoints : null;
  }

  const moved = sub(B, mul(dir, target));
  const newPoints = points.map((p, i) => (i === start ? moved : p));
  return isValidPolygon(newPoints) ? newPoints : null;
}

function localMoveCandidates(
  points: Vec[],
  edit: ConstraintEdit,
): Vec[][] {
  const n = points.length;
  const out: Vec[][] = [];

  if (edit.kind === "interior" || edit.kind === "exterior") {
    const index = edit.index;
    const deg = edit.kind === "interior" ? edit.value : 180 - edit.value;
    for (const moveIndex of [nextIndex(index, n), prevIndex(index, n)]) {
      const trial = trySetInteriorAngle(points, index, moveIndex, deg);
      if (trial) out.push(trial);
    }
    return out;
  }

  const end = nextIndex(edit.index, n);
  for (const moveIndex of [end, edit.index]) {
    const trial = trySetEdgeLength(points, edit.index, moveIndex, edit.value);
    if (trial) out.push(trial);
  }
  return out;
}

function optimizeForConstraints(
  start: Vec[],
  constraints: ShapeConstraints,
): Vec[] | null {
  const n = start.length;
  let best = start.map((p) => ({ ...p }));
  let bestObj = constraintError(best, constraints) + 0.003 * displacementCost(best, start);

  const stepSizes = [0.12, 0.06, 0.03, 0.015];
  for (const step of stepSizes) {
    for (let iter = 0; iter < 160; iter += 1) {
      let improved = false;
      for (let vi = 0; vi < n; vi += 1) {
        for (const [dx, dy] of [
          [step, 0],
          [-step, 0],
          [0, step],
          [0, -step],
          [step, step],
          [-step, step],
          [step, -step],
          [-step, -step],
        ] as const) {
          const trial = best.map((p, i) =>
            i === vi ? { x: p.x + dx, y: p.y + dy } : p,
          );
          if (!isValidPolygon(trial)) continue;
          const obj =
            constraintError(trial, constraints) + 0.003 * displacementCost(trial, start);
          if (obj < bestObj - 1e-9) {
            best = trial;
            bestObj = obj;
            improved = true;
          }
        }
      }
      if (!improved) break;
    }
  }

  return satisfiesConstraints(best, constraints) ? best : null;
}

function solveWithConstraints(
  state: PolygonState,
  edit: ConstraintEdit,
): Vec[] | null {
  const start = state.points;
  const constraints = collectLockedConstraints(state, edit);

  const localValid = localMoveCandidates(start, edit).filter((candidate) =>
    satisfiesConstraints(candidate, constraints),
  );
  const localBest = pickBestCandidate(localValid, start);
  if (localBest) return localBest;

  const chained: Vec[][] = [];
  for (const first of localMoveCandidates(start, edit)) {
    for (const second of localMoveCandidates(first, edit)) {
      if (satisfiesConstraints(second, constraints)) chained.push(second);
    }
  }
  const chainedBest = pickBestCandidate(chained, start);
  if (chainedBest) return chainedBest;

  return optimizeForConstraints(start, constraints);
}

export function applyInteriorAngleChange(
  state: PolygonState,
  index: number,
  deg: number,
): PolygonState {
  const n = state.points.length;
  if (index < 0 || index >= n) return state;
  const points = solveWithConstraints(state, {
    kind: "interior",
    index,
    value: deg,
  });
  if (!points) return state;
  return syncShapeFromPoints({ ...state, points });
}

export function applyEdgeLengthChange(
  state: PolygonState,
  edgeIndex: number,
  newLength: number,
): PolygonState {
  const n = state.points.length;
  if (edgeIndex < 0 || edgeIndex >= n) return state;
  const points = solveWithConstraints(state, {
    kind: "length",
    index: edgeIndex,
    value: newLength,
  });
  if (!points) return state;
  return syncShapeFromPoints({ ...state, points });
}

/** @deprecated Use applyEdgeLengthChange. */
export function applyEdgeLengthScale(
  state: PolygonState,
  edgeIndex: number,
  newLength: number,
): PolygonState {
  return applyEdgeLengthChange(state, edgeIndex, newLength);
}
