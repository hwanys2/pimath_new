"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applyOp,
  buildOpInput,
  parseOpTerm,
  previewOpSentence,
  termHasX,
  validateOp,
  VERB_LABELS,
  type EquationOpsState,
  type OpKind,
} from "@/lib/equation-ops-math";

type Props = {
  state: EquationOpsState;
  disabled?: boolean;
  onApply: (next: EquationOpsState) => void;
};

const KINDS: OpKind[] = ["add", "subtract", "multiply", "divide"];

function parseErrorMessage(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (parseOpTerm(trimmed)) return null;
  return "숫자, x, 3x, -3x 같은 항만 입력할 수 있어요.";
}

export default function OperationPicker({
  state,
  disabled = false,
  onApply,
}: Props) {
  const [termInput, setTermInput] = useState("3");
  const [kind, setKind] = useState<OpKind>("subtract");
  const [applyError, setApplyError] = useState<string | null>(null);

  const parsed = useMemo(() => parseOpTerm(termInput), [termInput]);
  const inputError = useMemo(() => parseErrorMessage(termInput), [termInput]);
  const hasX = parsed ? termHasX(parsed) : false;

  useEffect(() => {
    if (hasX && (kind === "multiply" || kind === "divide")) {
      setKind("subtract");
    }
  }, [hasX, kind]);

  const preview = parsed ? previewOpSentence(kind, parsed) : null;
  const canApply = Boolean(parsed) && !inputError && !disabled;

  const handleApply = () => {
    setApplyError(null);
    if (!parsed) {
      setApplyError("항을 입력해 주세요.");
      return;
    }

    const built = buildOpInput(kind, parsed);
    if (!built.ok) {
      setApplyError(built.message);
      return;
    }

    const check = validateOp(state, built.op);
    if (!check.ok) {
      setApplyError(check.message);
      return;
    }

    onApply(applyOp(state, built.op));
    setApplyError(null);
  };

  const particle = kind === "divide" ? "" : "를";
  const prefix = kind === "divide" ? "양변을" : "양변에";

  return (
    <div className="space-y-4 rounded-2xl border-2 border-lavender/40 bg-gradient-to-b from-lavender/15 to-lavender/5 p-4 sm:p-5">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-wood/70">
        연산 입력
      </p>

      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-base font-bold text-wood sm:text-lg">
          <span>{prefix}</span>
          <input
            type="text"
            inputMode="text"
            value={termInput}
            onChange={(e) => {
              setTermInput(e.target.value);
              setApplyError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canApply) handleApply();
            }}
            disabled={disabled}
            placeholder="3x"
            className="w-24 rounded-xl border-2 border-wood/25 bg-cream px-3 py-2 text-center font-mono text-lg font-bold text-wood shadow-inner focus:border-sky/60 focus:outline-none focus:ring-2 focus:ring-sky/30 disabled:opacity-50 sm:w-28 sm:text-xl"
            aria-label="연산 항"
          />
          {particle ? <span>{particle}</span> : null}
        </div>

        <div
          className="flex w-full max-w-sm flex-wrap justify-center gap-1.5"
          role="group"
          aria-label="연산 선택"
        >
          {KINDS.map((k) => {
            const scaleDisabled = hasX && (k === "multiply" || k === "divide");
            const isActive = kind === k;
            return (
              <button
                key={k}
                type="button"
                disabled={disabled || scaleDisabled}
                title={
                  scaleDisabled
                    ? "x가 있으면 더하기·빼기만 할 수 있어요"
                    : undefined
                }
                onClick={() => setKind(k)}
                className={[
                  "rounded-xl px-3 py-2 text-sm font-bold transition-colors sm:px-4",
                  isActive
                    ? "bg-wood text-cream shadow-sm"
                    : scaleDisabled
                      ? "cursor-not-allowed bg-wood/5 text-wood/30"
                      : "bg-cream text-wood hover:bg-wood/10",
                ].join(" ")}
              >
                {VERB_LABELS[k]}
              </button>
            );
          })}
        </div>
      </div>

      {preview && !inputError ? (
        <p className="text-center text-sm font-semibold text-wood/80">
          {preview}
        </p>
      ) : null}

      {inputError ? (
        <p className="text-center text-xs font-bold text-[#a63a1a]" role="status">
          {inputError}
        </p>
      ) : null}

      {applyError ? (
        <p className="text-center text-xs font-bold text-[#a63a1a]" role="status">
          {applyError}
        </p>
      ) : null}

      <div className="flex justify-center">
        <button
          type="button"
          disabled={!canApply}
          onClick={handleApply}
          className="rounded-xl bg-wood px-8 py-2.5 text-sm font-bold text-cream shadow-sm transition hover:bg-wood/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          적용
        </button>
      </div>
    </div>
  );
}
