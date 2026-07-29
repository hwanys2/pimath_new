import type { BackgroundId, Stroke } from "../board/types";
import { drawStrokeOn } from "./board-canvas-draw";
import { normalizeRect, type BoardRect } from "./board-stroke-bounds";

const PADDING = 24;
const MIN_EXPORT = 120;

function rasterBackgroundColor(background: BackgroundId): string {
  return background === "chalkboard" ? "#2a5142" : "#fcfcf8";
}

/** Rasterize selected strokes in a screen rect for Mathpix OCR. */
export function strokesToMathImageDataUrl(
  strokes: Stroke[],
  indices: number[],
  rect: BoardRect,
  background: BackgroundId,
): string | null {
  const sel = normalizeRect(rect);
  const w = Math.max(sel.x1 - sel.x0 + PADDING * 2, MIN_EXPORT);
  const h = Math.max(sel.y1 - sel.y0 + PADDING * 2, MIN_EXPORT);
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = rasterBackgroundColor(background);
  ctx.fillRect(0, 0, w, h);

  const ox = PADDING - sel.x0;
  const oy = PADDING - sel.y0;

  for (const i of indices) {
    const s = strokes[i];
    const shifted: Stroke = {
      ...s,
      points: shiftPoints(s, ox, oy),
    };
    if (s.tool === "arc") {
      drawStrokeOn(ctx, shifted);
    } else {
      drawStrokeOn(ctx, shifted);
    }
  }

  return canvas.toDataURL("image/png");
}

function shiftPoints(s: Stroke, ox: number, oy: number): number[] {
  const p = s.points;
  if (s.tool === "arc") {
    return [p[0] + ox, p[1] + oy, p[2], p[3], p[4]];
  }
  const out: number[] = [];
  for (let i = 0; i < p.length; i += 2) {
    out.push(p[i] + ox, p[i + 1] + oy);
  }
  return out;
}
