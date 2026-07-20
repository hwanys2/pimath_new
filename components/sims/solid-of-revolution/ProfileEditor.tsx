"use client";

import { useEffect, useRef } from "react";
import {
  type DrawMode,
  type Pt,
  GRID_STEP,
  WORLD_HALF,
  appendFreePoint,
  clampToRightHalf,
  isProfileReady,
  sealProfileToAxis,
  shouldClosePolygon,
  snapToGrid,
} from "@/lib/solid-of-revolution-math";

const VB = 420;
const PAD = 28;
const SCALE = (VB - PAD * 2) / (WORLD_HALF * 2);
const CX = VB / 2;
const CY = VB / 2;

function worldToSvg(p: Pt): { x: number; y: number } {
  return {
    x: CX + p.x * SCALE,
    y: CY - p.y * SCALE,
  };
}

function svgToWorld(clientX: number, clientY: number, svg: SVGSVGElement): Pt {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const local = pt.matrixTransform(ctm.inverse());
  return clampToRightHalf({
    x: (local.x - CX) / SCALE,
    y: (CY - local.y) / SCALE,
  });
}

type Props = {
  mode: DrawMode;
  points: Pt[];
  closed: boolean;
  onChange: (points: Pt[], closed: boolean) => void;
  disabled?: boolean;
};

export default function ProfileEditor({
  mode,
  points,
  closed,
  onChange,
  disabled = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef(points);
  const stateRef = useRef({ mode, closed, disabled, onChange });

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    stateRef.current = { mode, closed, disabled, onChange };
  }, [mode, closed, disabled, onChange]);

  const gridDots: Pt[] = [];
  for (let x = 0; x <= WORLD_HALF + 1e-9; x += GRID_STEP) {
    for (let y = -WORLD_HALF; y <= WORLD_HALF + 1e-9; y += GRID_STEP) {
      gridDots.push({ x, y });
    }
  }

  const handleGridClick = (raw: Pt) => {
    const { mode: m, closed: c, disabled: d, onChange: change } =
      stateRef.current;
    if (d || m !== "grid" || c) return;
    const p = snapToGrid(raw);
    const current = pointsRef.current;
    if (shouldClosePolygon(current, p)) {
      change(current, true);
      return;
    }
    const last = current[current.length - 1];
    if (last && last.x === p.x && last.y === p.y) return;
    change([...current, p], false);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const { mode: m, closed: c, disabled: d, onChange: change } =
      stateRef.current;
    if (d || !svgRef.current) return;
    if (m === "grid") {
      const world = svgToWorld(e.clientX, e.clientY, svgRef.current);
      handleGridClick(world);
      return;
    }
    if (m !== "free" || c) return;
    drawingRef.current = true;
    svgRef.current.setPointerCapture(e.pointerId);
    const world = svgToWorld(e.clientX, e.clientY, svgRef.current);
    change(appendFreePoint([], world), false);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current || !svgRef.current) return;
    if (stateRef.current.mode !== "free") return;
    const world = svgToWorld(e.clientX, e.clientY, svgRef.current);
    stateRef.current.onChange(
      appendFreePoint(pointsRef.current, world),
      false,
    );
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (
      stateRef.current.mode === "free" &&
      isProfileReady(pointsRef.current)
    ) {
      stateRef.current.onChange(sealProfileToAxis(pointsRef.current), true);
    }
  };

  const pathD =
    points.length === 0
      ? ""
      : points
          .map((p, i) => {
            const s = worldToSvg(p);
            return `${i === 0 ? "M" : "L"} ${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
          })
          .join(" ") + (closed ? " Z" : "");

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB} ${VB}`}
      className="mx-auto h-auto w-full touch-none select-none"
      role="img"
      aria-label="회전체 단면 그리기 판"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <linearGradient id="profile-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FEF9F0" />
          <stop offset="100%" stopColor="rgba(157,232,200,0.35)" />
        </linearGradient>
      </defs>
      <rect width={VB} height={VB} rx={16} fill="url(#profile-bg)" />

      <rect
        x={PAD}
        y={PAD}
        width={CX - PAD}
        height={VB - PAD * 2}
        fill="rgba(139,94,60,0.06)"
      />
      <text
        x={(PAD + CX) / 2}
        y={CY}
        textAnchor="middle"
        fill="rgba(92,64,51,0.35)"
        fontSize={13}
        fontWeight={700}
      >
        그리지 않음
      </text>

      {Array.from({ length: WORLD_HALF * 2 + 1 }, (_, i) => {
        const v = -WORLD_HALF + i;
        const y = CY - v * SCALE;
        const x = CX + v * SCALE;
        return (
          <g key={`g-${i}`}>
            <line
              x1={CX}
              y1={y}
              x2={CX + WORLD_HALF * SCALE}
              y2={y}
              stroke="rgba(139,94,60,0.12)"
              strokeWidth={v === 0 ? 0 : 1}
            />
            {v >= 0 ? (
              <line
                x1={x}
                y1={PAD}
                x2={x}
                y2={VB - PAD}
                stroke="rgba(139,94,60,0.12)"
                strokeWidth={v === 0 ? 0 : 1}
              />
            ) : null}
          </g>
        );
      })}

      <line
        x1={CX}
        y1={PAD}
        x2={CX}
        y2={VB - PAD}
        stroke="#8B5E3C"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <polygon
        points={`${CX},${PAD - 4} ${CX - 7},${PAD + 10} ${CX + 7},${PAD + 10}`}
        fill="#8B5E3C"
      />
      <text
        x={CX + 14}
        y={PAD + 14}
        fill="#8B5E3C"
        fontSize={14}
        fontWeight={800}
      >
        축
      </text>

      {mode === "grid" &&
        gridDots.map((p) => {
          const s = worldToSvg(p);
          return (
            <circle
              key={`d-${p.x}-${p.y}`}
              cx={s.x}
              cy={s.y}
              r={4.5}
              fill="rgba(77,182,160,0.45)"
              stroke="rgba(42,157,143,0.7)"
              strokeWidth={1}
              className={disabled || closed ? "" : "cursor-pointer"}
            />
          );
        })}

      {pathD && closed ? (
        <path
          d={pathD}
          fill="rgba(125,200,245,0.45)"
          stroke="#4A90C8"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      ) : pathD ? (
        <path
          d={pathD}
          fill="none"
          stroke="#2A9D8F"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {points.map((p, i) => {
        const s = worldToSvg(p);
        return (
          <circle
            key={`v-${i}`}
            cx={s.x}
            cy={s.y}
            r={i === 0 ? 6 : 4.5}
            fill={i === 0 ? "#FFD76A" : "#4DB6A0"}
            stroke="#5C4033"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}
