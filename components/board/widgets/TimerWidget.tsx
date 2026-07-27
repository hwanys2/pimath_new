"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

function playAlarm() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = i % 2 === 0 ? 880 : 1174;
      const t = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    }
    setTimeout(() => ctx.close(), 2200);
  } catch {
    // Audio not available; ignore.
  }
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtStopwatch(ms: number): string {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${cs}`;
}

const PRESETS = [60, 180, 300, 600];

export default function TimerWidget({ state, setState }: Props) {
  const mode = (state.mode as string) ?? "timer";
  const durationSec = (state.durationSec as number) ?? 300;

  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  // Timer: absolute end time; stopwatch: accumulated + start
  const endRef = useRef(0);
  const accRef = useRef(0);
  const startRef = useRef(0);
  const [remainingMs, setRemainingMs] = useState(durationSec * 1000);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (mode === "timer") {
        const rem = endRef.current - Date.now();
        if (rem <= 0) {
          setRunning(false);
          setRemainingMs(0);
          setFinished(true);
          playAlarm();
        } else {
          setRemainingMs(rem);
        }
      } else {
        setElapsedMs(accRef.current + (Date.now() - startRef.current));
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, mode]);

  const start = useCallback(() => {
    setFinished(false);
    if (mode === "timer") {
      const base = remainingMs > 0 ? remainingMs : durationSec * 1000;
      endRef.current = Date.now() + base;
    } else {
      startRef.current = Date.now();
    }
    setRunning(true);
  }, [mode, remainingMs, durationSec]);

  const pause = useCallback(() => {
    if (mode === "stopwatch") {
      accRef.current += Date.now() - startRef.current;
      setElapsedMs(accRef.current);
    }
    setRunning(false);
  }, [mode]);

  const reset = useCallback(
    (sec?: number) => {
      setRunning(false);
      setFinished(false);
      const d = sec ?? durationSec;
      if (sec !== undefined) setState({ durationSec: sec });
      setRemainingMs(d * 1000);
      accRef.current = 0;
      setElapsedMs(0);
    },
    [durationSec, setState],
  );

  const switchMode = (m: string) => {
    setRunning(false);
    setFinished(false);
    accRef.current = 0;
    setElapsedMs(0);
    setRemainingMs(durationSec * 1000);
    setState({ mode: m });
  };

  const display = mode === "timer" ? fmt(remainingMs) : fmtStopwatch(elapsedMs);
  const urgent = mode === "timer" && running && remainingMs <= 10_000;

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex gap-1 rounded-xl bg-black/5 p-1">
        {[
          ["timer", "타이머"],
          ["stopwatch", "스톱워치"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchMode(key)}
            className={`font-display flex-1 rounded-lg px-2 py-1 text-sm transition ${
              mode === key
                ? "bg-wood text-cream shadow"
                : "text-wood hover:bg-black/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className={`flex min-h-0 flex-1 items-center justify-center rounded-xl transition ${
          finished
            ? "animate-pulse bg-red-500 text-white"
            : urgent
              ? "bg-red-50 text-red-600"
              : "bg-[#f6f1e7] text-[#3d2c1e]"
        }`}
        style={{ containerType: "size" }}
      >
        <span
          className="font-display tabular-nums"
          style={{ fontSize: "min(34cqw, 70cqh)", lineHeight: 1 }}
        >
          {display}
        </span>
      </div>

      {mode === "timer" ? (
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => reset(sec)}
              className={`font-display flex-1 rounded-lg px-1 py-1 text-xs transition ${
                durationSec === sec
                  ? "bg-sky text-[#1a4a6e]"
                  : "bg-black/5 text-wood hover:bg-black/10"
              }`}
            >
              {sec / 60}분
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const next = durationSec + 60;
              setState({ durationSec: next });
              if (!running) setRemainingMs((r) => r + 60_000);
            }}
            className="font-display flex-1 rounded-lg bg-black/5 px-1 py-1 text-xs text-wood transition hover:bg-black/10"
          >
            +1분
          </button>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={running ? pause : start}
          className={`font-display flex-1 rounded-xl px-3 py-2 text-base text-white shadow-[0_3px_0_rgba(0,0,0,0.2)] transition active:translate-y-0.5 ${
            running
              ? "bg-orange-500 hover:brightness-105"
              : "bg-emerald-500 hover:brightness-105"
          }`}
        >
          {running ? "일시정지" : "시작"}
        </button>
        <button
          type="button"
          onClick={() => reset()}
          className="font-display rounded-xl bg-black/10 px-4 py-2 text-base text-[#3d2c1e] transition hover:bg-black/15"
        >
          초기화
        </button>
      </div>
    </div>
  );
}
