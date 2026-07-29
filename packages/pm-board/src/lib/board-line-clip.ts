/** Clip infinite line through (x0,y0)-(x1,y1) to viewport [0,w]×[0,h]. */
import type { LineKind } from "../board/types";

export function clipLineToViewport(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  h: number,
  mode: "segment" | "ray" | "infinite",
): { x0: number; y0: number; x1: number; y1: number } {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    return { x0, y0, x1, y1 };
  }

  const ux = dx / len;
  const uy = dy / len;
  const pad = Math.max(w, h) * 2;

  let ax: number;
  let ay: number;
  let bx: number;
  let by: number;

  if (mode === "segment") {
    ax = x0;
    ay = y0;
    bx = x1;
    by = y1;
  } else if (mode === "ray") {
    ax = x0;
    ay = y0;
    bx = x0 + ux * pad;
    by = y0 + uy * pad;
  } else {
    ax = x0 - ux * pad;
    ay = y0 - uy * pad;
    bx = x0 + ux * pad;
    by = y0 + uy * pad;
  }

  const clipped = liangBarsky(ax, ay, bx, by, 0, 0, w, h);
  if (!clipped) {
    return { x0: ax, y0: ay, x1: bx, y1: by };
  }
  return clipped;
}

function liangBarsky(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  xmin: number,
  ymin: number,
  xmax: number,
  ymax: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;

  const edges = [
    { p: -dx, q: x0 - xmin },
    { p: dx, q: xmax - x0 },
    { p: -dy, q: y0 - ymin },
    { p: dy, q: ymax - y0 },
  ];

  for (const { p, q } of edges) {
    if (Math.abs(p) < 1e-10) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }

  return {
    x0: x0 + t0 * dx,
    y0: y0 + t0 * dy,
    x1: x0 + t1 * dx,
    y1: y0 + t1 * dy,
  };
}

export function effectiveLineKind(
  tool: string,
  lineKind?: LineKind,
): LineKind {
  if (tool === "arrow") return "ray";
  if (lineKind) return lineKind;
  return "segment";
}
