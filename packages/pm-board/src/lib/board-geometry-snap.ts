import type { BoardPoint, CompassPose, Stroke } from "../board/types";

export const SNAP_RADIUS_PX = 14;

export type SnapTarget = { x: number; y: number };

function dist(x0: number, y0: number, x1: number, y1: number) {
  return Math.hypot(x1 - x0, y1 - y0);
}

function pushTarget(targets: SnapTarget[], x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  targets.push({ x, y });
}

/** Nearest snap target within radius, else original coordinates. */
export function snapClientPoint(
  x: number,
  y: number,
  targets: SnapTarget[],
  radius = SNAP_RADIUS_PX,
): { x: number; y: number; snapped: boolean } {
  let bestX = x;
  let bestY = y;
  let bestD = radius;

  for (const t of targets) {
    const d = dist(x, y, t.x, t.y);
    if (d < bestD) {
      bestD = d;
      bestX = t.x;
      bestY = t.y;
    }
  }

  return { x: bestX, y: bestY, snapped: bestD < radius };
}

function snapToLines(
  x: number,
  y: number,
  strokes: Stroke[],
  radius: number,
): { x: number; y: number; d: number } {
  let bestX = x;
  let bestY = y;
  let bestD = radius;

  for (const s of strokes) {
    if (s.tool !== "line" && s.tool !== "arrow") continue;
    const p = s.points;
    if (p.length < 4) continue;
    const x0 = p[0];
    const y0 = p[1];
    const x1 = p[p.length - 2];
    const y1 = p[p.length - 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-4) continue;
    const t = ((x - x0) * dx + (y - y0) * dy) / len2;
    const px = x0 + t * dx;
    const py = y0 + t * dy;
    const perp = dist(x, y, px, py);
    if (perp < bestD) {
      bestD = perp;
      bestX = px;
      bestY = py;
    }
  }

  return { x: bestX, y: bestY, d: bestD };
}

function snapToArcs(
  x: number,
  y: number,
  strokes: Stroke[],
  radius: number,
): { x: number; y: number; d: number } {
  let bestX = x;
  let bestY = y;
  let bestD = radius;

  for (const s of strokes) {
    if (s.tool !== "arc") continue;
    const [cx, cy, r, a0, a1] = s.points;
    if (!(r > 0)) continue;
    const dCenter = dist(x, y, cx, cy);
    const onCircle = Math.abs(dCenter - r);
    if (onCircle < bestD) {
      const ang = Math.atan2(y - cy, x - cx);
      bestD = onCircle;
      bestX = cx + r * Math.cos(ang);
      bestY = cy + r * Math.sin(ang);
    }
    const ex0 = cx + r * Math.cos(a0);
    const ey0 = cy + r * Math.sin(a0);
    const ex1 = cx + r * Math.cos(a1);
    const ey1 = cy + r * Math.sin(a1);
    for (const [px, py] of [
      [ex0, ey0],
      [ex1, ey1],
    ] as const) {
      const d = dist(x, y, px, py);
      if (d < bestD) {
        bestD = d;
        bestX = px;
        bestY = py;
      }
    }
  }

  return { x: bestX, y: bestY, d: bestD };
}

export function collectSnapTargets(opts: {
  strokes: Stroke[];
  points: BoardPoint[];
  compass?: CompassPose | null;
  /** Skip compass center when dragging the compass itself */
  skipCompassCenter?: boolean;
}): SnapTarget[] {
  const targets: SnapTarget[] = [];
  const { strokes, points, compass } = opts;

  for (const pt of points) {
    pushTarget(targets, pt.x, pt.y);
  }

  for (const s of strokes) {
    if (s.tool === "line" || s.tool === "arrow") {
      const p = s.points;
      if (p.length >= 4) {
        pushTarget(targets, p[0], p[1]);
        pushTarget(targets, p[p.length - 2], p[p.length - 1]);
      }
    }
    if (s.tool === "arc") {
      const [cx, cy, r, a0, a1] = s.points;
      pushTarget(targets, cx, cy);
      if (r > 0) {
        pushTarget(targets, cx + r * Math.cos(a0), cy + r * Math.sin(a0));
        pushTarget(targets, cx + r * Math.cos(a1), cy + r * Math.sin(a1));
      }
    }
  }

  if (compass) {
    if (!opts.skipCompassCenter) {
      pushTarget(targets, compass.cx, compass.cy);
    }
    const tipX = compass.cx + compass.radius * Math.cos((compass.angle * Math.PI) / 180);
    const tipY = compass.cy + compass.radius * Math.sin((compass.angle * Math.PI) / 180);
    pushTarget(targets, tipX, tipY);
  }

  return targets;
}

/** Full snap: vertices + line/arc geometry. */
export function snapBoardPoint(
  x: number,
  y: number,
  opts: Parameters<typeof collectSnapTargets>[0],
  radius = SNAP_RADIUS_PX,
): { x: number; y: number; snapped: boolean } {
  const targets = collectSnapTargets(opts);
  const vertex = snapClientPoint(x, y, targets, radius);
  const line = snapToLines(x, y, opts.strokes, radius);
  const arc = snapToArcs(x, y, opts.strokes, radius);

  let bestX = x;
  let bestY = y;
  let bestD = radius;
  let snapped = false;

  if (vertex.snapped) {
    bestX = vertex.x;
    bestY = vertex.y;
    bestD = 0;
    snapped = true;
  }
  if (line.d < bestD) {
    bestX = line.x;
    bestY = line.y;
    bestD = line.d;
    snapped = true;
  }
  if (arc.d < bestD) {
    bestX = arc.x;
    bestY = arc.y;
    snapped = true;
  }

  return { x: Math.round(bestX), y: Math.round(bestY), snapped };
}
