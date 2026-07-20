"use client";

import {
  BOARD_MAX,
  BOARD_MIN,
  BOARD_SIZE,
  type BoardMap,
  type Point,
  type Stone,
} from "@/lib/quadrilateral-maker-math";

type Props = {
  board: BoardMap;
  lastMove: Point | null;
  onCellClick?: (x: number, y: number) => void;
  disabled?: boolean;
};

const CELL = 28;
const PAD = 20;
const SIZE = PAD * 2 + CELL * (BOARD_SIZE - 1);

export default function QuadGridBoard({
  board,
  lastMove,
  onCellClick,
  disabled,
}: Props) {
  const points: { x: number; y: number }[] = [];
  for (let x = BOARD_MIN; x <= BOARD_MAX; x++) {
    for (let y = BOARD_MIN; y <= BOARD_MAX; y++) {
      points.push({ x, y });
    }
  }

  const toPx = (n: number) => PAD + n * CELL;

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full rounded-2xl bg-[#E8C98A]/40 ring-1 ring-wood/15"
        role="grid"
        aria-label="11×11 바둑판"
      >
        {/* grid lines */}
        {Array.from({ length: BOARD_SIZE }, (_, i) => {
          const p = toPx(i);
          return (
            <g key={`line-${i}`}>
              <line
                x1={toPx(0)}
                y1={p}
                x2={toPx(BOARD_MAX)}
                y2={p}
                stroke="#8B6914"
                strokeWidth={i === 0 || i === BOARD_MAX ? 1.2 : 0.6}
                opacity={0.45}
              />
              <line
                x1={p}
                y1={toPx(0)}
                x2={p}
                y2={toPx(BOARD_MAX)}
                stroke="#8B6914"
                strokeWidth={i === 0 || i === BOARD_MAX ? 1.2 : 0.6}
                opacity={0.45}
              />
            </g>
          );
        })}

        {/* star points */}
        {[2, 5, 8].flatMap((x) =>
          [2, 5, 8].map((y) => (
            <circle
              key={`star-${x}-${y}`}
              cx={toPx(x)}
              cy={toPx(y)}
              r={2}
              fill="#8B6914"
              opacity={0.35}
            />
          )),
        )}

        {/* intersections */}
        {points.map(({ x, y }) => {
          const stone = board.get(`${x},${y}`);
          const isLast = lastMove?.x === x && lastMove?.y === y;
          const cx = toPx(x);
          const cy = toPx(y);
          const canClick = !disabled && !stone && onCellClick;

          return (
            <g key={`${x},${y}`}>
              {canClick ? (
                <circle
                  cx={cx}
                  cy={cy}
                  r={12}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onCellClick(x, y)}
                />
              ) : null}
              {stone ? (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={10}
                    fill={stone === "black" ? "#2a2118" : "#f5f0e8"}
                    stroke={stone === "black" ? "#1a1510" : "#8B6914"}
                    strokeWidth={1}
                  />
                  {isLast ? (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill={stone === "black" ? "#f5c842" : "#c44"}
                    />
                  ) : null}
                </>
              ) : (
                <circle
                  cx={cx}
                  cy={cy}
                  r={2}
                  fill="#8B6914"
                  opacity={0.25}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
