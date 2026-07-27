"use client";

import { useEffect, useState } from "react";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function AnalogClock({ date }: { date: Date }) {
  const sec = date.getSeconds();
  const min = date.getMinutes() + sec / 60;
  const hour = (date.getHours() % 12) + min / 60;
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <circle cx="100" cy="100" r="94" fill="#fffdf7" stroke="#8b5e3c" strokeWidth="6" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI) / 6;
        const r1 = i % 3 === 0 ? 76 : 82;
        return (
          <line
            key={i}
            x1={100 + r1 * Math.sin(a)}
            y1={100 - r1 * Math.cos(a)}
            x2={100 + 88 * Math.sin(a)}
            y2={100 - 88 * Math.cos(a)}
            stroke="#6b4423"
            strokeWidth={i % 3 === 0 ? 4 : 2}
            strokeLinecap="round"
          />
        );
      })}
      {Array.from({ length: 12 }).map((_, i) => {
        const n = i === 0 ? 12 : i;
        const a = (i * Math.PI) / 6;
        return (
          <text
            key={n}
            x={100 + 64 * Math.sin(a)}
            y={100 - 64 * Math.cos(a)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="17"
            fontWeight="700"
            fill="#3d2c1e"
          >
            {n}
          </text>
        );
      })}
      <line
        x1="100"
        y1="100"
        x2={100 + 44 * Math.sin((hour * Math.PI) / 6)}
        y2={100 - 44 * Math.cos((hour * Math.PI) / 6)}
        stroke="#3d2c1e"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <line
        x1="100"
        y1="100"
        x2={100 + 64 * Math.sin((min * Math.PI) / 30)}
        y2={100 - 64 * Math.cos((min * Math.PI) / 30)}
        stroke="#3d2c1e"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <line
        x1="100"
        y1="100"
        x2={100 + 74 * Math.sin((sec * Math.PI) / 30)}
        y2={100 - 74 * Math.cos((sec * Math.PI) / 30)}
        stroke="#ef4444"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="100" cy="100" r="6" fill="#8b5e3c" />
    </svg>
  );
}

export default function ClockWidget({ state, setState }: Props) {
  const analog = (state.analog as boolean) ?? false;
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDate(new Date()));
    const id = setInterval(() => setDate(new Date()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  if (!date) return null;

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex gap-1 rounded-xl bg-black/5 p-1">
        {[
          [false, "디지털"],
          [true, "아날로그"],
        ].map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => setState({ analog: value })}
            className={`font-display flex-1 rounded-lg px-2 py-1 text-sm transition ${
              analog === value
                ? "bg-wood text-cream shadow"
                : "text-wood hover:bg-black/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl bg-[#f6f1e7]"
        style={{ containerType: "size" }}
      >
        {analog ? (
          <div className="h-[80cqh] w-full p-1">
            <AnalogClock date={date} />
          </div>
        ) : (
          <span
            className="font-display tabular-nums text-[#3d2c1e]"
            style={{ fontSize: "min(22cqw, 55cqh)", lineHeight: 1 }}
          >
            {hh}:{mm}
            <span className="opacity-50" style={{ fontSize: "0.55em" }}>
              :{ss}
            </span>
          </span>
        )}
        <p className="font-display mt-1 text-[min(7cqw,14cqh)] text-wood">
          {date.getFullYear()}년 {date.getMonth() + 1}월 {date.getDate()}일 (
          {DAYS[date.getDay()]})
        </p>
      </div>
    </div>
  );
}
