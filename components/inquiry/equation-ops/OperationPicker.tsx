"use client";

import { useState } from "react";
import {
  applyOp,
  parseOpValue,
  validateOp,
  type EquationOpsState,
  type OpInput,
  type OpKind,
  type OpTarget,
} from "@/lib/equation-ops-math";

type Props = {
  state: EquationOpsState;
  disabled?: boolean;
  onApply: (next: EquationOpsState) => void;
};

const KINDS: { id: OpKind; label: string }[] = [
  { id: "add", label: "더하기" },
  { id: "subtract", label: "빼기" },
  { id: "multiply", label: "곱하기" },
  { id: "divide", label: "나누기" },
];

export default function OperationPicker({
  state,
  disabled = false,
  onApply,
}: Props) {
  const [kind, setKind] = useState<OpKind>("subtract");
  const [target, setTarget] = useState<OpTarget>("constant");
  const [valueInput, setValueInput] = useState("3");
  const [error, setError] = useState<string | null>(null);

  const showTarget = kind === "add" || kind === "subtract";

  const handleApply = () => {
    setError(null);
    const value = parseOpValue(valueInput);
    if (value === null) {
      setError("숫자를 입력해 주세요.");
      return;
    }

    const op: OpInput = { kind, target: showTarget ? target : "constant", value };
    const check = validateOp(state, op);
    if (!check.ok) {
      setError(check.message);
      return;
    }

    onApply(applyOp(state, op));
  };

  return (
    <div className="space-y-3 rounded-xl border-2 border-lavender/35 bg-lavender/10 p-4">
      <p className="text-xs font-bold text-wood">연산 선택</p>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            disabled={disabled}
            onClick={() => setKind(k.id)}
            className={[
              "rounded-lg px-3 py-2 text-xs font-bold",
              kind === k.id
                ? "bg-wood text-cream"
                : "bg-cream text-wood hover:bg-wood/10",
            ].join(" ")}
          >
            {k.label}
          </button>
        ))}
      </div>

      {showTarget ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-wood">대상</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setTarget("constant")}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-bold",
              target === "constant"
                ? "bg-sky/60 text-wood"
                : "bg-cream text-wood/70",
            ].join(" ")}
          >
            상수
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setTarget("x")}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-bold",
              target === "x"
                ? "bg-sky/60 text-wood"
                : "bg-cream text-wood/70",
            ].join(" ")}
          >
            x
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={valueInput}
          onChange={(e) => {
            setValueInput(e.target.value);
            setError(null);
          }}
          disabled={disabled}
          className="w-16 rounded-lg border-2 border-wood/20 bg-cream px-2 py-1.5 text-center text-sm font-bold text-wood tabular-nums"
          aria-label="연산 값"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={handleApply}
          className="rounded-lg bg-wood px-5 py-2 text-xs font-bold text-cream disabled:opacity-40"
        >
          적용
        </button>
      </div>

      {error ? (
        <p className="text-center text-xs font-bold text-[#a63a1a]" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
