"use client";

import type { TileKind } from "@/lib/linear-equation-balance-math";

const TILE_W = 28;
const TILE_H = 28;
const X_TILE_W = 112;

export const TILE_COLORS: Record<
  TileKind,
  { fill: string; stroke: string; hatch?: boolean }
> = {
  x: { fill: "#9DE8C8", stroke: "#2A9D8F" },
  neg_x: { fill: "#FFB4A8", stroke: "#C45C4A", hatch: true },
  one: { fill: "#A8D8FF", stroke: "#4A90C8" },
  neg_one: { fill: "#FFB4A8", stroke: "#C45C4A", hatch: true },
};

export function tileLabel(kind: TileKind): string {
  switch (kind) {
    case "x":
      return "x";
    case "neg_x":
      return "−x";
    case "one":
      return "1";
    case "neg_one":
      return "−1";
  }
}

type Props = {
  kind: TileKind;
  x?: number;
  y?: number;
  scale?: number;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  className?: string;
  style?: React.CSSProperties;
};

export default function AlgebraTile({
  kind,
  x = 0,
  y = 0,
  scale = 1,
  selected = false,
  onPointerDown,
  className = "",
  style,
}: Props) {
  const isX = kind === "x" || kind === "neg_x";
  const w = (isX ? X_TILE_W : TILE_W) * scale;
  const h = TILE_H * scale;
  const colors = TILE_COLORS[kind];

  return (
    <g
      transform={`translate(${x}, ${y})`}
      className={className}
      style={style}
      onPointerDown={onPointerDown}
      role="img"
      aria-label={tileLabel(kind)}
    >
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={4 * scale}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={selected ? 3 * scale : 2 * scale}
        className={onPointerDown ? "cursor-grab active:cursor-grabbing" : ""}
      />
      {colors.hatch ? (
        <line
          x1={2 * scale}
          y1={2 * scale}
          x2={w - 2 * scale}
          y2={h - 2 * scale}
          stroke={colors.stroke}
          strokeWidth={1.5 * scale}
          opacity={0.5}
        />
      ) : null}
      <text
        x={w / 2}
        y={h / 2 + 5 * scale}
        textAnchor="middle"
        fontSize={isX ? 14 * scale : 12 * scale}
        fontWeight="bold"
        fill="#3d2c1e"
        pointerEvents="none"
      >
        {tileLabel(kind)}
      </text>
    </g>
  );
}

export { TILE_W, TILE_H, X_TILE_W };
