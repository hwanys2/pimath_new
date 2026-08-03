import type { Vec2 } from "./types";

/** Segment intersection excluding shared endpoints tolerance. */
function segmentsProperlyCross(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const cross = (p: Vec2, q: Vec2, r: Vec2) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const c1 = cross(a1, a2, b1);
  const c2 = cross(a1, a2, b2);
  const c3 = cross(b1, b2, a1);
  const c4 = cross(b1, b2, a2);
  if (Math.abs(c1) < 1e-6 && Math.abs(c2) < 1e-6) return false;
  if (
    ((c1 > 1e-6 && c2 < -1e-6) || (c1 < -1e-6 && c2 > 1e-6)) &&
    ((c3 > 1e-6 && c4 < -1e-6) || (c3 < -1e-6 && c4 > 1e-6))
  ) {
    return true;
  }
  return false;
}

function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function projectAxis(axis: Vec2, poly: Vec2[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const proj = p.x * axis.x + p.y * axis.y;
    min = Math.min(min, proj);
    max = Math.max(max, proj);
  }
  return [min, max];
}

function axesForPolygon(poly: Vec2[]): Vec2[] {
  const axes: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    axes.push({ x: -dy / len, y: dx / len });
  }
  return axes;
}

/** SAT overlap test for two convex polygons. */
export function convexPolygonsOverlap(a: Vec2[], b: Vec2[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  for (const axis of [...axesForPolygon(a), ...axesForPolygon(b)]) {
    const [minA, maxA] = projectAxis(axis, a);
    const [minB, maxB] = projectAxis(axis, b);
    if (maxA < minB - 1e-4 || maxB < minA - 1e-4) return false;
  }
  return true;
}

function pointStrictlyInside(p: Vec2, poly: Vec2[]): boolean {
  if (!pointInPolygon(p, poly)) return false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (pointToSegmentDistance(p, a, b) < 1.5) return false;
  }
  return true;
}

/** True if polygons overlap with positive area (shared edges alone are OK). */
export function polygonsHaveAreaOverlap(a: Vec2[], b: Vec2[]): boolean {
  for (const p of a) {
    if (pointStrictlyInside(p, b)) return true;
  }
  for (const p of b) {
    if (pointStrictlyInside(p, a)) return true;
  }
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (segmentsProperlyCross(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

export function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}
