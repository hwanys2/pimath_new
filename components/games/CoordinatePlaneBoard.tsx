"use client";

import type { BoardMap, Stone } from "@/lib/ordered-pair-omok-math";
import {
  BOARD_MAX,
  BOARD_MIN,
  getStone,
} from "@/lib/ordered-pair-omok-math";

type Props = {
  board: BoardMap;
  /** Highlight preview ordered pair before placing */
  preview?: { x: number; y: number } | null;
  lastMove?: { x: number; y: number } | null;
  myStone?: Stone | null;
};

/**
 * Display-only coordinate plane. Stones cannot be placed by clicking —
 * students must enter ordered pairs via OrderedPairPad.
 */
export default function CoordinatePlaneBoard({
  board,
  preview = null,
  lastMove = null,
  myStone = null,
}: Props) {
  const size = BOARD_MAX - BOARD_MIN + 1; // 21
  const cell = 22;
  const pad = 28;
  const w = pad * 2 + cell * (size - 1);
  const h = w;

  const toSvg = (x: number, y: number) => ({
    cx: pad + (x - BOARD_MIN) * cell,
    cy: pad + (BOARD_MAX - y) * cell, // y-up mathematical
  });

  const ticks: number[] = [];
  for (let i = BOARD_MIN; i <= BOARD_MAX; i++) ticks.push(i);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mx-auto block h-auto w-full max-w-[520px] select-none"
        role="img"
        aria-label="좌표평면 오목판. 순서쌍으로만 둘 수 있어요."
      >
        <defs>
          <linearGradient id="omokPlaneBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8F8F0" />
            <stop offset="55%" stopColor="#FEF9F0" />
            <stop offset="100%" stopColor="#D6EEFF" />
          </linearGradient>
        </defs>
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          rx={16}
          fill="url(#omokPlaneBg)"
        />

        {/* Grid */}
        {ticks.map((t) => {
          const v = toSvg(t, 0);
          const hLine = toSvg(0, t);
          return (
            <g key={`g-${t}`}>
              <line
                x1={v.cx}
                y1={pad}
                x2={v.cx}
                y2={h - pad}
                stroke={t === 0 ? "#8B5E3C" : "#8B5E3C22"}
                strokeWidth={t === 0 ? 2 : 1}
              />
              <line
                x1={pad}
                y1={hLine.cy}
                x2={w - pad}
                y2={hLine.cy}
                stroke={t === 0 ? "#8B5E3C" : "#8B5E3C22"}
                strokeWidth={t === 0 ? 2 : 1}
              />
            </g>
          );
        })}

        {/* Axis arrows / labels */}
        <text
          x={w - 10}
          y={toSvg(0, 0).cy - 8}
          textAnchor="end"
          className="fill-wood text-[11px] font-bold"
        >
          x
        </text>
        <text
          x={toSvg(0, 0).cx + 8}
          y={14}
          className="fill-wood text-[11px] font-bold"
        >
          y
        </text>
        <text
          x={toSvg(0, 0).cx + 6}
          y={toSvg(0, 0).cy + 14}
          className="fill-wood/70 text-[9px]"
        >
          O
        </text>

        {/* Tick labels (every 5) */}
        {ticks
          .filter((t) => t !== 0 && t % 5 === 0)
          .map((t) => {
            const onX = toSvg(t, 0);
            const onY = toSvg(0, t);
            return (
              <g key={`lab-${t}`}>
                <text
                  x={onX.cx}
                  y={onX.cy + 12}
                  textAnchor="middle"
                  className="fill-wood/55 text-[8px]"
                >
                  {t}
                </text>
                <text
                  x={onY.cx - 10}
                  y={onY.cy + 3}
                  textAnchor="end"
                  className="fill-wood/55 text-[8px]"
                >
                  {t}
                </text>
              </g>
            );
          })}

        {/* Preview ghost */}
        {preview &&
          (() => {
            const { cx, cy } = toSvg(preview.x, preview.y);
            const occupied = getStone(board, preview.x, preview.y) !== null;
            return (
              <circle
                cx={cx}
                cy={cy}
                r={8}
                fill={
                  occupied
                    ? "#e85d4c44"
                    : myStone === "white"
                      ? "#ffffff99"
                      : "#1a1a1a66"
                }
                stroke={occupied ? "#e85d4c" : "#8B5E3C"}
                strokeWidth={1.5}
                strokeDasharray="3 2"
              />
            );
          })()}

        {/* Stones */}
        {[...board.entries()].map(([key, stone]) => {
          const { x, y } = (() => {
            const [xs, ys] = key.split(",");
            return { x: Number(xs), y: Number(ys) };
          })();
          const { cx, cy } = toSvg(x, y);
          const isLast =
            lastMove && lastMove.x === x && lastMove.y === y;
          return (
            <g key={key}>
              <circle
                cx={cx}
                cy={cy}
                r={9}
                fill={stone === "black" ? "#1f1f1f" : "#fffef8"}
                stroke={stone === "black" ? "#000" : "#8B5E3C"}
                strokeWidth={1.2}
                filter={
                  stone === "white"
                    ? "drop-shadow(0 1px 1px rgba(0,0,0,.15))"
                    : undefined
                }
              />
              {isLast ? (
                <circle
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={stone === "black" ? "#FFD76A" : "#e85d4c"}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-xs font-semibold text-wood/55">
        판을 눌러서 두지 않아요 · 아래 순서쌍으로만 착수
        {preview ? (
          <>
            {" "}
            · 미리보기{" "}
            <span className="font-display text-wood">
              ({preview.x}, {preview.y})
            </span>
          </>
        ) : null}
      </p>
    </div>
  );
}
