"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

const SEGMENTS = 20;

export default function NoiseWidget({ state, setState }: Props) {
  const threshold = (state.threshold as number) ?? 60;

  const [listening, setListening] = useState(false);
  const [denied, setDenied] = useState(false);
  const [level, setLevel] = useState(0); // 0..100 smoothed
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setListening(false);
    setLevel(0);
  }, []);

  useEffect(() => stop, [stop]);

  const start = async () => {
    setDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      let smoothed = 0;

      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        // Map RMS (~0..0.5) to 0..100 with a soft curve
        const target = Math.min(100, Math.pow(rms * 2.4, 0.6) * 100);
        smoothed = target > smoothed ? target : smoothed * 0.92 + target * 0.08;
        setLevel(smoothed);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      setListening(true);
    } catch {
      setDenied(true);
      stop();
    }
  };

  const over = listening && level >= threshold;
  const activeSegments = Math.round((level / 100) * SEGMENTS);
  const thresholdSegment = Math.round((threshold / 100) * SEGMENTS);

  return (
    <div
      className={`flex h-full flex-col gap-2 p-3 transition ${
        over ? "bg-red-100" : ""
      }`}
    >
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 rounded-xl bg-[#f6f1e7] p-3">
        <div className="flex h-8 items-end gap-[3px]">
          {Array.from({ length: SEGMENTS }).map((_, i) => {
            const on = listening && i < activeSegments;
            const color =
              i < SEGMENTS * 0.5
                ? "#22c55e"
                : i < SEGMENTS * 0.75
                  ? "#facc15"
                  : "#ef4444";
            return (
              <div
                key={i}
                className="relative flex-1 rounded-sm transition-colors"
                style={{
                  height: `${40 + (i / SEGMENTS) * 60}%`,
                  background: on ? color : "rgba(0,0,0,0.08)",
                }}
              >
                {i === thresholdSegment ? (
                  <div className="absolute inset-y-[-4px] left-0 w-[2.5px] rounded bg-wood-dark" />
                ) : null}
              </div>
            );
          })}
        </div>
        <p
          className={`font-display text-center text-xl ${
            over ? "animate-pulse text-red-600" : "text-wood"
          }`}
        >
          {denied
            ? "마이크 권한이 필요해요"
            : !listening
              ? "시작을 누르면 소음을 측정해요"
              : over
                ? "너무 시끄러워요! 조용히 해주세요"
                : "좋아요, 잘하고 있어요"}
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs font-semibold text-wood">
        기준
        <input
          type="range"
          min={20}
          max={95}
          value={threshold}
          onChange={(e) => setState({ threshold: Number(e.target.value) })}
          className="flex-1"
        />
        {threshold}
      </label>

      <button
        type="button"
        onClick={listening ? stop : start}
        className={`font-display rounded-xl px-3 py-2 text-base text-white shadow-[0_3px_0_rgba(0,0,0,0.2)] transition active:translate-y-0.5 ${
          listening ? "bg-red-500 hover:brightness-105" : "bg-emerald-500 hover:brightness-105"
        }`}
      >
        {listening ? "측정 멈추기" : "측정 시작"}
      </button>
    </div>
  );
}
