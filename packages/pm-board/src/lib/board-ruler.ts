import type { OverlayPose } from "../board/types";

export const RULER_DEFAULT_LENGTH = 600;
export const RULER_H = 70;
export const RULER_UNIT = 40;
export const RULER_MIN_LENGTH = 200;
export const RULER_MAX_LENGTH = 1400;
export const RULER_EDGE_SNAP_PX = 20;

export function clampRulerLength(length: number): number {
  return Math.min(
    RULER_MAX_LENGTH,
    Math.max(RULER_MIN_LENGTH, Math.round(length)),
  );
}

export function rulerLength(pose: OverlayPose): number {
  return clampRulerLength(pose.length ?? RULER_DEFAULT_LENGTH);
}

/**
 * Top long edge (tick-mark side) in screen coordinates — the edge
 * students draw along when "using" the ruler.
 */
export function rulerTopEdge(pose: OverlayPose): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  const L = rulerLength(pose);
  const a = (pose.angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const localY = -RULER_H / 2;
  const lx = -L / 2;
  const rx = L / 2;
  return {
    x0: pose.x + lx * cos - localY * sin,
    y0: pose.y + lx * sin + localY * cos,
    x1: pose.x + rx * cos - localY * sin,
    y1: pose.y + rx * sin + localY * cos,
  };
}

/** Project (x,y) onto the ruler top edge; null if farther than radius. */
export function snapToRulerEdge(
  x: number,
  y: number,
  pose: OverlayPose,
  radius = RULER_EDGE_SNAP_PX,
): { x: number; y: number; d: number } | null {
  const { x0, y0, x1, y1 } = rulerTopEdge(pose);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-4) return null;
  let t = ((x - x0) * dx + (y - y0) * dy) / len2;
  t = Math.min(1, Math.max(0, t));
  const px = x0 + t * dx;
  const py = y0 + t * dy;
  const d = Math.hypot(x - px, y - py);
  if (d > radius) return null;
  return { x: px, y: py, d };
}
