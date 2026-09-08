"use client";

import { useState } from "react";
import type { AlkagiStone } from "@/lib/alkagi-types";
import { getLinearEquation } from "@/lib/alkagi-physics";

type Props = {
  selectedStone: AlkagiStone | null;
  slope: number | null;
  isVertical: boolean;
  disabled?: boolean;
  onSelectSlope: (slope: number | null, isVertical: boolean) => void;
};

const COMMON_SLOPES: { label: string; slope: number | null; isVertical: boolean }[] = [
  { label: "수직", slope: null, isVertical: true },
  { label: "-3", slope: -3, isVertical: false },
  { label: "-2", slope: -2, isVertical: false },
  { label: "-1", slope: -1, isVertical: false },
  { label: "-1/2", slope: -0.5, isVertical: false },
  { label: "0", slope: 0, isVertical: false },
  { label: "1/2", slope: 0.5, isVertical: false },
  { label: "1", slope: 1, isVertical: false },
  { label: "2", slope: 2, isVertical: false },
  { label: "3", slope: 3, isVertical: false },
];

function parseSlopeInput(val: string): { slope: number | null; isVertical: boolean } | null {
  const trimmed = val.trim().toLowerCase();
  if (trimmed === "수직" || trimmed === "v" || trimmed === "vertical") {
    return { slope: null, isVertical: true };
  }
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length === 2) {
      const num = Number(parts[0]);
      const den = Number(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return { slope: num / den, isVertical: false };
      }
    }
  }
  const n = Number(trimmed);
  if (!isNaN(n)) {
    return { slope: n, isVertical: false };
  }
  return null;
}

export default function AlkagiControls({
  selectedStone,
  slope,
  isVertical,
  disabled = false,
  onSelectSlope,
}: Props) {
  const [prevSlope, setPrevSlope] = useState(slope);
  const [prevIsVertical, setPrevIsVertical] = useState(isVertical);
  const [inputText, setInputText] = useState<string>(() =>
    isVertical ? "수직" : slope != null ? String(slope) : "1",
  );

  if (slope !== prevSlope || isVertical !== prevIsVertical) {
    setPrevSlope(slope);
    setPrevIsVertical(isVertical);
    setInputText(isVertical ? "수직" : slope != null ? String(slope) : "1");
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const txt = e.target.value;
    setInputText(txt);
    const parsed = parseSlopeInput(txt);
    if (parsed) {
      onSelectSlope(parsed.slope, parsed.isVertical);
    }
  };

  const handleStep = (delta: number) => {
    if (disabled) return;
    const current = isVertical ? 0 : (slope ?? 0);
    const next = Math.round((current + delta) * 10) / 10;
    onSelectSlope(next, false);
  };

  const eq = selectedStone
    ? getLinearEquation(selectedStone, slope, isVertical)
    : null;

  return (
    <div className="space-y-3 rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-wood/10 sm:p-5">
      {/* Stone & Equation info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-wood/10 pb-3">
        <div>
          <span className="text-xs font-bold text-wood/60">선택한 바둑알</span>
          {selectedStone ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full ring-2 ${
                  selectedStone.color === "black"
                    ? "bg-slate-900 ring-slate-400"
                    : "bg-white ring-slate-300"
                }`}
              />
              <span className="text-sm font-black tabular-nums text-wood">
                ({selectedStone.x}, {selectedStone.y})
              </span>
            </div>
          ) : (
            <p className="text-xs font-bold text-rose-600 mt-0.5 animate-pulse">
              판에서 내 바둑알을 클릭하세요
            </p>
          )}
        </div>

        {eq ? (
          <div className="text-right">
            <span className="text-xs font-bold text-wood/60">직선의 방정식</span>
            <p className="font-mono text-sm font-black text-amber-900">
              {eq.slopeIntercept}
            </p>
          </div>
        ) : null}
      </div>

      {/* Slope Input & Quick Presets */}
      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="slopeInput"
            className="text-xs font-bold text-wood/70"
          >
            기울기 <span className="font-mono italic font-bold">m</span> 입력 (분수 가능 예: 1/2)
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleStep(-1)}
              className="rounded px-1.5 py-0.5 text-xs font-bold bg-wood/10 hover:bg-wood/20 disabled:opacity-40"
              title="-1"
            >
              -1
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleStep(-0.1)}
              className="rounded px-1.5 py-0.5 text-xs font-bold bg-wood/10 hover:bg-wood/20 disabled:opacity-40"
              title="-0.1"
            >
              -0.1
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleStep(0.1)}
              className="rounded px-1.5 py-0.5 text-xs font-bold bg-wood/10 hover:bg-wood/20 disabled:opacity-40"
              title="+0.1"
            >
              +0.1
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleStep(1)}
              className="rounded px-1.5 py-0.5 text-xs font-bold bg-wood/10 hover:bg-wood/20 disabled:opacity-40"
              title="+1"
            >
              +1
            </button>
          </div>
        </div>

        <div className="mt-1.5 flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-wood/50">
              m =
            </span>
            <input
              id="slopeInput"
              type="text"
              value={inputText}
              onChange={handleInputChange}
              disabled={disabled}
              placeholder="예: 2 또는 -1/2"
              className="w-full rounded-xl border border-wood/20 bg-white py-2 pl-11 pr-3 font-mono text-base font-bold text-wood shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-40"
            />
          </div>
        </div>

        {/* Quick Slope Chips */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {COMMON_SLOPES.map((item) => {
            const isSelected =
              (item.isVertical && isVertical) ||
              (!item.isVertical && !isVertical && slope === item.slope);
            return (
              <button
                key={item.label}
                type="button"
                disabled={disabled}
                onClick={() => onSelectSlope(item.slope, item.isVertical)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-amber-600 text-white shadow-sm ring-1 ring-amber-700"
                    : "bg-wood/10 text-wood/80 hover:bg-wood/20 active:scale-95 disabled:opacity-40"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
