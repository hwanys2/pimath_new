"use client";

import { useState } from "react";
import {
  scoreForAttempts,
  type BalanceProblem,
  type BalanceState,
} from "@/lib/linear-equation-balance-math";
import type { SoftNotice } from "@/lib/inquiry-linear-equation-balance";
import BalanceWorkspace from "./BalanceWorkspace";
import EquationHintPanel from "./EquationHintPanel";

export type { SoftNotice };

function softMessage(reason: SoftNotice["reason"]): string {
  switch (reason) {
    case "unbalanced":
      return "저울이 균형을 이루지 않아요. 양변의 식이 같아지도록 막대를 옮겨 보세요.";
    case "wrong":
      return "아직 x의 값이 맞지 않아요. 왼쪽에 x만, 오른쪽에 답만 남겨 보세요.";
    case "incomplete":
      return "문제를 더 풀어 보세요.";
  }
}

type Props = {
  problem: BalanceProblem;
  stepIndex: number;
  stepCount: number;
  state: BalanceState;
  onStateChange: (state: BalanceState) => void;
  readOnly?: boolean;
  disabled?: boolean;
  wrongAttempts?: number;
  softNotice?: SoftNotice | null;
  submitted?: boolean;
  submitFeedback?: "correct" | "wrong" | null;
  onSubmit?: () => void;
};

export default function InquiryLinearEquationBalanceStep({
  problem,
  stepIndex,
  stepCount,
  state,
  onStateChange,
  readOnly = false,
  disabled = false,
  wrongAttempts = 0,
  softNotice = null,
  submitted = false,
  submitFeedback = null,
  onSubmit,
}: Props) {
  const [hintIndex, setHintIndex] = useState(-1);
  const locked = readOnly || disabled || submitted;
  const projected = scoreForAttempts(wrongAttempts);

  return (
    <section className="quest-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-wood">
        <span className="rounded-xl bg-mint/40 px-3 py-1 tabular-nums">
          문제 {stepIndex + 1}/{stepCount}
        </span>
        {!readOnly && !submitted ? (
          <span className="rounded-xl bg-sky/40 px-3 py-1 tabular-nums">
            오답 {wrongAttempts}회
            <span className="ml-1 font-semibold text-wood/55">
              · 맞히면 {projected}점
            </span>
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <EquationHintPanel
          problem={problem}
          hintIndex={hintIndex}
          onShowHint={() =>
            setHintIndex((i) => Math.min(problem.hints.length - 1, i + 1))
          }
          canShowMoreHints={hintIndex < problem.hints.length - 1}
        />
      </div>

      <div className="mt-6">
        <BalanceWorkspace
          state={state}
          onChange={onStateChange}
          allowNegatives={problem.allowNegatives}
          readOnly={readOnly}
          disabled={locked}
        />
      </div>

      {softNotice && !submitted && !readOnly ? (
        <p
          className="mt-4 text-center text-sm font-bold text-[#a63a1a]"
          role="status"
        >
          {softMessage(softNotice.reason)}
          {softNotice.reason === "wrong" ? (
            <span className="mt-1 block text-xs font-semibold text-wood/60">
              지금 맞히면 {scoreForAttempts(wrongAttempts)}점이에요.
            </span>
          ) : null}
        </p>
      ) : null}

      {submitted && submitFeedback ? (
        <div
          className={[
            "mt-5 rounded-2xl px-4 py-3 text-center",
            submitFeedback === "correct"
              ? "bg-mint/40 text-wood"
              : "bg-[#e85d4c]/15 text-[#a63a1a]",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-2xl">
            {submitFeedback === "correct" ? "O" : "X"}
          </p>
          <p className="mt-1 text-sm font-bold">
            {submitFeedback === "correct"
              ? "제출 완료! 선생님이 다음 문제로 넘길 때까지 기다려 주세요."
              : "다시 확인해 보세요. 선생님이 다음 문제로 넘길 때까지 기다려 주세요."}
          </p>
        </div>
      ) : null}

      {!readOnly && !submitted && onSubmit ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled}
            className="rounded-xl bg-wood px-8 py-3 text-base font-bold text-cream disabled:opacity-50"
          >
            확인
          </button>
        </div>
      ) : null}
    </section>
  );
}

export { validateBalanceSubmit } from "@/lib/inquiry-linear-equation-balance";
export { emptyBalanceState } from "@/lib/inquiry-linear-equation-balance";
