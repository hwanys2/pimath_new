"use client";

import {
  applyBothSides,
  isBalanced,
  type BalanceState,
  type TileKind,
} from "@/lib/linear-equation-balance-math";
import BalanceScale from "./BalanceScale";
import { tileLabel } from "./AlgebraTile";

type Props = {
  state: BalanceState;
  onChange: (state: BalanceState) => void;
  allowNegatives: boolean;
  readOnly?: boolean;
  disabled?: boolean;
};

const PALETTE: TileKind[] = ["x", "neg_x", "one", "neg_one"];

const TOOL_BUTTONS: { tile: TileKind; label: string }[] = [
  { tile: "one", label: "양변에 +1" },
  { tile: "neg_one", label: "양변에 −1" },
  { tile: "x", label: "양변에 +x" },
  { tile: "neg_x", label: "양변에 −x" },
];

export default function BalanceWorkspace({
  state,
  onChange,
  allowNegatives,
  readOnly = false,
  disabled = false,
}: Props) {
  const locked = readOnly || disabled;

  const applyTool = (tile: TileKind) => {
    if (locked) return;
    if (!allowNegatives && (tile === "neg_x" || tile === "neg_one")) return;
    onChange(applyBothSides(state, tile));
  };

  const removeFromBoth = (tile: TileKind) => {
    if (locked) return;
    const opposite: TileKind =
      tile === "x"
        ? "neg_x"
        : tile === "neg_x"
          ? "x"
          : tile === "one"
            ? "neg_one"
            : "one";
    if (!allowNegatives && (opposite === "neg_x" || opposite === "neg_one"))
      return;
    onChange(applyBothSides(state, opposite));
  };

  const visiblePalette = allowNegatives
    ? PALETTE
    : PALETTE.filter((t) => t !== "neg_x" && t !== "neg_one");

  const visibleTools = allowNegatives
    ? TOOL_BUTTONS
    : TOOL_BUTTONS.filter(
        (b) => b.tile !== "neg_x" && b.tile !== "neg_one",
      );

  return (
    <div className="space-y-4">
      <BalanceScale state={state} readOnly={readOnly} />

      <div
        className={[
          "rounded-xl px-4 py-2 text-center text-sm font-bold",
          isBalanced(state)
            ? "bg-mint/30 text-wood"
            : "bg-[#e85d4c]/15 text-[#a63a1a]",
        ].join(" ")}
        role="status"
      >
        {isBalanced(state)
          ? "⚖ 저울이 균형을 이뤄요!"
          : "저울이 기울어 있어요. 양변의 식이 같아지도록 막대를 옮겨 보세요."}
      </div>

      {!readOnly ? (
        <>
          <div className="rounded-xl border-2 border-wood/15 bg-cream/80 p-4">
            <p className="mb-3 text-center text-xs font-bold text-wood/70">
              등식의 성질 — 양변에 같은 막대를 더하거나 빼 보세요
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {visibleTools.map(({ tile, label }) => (
                <button
                  key={tile}
                  type="button"
                  onClick={() => applyTool(tile)}
                  disabled={locked}
                  className="rounded-lg bg-sky/40 px-3 py-2 text-xs font-bold text-wood hover:bg-sky/60 disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border-2 border-wood/15 bg-cream/80 p-4">
            <p className="mb-3 text-center text-xs font-bold text-wood/70">
              양변에서 같은 막대 빼기
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {visiblePalette.map((tile) => (
                <button
                  key={`rm-${tile}`}
                  type="button"
                  onClick={() => removeFromBoth(tile)}
                  disabled={locked}
                  className="rounded-lg border border-wood/20 bg-cream px-3 py-2 text-xs font-bold text-wood hover:bg-wood/5 disabled:opacity-40"
                >
                  양변에서 {tileLabel(tile)} 빼기
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
