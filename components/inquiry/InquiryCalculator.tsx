"use client";

import { useEffect, useState } from "react";
import {
  INITIAL_CALC,
  calcBack,
  calcClear,
  calcDigit,
  calcDot,
  calcEq,
  calcOp,
  type CalcOp,
  type CalcState,
} from "@/lib/inquiry-calculator";

function CalculatorGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="2.5" width="16" height="19" rx="3" />
      <rect x="7" y="5.2" width="10" height="4" rx="1" fill="currentColor" opacity="0.18" />
      <circle cx="8.2" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8.2" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
      <rect x="14.6" y="15.6" width="2.4" height="4" rx="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Key({
  label,
  ariaLabel,
  onPress,
  kind = "num",
  span = 1,
}: {
  label: string;
  ariaLabel?: string;
  onPress: () => void;
  kind?: "num" | "op" | "eq" | "fn";
  span?: 1 | 2;
}) {
  const tone =
    kind === "eq"
      ? "bg-wood text-cream hover:bg-wood-dark"
      : kind === "op"
        ? "bg-lavender/55 text-wood hover:bg-lavender/75"
        : kind === "fn"
          ? "bg-gold/55 text-wood hover:bg-gold/75"
          : "bg-white text-wood hover:bg-cream";
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      onClick={onPress}
      className={[
        "h-11 rounded-xl border-2 border-wood/15 text-base font-bold tabular-nums shadow-sm",
        span === 2 ? "col-span-2" : "",
        tone,
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function opSymbol(op: CalcOp | null): string {
  if (op === "+") return "+";
  if (op === "-") return "−";
  if (op === "*") return "×";
  if (op === "/") return "÷";
  return "";
}

export default function InquiryCalculator() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CalcState>(INITIAL_CALC);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        setState((s) => calcDigit(s, e.key));
        return;
      }
      if (e.key === ".") {
        e.preventDefault();
        setState((s) => calcDot(s));
        return;
      }
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        setState((s) => calcEq(s));
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        setState((s) => calcBack(s));
        return;
      }
      const map: Record<string, CalcOp> = {
        "+": "+",
        "-": "-",
        "*": "*",
        "/": "/",
        x: "*",
        X: "*",
      };
      const op = map[e.key];
      if (op) {
        e.preventDefault();
        setState((s) => calcOp(s, op));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        aria-label="계산기 열기"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          "inline-flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1.5 text-xs font-bold shadow-sm",
          open
            ? "border-wood/40 bg-gold/80 text-wood"
            : "border-wood/15 bg-cream text-wood hover:bg-gold/40",
        ].join(" ")}
      >
        <CalculatorGlyph className="h-4 w-4" />
        계산기
      </button>

      {open ? (
        <div className="absolute inset-0 z-30 flex items-start justify-center p-3">
          <button
            type="button"
            aria-label="계산기 닫기"
            className="absolute inset-0 rounded-2xl bg-[#fff8eb]/72 backdrop-blur-[1.5px]"
            onClick={close}
          />
          <div
            role="dialog"
            aria-label="사칙연산 계산기"
            className="relative z-10 mt-4 w-full max-w-[17.5rem] rounded-2xl border-2 border-wood/20 bg-[#fffdf8] p-3 shadow-[0_12px_32px_rgba(107,68,35,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-lg text-wood">계산기</p>
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-wood/10 px-2 py-1 text-xs font-bold text-wood hover:bg-wood/15"
              >
                닫기
              </button>
            </div>
            <div className="mb-2 rounded-xl border-2 border-wood/15 bg-cream px-3 py-2 text-right">
              <p className="min-h-[1rem] text-[11px] font-semibold text-wood/45">
                {state.acc != null && state.op
                  ? `${formatPending(state.acc)} ${opSymbol(state.op)}`
                  : "\u00a0"}
              </p>
              <p
                className={[
                  "font-mono text-2xl font-bold tabular-nums leading-tight",
                  state.error ? "text-[#a63a1a]" : "text-wood",
                ].join(" ")}
              >
                {state.display}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <Key label="C" ariaLabel="모두 지우기" kind="fn" onPress={() => setState(calcClear())} />
              <Key
                label="⌫"
                ariaLabel="한 자리 지우기"
                kind="fn"
                onPress={() => setState((s) => calcBack(s))}
              />
              <Key
                label="÷"
                ariaLabel="나누기"
                kind="op"
                onPress={() => setState((s) => calcOp(s, "/"))}
              />
              <Key
                label="×"
                ariaLabel="곱하기"
                kind="op"
                onPress={() => setState((s) => calcOp(s, "*"))}
              />
              <Key label="7" onPress={() => setState((s) => calcDigit(s, "7"))} />
              <Key label="8" onPress={() => setState((s) => calcDigit(s, "8"))} />
              <Key label="9" onPress={() => setState((s) => calcDigit(s, "9"))} />
              <Key
                label="−"
                ariaLabel="빼기"
                kind="op"
                onPress={() => setState((s) => calcOp(s, "-"))}
              />
              <Key label="4" onPress={() => setState((s) => calcDigit(s, "4"))} />
              <Key label="5" onPress={() => setState((s) => calcDigit(s, "5"))} />
              <Key label="6" onPress={() => setState((s) => calcDigit(s, "6"))} />
              <Key
                label="+"
                ariaLabel="더하기"
                kind="op"
                onPress={() => setState((s) => calcOp(s, "+"))}
              />
              <Key label="1" onPress={() => setState((s) => calcDigit(s, "1"))} />
              <Key label="2" onPress={() => setState((s) => calcDigit(s, "2"))} />
              <Key label="3" onPress={() => setState((s) => calcDigit(s, "3"))} />
              <Key
                label="="
                ariaLabel="결과"
                kind="eq"
                onPress={() => setState((s) => calcEq(s))}
              />
              <Key
                label="0"
                span={2}
                onPress={() => setState((s) => calcDigit(s, "0"))}
              />
              <Key
                label="."
                ariaLabel="소수점"
                span={2}
                onPress={() => setState((s) => calcDot(s))}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatPending(n: number): string {
  if (!Number.isFinite(n)) return "";
  const s = String(n);
  return s.length > 10 ? n.toPrecision(6) : s;
}
