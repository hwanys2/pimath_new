"use client";

import {
  balanceTiltDeg,
  formatExpr,
  tilesFromExpr,
  type BalanceState,
} from "@/lib/linear-equation-balance-math";
import AlgebraTile from "./AlgebraTile";

const VB_W = 720;
const VB_H = 320;
const PAN_W = 280;
const PAN_H = 48;
const BEAM_Y = 120;
const FULCRUM_X = VB_W / 2;

type Props = {
  state: BalanceState;
  readOnly?: boolean;
};

function PanTiles({
  expr,
  panX,
  panY,
}: {
  expr: { x: number; unit: number };
  panX: number;
  panY: number;
}) {
  const tiles = tilesFromExpr(expr);
  let offsetX = panX + 12;
  const rowY = panY + 8;

  return (
    <g>
      {tiles.map((kind, i) => {
        const isX = kind === "x" || kind === "neg_x";
        const w = isX ? 112 : 28;
        const el = (
          <AlgebraTile
            key={`${kind}-${i}`}
            kind={kind}
            x={offsetX}
            y={rowY}
            scale={0.85}
          />
        );
        offsetX += w * 0.85 + 4;
        return el;
      })}
      {tiles.length === 0 ? (
        <text
          x={panX + PAN_W / 2}
          y={panY + 30}
          textAnchor="middle"
          fontSize={12}
          fill="#8B5E3C"
          opacity={0.5}
        >
          (비어 있음)
        </text>
      ) : null}
    </g>
  );
}

export default function BalanceScale({ state, readOnly: _readOnly }: Props) {
  const tilt = balanceTiltDeg(state);
  const leftPanX = 60;
  const rightPanX = VB_W - 60 - PAN_W;
  const panDropY = BEAM_Y + 40;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="mx-auto w-full max-w-3xl"
        role="img"
        aria-label={`저울: 왼쪽 ${formatExpr(state.left)}, 오른쪽 ${formatExpr(state.right)}`}
      >
        <defs>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A67C52" />
            <stop offset="100%" stopColor="#8B5E3C" />
          </linearGradient>
        </defs>

        {/* Stand */}
        <polygon
          points={`${FULCRUM_X - 30},${VB_H - 20} ${FULCRUM_X + 30},${VB_H - 20} ${FULCRUM_X},${BEAM_Y + 20}`}
          fill="#8B5E3C"
          stroke="#6B4423"
          strokeWidth={2}
        />

        {/* Beam group with tilt */}
        <g transform={`rotate(${tilt}, ${FULCRUM_X}, ${BEAM_Y})`}>
          <rect
            x={40}
            y={BEAM_Y - 6}
            width={VB_W - 80}
            height={12}
            rx={4}
            fill="url(#beamGrad)"
            stroke="#6B4423"
            strokeWidth={1.5}
          />

          {/* Left chain */}
          <line
            x1={leftPanX + PAN_W / 2}
            y1={BEAM_Y + 6}
            x2={leftPanX + PAN_W / 2}
            y2={panDropY}
            stroke="#6B4423"
            strokeWidth={2}
          />
          {/* Right chain */}
          <line
            x1={rightPanX + PAN_W / 2}
            y1={BEAM_Y + 6}
            x2={rightPanX + PAN_W / 2}
            y2={panDropY}
            stroke="#6B4423"
            strokeWidth={2}
          />

          {/* Left pan */}
          <g>
            <ellipse
              cx={leftPanX + PAN_W / 2}
              cy={panDropY + PAN_H / 2}
              rx={PAN_W / 2}
              ry={PAN_H / 2}
              fill="#FEF9F0"
              stroke="#8B5E3C"
              strokeWidth={2}
            />
            <PanTiles
              expr={state.left}
              panX={leftPanX}
              panY={panDropY}
            />
          </g>

          {/* Right pan */}
          <g>
            <ellipse
              cx={rightPanX + PAN_W / 2}
              cy={panDropY + PAN_H / 2}
              rx={PAN_W / 2}
              ry={PAN_H / 2}
              fill="#FEF9F0"
              stroke="#8B5E3C"
              strokeWidth={2}
            />
            <PanTiles
              expr={state.right}
              panX={rightPanX}
              panY={panDropY}
            />
          </g>
        </g>

        {/* Fulcrum */}
        <circle
          cx={FULCRUM_X}
          cy={BEAM_Y}
          r={10}
          fill="#FFD76A"
          stroke="#C9A227"
          strokeWidth={2}
        />

        {/* Labels */}
        <text
          x={leftPanX + PAN_W / 2}
          y={panDropY + PAN_H + 24}
          textAnchor="middle"
          fontSize={13}
          fontWeight="bold"
          fill="#8B5E3C"
        >
          왼쪽: {formatExpr(state.left)}
        </text>
        <text
          x={rightPanX + PAN_W / 2}
          y={panDropY + PAN_H + 24}
          textAnchor="middle"
          fontSize={13}
          fontWeight="bold"
          fill="#8B5E3C"
        >
          오른쪽: {formatExpr(state.right)}
        </text>
      </svg>
    </div>
  );
}
