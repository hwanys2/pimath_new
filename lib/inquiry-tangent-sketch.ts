/** Grid geometry helpers for the tangent-intro sketchpad. */

export const GRID_W = 16;
export const GRID_H = 18;
export const SNAP_RADIUS = 0.35;

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
