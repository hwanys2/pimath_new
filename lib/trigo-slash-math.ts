/** Math helpers for 「삼각비 슬래시」 (중3 · 3.1 삼각비). */

import { SCORE_HARD_MAX } from "@/lib/xp";

export const CONTENT_KEY = "g3-u3-1-trigo-slash";

export const START_LIVES = 3;
export const MAX_LIVES = 3;
export const FEVER_COMBO = 10;
export const FEVER_SEC = 8;

/** viewBox is 0..100. */
export const VIEW = 100;

export type VertexId = "A" | "B" | "C";
export type SideId = "a" | "b" | "c";
export type TrigFn = "sin" | "cos" | "tan";
export type SideRole = "opp" | "adj" | "hyp";
export type ShapeKind = "normal" | "flat" | "skinny";
export type SlashVerdict = "correct" | "reversed" | "wrong" | "incomplete";

export type Point = { x: number; y: number };

export type VertexMap = Record<VertexId, Point>;

export type Round = {
  vertices: VertexMap;
  rightAt: VertexId;
  refAt: VertexId;
  fn: TrigFn;
  /** Additional spin on top of baked pose, radians per second. */
  spinSpeed: number;
  shape: ShapeKind;
  showSideLetters: boolean;
  /** 1·2 번호와 높이/밑변/빗변 색. 초반 2라운드. */
  showOrderHints: boolean;
  timeLimitSec: number;
  isBoss: boolean;
};

export const VERTEX_IDS: VertexId[] = ["A", "B", "C"];
export const SIDE_IDS: SideId[] = ["a", "b", "c"];
export const TRIG_FNS: TrigFn[] = ["sin", "cos", "tan"];

export const ROLE_LABEL: Record<SideRole, string> = {
  opp: "높이",
  adj: "밑변",
  hyp: "빗변",
};

export const ROLE_COLOR: Record<SideRole, string> = {
  opp: "#e85d4c",
  adj: "#3d8fd9",
  hyp: "#d4a017",
};

/** Slash order: denominator → numerator (「분모분에 분자」). */
export const FN_FORMULA: Record<TrigFn, string> = {
  sin: "빗변 → 높이",
  cos: "빗변 → 밑변",
  tan: "밑변 → 높이",
};

export const FN_LATEX: Record<TrigFn, string> = {
  sin: "\\sin",
  cos: "\\cos",
  tan: "\\tan",
};

/** Side opposite a vertex. */
export function oppositeSide(v: VertexId): SideId {
  return v.toLowerCase() as SideId;
}

/** Endpoints of a side (a=BC, b=AC, c=AB). */
export function sideVertices(side: SideId): [VertexId, VertexId] {
  switch (side) {
    case "a":
      return ["B", "C"];
    case "b":
      return ["A", "C"];
    case "c":
      return ["A", "B"];
  }
}

export function otherVertex(rightAt: VertexId, refAt: VertexId): VertexId {
  return VERTEX_IDS.find((v) => v !== rightAt && v !== refAt)!;
}

export function roleOfSide(
  side: SideId,
  rightAt: VertexId,
  refAt: VertexId,
): SideRole {
  if (side === oppositeSide(rightAt)) return "hyp";
  if (side === oppositeSide(refAt)) return "opp";
  return "adj";
}

export function sideByRole(
  role: SideRole,
  rightAt: VertexId,
  refAt: VertexId,
): SideId {
  for (const side of SIDE_IDS) {
    if (roleOfSide(side, rightAt, refAt) === role) return side;
  }
  return "c";
}

/** Denominator then numerator — Korean 「분모분에 분자」 slash order. */
export function sidesForRatio(
  fn: TrigFn,
  rightAt: VertexId,
  refAt: VertexId,
): [SideId, SideId] {
  const opp = sideByRole("opp", rightAt, refAt);
  const adj = sideByRole("adj", rightAt, refAt);
  const hyp = sideByRole("hyp", rightAt, refAt);
  switch (fn) {
    case "sin":
      return [hyp, opp];
    case "cos":
      return [hyp, adj];
    case "tan":
      return [adj, opp];
  }
}

export function missionLatex(fn: TrigFn, refAt: VertexId): string {
  return `${FN_LATEX[fn]}\\,${refAt}`;
}

export function missionPlain(fn: TrigFn, refAt: VertexId): string {
  return `${fn} ${refAt}`;
}

export function centroid(verts: VertexMap): Point {
  return {
    x: (verts.A.x + verts.B.x + verts.C.x) / 3,
    y: (verts.A.y + verts.B.y + verts.C.y) / 3,
  };
}

export function rotateAround(p: Point, origin: Point, rad: number): Point {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

export function rotateVertices(
  verts: VertexMap,
  rad: number,
  origin?: Point,
): VertexMap {
  const o = origin ?? centroid(verts);
  return {
    A: rotateAround(verts.A, o, rad),
    B: rotateAround(verts.B, o, rad),
    C: rotateAround(verts.C, o, rad),
  };
}

export function sideSegment(
  verts: VertexMap,
  side: SideId,
): [Point, Point] {
  const [u, v] = sideVertices(side);
  return [verts[u], verts[v]];
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function rand(): number {
  return Math.random();
}

function randRange(lo: number, hi: number): number {
  return lo + rand() * (hi - lo);
}

function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(rand() * xs.length)]!;
}

function acuteVertices(rightAt: VertexId): [VertexId, VertexId] {
  const rest = VERTEX_IDS.filter((v) => v !== rightAt) as [VertexId, VertexId];
  return rest;
}

/**
 * Place a right triangle in local coords: right angle at origin,
 * adjacent-to-ref along +x, opposite along +y. Then rotate/mirror/fit.
 */
function placeTriangle(
  rightAt: VertexId,
  refAt: VertexId,
  adjLen: number,
  oppLen: number,
  rotation: number,
  mirror: boolean,
): VertexMap {
  const third = otherVertex(rightAt, refAt);
  const local: VertexMap = {
    A: { x: 0, y: 0 },
    B: { x: 0, y: 0 },
    C: { x: 0, y: 0 },
  };
  local[rightAt] = { x: 0, y: 0 };
  local[refAt] = { x: adjLen, y: 0 };
  // SVG y grows downward — negative y reads as “up” before rotation.
  local[third] = { x: 0, y: -oppLen };

  if (mirror) {
    for (const id of VERTEX_IDS) {
      local[id] = { x: local[id].x, y: -local[id].y };
    }
  }

  const rotated = rotateVertices(local, rotation, { x: 0, y: 0 });
  return fitByRadius(rotated, 16);
}

function fitByRadius(verts: VertexMap, padding: number): VertexMap {
  const c = centroid(verts);
  const r = Math.max(
    dist(c, verts.A),
    dist(c, verts.B),
    dist(c, verts.C),
    1,
  );
  const targetR = 50 - padding;
  const scale = targetR / r;
  const map = (p: Point): Point => ({
    x: 50 + (p.x - c.x) * scale,
    y: 50 + (p.y - c.y) * scale,
  });
  return { A: map(verts.A), B: map(verts.B), C: map(verts.C) };
}

export type Difficulty = {
  randomizeRight: boolean;
  spin: boolean;
  spinSpeed: number;
  shapePool: ShapeKind[];
  hideSideLetters: boolean;
  timeLimitSec: number;
  isBoss: boolean;
  freeRotation: boolean;
  allowMirror: boolean;
};

export function difficultyAt(cleared: number): Difficulty {
  const n = Math.max(0, cleared);
  const isBoss = n >= 9 && (n + 1) % 10 === 0;
  const timeLimitSec = isBoss
    ? 7.2
    : Math.max(4.2, 8.4 - n * 0.12);

  if (n <= 1) {
    return {
      randomizeRight: false,
      spin: false,
      spinSpeed: 0,
      shapePool: ["normal"],
      hideSideLetters: false,
      timeLimitSec: 10,
      isBoss: false,
      freeRotation: false,
      allowMirror: false,
    };
  }

  if (n <= 4) {
    return {
      randomizeRight: false,
      spin: false,
      spinSpeed: 0,
      shapePool: ["normal"],
      hideSideLetters: false,
      timeLimitSec,
      isBoss: false,
      freeRotation: false,
      allowMirror: n >= 3,
    };
  }

  if (n <= 8) {
    return {
      randomizeRight: false,
      spin: false,
      spinSpeed: 0,
      shapePool: ["normal", "normal", "flat", "skinny"],
      hideSideLetters: false,
      timeLimitSec,
      isBoss: false,
      freeRotation: true,
      allowMirror: true,
    };
  }

  return {
    randomizeRight: n >= 12 || isBoss,
    spin: isBoss || n >= 14,
    spinSpeed: isBoss ? 0.55 : 0.32,
    shapePool: isBoss
      ? ["flat", "skinny"]
      : n >= 10
        ? ["normal", "flat", "skinny"]
        : ["normal", "normal", "flat", "skinny"],
    hideSideLetters: n >= 18,
    timeLimitSec,
    isBoss,
    freeRotation: true,
    allowMirror: true,
  };
}

function lengthsForShape(shape: ShapeKind): { adj: number; opp: number } {
  if (shape === "flat") {
    return { adj: randRange(6.4, 8.2), opp: randRange(1.7, 2.35) };
  }
  if (shape === "skinny") {
    return { adj: randRange(1.7, 2.35), opp: randRange(6.4, 8.2) };
  }
  return { adj: randRange(3.1, 5.2), opp: randRange(3.1, 5.2) };
}

function poseRotation(diff: Difficulty, cleared: number): number {
  if (cleared <= 1) return 0;
  if (!diff.freeRotation) {
    const steps = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, Math.PI / 4, (3 * Math.PI) / 4];
    return pick(steps);
  }
  return randRange(0, Math.PI * 2);
}

export function dealRound(cleared: number): Round {
  const diff = difficultyAt(cleared);
  const shape = pick(diff.shapePool);
  const { adj, opp } = lengthsForShape(shape);

  let rightAt: VertexId = "C";
  let refAt: VertexId = "A";
  let fn: TrigFn = "sin";

  if (cleared === 0) {
    fn = "sin";
    refAt = "A";
    rightAt = "C";
  } else if (cleared === 1) {
    fn = "cos";
    refAt = "A";
    rightAt = "C";
  } else if (cleared === 2) {
    fn = "tan";
    refAt = "A";
    rightAt = "C";
  } else {
    rightAt = diff.randomizeRight ? pick(VERTEX_IDS) : "C";
    refAt = pick(acuteVertices(rightAt));
    fn = pick(TRIG_FNS);
  }

  /**
   * Rounds 0–2: textbook pose with ∠C=90°, A on top, B right.
   * Opposite of A is the bottom side — the classic “밑변처럼 보이는 높이”.
   */
  const vertices =
    cleared <= 2
      ? fitByRadius(
          {
            C: { x: 0, y: 0 },
            A: { x: 0, y: -adj },
            B: { x: opp, y: 0 },
          },
          16,
        )
      : placeTriangle(
          rightAt,
          refAt,
          adj,
          opp,
          poseRotation(diff, cleared),
          diff.allowMirror && rand() < 0.5,
        );

  return {
    vertices,
    rightAt,
    refAt,
    fn,
    spinSpeed: diff.spin ? diff.spinSpeed * (rand() < 0.5 ? 1 : -1) : 0,
    shape,
    showSideLetters: !diff.hideSideLetters,
    showOrderHints: cleared < 2,
    timeLimitSec: diff.timeLimitSec,
    isBoss: diff.isBoss,
  };
}

const END_MARGIN = 0.14;
const HIT_RADIUS = 5.6;
const MIN_STROKE = 11;
const REF_START_RADIUS = 14;

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function closestT(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) return 0;
  return clamp01(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2);
}

function distToSeg(p: Point, a: Point, b: Point): { d: number; t: number } {
  const t = closestT(p, a, b);
  const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  return { d: dist(p, q), t };
}

function segsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const cross = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

function hitsSide(poly: Point[], a: Point, b: Point): number | null {
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const { d, t } = distToSeg(p, a, b);
    if (t >= END_MARGIN && t <= 1 - END_MARGIN && d <= HIT_RADIUS) {
      return i;
    }
    if (i > 0) {
      const q = poly[i - 1]!;
      if (segsIntersect(q, p, a, b)) {
        const mid = midpoint(q, p);
        const hit = distToSeg(mid, a, b);
        if (hit.t >= END_MARGIN && hit.t <= 1 - END_MARGIN) return i;
      }
    }
  }
  return null;
}

export type SlashEval = {
  verdict: SlashVerdict;
  hitOrder: SideId[];
  startedNearRef: boolean;
};

export function evaluateSlash(
  polyline: Point[],
  verts: VertexMap,
  target: [SideId, SideId],
  refAt: VertexId,
): SlashEval {
  const startedNearRef =
    polyline.length > 0 && dist(polyline[0]!, verts[refAt]) <= REF_START_RADIUS;

  if (polyline.length < 2) {
    return { verdict: "incomplete", hitOrder: [], startedNearRef };
  }

  let length = 0;
  for (let i = 1; i < polyline.length; i++) {
    length += dist(polyline[i - 1]!, polyline[i]!);
  }
  if (length < MIN_STROKE) {
    return { verdict: "incomplete", hitOrder: [], startedNearRef };
  }

  const hits: { side: SideId; index: number }[] = [];
  for (const side of SIDE_IDS) {
    const [a, b] = sideSegment(verts, side);
    const index = hitsSide(polyline, a, b);
    if (index != null) hits.push({ side, index });
  }
  hits.sort((x, y) => x.index - y.index);
  const hitOrder = hits.map((h) => h.side);

  if (hitOrder.length < 2) {
    return { verdict: "incomplete", hitOrder, startedNearRef };
  }

  const first = hitOrder[0]!;
  const second = hitOrder[1]!;
  if (first === target[0] && second === target[1]) {
    return { verdict: "correct", hitOrder, startedNearRef };
  }
  if (first === target[1] && second === target[0]) {
    return { verdict: "reversed", hitOrder, startedNearRef };
  }
  return { verdict: "wrong", hitOrder, startedNearRef };
}

export function pointsForHit(opts: {
  streakBefore: number;
  fever: boolean;
  speedRatio: number;
  startedNearRef: boolean;
  isBoss: boolean;
}): number {
  const combo = Math.min(opts.streakBefore, 12) * 2;
  const speed =
    opts.speedRatio > 0.55 ? 8 : opts.speedRatio > 0.28 ? 4 : 0;
  const start = opts.startedNearRef ? 4 : 0;
  const boss = opts.isBoss ? 10 : 0;
  const raw = 28 + combo + speed + start + boss;
  return opts.fever ? raw * 2 : raw;
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(SCORE_HARD_MAX, Math.round(score)));
}

export { applyScoreGain, SCORE_SOFT_CAP, SCORE_HARD_MAX } from "@/lib/xp";

function orient(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function lineIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const den =
    (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(den) < 1e-9) return null;
  const t =
    ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };
}

/** Split a convex polygon with the infinite line through a,b. */
export function splitConvexByLine(
  poly: Point[],
  a: Point,
  b: Point,
): [Point[], Point[]] | null {
  const pos: Point[] = [];
  const neg: Point[] = [];
  const sgn = (p: Point) => {
    const v = orient(a, b, p);
    if (Math.abs(v) < 1e-7) return 0;
    return v > 0 ? 1 : -1;
  };
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const cur = poly[i]!;
    const nxt = poly[(i + 1) % n]!;
    const sc = sgn(cur);
    const sn = sgn(nxt);
    if (sc >= 0) pos.push(cur);
    if (sc <= 0) neg.push(cur);
    if (sc !== 0 && sn !== 0 && sc !== sn) {
      const hit = lineIntersection(cur, nxt, a, b);
      if (hit) {
        pos.push(hit);
        neg.push(hit);
      }
    }
  }
  if (pos.length < 3 || neg.length < 3) return null;
  return [pos, neg];
}

export function outwardLabel(
  verts: VertexMap,
  a: Point,
  b: Point,
  distOut = 7,
): Point {
  const c = centroid(verts);
  const m = midpoint(a, b);
  let nx = m.x - c.x;
  let ny = m.y - c.y;
  const len = Math.hypot(nx, ny) || 1;
  nx = (nx / len) * distOut;
  ny = (ny / len) * distOut;
  return { x: m.x + nx, y: m.y + ny };
}

export function polyString(pts: Point[]): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

export function trianglePoints(verts: VertexMap): Point[] {
  return [verts.A, verts.B, verts.C];
}

/** Right-angle square mark, in viewBox units. */
export function rightAngleMark(
  verts: VertexMap,
  rightAt: VertexId,
  size = 5,
): Point[] {
  const r = verts[rightAt];
  const others = VERTEX_IDS.filter((v) => v !== rightAt).map((id) => verts[id]);
  const u = others[0]!;
  const v = others[1]!;
  const du = { x: u.x - r.x, y: u.y - r.y };
  const dv = { x: v.x - r.x, y: v.y - r.y };
  const lu = Math.hypot(du.x, du.y) || 1;
  const lv = Math.hypot(dv.x, dv.y) || 1;
  const uu = { x: (du.x / lu) * size, y: (du.y / lu) * size };
  const vv = { x: (dv.x / lv) * size, y: (dv.y / lv) * size };
  return [
    { x: r.x + uu.x, y: r.y + uu.y },
    { x: r.x + uu.x + vv.x, y: r.y + uu.y + vv.y },
    { x: r.x + vv.x, y: r.y + vv.y },
  ];
}

/** Small arc near the reference acute angle. */
export function angleArc(
  verts: VertexMap,
  refAt: VertexId,
  radius = 8,
): string {
  const p = verts[refAt];
  const others = VERTEX_IDS.filter((v) => v !== refAt).map((id) => verts[id]);
  const a = others[0]!;
  const b = others[1]!;
  const da = { x: a.x - p.x, y: a.y - p.y };
  const db = { x: b.x - p.x, y: b.y - p.y };
  const la = Math.hypot(da.x, da.y) || 1;
  const lb = Math.hypot(db.x, db.y) || 1;
  const ua = { x: p.x + (da.x / la) * radius, y: p.y + (da.y / la) * radius };
  const ub = { x: p.x + (db.x / lb) * radius, y: p.y + (db.y / lb) * radius };
  const cross = da.x * db.y - da.y * db.x;
  // SVG Y-down: positive cross ⇒ clockwise from a→b ⇒ sweep=1 keeps center at the vertex.
  const sweep = cross > 0 ? 1 : 0;
  return `M ${ua.x.toFixed(2)} ${ua.y.toFixed(2)} A ${radius} ${radius} 0 0 ${sweep} ${ub.x.toFixed(2)} ${ub.y.toFixed(2)}`;
}

export type ResultKind = "hit" | "reverse" | "miss" | "timeout";

export type RoundLog = {
  i: number;
  mission: string;
  result: ResultKind;
  shape: ShapeKind;
  spin: boolean;
  boss: boolean;
};
