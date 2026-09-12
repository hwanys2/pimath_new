"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  disabled?: boolean;
  isVertical?: boolean;
  onFire: (
    direction: "left" | "right",
    power: number,
  ) => void | Promise<void>;
};

export default function AlkagiSlider({
  disabled = false,
  isVertical = false,
  onFire,
}: Props) {
  // Value oscillates between -1.0 and +1.0
  const [value, setValue] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const disabledRef = useRef(disabled);
  const valueRef = useRef(value);

  // Period for full cycle (-1 -> +1 -> -1) in ms
  const CYCLE_MS = 2200;

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (disabled) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      return;
    }

    lockedRef.current = false;
    startTimeRef.current = null;
    let running = true;

    const tick = (time: number) => {
      if (!running || lockedRef.current) return;
      if (startTimeRef.current == null) startTimeRef.current = time;

      const elapsed = time - startTimeRef.current;
      // Sinusoidal oscillation: -1 to +1
      const phase = (elapsed % CYCLE_MS) / CYCLE_MS;
      const v = Math.sin(phase * Math.PI * 2);
      setValue(v);

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    };
  }, [disabled]);

  const resumeOscillation = useCallback(() => {
    lockedRef.current = false;
    if (disabledRef.current) return;
    if (animFrameRef.current != null) return;
    startTimeRef.current = null;
    const tick = (time: number) => {
      if (lockedRef.current || disabledRef.current) return;
      if (startTimeRef.current == null) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const phase = (elapsed % CYCLE_MS) / CYCLE_MS;
      setValue(Math.sin(phase * Math.PI * 2));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const handleShoot = useCallback(() => {
    if (disabled || lockedRef.current) return;
    lockedRef.current = true;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;

    const currentV = valueRef.current;
    const direction: "left" | "right" = currentV >= 0 ? "right" : "left";
    const power = Math.max(0.08, Math.min(1.0, Math.abs(currentV)));

    // onFire may be async (PvP RPC). Always unlock if parent did not disable us
    // via animating — otherwise a failed/early return left the needle frozen forever.
    void Promise.resolve(onFire(direction, power)).finally(() => {
      queueMicrotask(() => {
        if (disabledRef.current) {
          lockedRef.current = false;
          return;
        }
        resumeOscillation();
      });
    });
  }, [disabled, onFire, resumeOscillation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !disabled && !lockedRef.current) {
        // Prevent default page scroll
        e.preventDefault();
        handleShoot();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleShoot, disabled]);

  const percent = Math.round(Math.abs(value) * 100);
  const currentDir = value >= 0 ? "right" : "left";
  // Convert -1..1 to 0..100% for cursor position
  const cursorLeftPercent = ((value + 1) / 2) * 100;

  const leftLabel = isVertical ? "◀ 아래 (y 감소)" : "◀ 왼쪽 (x 감소)";
  const rightLabel = isVertical ? "위 (y 증가) ▶" : "오른쪽 (x 증가) ▶";
  const activeLabel =
    percent < 8
      ? "정지 (파워 약함)"
      : `${currentDir === "right" ? (isVertical ? "위로" : "오른쪽으로") : (isVertical ? "아래로" : "왼쪽으로")} ${percent}% 파워`;

  return (
    <div className="w-full rounded-2xl bg-wood/5 p-4 ring-1 ring-wood/15">
      <div className="flex items-center justify-between text-xs font-bold text-wood">
        <span className="flex items-center gap-1 text-sky-700">
          {leftLabel}
        </span>
        <span className="rounded-full bg-wood/10 px-2 py-0.5 text-[11px] text-wood/80">
          중앙: 0% 파워
        </span>
        <span className="flex items-center gap-1 text-rose-700">
          {rightLabel}
        </span>
      </div>

      {/* Track */}
      <div
        className="relative mt-2 h-9 w-full cursor-pointer select-none overflow-hidden rounded-xl bg-gradient-to-r from-sky-400 via-wood/20 to-rose-400 p-0.5 shadow-inner"
        onClick={handleShoot}
        title="클릭하거나 발사 버튼을 누르세요"
      >
        {/* Center line */}
        <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-wood/40 z-0" />

        {/* Oscillating Cursor Needle */}
        <div
          className="absolute top-1/2 h-7 w-4 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white shadow-md ring-2 ring-wood z-10 transition-transform duration-75 flex items-center justify-center"
          style={{ left: `${cursorLeftPercent}%` }}
        >
          <div className="h-4 w-1 rounded-full bg-wood" />
        </div>
      </div>

      {/* Controls & Fire button */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/70">현재 조준:</span>
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-black tabular-nums transition-colors ${
              currentDir === "right"
                ? "bg-rose-100 text-rose-800 ring-1 ring-rose-300"
                : "bg-sky-100 text-sky-800 ring-1 ring-sky-300"
            }`}
          >
            {activeLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={handleShoot}
          disabled={disabled}
          className="btn-block flex-1 sm:flex-none sm:min-w-[150px] rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-5 py-2.5 text-sm font-black text-white shadow-md hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ⚡ 발사! (Space)
        </button>
      </div>
    </div>
  );
}
