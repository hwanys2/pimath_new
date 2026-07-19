"use client";

import { BOARD_MAX, BOARD_MIN, formatPair } from "@/lib/ordered-pair-omok-math";

type Props = {
  x: number | null;
  y: number | null;
  onChangeX: (v: number | null) => void;
  onChangeY: (v: number | null) => void;
  onPlace: () => void;
  disabled?: boolean;
  placeLabel?: string;
};

const RANGE: number[] = [];
for (let i = BOARD_MIN; i <= BOARD_MAX; i++) RANGE.push(i);

function AxisPad({
  axis,
  value,
  onChange,
  disabled,
}: {
  axis: "x" | "y";
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-lg text-wood">
          {axis}좌표
        </p>
        <p className="text-sm font-semibold text-wood/60">
          {value === null ? "선택하세요" : `${axis} = ${value}`}
        </p>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-11">
        {RANGE.map((n) => {
          const selected = value === n;
          return (
            <button
              key={`${axis}-${n}`}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selected ? null : n)}
              className={[
                "rounded-lg px-0 py-2 text-sm font-black transition",
                "disabled:cursor-not-allowed disabled:opacity-40",
                selected
                  ? "bg-mint text-wood shadow-sm ring-2 ring-wood/30"
                  : n === 0
                    ? "bg-gold/50 text-wood hover:bg-gold/70"
                    : "bg-white/70 text-wood hover:bg-sky/40",
              ].join(" ")}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function OrderedPairPad({
  x,
  y,
  onChangeX,
  onChangeY,
  onPlace,
  disabled = false,
  placeLabel = "이 순서쌍에 두기",
}: Props) {
  const ready = x !== null && y !== null;

  return (
    <div className="space-y-4 rounded-2xl bg-white/55 p-4 ring-1 ring-wood/10">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-wood/50">
          순서쌍 입력
        </p>
        <p className="font-display text-3xl text-wood">
          {ready ? formatPair(x!, y!) : "( x , y )"}
        </p>
        <p className="mt-1 text-sm text-wood/60">
          x를 고르고, y를 고른 뒤 두세요. 좌표평면의 한 점이에요.
        </p>
      </div>

      <AxisPad axis="x" value={x} onChange={onChangeX} disabled={disabled} />
      <AxisPad axis="y" value={y} onChange={onChangeY} disabled={disabled} />

      <button
        type="button"
        disabled={disabled || !ready}
        onClick={onPlace}
        className="w-full rounded-xl bg-wood px-4 py-3 font-display text-lg text-[#FEF9F0] shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {ready ? `${formatPair(x!, y!)} ${placeLabel}` : placeLabel}
      </button>
    </div>
  );
}
