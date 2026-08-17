/** Grid geometry helpers for the tangent-intro sketchpad. */

export const GRID_W = 16;
export const GRID_H = 18;
export const SNAP_RADIUS = 0.35;
export const POINT_EPS = 0.08;

export type Vec2 = { x: number; y: number };

export type SketchSeg = {
  id: string;
  a: Vec2;
  b: Vec2;
  measured?: boolean;
};

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function clampToGrid(p: Vec2): Vec2 {
  return {
    x: Math.min(GRID_W, Math.max(0, p.x)),
    y: Math.min(GRID_H, Math.max(0, p.y)),
  };
}

export function snapToGrid(p: Vec2): Vec2 {
  return {
    x: Math.min(GRID_W, Math.max(0, Math.round(p.x))),
    y: Math.min(GRID_H, Math.max(0, Math.round(p.y))),
  };
}

export function pointsNear(a: Vec2, b: Vec2, eps = POINT_EPS): boolean {
  return dist(a, b) <= eps;
}

export function projectOnSeg(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number; d: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) {
    return { point: { ...a }, t: 0, d: dist(p, a) };
  }
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point, t, d: dist(p, point) };
}

export function segLength(seg: SketchSeg): number {
  return dist(seg.a, seg.b);
}

export function formatLength(n: number): string {
  if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
  return n.toFixed(1);
}

/** Left endpoint when reading the segment left → right (smaller x, then smaller y). */
export function leftVertex(seg: SketchSeg): Vec2 {
  const { a, b } = seg;
  if (a.x < b.x - 1e-6) return a;
  if (b.x < a.x - 1e-6) return b;
  return a.y <= b.y ? a : b;
}

export function rightVertex(seg: SketchSeg): Vec2 {
  const { a, b } = seg;
  if (a.x > b.x + 1e-6) return a;
  if (b.x < a.x + 1e-6) return b;
  return a.y >= b.y ? a : b;
}

export function baseDirection(seg: SketchSeg): Vec2 {
  const l = leftVertex(seg);
  const r = rightVertex(seg);
  const dx = r.x - l.x;
  const dy = r.y - l.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-8) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

/** Elevation angle (0–180°) from base direction toward `target`, rounded to 1°. */
export function elevationDegFromBase(origin: Vec2, baseDir: Vec2, target: Vec2): number {
  const vx = target.x - origin.x;
  const vy = target.y - origin.y;
  const len = Math.hypot(vx, vy);
  if (len < 1e-6) return 0;
  const cross = baseDir.x * vy - baseDir.y * vx;
  const dot = baseDir.x * vx + baseDir.y * vy;
  let deg = (Math.atan2(cross, dot) * 180) / Math.PI;
  if (deg < 0) deg = -deg;
  return Math.min(180, Math.max(0, Math.round(deg)));
}

function lineRectHitsPositive(origin: Vec2, dir: Vec2): Vec2 | null {
  let bestT = Infinity;
  let best: Vec2 | null = null;
  const tryT = (t: number) => {
    if (t <= 1e-6 || t >= bestT) return;
    const q = { x: origin.x + t * dir.x, y: origin.y + t * dir.y };
    if (q.x >= -1e-6 && q.x <= GRID_W + 1e-6 && q.y >= -1e-6 && q.y <= GRID_H + 1e-6) {
      bestT = t;
      best = clampToGrid(q);
    }
  };
  if (Math.abs(dir.x) > 1e-8) {
    tryT((0 - origin.x) / dir.x);
    tryT((GRID_W - origin.x) / dir.x);
  }
  if (Math.abs(dir.y) > 1e-8) {
    tryT((0 - origin.y) / dir.y);
    tryT((GRID_H - origin.y) / dir.y);
  }
  return best;
}

/** Ray from origin at `angleDeg` above the base direction, clipped to the grid. */
export function rayEndpoint(
  origin: Vec2,
  baseDir: Vec2,
  angleDeg: number,
): Vec2 | null {
  const baseAng = Math.atan2(baseDir.y, baseDir.x);
  const rad = baseAng + (angleDeg * Math.PI) / 180;
  const dir = { x: Math.cos(rad), y: Math.sin(rad) };
  return lineRectHitsPositive(origin, dir);
}

function verticesOf(segs: SketchSeg[]): Vec2[] {
  const out: Vec2[] = [];
  for (const s of segs) {
    out.push(s.a, s.b);
  }
  return out;
}

/** Snap drawing point: vertices, then on-segment, then grid. */
export function snapPoint(
  p: Vec2,
  segs: SketchSeg[],
  excludeId?: string | null,
): Vec2 {
  const candidates: { point: Vec2; d: number }[] = [];
  for (const v of verticesOf(segs)) {
    const d = dist(p, v);
    if (d <= SNAP_RADIUS) candidates.push({ point: v, d });
  }
  for (const s of segs) {
    if (excludeId && s.id === excludeId) continue;
    const proj = projectOnSeg(p, s.a, s.b);
    if (proj.d <= SNAP_RADIUS) candidates.push({ point: proj.point, d: proj.d });
  }
  const grid = snapToGrid(p);
  candidates.push({ point: grid, d: dist(p, grid) });
  candidates.sort((a, b) => a.d - b.d);
  return clampToGrid(candidates[0]?.point ?? grid);
}

export function nearestSeg(
  p: Vec2,
  segs: SketchSeg[],
  maxDist = 0.45,
): SketchSeg | null {
  let best: SketchSeg | null = null;
  let bestD = maxDist;
  for (const s of segs) {
    const proj = projectOnSeg(p, s.a, s.b);
    if (proj.d < bestD) {
      bestD = proj.d;
      best = s;
    }
  }
  return best;
}

function lineRectHits(p: Vec2, dir: Vec2): Vec2[] {
  const hits: Vec2[] = [];
  const dx = dir.x;
  const dy = dir.y;
  const add = (t: number) => {
    const q = { x: p.x + t * dx, y: p.y + t * dy };
    if (q.x >= -1e-6 && q.x <= GRID_W + 1e-6 && q.y >= -1e-6 && q.y <= GRID_H + 1e-6) {
      hits.push(clampToGrid(q));
    }
  };
  if (Math.abs(dx) > 1e-8) {
    add((0 - p.x) / dx);
    add((GRID_W - p.x) / dx);
  }
  if (Math.abs(dy) > 1e-8) {
    add((0 - p.y) / dy);
    add((GRID_H - p.y) / dy);
  }
  return hits;
}

/** Infinite line through `foot`, perpendicular to `seg`, clipped to the grid. */
export function perpendicularThrough(foot: Vec2, seg: SketchSeg): { a: Vec2; b: Vec2 } | null {
  const dx = seg.b.x - seg.a.x;
  const dy = seg.b.y - seg.a.y;
  const dir = { x: -dy, y: dx };
  if (Math.hypot(dir.x, dir.y) < 1e-8) return null;
  const hits = lineRectHits(foot, dir);
  if (hits.length < 2) return null;
  let a = hits[0]!;
  let b = hits[1]!;
  let best = dist(a, b);
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      const d = dist(hits[i]!, hits[j]!);
      if (d > best) {
        best = d;
        a = hits[i]!;
        b = hits[j]!;
      }
    }
  }
  if (best < 0.4) return null;
  return { a, b };
}

export function nearEndpoint(p: Vec2, seg: SketchSeg, radius = 0.4): Vec2 | null {
  if (dist(p, seg.a) <= radius) return seg.a;
  if (dist(p, seg.b) <= radius) return seg.b;
  return null;
}

/** Proper segment intersection (excluding shared endpoints only). */
export function segmentIntersection(
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2,
): Vec2 | null {
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / denom;
  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
  return { x: a1.x + t * d1x, y: a1.y + t * d1y };
}

/** All distinct intersection points across segment pairs. */
export function allIntersections(segs: SketchSeg[]): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s1 = segs[i]!;
      const s2 = segs[j]!;
      const hit = segmentIntersection(s1.a, s1.b, s2.a, s2.b);
      if (!hit) continue;
      if (out.some((p) => pointsNear(p, hit))) continue;
      out.push(hit);
    }
  }
  return out;
}

/** Split points on a segment: endpoints + interior intersections with other segments. */
export function splitPointsOnSeg(seg: SketchSeg, allSegs: SketchSeg[]): Vec2[] {
  const pts: Vec2[] = [seg.a, seg.b];
  for (const other of allSegs) {
    if (other.id === seg.id) continue;
    const hit = segmentIntersection(seg.a, seg.b, other.a, other.b);
    if (!hit) continue;
    const t = projectOnSeg(hit, seg.a, seg.b).t;
    if (t <= POINT_EPS / Math.max(segLength(seg), 1) || t >= 1 - POINT_EPS / Math.max(segLength(seg), 1)) {
      continue;
    }
    if (!pts.some((p) => pointsNear(p, hit))) pts.push(hit);
  }
  pts.sort(
    (p, q) =>
      projectOnSeg(p, seg.a, seg.b).t - projectOnSeg(q, seg.a, seg.b).t,
  );
  return pts;
}

export function subSegments(seg: SketchSeg, allSegs: SketchSeg[]): { a: Vec2; b: Vec2 }[] {
  const pts = splitPointsOnSeg(seg, allSegs);
  const out: { a: Vec2; b: Vec2 }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (dist(a, b) >= 0.15) out.push({ a, b });
  }
  return out;
}
