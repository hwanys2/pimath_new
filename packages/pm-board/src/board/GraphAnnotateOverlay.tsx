"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BoardPoint, Stroke } from "./types";
import type { PlotView } from "../lib/graph-plot";
import { drawStrokeOn } from "../lib/board-canvas-draw";
import { boardPointIdsHitByEraser } from "../lib/board-point-erase";
import {
  applyGraphPoint,
  applyGraphStroke,
  clientToNormalized,
  EMPTY_GRAPH_ANNOTATIONS,
  formatGraphCoord,
  type GraphAnnotations,
  normalizedToMath,
  scaleNormalizedPoints,
  snapNormalizedToGrid,
} from "../lib/graph-annotate";
import GraphDrawToolbar, { type GraphDrawTool } from "./GraphDrawToolbar";

function nid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

type LiveStroke = {
  tool: Exclude<GraphDrawTool, "cursor" | "point">;
  size: number;
  points: number[];
};

function liveToStroke(
  live: LiveStroke,
  color: string,
  width: number,
  height: number,
): Stroke | null {
  const p = live.points;
  if (p.length < 2) return null;
  const pts: number[] = [];
  for (let i = 0; i < p.length; i += 2) {
    pts.push(p[i] / Math.max(width, 1), p[i + 1] / Math.max(height, 1));
  }
  if (live.tool === "line") {
    if (p.length < 4) return null;
    return {
      tool: "line",
      color,
      size: live.size,
      points: [pts[0], pts[1], pts[pts.length - 2], pts[pts.length - 1]],
      lineKind: "segment",
    };
  }
  return { tool: live.tool, color, size: live.size, points: pts };
}

function GraphAnnotateOverlay({
  tool,
  color,
  size,
  annotations,
  view,
  xScale,
  yScale,
  onStroke,
  onPoint,
}: {
  tool: GraphDrawTool;
  color: string;
  size: number;
  annotations: GraphAnnotations;
  view: PlotView;
  xScale: number;
  yScale: number;
  onStroke: (stroke: Stroke, deletedPointIds?: string[]) => void;
  onPoint: (point: BoardPoint) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const liveStroke = useRef<LiveStroke | null>(null);
  const eraserHits = useRef<Set<string>>(new Set());
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const active = tool !== "cursor";

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      const dpr = window.devicePixelRatio || 1;
      setDims({ w, h });
      for (const canvas of [committedRef.current, liveRef.current]) {
        if (!canvas) continue;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getCtx = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return null;
    return canvas.getContext("2d");
  };

  const clearLive = useCallback(() => {
    const canvas = liveRef.current;
    const ctx = getCtx(canvas);
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const paintCommitted = useCallback(() => {
    const canvas = committedRef.current;
    const ctx = getCtx(canvas);
    if (!canvas || !ctx || dims.w < 2 || dims.h < 2) return;
    ctx.clearRect(0, 0, dims.w, dims.h);
    const viewBox = { w: dims.w, h: dims.h };
    for (const stroke of annotations.strokes) {
      drawStrokeOn(
        ctx,
        { ...stroke, points: scaleNormalizedPoints(stroke.points, dims.w, dims.h) },
        viewBox,
      );
    }
  }, [annotations.strokes, dims.h, dims.w]);

  useEffect(() => {
    paintCommitted();
  }, [paintCommitted]);

  const localXY = (e: React.PointerEvent) => {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - r.left),
      y: Math.round(e.clientY - r.top),
    };
  };

  const pixelPoints = annotations.points.map((p) => ({
    ...p,
    x: p.x * dims.w,
    y: p.y * dims.h,
  }));

  const onPointerDown = (e: React.PointerEvent) => {
    if (!active || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = localXY(e);

    if (tool === "point") {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const n = clientToNormalized(e.clientX, e.clientY, r);
      const snapped = snapNormalizedToGrid(n.nx, n.ny, view, xScale, yScale);
      onPoint({
        id: nid("gp"),
        x: snapped.nx,
        y: snapped.ny,
        r: Math.max(3, size),
      });
      return;
    }

    eraserHits.current = new Set();
    if (tool === "eraser") {
      const hits = boardPointIdsHitByEraser(
        pixelPoints,
        4,
        size,
        x,
        y,
      );
      for (const id of hits) eraserHits.current.add(id);
    }
    liveStroke.current = {
      tool,
      size,
      points: [x, y],
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const live = liveStroke.current;
    if (!live) return;
    const { x, y } = localXY(e);
    const pts = live.points;
    const lastX = pts[pts.length - 2];
    const lastY = pts[pts.length - 1];
    const free =
      live.tool === "pen" ||
      live.tool === "highlighter" ||
      live.tool === "eraser";
    if (free) {
      if (Math.hypot(x - lastX, y - lastY) < 1.5) return;
      pts.push(x, y);
      if (live.tool === "eraser") {
        const hits = boardPointIdsHitByEraser(
          pixelPoints,
          4,
          live.size,
          lastX,
          lastY,
          x,
          y,
          eraserHits.current,
        );
        for (const id of hits) eraserHits.current.add(id);
        const ctx = getCtx(committedRef.current);
        if (ctx) {
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.lineCap = "round";
          ctx.lineWidth = live.size * 7;
          ctx.beginPath();
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        clearLive();
        const ctx = getCtx(liveRef.current);
        if (ctx) {
          drawStrokeOn(
            ctx,
            { tool: live.tool, color, size: live.size, points: pts },
            { w: dims.w, h: dims.h },
          );
        }
      }
    } else {
      live.points = [pts[0], pts[1], x, y];
      clearLive();
      const ctx = getCtx(liveRef.current);
      if (ctx) {
        drawStrokeOn(
          ctx,
          {
            tool: "line",
            color,
            size: live.size,
            points: live.points,
            lineKind: "segment",
          },
          { w: dims.w, h: dims.h },
        );
      }
    }
  };

  const onPointerUp = () => {
    const live = liveStroke.current;
    if (!live) return;
    liveStroke.current = null;
    clearLive();
    const stroke = liveToStroke(live, color, dims.w, dims.h);
    const deleted =
      live.tool === "eraser" && eraserHits.current.size > 0
        ? [...eraserHits.current]
        : undefined;
    eraserHits.current = new Set();
    if (stroke) onStroke(stroke, deleted);
    else if (deleted) {
      onStroke(
        { tool: "eraser", color, size: live.size, points: [0, 0] },
        deleted,
      );
    }
  };

  return (
    <div
      ref={wrapRef}
      className={`absolute inset-0 z-[12] ${
        active ? "pointer-events-auto touch-none" : "pointer-events-none"
      }`}
      style={{ cursor: active ? "crosshair" : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={committedRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={liveRef} className="absolute inset-0 h-full w-full" />
      {annotations.points.length > 0 ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          {annotations.points.map((pt) => {
            const math = normalizedToMath(pt.x, pt.y, view);
            const cx = pt.x * dims.w;
            const cy = pt.y * dims.h;
            const r = pt.r ?? 4;
            return (
              <g key={pt.id}>
                <circle cx={cx} cy={cy} r={r} fill={color} stroke="#fff" strokeWidth={1} />
                <text
                  x={cx + r + 3}
                  y={cy - 4}
                  className="fill-wood text-[10px] font-semibold"
                >
                  ({formatGraphCoord(math.x)}, {formatGraphCoord(math.y)})
                </text>
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}

type HostProps = {
  annotations?: GraphAnnotations;
  onChange: (next: GraphAnnotations) => void;
  view: PlotView;
  xScale: number;
  yScale: number;
  children: (opts: { allowPanZoom: boolean }) => ReactNode;
};

export default function GraphAnnotateHost({
  annotations = EMPTY_GRAPH_ANNOTATIONS,
  onChange,
  view,
  xScale,
  yScale,
  children,
}: HostProps) {
  const [tool, setTool] = useState<GraphDrawTool>("cursor");
  const [color, setColor] = useState("#ef4444");
  const [size, setSize] = useState(3);
  const [past, setPast] = useState<GraphAnnotations[]>([]);
  const [future, setFuture] = useState<GraphAnnotations[]>([]);

  const commit = (next: GraphAnnotations) => {
    setPast((p) => [...p.slice(-40), annotations]);
    setFuture([]);
    onChange(next);
  };

  return (
    <div className="flex h-full min-h-0 gap-1">
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {children({ allowPanZoom: tool === "cursor" })}
        <GraphAnnotateOverlay
          tool={tool}
          color={color}
          size={size}
          annotations={annotations}
          view={view}
          xScale={xScale}
          yScale={yScale}
          onStroke={(stroke, deleted) =>
            commit(applyGraphStroke(annotations, stroke, deleted))
          }
          onPoint={(point) => commit(applyGraphPoint(annotations, point))}
        />
      </div>
      <GraphDrawToolbar
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        size={size}
        onSizeChange={setSize}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={() => {
          const prev = past[past.length - 1];
          if (!prev) return;
          setPast((p) => p.slice(0, -1));
          setFuture((f) => [annotations, ...f]);
          onChange(prev);
        }}
        onRedo={() => {
          const next = future[0];
          if (!next) return;
          setFuture((f) => f.slice(1));
          setPast((p) => [...p, annotations]);
          onChange(next);
        }}
        onClear={() => {
          if (
            annotations.strokes.length === 0 &&
            annotations.points.length === 0
          ) {
            return;
          }
          commit(EMPTY_GRAPH_ANNOTATIONS);
        }}
      />
    </div>
  );
}
