"use client";

import type { ReactNode } from "react";

export const SCALE_VB_W = 820;
export const SCALE_VB_H = 340;
export const BEAM_Y = 88;
export const FULCRUM_X = SCALE_VB_W / 2;
export const PAN_W = 300;
export const PAN_H = 18;
export const PAN_RISE = 28;
export const LEFT_HOOK_X = 100;
export const RIGHT_HOOK_X = SCALE_VB_W - 100;
export const PAN_SURFACE_Y = BEAM_Y + PAN_RISE;

type Props = {
  tilt: number;
  leftHighlight?: boolean;
  rightHighlight?: boolean;
  leftTiles?: ReactNode;
  rightTiles?: ReactNode;
  uid: string;
};

export default function BalanceScale({
  tilt,
  leftHighlight = false,
  rightHighlight = false,
  leftTiles,
  rightTiles,
  uid,
}: Props) {
  const beamId = `beam-${uid}`;
  const panId = `pan-${uid}`;

  const renderPan = (
    hookX: number,
    highlight: boolean,
    tiles?: ReactNode,
  ) => (
    <g transform={`translate(${hookX}, ${BEAM_Y})`}>
      <rect x={-3} y={0} width={6} height={PAN_RISE} fill="#9a9a9a" rx={2} />
      <g transform={`translate(0, ${PAN_RISE}) rotate(${-tilt})`}>
        <ellipse
          cx={0}
          cy={PAN_H + 6}
          rx={PAN_W / 2 + 8}
          ry={10}
          fill="rgba(0,0,0,0.06)"
        />
        <ellipse
          cx={0}
          cy={PAN_H / 2}
          rx={PAN_W / 2}
          ry={PAN_H / 2 + 2}
          fill={`url(#${panId})`}
          stroke={highlight ? "#2A9D8F" : "#b0b0b0"}
          strokeWidth={highlight ? 3 : 2}
        />
        <ellipse
          cx={0}
          cy={0}
          rx={PAN_W / 2 - 4}
          ry={6}
          fill="none"
          stroke="#c8c8c8"
          strokeWidth={2}
        />
        <g transform="translate(0, -8)">{tiles}</g>
      </g>
    </g>
  );

  return (
    <g>
      <defs>
        <linearGradient id={beamId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d8d8d8" />
          <stop offset="100%" stopColor="#a8a8a8" />
        </linearGradient>
        <linearGradient id={panId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5f5f5" />
          <stop offset="100%" stopColor="#e0e0e0" />
        </linearGradient>
      </defs>

      <polygon
        points={`${FULCRUM_X - 22},${BEAM_Y + 28} ${FULCRUM_X + 22},${BEAM_Y + 28} ${FULCRUM_X},${BEAM_Y + 4}`}
        fill="#c0c0c0"
        stroke="#909090"
        strokeWidth={1.5}
      />
      <text
        x={FULCRUM_X}
        y={BEAM_Y + 22}
        textAnchor="middle"
        fontSize={14}
        fontWeight="bold"
        fill="#606060"
      >
        =
      </text>

      <g transform={`rotate(${tilt}, ${FULCRUM_X}, ${BEAM_Y})`}>
        <rect
          x={60}
          y={BEAM_Y - 4}
          width={SCALE_VB_W - 120}
          height={8}
          rx={4}
          fill={`url(#${beamId})`}
          stroke="#909090"
          strokeWidth={1}
        />
        {renderPan(LEFT_HOOK_X, leftHighlight, leftTiles)}
        {renderPan(RIGHT_HOOK_X, rightHighlight, rightTiles)}
      </g>
    </g>
  );
}
