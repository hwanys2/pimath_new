import type { Stroke } from "../board/types";
import { strokeWidth } from "./board-canvas-draw";

export type BoardRect = { x0: number; y0: number; x1: number; y1: number };

export function normalizeRect(r: BoardRect): BoardRect {
  return {
    x0: Math.min(r.x0, r.x1),
    y0: Math.min(r.y0, r.y1),
    x1: Math.max(r.x0, r.x1),
    y1: Math.max(r.y0, r.y1),
  };
}

function rectsOverlap(a: BoardRect, b: BoardRect): boolean {
  return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
}

export function strokeBounds(s: Stroke): BoardRect | null {
  const p = s.points;
  if (p.length < 2) return null;
  const pad = strokeWidth(s.tool, s.size) / 2 + 2;

  if (s.tool === "arc") {
    const [cx, cy, r] = p;
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r))
      return null;
    return {
      x0: cx - r - pad,
      y0: cy - r - pad,
      x1: cx + r + pad,
      y1: cy + r + pad,
    };
  }

  if (
    s.tool === "pen" ||
    s.tool === "highlighter" ||
    s.tool === "eraser"
  ) {
    let x0 = p[0];
    let y0 = p[1];
    let x1 = p[0];
    let y1 = p[1];
    for (let i = 0; i < p.length; i += 2) {
      x0 = Math.min(x0, p[i]);
      x1 = Math.max(x1, p[i]);
      y0 = Math.min(y0, p[i + 1]);
      y1 = Math.max(y1, p[i + 1]);
    }
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }

  const x0 = Math.min(p[0], p[p.length - 2]);
  const x1 = Math.max(p[0], p[p.length - 2]);
  const y0 = Math.min(p[1], p[p.length - 1]);
  const y1 = Math.max(p[1], p[p.length - 1]);
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

export function strokeIndicesInRect(
  strokes: Stroke[],
  rect: BoardRect,
): number[] {
  const sel = normalizeRect(rect);
  const out: number[] = [];
  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i];
    if (s.tool === "eraser") continue;
    const b = strokeBounds(s);
    if (b && rectsOverlap(sel, b)) out.push(i);
  }
  return out;
}
