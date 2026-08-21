"use client";

import { useMemo } from "react";
import { Line, Polygon, usePaneContext, useTransformContext, vec } from "mafs";
import {
  axisLabelStride,
  axisTicks,
  formatAxisLabel,
  resolveAxisScale,
} from "../lib/graph-plot";

const AXIS_COLOR = "#1e293b";
const TICK_COLOR = "#475569";
const AXIS_WEIGHT = 2.25;
const NAME_SIZE = 18;
const NUM_SIZE = 13;
const EDGE_PAD_PX = 16;
const ARROW_PAD_PX = 10;
const TICK_PX = 5.5;
const LABEL_GAP_PX = 7;
const NAME_GAP_PX = 11;

type Props = {
  showXAxis: boolean;
  showYAxis: boolean;
  showNumbers: boolean;
  showTicks: boolean;
  showArrows: boolean;
  showAxisNames: boolean;
  xAxisName: string;
  yAxisName: string;
  xScale: number;
  yScale: number;
};

type Stick = "origin" | "min" | "max";

function stickAxis(
  origin: number,
  min: number,
  max: number,
  margin: number,
): { pos: number; stick: Stick } {
  if (origin >= min && origin <= max) return { pos: origin, stick: "origin" };
  if (origin < min) return { pos: min + margin, stick: "min" };
  return { pos: max - margin, stick: "max" };
}

function pxPerUnit(viewTransform: vec.Matrix): { x: number; y: number } {
  const origin = vec.transform([0, 0], viewTransform);
  const i = vec.transform([1, 0], viewTransform);
  const j = vec.transform([0, 1], viewTransform);
  return {
    x: Math.max(1e-6, Math.abs(i[0] - origin[0])),
    y: Math.max(1e-6, Math.abs(j[1] - origin[1])),
  };
}

export default function BoardGraphAxisDecor({
  showXAxis,
  showYAxis,
  showNumbers,
  showTicks,
  showArrows,
  showAxisNames,
  xAxisName,
  yAxisName,
  xScale,
  yScale,
}: Props) {
  const { xPaneRange, yPaneRange } = usePaneContext();
  const { viewTransform } = useTransformContext();
  const [xMin, xMax] = xPaneRange;
  const [yMin, yMax] = yPaneRange;
  const px = pxPerUnit(viewTransform);

  const decor = useMemo(() => {
    const xSpan = xMax - xMin;
    const ySpan = yMax - yMin;
    const marginX = EDGE_PAD_PX / px.x;
    const marginY = EDGE_PAD_PX / px.y;
    const arrowPadX = ARROW_PAD_PX / px.x;
    const arrowPadY = ARROW_PAD_PX / px.y;
    const xStep = resolveAxisScale(xMin, xMax, xScale, xSpan * px.x);
    const yStep = resolveAxisScale(yMin, yMax, yScale, ySpan * px.y);
    const xAll = axisTicks(xMin, xMax, xStep);
    const yAll = axisTicks(yMin, yMax, yStep);
    const xStride =
      xScale > 0 && xStep * px.x >= 8
        ? 1
        : axisLabelStride(xStep, px.x, 13);
    const yStride =
      yScale > 0 && yStep * px.y >= 8
        ? 1
        : axisLabelStride(yStep, px.y, 13);
    const xAxis = stickAxis(0, yMin, yMax, marginY * 0.45);
    const yAxis = stickAxis(0, xMin, xMax, marginX * 0.45);
    const arrowW = 11 / px.x;
    const arrowH = 5.5 / px.y;
    const arrowWh = 5.5 / px.x;
    const arrowHh = 11 / px.y;
    return {
      marginX,
      marginY,
      arrowPadX,
      arrowPadY,
      xStep,
      yStep,
      xAll,
      yAll,
      xStride,
      yStride,
      xAxis,
      yAxis,
      arrowW,
      arrowH,
      arrowWh,
      arrowHh,
      tickX: TICK_PX / px.x,
      tickY: TICK_PX / px.y,
    };
  }, [xMin, xMax, yMin, yMax, px.x, px.y, xScale, yScale]);

  if (!showXAxis && !showYAxis) return null;

  const {
    marginX,
    marginY,
    arrowPadX,
    arrowPadY,
    xAll,
    yAll,
    xStride,
    yStride,
    xAxis,
    yAxis,
    arrowW,
    arrowH,
    arrowWh,
    arrowHh,
    tickX,
    tickY,
  } = decor;

  const xHi = showArrows ? xMax - arrowPadX : xMax;
  const yHi = showArrows ? yMax - arrowPadY : yMax;
  const xName = xAxisName.trim();
  const yName = yAxisName.trim();

  const onStride = (value: number, step: number, stride: number) => {
    const k = Math.round(value / step);
    if (stride <= 1) return true;
    return ((k % stride) + stride) % stride === 0;
  };

  const xLabelOk = (x: number) => {
    if (Math.abs(x) < 1e-9) return false;
    if (x > xMax - marginX * 0.85) return false;
    if (x < xMin + marginX * 0.35) return false;
    if (showYAxis && Math.abs(x - yAxis.pos) < decor.xStep * 0.45) return false;
    return onStride(x, decor.xStep, xStride);
  };

  const yLabelOk = (y: number) => {
    if (Math.abs(y) < 1e-9) return false;
    if (y > yMax - marginY * 0.85) return false;
    if (y < yMin + marginY * 0.35) return false;
    if (showXAxis && Math.abs(y - xAxis.pos) < decor.yStep * 0.45) return false;
    return onStride(y, decor.yStep, yStride);
  };

  const originVisible =
    showNumbers &&
    xMin <= 0 &&
    0 <= xMax &&
    yMin <= 0 &&
    0 <= yMax;

  const xNumSide: "n" | "s" =
    xAxis.stick === "min" ? "n" : "s";
  const yNumSide: "e" | "w" =
    yAxis.stick === "max" ? "w" : "e";

  return (
    <g className="pm-graph-axis-decor" fill="none" pointerEvents="none">
      {showXAxis ? (
        <>
          <Line.Segment
            point1={[xMin, xAxis.pos]}
            point2={[xHi, xAxis.pos]}
            color={AXIS_COLOR}
            weight={AXIS_WEIGHT}
          />
          {showArrows ? (
            <Polygon
              color={AXIS_COLOR}
              fillOpacity={1}
              points={[
                [xHi, xAxis.pos],
                [xHi - arrowW, xAxis.pos + arrowH],
                [xHi - arrowW, xAxis.pos - arrowH],
              ]}
            />
          ) : null}
          {showAxisNames && xName ? (
            <PixelLabel
              x={xHi - 2 / px.x}
              y={xAxis.pos}
              dx={-2}
              dy={xNumSide === "s" ? NAME_GAP_PX + 2 : -(NAME_GAP_PX + 2)}
              textAnchor="end"
              dominantBaseline={xNumSide === "s" ? "hanging" : "auto"}
              size={NAME_SIZE}
              color={AXIS_COLOR}
              className="pm-graph-axis-name"
            >
              {xName}
            </PixelLabel>
          ) : null}
        </>
      ) : null}

      {showYAxis ? (
        <>
          <Line.Segment
            point1={[yAxis.pos, yMin]}
            point2={[yAxis.pos, yHi]}
            color={AXIS_COLOR}
            weight={AXIS_WEIGHT}
          />
          {showArrows ? (
            <Polygon
              color={AXIS_COLOR}
              fillOpacity={1}
              points={[
                [yAxis.pos, yHi],
                [yAxis.pos - arrowWh, yHi - arrowHh],
                [yAxis.pos + arrowWh, yHi - arrowHh],
              ]}
            />
          ) : null}
          {showAxisNames && yName ? (
            <PixelLabel
              x={yAxis.pos}
              y={yHi - 2 / px.y}
              dx={yNumSide === "e" ? -(NAME_GAP_PX + 1) : NAME_GAP_PX + 1}
              dy={4}
              textAnchor={yNumSide === "e" ? "end" : "start"}
              dominantBaseline="auto"
              size={NAME_SIZE}
              color={AXIS_COLOR}
              className="pm-graph-axis-name"
            >
              {yName}
            </PixelLabel>
          ) : null}
        </>
      ) : null}

      {showXAxis && (showTicks || showNumbers)
        ? xAll.map((x) => {
            if (Math.abs(x) < 1e-9) return null;
            const tickUp =
              xAxis.stick === "min" ? tickY : xAxis.stick === "max" ? 0 : tickY;
            const tickDown =
              xAxis.stick === "max" ? tickY : xAxis.stick === "min" ? 0 : tickY;
            return (
              <g key={`xt-${x}`}>
                {showTicks ? (
                  <Line.Segment
                    point1={[x, xAxis.pos - tickDown]}
                    point2={[x, xAxis.pos + tickUp]}
                    color={TICK_COLOR}
                    weight={1.25}
                  />
                ) : null}
                {showNumbers && xLabelOk(x) ? (
                  <PixelLabel
                    x={x}
                    y={xAxis.pos}
                    dx={0}
                    dy={
                      xNumSide === "s"
                        ? LABEL_GAP_PX + 1
                        : -(LABEL_GAP_PX + 1)
                    }
                    textAnchor="middle"
                    dominantBaseline={xNumSide === "s" ? "hanging" : "auto"}
                    size={NUM_SIZE}
                    color={TICK_COLOR}
                  >
                    {formatAxisLabel(x)}
                  </PixelLabel>
                ) : null}
              </g>
            );
          })
        : null}

      {originVisible ? (
        <PixelLabel
          x={0}
          y={0}
          dx={-6}
          dy={LABEL_GAP_PX + 1}
          textAnchor="end"
          dominantBaseline="hanging"
          size={NUM_SIZE}
          color={TICK_COLOR}
        >
          0
        </PixelLabel>
      ) : null}

      {showYAxis && (showTicks || showNumbers)
        ? yAll.map((y) => {
            if (Math.abs(y) < 1e-9) return null;
            const tickRight =
              yAxis.stick === "max" ? 0 : tickX;
            const tickLeft =
              yAxis.stick === "min" ? 0 : tickX;
            return (
              <g key={`yt-${y}`}>
                {showTicks ? (
                  <Line.Segment
                    point1={[yAxis.pos - tickLeft, y]}
                    point2={[yAxis.pos + tickRight, y]}
                    color={TICK_COLOR}
                    weight={1.25}
                  />
                ) : null}
                {showNumbers && yLabelOk(y) ? (
                  <PixelLabel
                    x={yAxis.pos}
                    y={y}
                    dx={
                      yNumSide === "e"
                        ? LABEL_GAP_PX + 2
                        : -(LABEL_GAP_PX + 2)
                    }
                    dy={0}
                    textAnchor={yNumSide === "e" ? "start" : "end"}
                    dominantBaseline="central"
                    size={NUM_SIZE}
                    color={TICK_COLOR}
                  >
                    {formatAxisLabel(y)}
                  </PixelLabel>
                ) : null}
              </g>
            );
          })
        : null}
    </g>
  );
}

function PixelLabel({
  x,
  y,
  dx,
  dy,
  textAnchor,
  dominantBaseline,
  size,
  color,
  className,
  children,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  textAnchor: "start" | "middle" | "end";
  dominantBaseline: "auto" | "hanging" | "central";
  size: number;
  color: string;
  className?: string;
  children: string;
}) {
  const { viewTransform } = useTransformContext();
  const [px, py] = vec.transform([x, y], viewTransform);
  return (
    <text
      x={px + dx}
      y={py + dy}
      textAnchor={textAnchor}
      dominantBaseline={dominantBaseline}
      fontSize={size}
      className={`mafs-shadow${className ? ` ${className}` : ""}`}
      style={{
        fill: color,
        stroke: "#ffffff",
        paintOrder: "stroke",
      }}
    >
      {children}
    </text>
  );
}
