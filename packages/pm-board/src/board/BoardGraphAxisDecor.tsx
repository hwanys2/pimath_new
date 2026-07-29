"use client";

import { useMemo } from "react";
import { Line, Polygon, Text, usePaneContext } from "mafs";
import { axisTicks, formatAxisLabel } from "../lib/graph-plot";

const AXIS_COLOR = "#1e293b";
const TICK_COLOR = "#475569";
const AXIS_WEIGHT = 2.25;
const TICK_LEN = 0.22;

type Props = {
  showAxes: boolean;
  showNumbers: boolean;
};

function arrowScale(xSpan: number, ySpan: number): number {
  return Math.min(xSpan, ySpan) * 0.035;
}

export default function BoardGraphAxisDecor({ showAxes, showNumbers }: Props) {
  const { xPaneRange, yPaneRange } = usePaneContext();
  const [xMin, xMax] = xPaneRange;
  const [yMin, yMax] = yPaneRange;

  const decor = useMemo(() => {
    const xSpan = xMax - xMin;
    const ySpan = yMax - yMin;
    const s = arrowScale(xSpan, ySpan);
    const xTicks = showNumbers ? axisTicks(xMin, xMax) : [];
    const yTicks = showNumbers ? axisTicks(yMin, yMax) : [];
    const showXAxis = yMin <= 0 && yMax >= 0;
    const showYAxis = xMin <= 0 && xMax >= 0;
    return { s, xTicks, yTicks, showXAxis, showYAxis, xMin, xMax, yMin, yMax };
  }, [xMin, xMax, yMin, yMax, showNumbers]);

  if (!showAxes) return null;

  const { s, xTicks, yTicks, showXAxis, showYAxis } = decor;
  const { xMin: xLo, xMax: xHi, yMin: yLo, yMax: yHi } = decor;

  return (
    <g className="pm-graph-axis-decor" fill="none">
      {showXAxis ? (
        <>
          <Line.Segment
            point1={[xLo, 0]}
            point2={[xHi, 0]}
            color={AXIS_COLOR}
            weight={AXIS_WEIGHT}
          />
          <Polygon
            color={AXIS_COLOR}
            fillOpacity={1}
            points={[
              [xHi, 0],
              [xHi - s, s * 0.45],
              [xHi - s, -s * 0.45],
            ]}
          />
          <Text
            x={xHi}
            y={0}
            attach="w"
            attachDistance={10}
            size={17}
            color={AXIS_COLOR}
            svgTextProps={{ fontWeight: 600 }}
          >
            x
          </Text>
        </>
      ) : null}

      {showYAxis ? (
        <>
          <Line.Segment
            point1={[0, yLo]}
            point2={[0, yHi]}
            color={AXIS_COLOR}
            weight={AXIS_WEIGHT}
          />
          <Polygon
            color={AXIS_COLOR}
            fillOpacity={1}
            points={[
              [0, yHi],
              [-s * 0.45, yHi - s],
              [s * 0.45, yHi - s],
            ]}
          />
          <Text
            x={0}
            y={yHi}
            attach="s"
            attachDistance={10}
            size={17}
            color={AXIS_COLOR}
            svgTextProps={{ fontWeight: 600 }}
          >
            y
          </Text>
        </>
      ) : null}

      {showNumbers && showXAxis
        ? xTicks.map((x) => {
            if (Math.abs(x) < 1e-9) return null;
            return (
              <g key={`xt-${x}`}>
                <Line.Segment
                  point1={[x, -TICK_LEN]}
                  point2={[x, TICK_LEN]}
                  color={TICK_COLOR}
                  weight={1.25}
                />
                <Text
                  x={x}
                  y={0}
                  attach="n"
                  attachDistance={14}
                  size={14}
                  color={TICK_COLOR}
                >
                  {formatAxisLabel(x)}
                </Text>
              </g>
            );
          })
        : null}

      {showNumbers && showXAxis
        ? xTicks.some((x) => Math.abs(x) < 1e-9) && (
            <Text
              key="origin-x"
              x={0}
              y={0}
              attach="nw"
              attachDistance={10}
              size={14}
              color={TICK_COLOR}
            >
              0
            </Text>
          )
        : null}

      {showNumbers && showYAxis
        ? yTicks.map((y) => {
            if (Math.abs(y) < 1e-9) return null;
            return (
              <g key={`yt-${y}`}>
                <Line.Segment
                  point1={[-TICK_LEN, y]}
                  point2={[TICK_LEN, y]}
                  color={TICK_COLOR}
                  weight={1.25}
                />
                <Text
                  x={0}
                  y={y}
                  attach="e"
                  attachDistance={14}
                  size={14}
                  color={TICK_COLOR}
                >
                  {formatAxisLabel(y)}
                </Text>
              </g>
            );
          })
        : null}
    </g>
  );
}
