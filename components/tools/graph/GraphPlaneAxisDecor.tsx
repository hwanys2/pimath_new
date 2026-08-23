"use client";

import { useMemo } from "react";
import { Line, Polygon, Text, usePaneContext, useTransformContext, vec } from "mafs";

const AXIS_COLOR = "#6b4423";
const AXIS_WEIGHT = 2;
const EDGE_PAD_PX = 14;
const ARROW_PAD_PX = 10;

function pxPerUnit(viewTransform: vec.Matrix): { x: number; y: number } {
  const origin = vec.transform([0, 0], viewTransform);
  const i = vec.transform([1, 0], viewTransform);
  const j = vec.transform([0, 1], viewTransform);
  return {
    x: Math.max(1e-6, Math.abs(i[0] - origin[0])),
    y: Math.max(1e-6, Math.abs(j[1] - origin[1])),
  };
}

/** y=0 또는 가장자리에 붙는 x축 위치 */
function xAxisY(yMin: number, yMax: number, margin: number): number {
  if (yMin <= 0 && yMax >= 0) return 0;
  if (0 < yMin) return yMin + margin;
  return yMax - margin;
}

/** x=0 또는 가장자리에 붙는 y축 위치 */
function yAxisX(xMin: number, xMax: number, margin: number): number {
  if (xMin <= 0 && xMax >= 0) return 0;
  if (0 < xMin) return xMin + margin;
  return xMax - margin;
}

/** Mafs 기본 축 위에 화살표·x/y 라벨·원점 O (기존 GraphPlane SVG 스타일) */
export default function GraphPlaneAxisDecor() {
  const { xPaneRange, yPaneRange } = usePaneContext();
  const { viewTransform } = useTransformContext();
  const [xMin, xMax] = xPaneRange;
  const [yMin, yMax] = yPaneRange;
  const px = pxPerUnit(viewTransform);

  const decor = useMemo(() => {
    const marginX = EDGE_PAD_PX / px.x;
    const marginY = EDGE_PAD_PX / px.y;
    const arrowPadX = ARROW_PAD_PX / px.x;
    const arrowPadY = ARROW_PAD_PX / px.y;
    const xY = xAxisY(yMin, yMax, marginY * 0.45);
    const yX = yAxisX(xMin, xMax, marginX * 0.45);
    return {
      xY,
      yX,
      xLo: xMin + marginX * 0.2,
      xHi: xMax - arrowPadX,
      yLo: yMin + marginY * 0.2,
      yHi: yMax - arrowPadY,
      arrowW: 11 / px.x,
      arrowH: 5.5 / px.y,
      arrowWh: 5.5 / px.x,
      arrowHh: 11 / px.y,
      originVisible: xMin <= 0 && xMax >= 0 && yMin <= 0 && yMax >= 0,
    };
  }, [xMin, xMax, yMin, yMax, px.x, px.y]);

  const { xY, yX, xLo, xHi, yLo, yHi, arrowW, arrowH, arrowWh, arrowHh, originVisible } =
    decor;

  return (
    <g className="pm-graph-axis-decor" fill="none" pointerEvents="none">
      <Line.Segment
        point1={[xLo, xY]}
        point2={[xHi, xY]}
        color={AXIS_COLOR}
        weight={AXIS_WEIGHT}
      />
      <Polygon
        color={AXIS_COLOR}
        fillOpacity={1}
        points={[
          [xHi, xY],
          [xHi - arrowW, xY + arrowH],
          [xHi - arrowW, xY - arrowH],
        ]}
      />
      <Text
        x={xHi}
        y={xY}
        attach="e"
        attachDistance={14}
        size={17}
        color={AXIS_COLOR}
        svgTextProps={{ className: "pm-graph-axis-name" }}
      >
        x
      </Text>

      <Line.Segment
        point1={[yX, yLo]}
        point2={[yX, yHi]}
        color={AXIS_COLOR}
        weight={AXIS_WEIGHT}
      />
      <Polygon
        color={AXIS_COLOR}
        fillOpacity={1}
        points={[
          [yX, yHi],
          [yX - arrowWh, yHi - arrowHh],
          [yX + arrowWh, yHi - arrowHh],
        ]}
      />
      <Text
        x={yX}
        y={yHi}
        attach="n"
        attachDistance={14}
        size={17}
        color={AXIS_COLOR}
        svgTextProps={{ className: "pm-graph-axis-name" }}
      >
        y
      </Text>

      {originVisible ? (
        <Text x={-0.35} y={-0.35} attach="e" attachDistance={8} size={13} color="#64748b">
          O
        </Text>
      ) : null}
    </g>
  );
}
