"use client";

import AlgebraTile, { tileWidth } from "./AlgebraTile";
import { PALETTE_DIVIDER_Y, PALETTE_Y, SCALE_VB_H, SCALE_VB_W } from "./BalanceScale";
import type { TileKind } from "@/lib/linear-equation-balance-math";

const PALETTE_KINDS: TileKind[] = ["x", "neg_x", "one", "neg_one"];
const PALETTE_SCALE = 0.82;
const PALETTE_GAP = 28;

type Props = {
  allowNegatives: boolean;
  disabled?: boolean;
  onPalettePointerDown: (
    e: React.PointerEvent,
    kind: TileKind,
  ) => void;
};

function layoutKinds(kinds: TileKind[]) {
  const widths = kinds.map((k) => tileWidth(k, PALETTE_SCALE));
  const total =
    widths.reduce((a, b) => a + b, 0) + PALETTE_GAP * (kinds.length - 1);
  let x = (SCALE_VB_W - total) / 2;
  return kinds.map((kind, i) => {
    const pos = { kind, x, y: PALETTE_Y };
    x += widths[i] + PALETTE_GAP;
    return pos;
  });
}

export default function TilePalette({
  allowNegatives,
  disabled = false,
  onPalettePointerDown,
}: Props) {
  const kinds = allowNegatives
    ? PALETTE_KINDS
    : PALETTE_KINDS.filter((k) => k !== "neg_x" && k !== "neg_one");
  const slots = layoutKinds(kinds);

  return (
    <g>
      <line
        x1={48}
        y1={PALETTE_DIVIDER_Y}
        x2={SCALE_VB_W - 48}
        y2={PALETTE_DIVIDER_Y}
        stroke="#d8d0c4"
        strokeWidth={1.5}
        strokeDasharray="6 5"
      />
      <rect
        x={40}
        y={PALETTE_DIVIDER_Y + 6}
        width={SCALE_VB_W - 80}
        height={SCALE_VB_H - PALETTE_DIVIDER_Y - 14}
        rx={14}
        fill="rgba(255,255,255,0.45)"
        stroke="#e0d8cc"
        strokeWidth={1}
      />
      <text
        x={SCALE_VB_W / 2}
        y={PALETTE_DIVIDER_Y + 26}
        textAnchor="middle"
        fontSize={11}
        fontWeight="bold"
        fill="#9a8e80"
      >
        막대를 끌어 접시에 놓으면 복제되어 추가돼요
      </text>
      {slots.map(({ kind, x, y }) => (
        <g
          key={kind}
          transform={`translate(${x}, ${y})`}
          style={{
            cursor: disabled ? "default" : "grab",
            opacity: disabled ? 0.4 : 1,
          }}
          onPointerDown={(e) => {
            if (disabled) return;
            onPalettePointerDown(e, kind);
          }}
        >
          <rect
            x={-6}
            y={-6}
            width={tileWidth(kind, PALETTE_SCALE) + 12}
            height={40}
            rx={8}
            fill="transparent"
            stroke="transparent"
          />
          <AlgebraTile kind={kind} scale={PALETTE_SCALE} />
        </g>
      ))}
    </g>
  );
}
