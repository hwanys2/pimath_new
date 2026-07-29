"use client";

import { useMemo, type ReactNode } from "react";
import { Mafs, Coordinates, Plot, type vec } from "mafs";
import "mafs/core.css";
import "./board-graph-theme.css";
import {
  compileExpression,
  defaultParamValues,
  listParameters,
  normalizeGraphExpression,
} from "@/lib/board-math";
import { parseInequality, inequalityShadePath } from "@/lib/graph-inequality";
import type { BoardGraphSeriesInput, GraphSettings } from "./graph-types";
import BoardGraphAxisDecor from "./BoardGraphAxisDecor";

type Props = {
  width: number;
  height: number;
  series: BoardGraphSeriesInput[];
  settings: GraphSettings;
  paramValues?: Record<string, number>;
};

function gridAxisOpts(
  showGrid: boolean,
): false | { axis: false; lines: number | false; labels: false } {
  if (!showGrid) return false;
  return {
    axis: false,
    lines: 1,
    labels: false,
  };
}

function toMafsInequality(
  expr: string,
  color: string,
): ReactNode | { parsed: NonNullable<ReturnType<typeof parseInequality>>; color: string } | null {
  const parsed = parseInequality(expr);
  if (!parsed) return null;

  if (parsed.type === "y") {
    const fn = compileExpression(parsed.expr);
    if (!fn) return null;
    const op = parsed.op;
    const yProp: Record<string, (x: number) => number> = {};
    if (op === ">") yProp[">"] = fn;
    else if (op === ">=") yProp[">="] = fn;
    else if (op === "<") yProp["<"] = fn;
    else if (op === "<=") yProp["<="] = fn;
    return (
      <Plot.Inequality
        key={expr}
        y={yProp}
        color={color}
        fillOpacity={0.22}
        weight={2.75}
      />
    );
  }

  if (parsed.type === "x") {
    const boundary = parsed.boundary;
    const op = parsed.op;
    const xProp: Record<string, (y: number) => number> = {};
    const fn = () => boundary;
    if (op === ">") xProp[">"] = fn;
    else if (op === ">=") xProp[">="] = fn;
    else if (op === "<") xProp["<"] = fn;
    else if (op === "<=") xProp["<="] = fn;
    return (
      <Plot.Inequality
        key={expr}
        x={xProp}
        color={color}
        fillOpacity={0.22}
        weight={2.75}
      />
    );
  }

  return { parsed, color };
}

export default function BoardGraphInner({
  width,
  height,
  series,
  settings,
  paramValues = {},
}: Props) {
  const { view } = settings;
  const viewBox = useMemo(
    () => ({
      x: [view.xMin, view.xMax] as vec.Vector2,
      y: [view.yMin, view.yMax] as vec.Vector2,
      padding: 0.35,
    }),
    [view],
  );

  const gridAxis = gridAxisOpts(settings.showGrid);

  const plots = useMemo(() => {
    const out: ReactNode[] = [];
    const fxShades: { d: string; color: string }[] = [];

    for (const s of series) {
      const raw = s.expr.trim();
      if (!raw) continue;

      const ineq = parseInequality(raw);
      if (ineq || s.kind === "inequality") {
        const m = toMafsInequality(raw, s.color);
        if (m && typeof m === "object" && "parsed" in m) {
          const path = inequalityShadePath(m.parsed, view, width, height);
          if (path) fxShades.push({ d: path, color: m.color });
        } else if (m) {
          out.push(m);
        }
        continue;
      }

      const expr = normalizeGraphExpression(raw);
      const params = listParameters(expr);
      const merged = { ...defaultParamValues(params), ...paramValues };
      const fn =
        params.length > 0
          ? compileExpression(expr, merged)
          : compileExpression(expr);
      if (!fn) continue;
      out.push(
        <Plot.OfX
          key={raw + s.color}
          y={(x) => fn(x)}
          color={s.color}
          weight={3}
          domain={[view.xMin, view.xMax]}
        />,
      );
    }

    return { plots: out, fxShades };
  }, [series, paramValues, view, width, height]);

  if (width < 8 || height < 8) {
    return null;
  }

  return (
    <div className="pm-board-graph relative h-full w-full overflow-hidden rounded-lg bg-white ring-1 ring-slate-200/80">
      <Mafs
        width={width}
        height={height}
        pan={settings.panZoom}
        zoom={settings.panZoom}
        viewBox={viewBox}
        preserveAspectRatio="contain"
      >
        {settings.showGrid ? (
          <Coordinates.Cartesian
            subdivisions={
              settings.subdivisions > 1 ? settings.subdivisions : false
            }
            xAxis={gridAxis}
            yAxis={gridAxis}
          />
        ) : null}
        <BoardGraphAxisDecor
          showAxes={settings.showAxes}
          showNumbers={settings.showNumbers}
        />
        {plots.plots}
      </Mafs>
      {plots.fxShades.length > 0 ? (
        <svg
          className="pointer-events-none absolute inset-0"
          width={width}
          height={height}
        >
          {plots.fxShades.map((shade, i) => (
            <path
              key={i}
              d={shade.d}
              fill={shade.color}
              fillOpacity={0.2}
              stroke="none"
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}
