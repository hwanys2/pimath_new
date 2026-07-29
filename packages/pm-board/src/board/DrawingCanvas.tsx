"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DrawTool, Stroke, ToolId } from "./types";
import { drawStrokeOn, strokeWidth } from "../lib/board-canvas-draw";
type Props = {
  tool: ToolId;
  color: string;
  size: number;
  strokes: Stroke[];
  disabled?: boolean;
  onCommit: (s: Stroke) => void;
};

export default function DrawingCanvas({
  tool,
  color,
  size,
  strokes,
  disabled = false,
  onCommit,
}: Props) {
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const currentRef = useRef<{ tool: DrawTool; points: number[] } | null>(null);
  const active = tool !== "cursor" && !disabled;

  const redrawCommitted = useCallback(() => {
    const canvas = committedRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    for (const s of strokes) drawStrokeOn(ctx, s);
  }, [strokes]);

  // Size canvases to the viewport (with devicePixelRatio) and redraw.
  useEffect(() => {
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      for (const canvas of [committedRef.current, liveRef.current]) {
        if (!canvas) continue;
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }
      }
      redrawCommitted();
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [redrawCommitted]);

  useEffect(() => {
    redrawCommitted();
  }, [redrawCommitted]);

  const getCtx = (canvas: HTMLCanvasElement | null) => {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return null;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  };

  const clearLive = useCallback(() => {
    const canvas = liveRef.current;
    const ctx = getCtx(canvas);
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!active || e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    currentRef.current = {
      tool: tool as DrawTool,
      points: [Math.round(e.clientX), Math.round(e.clientY)],
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const cur = currentRef.current;
    if (!cur) return;
    const x = Math.round(e.clientX);
    const y = Math.round(e.clientY);
    const pts = cur.points;
    const lastX = pts[pts.length - 2];
    const lastY = pts[pts.length - 1];

    const isFreehand =
      cur.tool === "pen" || cur.tool === "highlighter" || cur.tool === "eraser";

    if (isFreehand) {
      if (Math.hypot(x - lastX, y - lastY) < 2) return;
      pts.push(x, y);
      if (cur.tool === "eraser") {
        // Erase committed content directly for live feedback.
        const ctx = getCtx(committedRef.current);
        if (ctx) {
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.lineCap = "round";
          ctx.lineWidth = strokeWidth("eraser", size);
          ctx.beginPath();
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        clearLive();
        const ctx = getCtx(liveRef.current);
        if (ctx)
          drawStrokeOn(ctx, { tool: cur.tool, color, size, points: pts });
      }
    } else {
      // Shape preview: keep only start + current point.
      cur.points = [pts[0], pts[1], x, y];
      clearLive();
      const ctx = getCtx(liveRef.current);
      if (ctx)
        drawStrokeOn(ctx, { tool: cur.tool, color, size, points: cur.points });
    }
  };

  const onPointerUp = () => {
    const cur = currentRef.current;
    if (!cur) return;
    currentRef.current = null;
    clearLive();
    onCommit({ tool: cur.tool, color, size, points: cur.points });
  };

  return (
    <div
      className={`absolute inset-0 ${active ? "pointer-events-auto touch-none" : "pointer-events-none"}`}
      style={{ cursor: active ? "crosshair" : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={committedRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={liveRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
