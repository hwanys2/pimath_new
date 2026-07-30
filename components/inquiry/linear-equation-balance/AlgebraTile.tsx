"use client";

import type { TileKind } from "@/lib/linear-equation-balance-math";

export const TILE_UNIT = 32;
export const TILE_X_LEN = 128;
export const TILE_H = 32;

export const TILE_COLORS: Record<
  TileKind,
  { fill: string; stroke: string; shadow: string; hatch?: boolean }
> = {
  x: { fill: "#7DD3B0", stroke: "#2A9D8F", shadow: "#1a7a6c" },
  neg_x: { fill: "#FFB4A8", stroke: "#C45C4A", shadow: "#a04030", hatch: true },
  one: { fill: "#8EC8F5", stroke: "#4A90C8", shadow: "#3578a8" },
  neg_one: { fill: "#FFB4A8", stroke: "#C45C4A", shadow: "#a04030", hatch: true },
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

export function tileWidth(kind: TileKind, scale = 1): number {
  const isX = kind === "x" || kind === "neg_x";
  return (isX ? TILE_X_LEN : TILE_UNIT) * scale;
}

type Props = {
  kind: TileKind;
  x?: number;
  y?: number;
  scale?: number;
  dragging?: boolean;
  vanishing?: boolean;
  flipping?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
};

export default function AlgebraTile({
  kind,
  x = 0,
  y = 0,
  scale = 1,
  dragging = false,
  vanishing = false,
  flipping = false,
  onPointerDown,
}: Props) {
  const isX = kind === "x" || kind === "neg_x";
  const w = tileWidth(kind, scale);
  const h = TILE_H * scale;
  const colors = TILE_COLORS[kind];
  const depth = dragging ? 6 * scale : 3 * scale;
  const tileScale = vanishing ? 0.3 : flipping ? 0.85 : 1;

  return (
    <g
      transform={`translate(${x}, ${y}) scale(${tileScale})`}
      onPointerDown={onPointerDown}
      style={{
        cursor: onPointerDown ? (dragging ? "grabbing" : "grab") : undefined,
        opacity: vanishing ? 0 : flipping ? 0.45 : dragging ? 0.95 : 1,
        filter: dragging
          ? "drop-shadow(0 8px 12px rgba(61,44,30,0.35))"
          : flipping
            ? "brightness(1.15)"
            : undefined,
        transition: vanishing
          ? "opacity 0.35s, transform 0.35s"
          : flipping
            ? "opacity 0.3s, transform 0.3s, filter 0.3s"
            : undefined,
      }}
      role="img"
      aria-label={tileLabel(kind)}
    >
      <rect
        x={depth}
        y={depth}
        width={w}
        height={h}
        rx={5 * scale}
        fill={colors.shadow}
      />
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={5 * scale}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={2 * scale}
      />
      {colors.hatch ? (
        <>
          <line
            x1={4 * scale}
            y1={4 * scale}
            x2={w - 4 * scale}
            y2={h - 4 * scale}
            stroke={colors.stroke}
            strokeWidth={1.5 * scale}
            opacity={0.45}
          />
          <line
            x1={w - 4 * scale}
            y1={4 * scale}
            x2={4 * scale}
            y2={h - 4 * scale}
            stroke={colors.stroke}
            strokeWidth={1.5 * scale}
            opacity={0.45}
          />
        </>
      ) : null}
      <text
        x={w / 2}
        y={h / 2 + 6 * scale}
        textAnchor="middle"
        fontSize={isX ? 15 * scale : 13 * scale}
        fontWeight="bold"
        fill="#3d2c1e"
        pointerEvents="none"
      >
        {tileLabel(kind)}
      </text>
    </g>
  );
}
