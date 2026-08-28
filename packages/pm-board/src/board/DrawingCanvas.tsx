"use client";

import { useCallback, useEffect, useRef } from "react";
import type { BoardPoint, DrawTool, LineKind, Stroke, ToolId } from "./types";
import { drawStrokeOn, strokeWidth } from "../lib/board-canvas-draw";
import { boardPointIdsHitByEraser } from "../lib/board-point-erase";
import { isPalmPointer } from "../lib/board-palm-eraser";
import { capturePointer, isPrimaryDrawPointer } from "../lib/board-pointer";

export type SnapFn = (x: number, y: number) => { x: number; y: number };

type Props = {
  tool: ToolId;
  color: string;
  size: number;
  eraserSize: number;
  pointSize: number;
  boardPoints: BoardPoint[];
  lineKind: LineKind;
  strokes: Stroke[];
  disabled?: boolean;
  snap?: SnapFn;
  onCommit: (s: Stroke, deletedPointIds?: string[]) => void;
  onEraserPreview?: (ids: string[]) => void;
};

type ActiveStroke = {
  tool: DrawTool;
  size: number;
  points: number[];
  lineKind?: LineKind;
  pointerId: number;
};

export default function DrawingCanvas({
  tool,
  color,
  size,
  eraserSize,
  pointSize,
  boardPoints,
  lineKind,
  strokes,
  disabled = false,
  snap,
  onCommit,
  onEraserPreview,
}: Props) {
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const currentRef = useRef<ActiveStroke | null>(null);
  const eraserPointIdsRef = useRef<Set<string>>(new Set());
  const snapRef = useRef(snap);
  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);
  const active =
    tool !== "cursor" && tool !== "point" && !disabled;

  const view = () => {
    const wrap = committedRef.current?.parentElement;
    return {
      w: wrap?.clientWidth || window.innerWidth,
      h: wrap?.clientHeight || window.innerHeight,
    };
  };

  const redrawCommitted = useCallback(() => {
    const canvas = committedRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    const v = view();
    for (const s of strokes) drawStrokeOn(ctx, s, v);
  }, [strokes]);

  useEffect(() => {
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const wrap = committedRef.current?.parentElement;
      const w = wrap?.clientWidth || window.innerWidth;
      const h = wrap?.clientHeight || window.innerHeight;
      for (const canvas of [committedRef.current, liveRef.current]) {
        if (!canvas) continue;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
      }
      redrawCommitted();
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
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

  const applySnap = (x: number, y: number, drawTool?: DrawTool) => {
    if (drawTool === "eraser") return { x, y };
    const fn = snapRef.current;
    if (!fn) return { x, y };
    return fn(x, y);
  };

  const resolveStrokeTool = (e: React.PointerEvent): ActiveStroke["tool"] => {
    if (isPalmPointer(e.nativeEvent)) return "eraser";
    return tool as DrawTool;
  };

  const resolveStrokeSize = (drawTool: DrawTool) => {
    if (drawTool === "eraser") return eraserSize;
    return size;
  };

  const collectEraserHits = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    erSize: number,
  ) => {
    const hits = boardPointIdsHitByEraser(
      boardPoints,
      pointSize,
      erSize,
      x0,
      y0,
      x1,
      y1,
      eraserPointIdsRef.current,
    );
    if (hits.length === 0) return;
    for (const id of hits) eraserPointIdsRef.current.add(id);
    onEraserPreview?.([...eraserPointIdsRef.current]);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!active || !isPrimaryDrawPointer(e)) return;
    e.preventDefault();
    capturePointer(e.currentTarget, e.pointerId);
    const drawTool = resolveStrokeTool(e);
    const { x, y } = applySnap(
      Math.round(e.clientX),
      Math.round(e.clientY),
      drawTool,
    );
    eraserPointIdsRef.current = new Set();
    if (drawTool === "eraser") {
      collectEraserHits(x, y, x, y, resolveStrokeSize(drawTool));
    }
    currentRef.current = {
      tool: drawTool,
      size: resolveStrokeSize(drawTool),
      points: [x, y],
      lineKind: drawTool === "line" ? lineKind : undefined,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const cur = currentRef.current;
    if (!cur || cur.pointerId !== e.pointerId) return;
    const snapped = applySnap(
      Math.round(e.clientX),
      Math.round(e.clientY),
      cur.tool,
    );
    const x = snapped.x;
    const y = snapped.y;
    const pts = cur.points;
    const lastX = pts[pts.length - 2];
    const lastY = pts[pts.length - 1];

    const isFreehand =
      cur.tool === "pen" || cur.tool === "highlighter" || cur.tool === "eraser";

    if (isFreehand) {
      if (Math.hypot(x - lastX, y - lastY) < 2) return;
      pts.push(x, y);
      if (cur.tool === "eraser") {
        collectEraserHits(lastX, lastY, x, y, cur.size);
        const ctx = getCtx(committedRef.current);
        if (ctx) {
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.lineCap = "round";
          ctx.lineWidth = strokeWidth("eraser", cur.size);
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
          drawStrokeOn(
            ctx,
            { tool: cur.tool, color, size: cur.size, points: pts },
            view(),
          );
      }
    } else {
      cur.points = [pts[0], pts[1], x, y];
      clearLive();
      const ctx = getCtx(liveRef.current);
      if (ctx)
        drawStrokeOn(
          ctx,
          {
            tool: cur.tool,
            color,
            size: cur.size,
            points: cur.points,
            lineKind: cur.lineKind,
          },
          view(),
        );
    }
  };

  const onPointerUp = (e?: React.PointerEvent) => {
    const cur = currentRef.current;
    if (!cur) return;
    if (e && cur.pointerId !== e.pointerId) return;
    currentRef.current = null;
    clearLive();
    let points = cur.points;
    if (
      cur.tool === "line" ||
      cur.tool === "arrow" ||
      cur.tool === "rect" ||
      cur.tool === "ellipse"
    ) {
      const snapped = applySnap(
        points[points.length - 2],
        points[points.length - 1],
        cur.tool,
      );
      points = [points[0], points[1], snapped.x, snapped.y];
    }
    const stroke: Stroke = {
      tool: cur.tool,
      color,
      size: cur.size,
      points,
    };
    if (cur.tool === "line" && cur.lineKind) {
      stroke.lineKind = cur.lineKind;
    }
    const deletedPointIds =
      cur.tool === "eraser" && eraserPointIdsRef.current.size > 0
        ? [...eraserPointIdsRef.current]
        : undefined;
    eraserPointIdsRef.current = new Set();
    onEraserPreview?.([]);
    onCommit(stroke, deletedPointIds);
  };

  return (
    <div
      className={`absolute inset-0 ${active ? "pointer-events-auto touch-none" : "pointer-events-none"}`}
      style={{ cursor: active ? "crosshair" : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
    >
      <canvas ref={committedRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={liveRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
