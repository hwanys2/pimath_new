import type { BoardPoint } from "../board/types";
import { strokeWidth } from "./board-canvas-draw";

function distPointToSegment(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(px - x0, py - y0);
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lenSq));
  const cx = x0 + t * dx;
  const cy = y0 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Board points whose center lies within eraser reach of a segment or dot. */
export function boardPointIdsHitByEraser(
  points: BoardPoint[],
  defaultRadius: number,
  eraserSize: number,
  x0: number,
  y0: number,
  x1?: number,
  y1?: number,
  excludeIds?: ReadonlySet<string>,
): string[] {
  const eraserR = strokeWidth("eraser", eraserSize) / 2;
  const ex1 = x1 ?? x0;
  const ey1 = y1 ?? y0;
  const out: string[] = [];
  for (const pt of points) {
    if (excludeIds?.has(pt.id)) continue;
    const pr = pt.r ?? defaultRadius;
    const d = distPointToSegment(pt.x, pt.y, x0, y0, ex1, ey1);
    if (d <= eraserR + pr) out.push(pt.id);
  }
  return out;
}
