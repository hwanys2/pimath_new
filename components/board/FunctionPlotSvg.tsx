"use client";

import { useMemo } from "react";
import type { CompiledExpr } from "@/lib/board-math";
import {
  buildFunctionPath,
  DEFAULT_PLOT_VIEW,
  plotTicks,
  type PlotView,
} from "@/lib/graph-plot";

type Props = {
  fn: CompiledExpr | null;
  color?: string;
  width: number;
  height: number;
  view?: PlotView;
};

export default function FunctionPlotSvg({
  fn,
  color = "#3b82f6",
  width: w,
  height: h,
  view = DEFAULT_PLOT_VIEW,
}: Props) {
  const pathD = useMemo(() => {
    if (!fn || w < 8 || h < 8) return "";
    return buildFunctionPath(fn, view, w, h);
  }, [fn, view, w, h]);

  const toPx = useMemo(() => {
    const sx = w / (view.xMax - view.xMin);
    const sy = h / (view.yMax - view.yMin);
    return {
      x: (x: number) => (x - view.xMin) * sx,
      y: (y: number) => h - (y - view.yMin) * sy,
    };
  }, [w, h, view]);

  const xTicks = plotTicks(view.xMin, view.xMax);
  const yTicks = plotTicks(view.yMin, view.yMax);
  const axisX = Math.min(Math.max(toPx.y(0), 10), h - 4);
  const axisY = Math.min(Math.max(toPx.x(0), 4), w - 10);

  if (!fn) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-wood/60">
        그래프를 그릴 수 없어요
      </div>
    );
  }

  return (
    <svg width={w} height={h} className="block">
      {xTicks.map((t) => (
        <line
          key={`gx${t}`}
          x1={toPx.x(t)}
          y1={0}
          x2={toPx.x(t)}
          y2={h}
          stroke={t === 0 ? "#3d2c1e" : "#e5e0d5"}
          strokeWidth={t === 0 ? 1.2 : 0.8}
        />
      ))}
      {yTicks.map((t) => (
        <line
          key={`gy${t}`}
          x1={0}
          y1={toPx.y(t)}
          x2={w}
          y2={toPx.y(t)}
          stroke={t === 0 ? "#3d2c1e" : "#e5e0d5"}
          strokeWidth={t === 0 ? 1.2 : 0.8}
        />
      ))}
      {pathD ? (
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      ) : null}
      <line
        x1={axisY}
        y1={0}
        x2={axisY}
        y2={h}
        stroke="#3d2c1e"
        strokeWidth={1.2}
        opacity={0.35}
      />
      <line
        x1={0}
        y1={axisX}
        x2={w}
        y2={axisX}
        stroke="#3d2c1e"
        strokeWidth={1.2}
        opacity={0.35}
      />
    </svg>
  );
}
