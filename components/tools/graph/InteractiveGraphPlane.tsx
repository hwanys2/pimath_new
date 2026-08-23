"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mafs, Coordinates, Plot, Point, Text } from "mafs";
import "mafs/core.css";
import { compileExpression } from "@/lib/graph-explorer-math";
import type { GraphPointSize } from "@/lib/graph-explorer-types";
import type { PlanePoint } from "@/components/tools/graph/GraphPlane";

export type { PlanePoint };

const POINT_RADIUS: Record<GraphPointSize, number> = {
  sm: 0.12,
  md: 0.18,
  lg: 0.26,
};

type Props = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  step: number;
  points: PlanePoint[];
  curveExpression?: string | null;
  curveColor?: string;
  pointSize?: GraphPointSize;
  showNames?: boolean;
  interactive?: boolean;
  className?: string;
};

export default function InteractiveGraphPlane({
  xMin,
  xMax,
  yMin,
  yMax,
  step,
  points,
  curveExpression,
  curveColor = "#e74c3c",
  pointSize = "md",
  showNames = true,
  interactive = true,
  className,
}: Props) {
  const viewBox = useMemo(
    () => ({
      x: [xMin, xMax] as [number, number],
      y: [yMin, yMax] as [number, number],
      padding: 0.12,
    }),
    [xMin, xMax, yMin, yMax],
  );

  const curveFn = useMemo(() => {
    if (!curveExpression) return null;
    return compileExpression(curveExpression);
  }, [curveExpression]);

  const r = POINT_RADIUS[pointSize];
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSize({ width: Math.round(width), height: Math.round(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gridStep = step > 0 ? step : 1;
  const gridAxis = {
    axis: false as const,
    lines: gridStep,
    labels: false as const,
  };

  return (
    <div
      ref={containerRef}
      className={`h-full w-full min-h-0 ${className ?? ""}`}
    >
      {size.width > 0 && size.height > 0 ? (
      <Mafs
        width={size.width}
        height={size.height}
        pan={interactive}
        zoom={interactive}
        viewBox={viewBox}
      >
        <Coordinates.Cartesian
          subdivisions={false}
          xAxis={gridAxis}
          yAxis={gridAxis}
        />
        {curveFn ? (
          <Plot.OfX y={curveFn} color={curveColor} weight={3} />
        ) : null}
        {points.map((p) => (
          <g key={p.id}>
            <Point
              x={p.x}
              y={p.y}
              color={p.color}
              opacity={p.isCorrect ? 1 : 0.55}
              svgCircleProps={{ r: p.emphasized ? r * 1.2 : r }}
            />
            {showNames && p.label ? (
              <Text x={p.x} y={p.y} attach="n" attachDistance={12} size={14} color={p.color}>
                {p.label}
              </Text>
            ) : null}
          </g>
        ))}
      </Mafs>
      ) : null}
    </div>
  );
}
