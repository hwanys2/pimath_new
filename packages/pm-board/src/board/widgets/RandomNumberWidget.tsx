"use client";

import { useRef, useState } from "react";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

export default function RandomNumberWidget({ state, setState }: Props) {
  const min = (state.min as number) ?? 1;
  const max = (state.max as number) ?? 30;
  const noRepeat = (state.noRepeat as boolean) ?? false;

  const [current, setCurrent] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [spinning, setSpinning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const pool: number[] = [];
  for (let n = lo; n <= hi; n++) {
    if (!noRepeat || !history.includes(n)) pool.push(n);
  }

  const draw = () => {
    if (spinning || pool.length === 0) return;
    setSpinning(true);
    const started = Date.now();
    timerRef.current = setInterval(() => {
      setCurrent(pool[Math.floor(Math.random() * pool.length)]);
      if (Date.now() - started > 650 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        const value = pool[Math.floor(Math.random() * pool.length)];
        setCurrent(value);
        setHistory((h) => [...h, value]);
        setSpinning(false);
      }
    }, 60);
  };

  const reset = () => {
    setHistory([]);
    setCurrent(null);
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-2 text-sm">
        <input
          type="number"
          value={min}
          onChange={(e) => setState({ min: Number(e.target.value) })}
          className="w-16 rounded-lg border-2 border-black/10 bg-white px-2 py-1 text-center font-semibold"
          aria-label="최솟값"
        />
        <span className="text-wood">~</span>
        <input
          type="number"
          value={max}
          onChange={(e) => setState({ max: Number(e.target.value) })}
          className="w-16 rounded-lg border-2 border-black/10 bg-white px-2 py-1 text-center font-semibold"
          aria-label="최댓값"
        />
        <label className="ml-auto flex items-center gap-1 text-xs font-semibold text-wood">
          <input
            type="checkbox"
            checked={noRepeat}
            onChange={(e) => setState({ noRepeat: e.target.checked })}
          />
          중복 없이
        </label>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center rounded-xl bg-[#f6f1e7]"
        style={{ containerType: "size" }}
      >
        <span
          className={`font-display tabular-nums ${
            spinning ? "text-wood/50" : "text-[#3d2c1e]"
          }`}
          style={{ fontSize: "min(38cqw, 72cqh)", lineHeight: 1 }}
        >
          {current ?? "?"}
        </span>
      </div>

      {history.length > 0 ? (
        <p className="max-h-10 overflow-auto text-xs text-wood">
          지금까지: {history.join(", ")}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={draw}
          disabled={spinning || pool.length === 0}
          className="font-display flex-1 rounded-xl bg-sky px-3 py-2 text-base text-[#1a4a6e] shadow-[0_3px_0_rgba(26,74,110,0.25)] transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-60"
        >
          {pool.length === 0 ? "모두 뽑았어요" : "뽑기"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="font-display rounded-xl bg-black/10 px-4 py-2 text-base text-[#3d2c1e] transition hover:bg-black/15"
        >
          초기화
        </button>
      </div>
    </div>
  );
}
