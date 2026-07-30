"use client";

import type { ReactNode } from "react";

export const SCALE_VB_W = 820;
export const SCALE_VB_H = 420;
export const BEAM_Y = 155;
export const FULCRUM_X = SCALE_VB_W / 2;
export const PAN_W = 300;
export const PAN_H = 20;
export const PAN_RISE = 36;
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
  const fulcrumId = `fulcrum-${uid}`;

  const renderPan = (
    hookX: number,
    highlight: boolean,
    tiles?: ReactNode,
  ) => (
    <g transform={`translate(${hookX}, ${BEAM_Y})`}>
      <rect x={-4} y={0} width={8} height={PAN_RISE} fill="#8a8a8a" rx={2} />
      <g transform={`translate(0, ${PAN_RISE}) rotate(${-tilt})`}>
        <ellipse
          cx={0}
          cy={PAN_H + 8}
          rx={PAN_W / 2 + 10}
          ry={12}
          fill="rgba(0,0,0,0.07)"
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
          ry={7}
          fill="none"
          stroke="#c8c8c8"
          strokeWidth={2}
        />
        <g transform="translate(0, -10)">{tiles}</g>
      </g>
    </g>
  );

  return (
    <g>
      <defs>
        <linearGradient id={beamId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d8d8d8" />
          <stop offset="100%" stopColor="#a0a0a0" />
        </linearGradient>
        <linearGradient id={panId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8f8f8" />
          <stop offset="100%" stopColor="#dcdcdc" />
        </linearGradient>
        <linearGradient id={fulcrumId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d0d0d0" />
          <stop offset="100%" stopColor="#909090" />
        </linearGradient>
      </defs>

      {/* 받침대 — 넓은 삼각형 + 받침대 */}
      <rect
        x={FULCRUM_X - 48}
        y={BEAM_Y + 52}
        width={96}
        height={14}
        rx={4}
        fill="#a8a8a8"
        stroke="#808080"
        strokeWidth={1.5}
      />
      <polygon
        points={`${FULCRUM_X - 38},${BEAM_Y + 52} ${FULCRUM_X + 38},${BEAM_Y + 52} ${FULCRUM_X},${BEAM_Y + 2}`}
        fill={`url(#${fulcrumId})`}
        stroke="#707070"
        strokeWidth={2}
      />
      <text
        x={FULCRUM_X}
        y={BEAM_Y + 38}
        textAnchor="middle"
        fontSize={18}
        fontWeight="bold"
        fill="#505050"
      >
        =
      </text>

      <g transform={`rotate(${tilt}, ${FULCRUM_X}, ${BEAM_Y})`}>
        <rect
          x={60}
          y={BEAM_Y - 5}
          width={SCALE_VB_W - 120}
          height={10}
          rx={5}
          fill={`url(#${beamId})`}
          stroke="#808080"
          strokeWidth={1.5}
        />
        {renderPan(LEFT_HOOK_X, leftHighlight, leftTiles)}
        {renderPan(RIGHT_HOOK_X, rightHighlight, rightTiles)}
      </g>
    </g>
  );
}
