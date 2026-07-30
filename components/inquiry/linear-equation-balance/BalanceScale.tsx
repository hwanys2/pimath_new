"use client";

import type { ReactNode } from "react";

export const SCALE_VB_W = 880;
export const SCALE_VB_H = 520;
export const BEAM_Y = 230;
export const FULCRUM_X = SCALE_VB_W / 2;
export const PAN_W = 220;
export const PAN_H = 14;
export const PAN_RISE = 34;
export const LEFT_HOOK_X = 175;
export const RIGHT_HOOK_X = SCALE_VB_W - 175;
export const PAN_SURFACE_Y = BEAM_Y - PAN_RISE;
export const TRASH_X = FULCRUM_X;
export const TRASH_Y = BEAM_Y + 98;
export const PALETTE_DIVIDER_Y = 388;
export const PALETTE_Y = 432;

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
      {/* 받침대 — 빔 위로 올라가는 지지대 */}
      <rect
        x={-5}
        y={-PAN_RISE}
        width={10}
        height={PAN_RISE}
        fill="#9a9a9a"
        rx={2}
      />
      <g transform={`translate(0, ${-PAN_RISE}) rotate(${-tilt})`}>
        <ellipse
          cx={0}
          cy={6}
          rx={PAN_W / 2 + 8}
          ry={9}
          fill="rgba(0,0,0,0.06)"
        />
        <ellipse
          cx={0}
          cy={0}
          rx={PAN_W / 2}
          ry={PAN_H / 2 + 2}
          fill={`url(#${panId})`}
          stroke={highlight ? "#2A9D8F" : "#b0b0b0"}
          strokeWidth={highlight ? 3 : 2}
        />
        <ellipse
          cx={0}
          cy={-3}
          rx={PAN_W / 2 - 6}
          ry={5}
          fill="none"
          stroke="#d0d0d0"
          strokeWidth={1.5}
        />
        <g transform={`translate(0, ${-PAN_H - 10})`}>{tiles}</g>
      </g>
    </g>
  );

  return (
    <g>
      <defs>
        <linearGradient id={beamId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0e0e0" />
          <stop offset="100%" stopColor="#a0a0a0" />
        </linearGradient>
        <linearGradient id={panId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fafafa" />
          <stop offset="100%" stopColor="#d8d8d8" />
        </linearGradient>
        <linearGradient id={fulcrumId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4d4d4" />
          <stop offset="100%" stopColor="#888888" />
        </linearGradient>
      </defs>

      {/* 받침대 — 빔 아래 고정 */}
      <rect
        x={FULCRUM_X - 54}
        y={BEAM_Y + 56}
        width={108}
        height={16}
        rx={5}
        fill="#a0a0a0"
        stroke="#707070"
        strokeWidth={1.5}
      />
      <polygon
        points={`${FULCRUM_X - 42},${BEAM_Y + 56} ${FULCRUM_X + 42},${BEAM_Y + 56} ${FULCRUM_X},${BEAM_Y + 6}`}
        fill={`url(#${fulcrumId})`}
        stroke="#686868"
        strokeWidth={2}
      />
      <text
        x={FULCRUM_X}
        y={BEAM_Y + 42}
        textAnchor="middle"
        fontSize={20}
        fontWeight="bold"
        fill="#484848"
      >
        =
      </text>

      {/* 기울어지는 빔 + 위쪽 접시 */}
      <g transform={`rotate(${tilt}, ${FULCRUM_X}, ${BEAM_Y})`}>
        <rect
          x={80}
          y={BEAM_Y - 6}
          width={SCALE_VB_W - 160}
          height={12}
          rx={6}
          fill={`url(#${beamId})`}
          stroke="#787878"
          strokeWidth={1.5}
        />
        {renderPan(LEFT_HOOK_X, leftHighlight, leftTiles)}
        {renderPan(RIGHT_HOOK_X, rightHighlight, rightTiles)}
      </g>
    </g>
  );
}
