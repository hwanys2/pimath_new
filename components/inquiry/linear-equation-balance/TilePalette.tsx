"use client";

import AlgebraTile, { tileWidth } from "./AlgebraTile";
import type { TileKind } from "@/lib/linear-equation-balance-math";

const PALETTE_KINDS: TileKind[] = ["x", "neg_x", "one", "neg_one"];

type Props = {
  allowNegatives: boolean;
  disabled?: boolean;
  onPalettePointerDown: (
    e: React.PointerEvent,
    kind: TileKind,
  ) => void;
};

export default function TilePalette({
  allowNegatives,
  disabled = false,
  onPalettePointerDown,
}: Props) {
  const kinds = allowNegatives
    ? PALETTE_KINDS
    : PALETTE_KINDS.filter((k) => k !== "neg_x" && k !== "neg_one");

  return (
    <div className="rounded-xl border-2 border-wood/12 bg-cream/95 p-4">
      <p className="mb-3 text-center text-xs font-bold text-wood/70">
        막대를 끌어 접시에 놓으면 복제되어 추가돼요
      </p>
      <div className="flex flex-wrap items-end justify-center gap-6">
        {kinds.map((kind) => {
          const w = tileWidth(kind, 0.82);
          return (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              onPointerDown={(e) => {
                if (disabled) return;
                onPalettePointerDown(e, kind);
              }}
              className="flex flex-col items-center gap-1 rounded-lg border-2 border-transparent p-2 transition hover:border-mint/50 hover:bg-mint/10 disabled:opacity-40"
              aria-label={`${kind} 막대 끌어오기`}
            >
              <svg
                width={w + 8}
                height={40}
                className="overflow-visible touch-none"
              >
                <AlgebraTile kind={kind} scale={0.82} />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
