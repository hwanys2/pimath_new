"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DrawTool, Stroke, ToolId } from "./types";

function strokeWidth(tool: DrawTool, size: number): number {
  if (tool === "highlighter") return size * 4;
  if (tool === "eraser") return size * 7;
  return size;
}

function drawStrokeOn(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = strokeWidth(s.tool, s.size);
  ctx.strokeStyle = s.color;
  if (s.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else if (s.tool === "highlighter") {
    ctx.globalAlpha = 0.35;
  }

  const p = s.points;
  ctx.beginPath();
  if (s.tool === "pen" || s.tool === "highlighter" || s.tool === "eraser") {
    if (p.length < 4) {
      // A dot
      ctx.beginPath();
      ctx.fillStyle = ctx.strokeStyle as string;
      ctx.arc(p[0], p[1], ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2;
      const my = (p[i + 1] + p[i + 3]) / 2;
      ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
    }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
    ctx.stroke();
  } else {
    const [x0, y0, x1, y1] = [p[0], p[1], p[p.length - 2], p[p.length - 1]];
    if (s.tool === "line" || s.tool === "arrow") {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (s.tool === "arrow") {
        const angle = Math.atan2(y1 - y0, x1 - x0);
        const head = Math.max(14, s.size * 4);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(
          x1 - head * Math.cos(angle - Math.PI / 6),
          y1 - head * Math.sin(angle - Math.PI / 6),
        );
        ctx.moveTo(x1, y1);
        ctx.lineTo(
          x1 - head * Math.cos(angle + Math.PI / 6),
          y1 - head * Math.sin(angle + Math.PI / 6),
        );
        ctx.stroke();
      }
    } else if (s.tool === "rect") {
      ctx.strokeRect(
        Math.min(x0, x1),
        Math.min(y0, y1),
        Math.abs(x1 - x0),
        Math.abs(y1 - y0),
      );
    } else if (s.tool === "ellipse") {
      ctx.ellipse(
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        Math.abs(x1 - x0) / 2,
        Math.abs(y1 - y0) / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

type Props = {
  tool: ToolId;
  color: string;
  size: number;
  strokes: Stroke[];
  onCommit: (s: Stroke) => void;
};

export default function DrawingCanvas({
  tool,
  color,
  size,
  strokes,
  onCommit,
}: Props) {
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const currentRef = useRef<{ tool: DrawTool; points: number[] } | null>(null);
  const active = tool !== "cursor";

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
