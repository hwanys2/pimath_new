"use client";

import { useState } from "react";
import { scoreForAttempts } from "@/lib/linear-equation-balance-math";
import type { BalanceProblem, TileWorkspace } from "@/lib/linear-equation-balance-math";
import type { SoftNotice } from "@/lib/inquiry-linear-equation-balance";
import BalanceWorkspace from "./BalanceWorkspace";
import EquationHintPanel from "./EquationHintPanel";

export type { SoftNotice };

function softMessage(reason: SoftNotice["reason"]): string {
  switch (reason) {
    case "unbalanced":
      return "저울이 기울었어요. 양변에 똑같이 해야 등식이 유지돼요.";
    case "wrong":
      return "한쪽에 x 막대만 혼자 남겨 보세요.";
    case "x_on_both_sides":
      return "반대쪽 접시에도 x 막대가 남아 있어요.";
  }
}

type Props = {
  problem: BalanceProblem;
  stepIndex: number;
  stepCount: number;
  workspace: TileWorkspace;
  onWorkspaceChange: (ws: TileWorkspace) => void;
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
  workspace,
  onWorkspaceChange,
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
          problem={problem}
          workspace={workspace}
          onChange={onWorkspaceChange}
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

export { validateBalanceSubmit, emptyBalanceWorkspace } from "@/lib/inquiry-linear-equation-balance";
