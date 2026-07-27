"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [26, 26],
    [50, 50],
    [74, 74],
  ],
  4: [
    [30, 30],
    [70, 30],
    [30, 70],
    [70, 70],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [30, 26],
    [70, 26],
    [30, 50],
    [70, 50],
    [30, 74],
    [70, 74],
  ],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div
      className={`aspect-square w-full max-w-[140px] rounded-2xl border-2 border-black/10 bg-white shadow-[0_5px_0_rgba(0,0,0,0.15)] ${
        rolling ? "dice-shake" : "dice-settle"
      }`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        {PIP_LAYOUT[value].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="9" fill="#3d2c1e" />
        ))}
      </svg>
    </div>
  );
}

export default function DiceWidget({ state, setState }: Props) {
  const count = (state.count as number) ?? 2;
  const [values, setValues] = useState<number[]>(() =>
    Array.from({ length: count }, () => 1),
  );
  const [rolling, setRolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive display values instead of syncing state when count changes.
  const displayValues = Array.from({ length: count }, (_, i) => values[i] ?? 1);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    const started = Date.now();
    timerRef.current = setInterval(() => {
      setValues(
        Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6)),
      );
      if (Date.now() - started > 700 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setRolling(false);
      }
    }, 80);
  };

  const sum = displayValues.reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-1 rounded-xl bg-black/5 p-1">
        <span className="font-display px-2 text-sm text-wood">개수</span>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setState({ count: n })}
            className={`font-display flex-1 rounded-lg px-2 py-1 text-sm transition ${
              count === n ? "bg-wood text-cream shadow" : "text-wood hover:bg-black/5"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 rounded-xl bg-[#f6f1e7] p-3">
        {displayValues.map((v, i) => (
          <Die key={i} value={v} rolling={rolling} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={roll}
          disabled={rolling}
          className="font-display flex-1 rounded-xl bg-sky px-3 py-2 text-base text-[#1a4a6e] shadow-[0_3px_0_rgba(26,74,110,0.25)] transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-60"
        >
          굴리기
        </button>
        {count > 1 ? (
          <span className="font-display rounded-xl bg-gold px-4 py-2 text-base text-[#6b4a00]">
            합 {sum}
          </span>
        ) : null}
      </div>
    </div>
  );
}
