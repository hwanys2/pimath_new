import type { BoardPoint, Stroke } from "../board/types";
import type { PlotView } from "./graph-plot";
import { resolveAxisScale, safePlotView } from "./graph-plot";

export type GraphAnnotations = {
  strokes: Stroke[];
  points: BoardPoint[];
};

export const EMPTY_GRAPH_ANNOTATIONS: GraphAnnotations = {
  strokes: [],
  points: [],
};

/** Convert a pointer position inside a graph pane to 0–1 coordinates. */
export function clientToNormalized(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { nx: number; ny: number } {
  const w = Math.max(rect.width, 1);
  const h = Math.max(rect.height, 1);
  return {
    nx: Math.min(1, Math.max(0, (clientX - rect.left) / w)),
    ny: Math.min(1, Math.max(0, (clientY - rect.top) / h)),
  };
}

export function scaleNormalizedPoints(
  points: number[],
  width: number,
  height: number,
): number[] {
  const out = new Array(points.length);
  for (let i = 0; i < points.length; i += 2) {
    out[i] = points[i] * width;
    out[i + 1] = points[i + 1] * height;
  }
  return out;
}

export function normalizedToMath(
  nx: number,
  ny: number,
  view: PlotView,
): { x: number; y: number } {
  const v = safePlotView(view);
  return {
    x: v.xMin + nx * (v.xMax - v.xMin),
    y: v.yMax - ny * (v.yMax - v.yMin),
  };
}

export function mathToNormalized(
  x: number,
  y: number,
  view: PlotView,
): { nx: number; ny: number } {
  const v = safePlotView(view);
  const spanX = v.xMax - v.xMin;
  const spanY = v.yMax - v.yMin;
  return {
    nx: spanX === 0 ? 0.5 : (x - v.xMin) / spanX,
    ny: spanY === 0 ? 0.5 : (v.yMax - y) / spanY,
  };
}

function snapToScale(value: number, scale: number): number {
  const step = scale > 0 ? scale : 1;
  return Math.round(value / step) * step;
}

function gridStep(
  min: number,
  max: number,
  scale: number,
  pixelLength: number,
): number {
  if (pixelLength > 0) return resolveAxisScale(min, max, scale, pixelLength);
  return scale > 0 ? scale : 1;
}

/** Snap a pane location onto the graph's major grid (default: integers). */
export function snapNormalizedToGrid(
  nx: number,
  ny: number,
  view: PlotView,
  xScale = 1,
  yScale = 1,
  pixelW = 0,
  pixelH = 0,
): { nx: number; ny: number; mathX: number; mathY: number } {
  const v = safePlotView(view);
  const math = normalizedToMath(nx, ny, v);
  const mathX = snapToScale(math.x, gridStep(v.xMin, v.xMax, xScale, pixelW));
  const mathY = snapToScale(math.y, gridStep(v.yMin, v.yMax, yScale, pixelH));
  const n = mathToNormalized(mathX, mathY, v);
  return { nx: n.nx, ny: n.ny, mathX, mathY };
}

/** Hold this long to magnet-snap a graph point onto the visible grid. */
export const GRAPH_POINT_SNAP_HOLD_MS = 450;

/** Tap = free point. Long-press = snap to the graph grid. Never labels coords. */
export function placeGraphPoint(
  nx: number,
  ny: number,
  view: PlotView,
  xScale: number,
  yScale: number,
  holdMs: number,
  pixelW = 0,
  pixelH = 0,
): { nx: number; ny: number; snap: boolean } {
  if (holdMs >= GRAPH_POINT_SNAP_HOLD_MS) {
    const snapped = snapNormalizedToGrid(
      nx,
      ny,
      view,
      xScale,
      yScale,
      pixelW,
      pixelH,
    );
    return { nx: snapped.nx, ny: snapped.ny, snap: true };
  }
  return { nx, ny, snap: false };
}

export function formatGraphCoord(n: number): string {
  if (Math.abs(n) < 1e-9) return "0";
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return String(parseFloat(n.toFixed(2)));
}

export function applyGraphStroke(
  annotations: GraphAnnotations,
  stroke: Stroke,
  deletedPointIds?: string[],
): GraphAnnotations {
  const deleted = deletedPointIds?.length
    ? new Set(deletedPointIds)
    : null;
  return {
    strokes: [...annotations.strokes, stroke],
    points: deleted
      ? annotations.points.filter((p) => !deleted.has(p.id))
      : annotations.points,
  };
}

export function applyGraphPoint(
  annotations: GraphAnnotations,
  point: BoardPoint,
): GraphAnnotations {
  return {
    strokes: annotations.strokes,
    points: [...annotations.points, point],
  };
}
