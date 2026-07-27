"use client";

import { useState } from "react";
import { evaluateExpression, formatNumber } from "@/lib/board-math";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

const KEYS: { label: string; insert?: string; action?: "clear" | "back" | "eval"; wide?: boolean; accent?: string }[] = [
  { label: "C", action: "clear", accent: "bg-red-100 text-red-700" },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "⌫", action: "back", accent: "bg-black/10" },
  { label: "÷", insert: "÷", accent: "bg-peach/60" },
  { label: "7", insert: "7" },
  { label: "8", insert: "8" },
  { label: "9", insert: "9" },
  { label: "√", insert: "sqrt(", accent: "bg-lavender/60" },
  { label: "×", insert: "×", accent: "bg-peach/60" },
  { label: "4", insert: "4" },
  { label: "5", insert: "5" },
  { label: "6", insert: "6" },
  { label: "^", insert: "^", accent: "bg-lavender/60" },
  { label: "−", insert: "−", accent: "bg-peach/60" },
  { label: "1", insert: "1" },
  { label: "2", insert: "2" },
  { label: "3", insert: "3" },
  { label: "π", insert: "π", accent: "bg-lavender/60" },
  { label: "+", insert: "+", accent: "bg-peach/60" },
  { label: "0", insert: "0", wide: true },
  { label: ".", insert: "." },
  { label: "=", action: "eval", wide: true, accent: "bg-gold" },
];

export default function CalculatorWidget({ state, setState }: Props) {
  const expr = (state.expr as string) ?? "";
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const press = (key: (typeof KEYS)[number]) => {
    setError(false);
    if (key.action === "clear") {
      setState({ expr: "" });
      setResult(null);
    } else if (key.action === "back") {
      setState({ expr: expr.slice(0, -1) });
      setResult(null);
    } else if (key.action === "eval") {
      if (!expr.trim()) return;
      const value = evaluateExpression(expr);
      if (value === null) {
        setError(true);
        setResult(null);
      } else {
        setResult(formatNumber(value));
      }
    } else if (key.insert) {
      // Start fresh after showing a result if a value key is pressed
      if (result !== null && /[0-9π.]|sqrt/.test(key.insert)) {
        setState({ expr: key.insert });
      } else if (result !== null) {
        setState({ expr: result + key.insert });
      } else {
        setState({ expr: expr + key.insert });
      }
      setResult(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div
        className={`flex min-h-16 flex-col items-end justify-center rounded-xl border-2 px-3 py-2 ${
          error ? "border-red-300 bg-red-50" : "border-black/10 bg-[#f6f1e7]"
        }`}
      >
        <p className="max-w-full truncate font-mono text-sm text-wood">
          {expr || "0"}
        </p>
        <p className="font-display max-w-full truncate text-3xl text-[#3d2c1e]">
          {error ? "오류" : (result ?? "")}
        </p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-5 gap-1.5">
        {KEYS.map((key) => (
          <button
            key={key.label}
            type="button"
            onClick={() => press(key)}
            className={`font-display rounded-xl border-2 border-black/5 text-lg text-[#3d2c1e] shadow-[0_2px_0_rgba(0,0,0,0.1)] transition hover:brightness-95 active:translate-y-0.5 ${
              key.accent ?? "bg-white"
            } ${key.wide ? "col-span-2" : ""}`}
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}
