/** Circle, downward-angle, and point-to-line perpendicular helpers for sincos sketchpad. */

import {
  dist,
  perpendicularThrough,
  rayEndpoint,
  SNAP_RADIUS,
  snapPoint,
  type SketchSeg,
  type Vec2,
} from "@/lib/inquiry-tangent-sketch";

export type HypCircle = {
  center: Vec2;
  radius: number;
};

export function hypCircleFromSeg(seg: SketchSeg): HypCircle {
  return { center: { ...seg.a }, radius: dist(seg.a, seg.b) };
}

export function distToCircle(p: Vec2, circle: HypCircle): number {
  return Math.abs(dist(p, circle.center) - circle.radius);
}

export function projectOnCircle(p: Vec2, circle: HypCircle): Vec2 {
  const dx = p.x - circle.center.x;
  const dy = p.y - circle.center.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-8) {
    return { x: circle.center.x + circle.radius, y: circle.center.y };
  }
  return {
    x: circle.center.x + (dx / len) * circle.radius,
    y: circle.center.y + (dy / len) * circle.radius,
  };
}

/** +1 = below is counterclockwise from baseDir, -1 = clockwise. */
export function belowSign(baseDir: Vec2): 1 | -1 {
  const ccw = { x: -baseDir.y, y: baseDir.x };
  const cw = { x: baseDir.y, y: -baseDir.x };
  if (Math.abs(ccw.y - cw.y) > 1e-8) {
    return ccw.y < cw.y ? 1 : -1;
  }
  return ccw.x > cw.x ? 1 : -1;
}

/** Angle 0–180° from baseDir toward the ground (below) side, rounded to 1°. */
export function belowDegFromBase(
  origin: Vec2,
  baseDir: Vec2,
  target: Vec2,
): number {
  const vx = target.x - origin.x;
  const vy = target.y - origin.y;
  const len = Math.hypot(vx, vy);
  if (len < 1e-6) return 0;
  const cross = baseDir.x * vy - baseDir.y * vx;
  const dot = baseDir.x * vx + baseDir.y * vy;
  const ccw = (Math.atan2(cross, dot) * 180) / Math.PI;
  const deg = belowSign(baseDir) * ccw;
  if (deg < 0) return 0;
  return Math.min(180, Math.max(0, Math.round(deg)));
}

export function belowRayEndpoint(
  origin: Vec2,
  baseDir: Vec2,
  angleDeg: number,
): Vec2 | null {
  return rayEndpoint(origin, baseDir, belowSign(baseDir) * angleDeg);
}

export function belowDialPoint(
  origin: Vec2,
  baseDir: Vec2,
  deg: number,
  radius: number,
): Vec2 {
  const baseAng = Math.atan2(baseDir.y, baseDir.x);
  const rad = baseAng + belowSign(baseDir) * ((deg * Math.PI) / 180);
  return {
    x: origin.x + radius * Math.cos(rad),
    y: origin.y + radius * Math.sin(rad),
  };
}

/** Unclamped projection onto the infinite line through a–b. */
export function projectOnLine(
  p: Vec2,
  a: Vec2,
  b: Vec2,
): { point: Vec2; t: number; d: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) {
    return { point: { ...a }, t: 0, d: dist(p, a) };
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point, t, d: dist(p, point) };
}

export function perpFromPointToLine(
  p: Vec2,
  seg: SketchSeg,
): { a: Vec2; b: Vec2 } | null {
  const foot = projectOnLine(p, seg.a, seg.b).point;
  return perpendicularThrough(foot, seg);
}

export function nearestVertex(
  p: Vec2,
  segs: SketchSeg[],
  maxDist = 0.45,
): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = maxDist;
  for (const s of segs) {
    for (const v of [s.a, s.b]) {
      const d = dist(p, v);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
  }
  return best;
}

/** Snap: vertices / segments / circle / grid. */
export function snapPointWithCircle(
  p: Vec2,
  segs: SketchSeg[],
  circle: HypCircle | null,
  excludeId?: string | null,
): Vec2 {
  const base = snapPoint(p, segs, excludeId);
  if (!circle || circle.radius < 0.2) return base;
  const onCircle = projectOnCircle(p, circle);
  const dCircle = dist(p, onCircle);
  const dBase = dist(p, base);
  if (dCircle <= SNAP_RADIUS && dCircle <= dBase) return onCircle;
  return base;
}

export function originOnSeg(
  seg: SketchSeg,
  pointer: Vec2,
  hypSegId: string | null,
): { origin: Vec2; baseDir: Vec2 } {
  const useCenter = hypSegId != null && seg.id === hypSegId;
  const origin = useCenter
    ? seg.a
    : dist(pointer, seg.a) <= dist(pointer, seg.b)
      ? seg.a
      : seg.b;
  const other = origin === seg.a || (origin.x === seg.a.x && origin.y === seg.a.y)
    ? seg.b
    : seg.a;
  const dx = other.x - origin.x;
  const dy = other.y - origin.y;
  const len = Math.hypot(dx, dy);
  const baseDir =
    len < 1e-8 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
  return { origin, baseDir };
}
