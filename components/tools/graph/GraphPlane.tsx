"use client";

import { useId, useMemo } from "react";
import {
  compileExpression,
  formatCoord,
} from "@/lib/graph-explorer-math";
import type { GraphPointSize } from "@/lib/graph-explorer-types";

export type PlanePoint = {
  id: string;
  x: number;
  y: number;
  color: string;
  label?: string | null;
  isCorrect: boolean;
  emphasized?: boolean;
};

type Props = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  step: number;
  points: PlanePoint[];
  /** 공개된 함수식(정규화된 형태). 있으면 곡선을 그린다. */
  curveExpression?: string | null;
  curveColor?: string;
  pointSize?: GraphPointSize;
  showNames?: boolean;
  className?: string;
};

const BASE_W = 960;
const POINT_RADIUS: Record<GraphPointSize, number> = {
  sm: 6,
  md: 9,
  lg: 13,
};

/** 눈금 숫자가 너무 빽빽하면 k개마다 하나만 라벨링 */
function labelEvery(count: number): number {
  if (count <= 21) return 1;
  return Math.ceil(count / 20);
}

export default function GraphPlane({
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
  className,
}: Props) {
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  const scale = BASE_W / xSpan;
  const H = Math.max(240, Math.min(1400, ySpan * scale));
  const yScale = H / ySpan;

  const px = (x: number) => (x - xMin) * scale;
  const py = (y: number) => (yMax - y) * yScale;

  const clipId = `pm-graph-clip-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;

  const gridX = useMemo(() => {
    const out: number[] = [];
    const start = Math.ceil(xMin / step) * step;
    for (let v = start; v <= xMax + 1e-9; v += step) {
      out.push(parseFloat(v.toPrecision(10)));
    }
    return out;
  }, [xMin, xMax, step]);

  const gridY = useMemo(() => {
    const out: number[] = [];
    const start = Math.ceil(yMin / step) * step;
    for (let v = start; v <= yMax + 1e-9; v += step) {
      out.push(parseFloat(v.toPrecision(10)));
    }
    return out;
  }, [yMin, yMax, step]);

  const xLabelStep = labelEvery(gridX.length);
  const yLabelStep = labelEvery(gridY.length);

  const hasXAxis = yMin <= 0 && yMax >= 0;
  const hasYAxis = xMin <= 0 && xMax >= 0;
  const axisY = hasXAxis ? py(0) : py(yMin); // x축(y=0) 없으면 아래 모서리
  const axisX = hasYAxis ? px(0) : px(xMin);

  const curvePath = useMemo(() => {
    if (!curveExpression) return null;
    const fn = compileExpression(curveExpression);
    if (!fn) return null;

    const N = 480;
    const margin = ySpan; // 범위 밖으로 한 화면 이상 벗어나면 선 분리
    let d = "";
    let penDown = false;
    for (let i = 0; i <= N; i++) {
      const x = xMin + (xSpan * i) / N;
      const y = fn(x);
      if (!Number.isFinite(y) || y < yMin - margin || y > yMax + margin) {
        penDown = false;
        continue;
      }
      const cmd = penDown ? "L" : "M";
      d += `${cmd}${px(x).toFixed(2)} ${py(y).toFixed(2)}`;
      penDown = true;
    }
    return d || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curveExpression, xMin, xMax, yMin, yMax]);

  const r = POINT_RADIUS[pointSize];
  const fontSize = 15;

  return (
    <svg
      viewBox={`0 0 ${BASE_W} ${H}`}
      className={className}
      role="img"
      aria-label="좌표평면"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={BASE_W} height={H} />
        </clipPath>
      </defs>

      <rect x={0} y={0} width={BASE_W} height={H} fill="#ffffff" rx={0} />

      {/* 격자 */}
      {gridX.map((v) => (
        <line
          key={`gx${v}`}
          x1={px(v)}
          y1={0}
          x2={px(v)}
          y2={H}
          stroke={Math.abs(v) < 1e-9 ? "#94a3b8" : "#e2e8f0"}
          strokeWidth={Math.abs(v) < 1e-9 ? 0 : 1}
        />
      ))}
      {gridY.map((v) => (
        <line
          key={`gy${v}`}
          x1={0}
          y1={py(v)}
          x2={BASE_W}
          y2={py(v)}
          stroke={Math.abs(v) < 1e-9 ? "#94a3b8" : "#e2e8f0"}
          strokeWidth={Math.abs(v) < 1e-9 ? 0 : 1}
        />
      ))}

      {/* 축 */}
      <line
        x1={0}
        y1={axisY}
        x2={BASE_W}
        y2={axisY}
        stroke="#334155"
        strokeWidth={2}
      />
      <line
        x1={axisX}
        y1={0}
        x2={axisX}
        y2={H}
        stroke="#334155"
        strokeWidth={2}
      />
      {/* 축 화살표 & 라벨 */}
      <polygon
        points={`${BASE_W},${axisY} ${BASE_W - 12},${axisY - 5} ${BASE_W - 12},${axisY + 5}`}
        fill="#334155"
      />
      <polygon
        points={`${axisX},0 ${axisX - 5},12 ${axisX + 5},12`}
        fill="#334155"
      />
      <text
        x={BASE_W - 16}
        y={axisY - 10}
        fontSize={fontSize + 2}
        fontStyle="italic"
        fill="#334155"
        textAnchor="end"
      >
        x
      </text>
      <text
        x={axisX + 12}
        y={18}
        fontSize={fontSize + 2}
        fontStyle="italic"
        fill="#334155"
      >
        y
      </text>

      {/* 눈금 숫자 */}
      {gridX.map((v, i) =>
        Math.abs(v) < 1e-9 || i % xLabelStep !== 0 ? null : (
          <text
            key={`lx${v}`}
            x={px(v)}
            y={Math.min(H - 6, axisY + 18)}
            fontSize={fontSize - 2}
            fill="#64748b"
            textAnchor="middle"
          >
            {formatCoord(v)}
          </text>
        ),
      )}
      {gridY.map((v, i) =>
        Math.abs(v) < 1e-9 || i % yLabelStep !== 0 ? null : (
          <text
            key={`ly${v}`}
            x={Math.max(18, axisX - 8)}
            y={py(v) + 5}
            fontSize={fontSize - 2}
            fill="#64748b"
            textAnchor="end"
          >
            {formatCoord(v)}
          </text>
        ),
      )}
      {hasXAxis && hasYAxis ? (
        <text
          x={axisX - 8}
          y={axisY + 18}
          fontSize={fontSize - 2}
          fill="#64748b"
          textAnchor="end"
        >
          O
        </text>
      ) : null}

      {/* 공개된 그래프 곡선 */}
      {curvePath ? (
        <g clipPath={`url(#${clipId})`}>
          <path
            d={curvePath}
            fill="none"
            stroke={curveColor}
            strokeWidth={4}
            strokeLinecap="round"
            className="pm-graph-curve"
          />
        </g>
      ) : null}

      {/* 학생 점 */}
      <g clipPath={`url(#${clipId})`}>
        {points.map((p) => {
          if (p.x < xMin || p.x > xMax || p.y < yMin || p.y > yMax) {
            return null;
          }
          const cx = px(p.x);
          const cy = py(p.y);
          return (
            <g key={p.id} className="pm-graph-point">
              <circle
                cx={cx}
                cy={cy}
                r={p.emphasized ? r + 2 : r}
                fill={p.color}
                stroke="#ffffff"
                strokeWidth={2}
                opacity={p.isCorrect ? 1 : 0.55}
              />
              {!p.isCorrect ? (
                <text
                  x={cx}
                  y={cy + r * 0.55}
                  fontSize={r * 1.5}
                  fill="#ffffff"
                  textAnchor="middle"
                  fontWeight={700}
                >
                  ×
                </text>
              ) : null}
              {showNames && p.label ? (
                <text
                  x={cx}
                  y={cy - r - 5}
                  fontSize={fontSize - 2}
                  fill={p.color}
                  textAnchor="middle"
                  fontWeight={600}
                >
                  {p.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
