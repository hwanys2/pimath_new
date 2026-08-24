"use client";

import { useEffect, useRef, useState } from "react";
import katex from "katex";
import EquationOpsBalance from "./EquationOpsBalance";
import EquationTrail from "./EquationTrail";
import OperationPicker from "./OperationPicker";
import {
  isStateBalanced,
  isStateSolved,
  projectedScore,
  type EquationOpsProblem,
  type EquationOpsState,
} from "@/lib/equation-ops-math";
import "katex/dist/katex.min.css";

type Props = {
  problem: EquationOpsProblem;
  stepIndex: number;
  stepCount: number;
  state: EquationOpsState;
  onStateChange: (state: EquationOpsState) => void;
  hostPreview?: boolean;
  disabled?: boolean;
  submitted?: boolean;
  submitFeedback?: "correct" | "wrong" | null;
  earnedScore?: number | null;
  onSubmit?: () => void;
  stepStartedAt?: number;
};

function renderLatex(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
    });
  } catch {
    return latex;
  }
}

function formatElapsed(ms: number): string {
  const sec = ms / 1000;
  return sec < 10 ? sec.toFixed(1) : Math.round(sec).toString();
}

export default function EquationOpsStep({
  problem,
  stepIndex,
  stepCount,
  state,
  onStateChange,
  hostPreview = false,
  disabled = false,
  submitted = false,
  submitFeedback = null,
  earnedScore = null,
  onSubmit,
  stepStartedAt,
}: Props) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const startedRef = useRef(stepStartedAt ?? Date.now());

  useEffect(() => {
    startedRef.current = stepStartedAt ?? Date.now();
    setElapsedMs(0);
    setSubmitError(null);
  }, [stepIndex, stepStartedAt]);

  useEffect(() => {
    if (hostPreview) return;
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedRef.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [hostPreview, stepIndex]);

  const locked = disabled;
  const balanced = isStateBalanced(state, problem.xValue);
  const solved = isStateSolved(state, problem.xValue);
  const targetHtml = renderLatex(problem.targetLatex);
  const previewScore = projectedScore(elapsedMs);

  const handleSubmit = () => {
    if (locked || !onSubmit) return;
    if (!balanced) {
      setSubmitError("저울이 기울었어요. 양변에 똑같이 해야 해요.");
      return;
    }
    if (!solved) {
      setSubmitError("x 막대만 한쪽에 남기고 해를 구해 보세요.");
      return;
    }
    setSubmitError(null);
    onSubmit();
  };

  const handleApply = (next: EquationOpsState) => {
    onStateChange(next);
    setSubmitError(null);
  };

  const statusMessage = !balanced
    ? "저울이 기울었어요. 양변에 똑같이 해야 등식이 유지돼요."
    : solved
      ? submitted
        ? "x를 구했어요! 답을 고친 뒤 다시 확인할 수 있어요."
        : "x를 구했어요! 확인을 눌러 점수를 받으세요."
      : null;

  return (
    <section className="quest-card space-y-4 p-4 sm:p-6 lg:space-y-6">
      {/* Status badges — full width */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-wood">
        <span className="rounded-xl bg-gold/45 px-3 py-1 tabular-nums">
          문제 {stepIndex + 1}/{stepCount}
        </span>
        {!hostPreview ? (
          <>
            <span className="rounded-xl bg-sky/40 px-3 py-1 tabular-nums">
              ⏱ {formatElapsed(elapsedMs)}초
            </span>
            <span className="rounded-xl bg-mint/40 px-3 py-1 tabular-nums">
              맞히면 ~{previewScore}점
            </span>
          </>
        ) : null}
        {hostPreview ? (
          <span className="rounded-xl bg-lavender/45 px-3 py-1 text-xs font-bold text-wood">
            시연 모드
          </span>
        ) : null}
      </div>

      {/* 2×2 on PC; stacked on mobile */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Row 1 left: problem card */}
        <div className="order-1 flex flex-col justify-center rounded-xl border-2 border-mint/35 bg-mint/10 p-4 text-center lg:min-h-[280px] lg:p-6">
          <p className="font-display text-lg text-wood lg:text-xl">
            {problem.title}
          </p>
          <div
            className="mt-3 text-wood [&_.katex]:text-[1.25rem] lg:[&_.katex]:text-[1.5rem]"
            dangerouslySetInnerHTML={{ __html: targetHtml }}
          />
          <p className="mt-3 text-sm font-semibold text-foreground/70 lg:text-base">
            {problem.instruction}
          </p>
        </div>

        {/* Row 1 right: balance */}
        <div className="order-3 lg:order-2 lg:min-h-[320px]">
          <EquationOpsBalance state={state} xValue={problem.xValue} />
        </div>

        {/* Row 2 left: operation input */}
        <div className="order-2 space-y-3 lg:order-3">
          <OperationPicker
            state={state}
            disabled={hostPreview ? false : locked}
            onApply={handleApply}
          />
          {statusMessage ? (
            <p
              className={[
                "text-center text-sm font-bold",
                balanced ? "text-wood" : "text-[#a63a1a]",
              ].join(" ")}
              role="status"
            >
              {balanced ? "⚖ " : ""}
              {statusMessage}
            </p>
          ) : null}
        </div>

        {/* Row 2 right: trail */}
        <div className="order-4 max-h-64 overflow-y-auto lg:max-h-[min(50vh,480px)] lg:min-h-[280px]">
          <EquationTrail trail={state.trail} compact />
        </div>
      </div>

      {submitError ? (
        <p className="text-center text-sm font-bold text-[#a63a1a]" role="status">
          {submitError}
        </p>
      ) : null}

      {submitted && submitFeedback ? (
        <div
          className={[
            "rounded-2xl px-4 py-3 text-center",
            submitFeedback === "correct"
              ? "bg-mint/40 text-wood"
              : "bg-[#e85d4c]/15 text-[#a63a1a]",
          ].join(" ")}
          role="status"
        >
          <p className="font-display text-2xl">
            {submitFeedback === "correct" ? "O" : "X"}
          </p>
          <p className="mt-1 text-sm font-bold">
            {submitFeedback === "correct"
              ? `+${earnedScore ?? previewScore}점! 답을 고친 뒤 다시 확인할 수 있어요.`
              : "다시 확인해 보세요."}
          </p>
        </div>
      ) : null}

      {!hostPreview && onSubmit ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={locked}
            className="rounded-xl bg-wood px-8 py-3 text-base font-bold text-cream disabled:opacity-50"
          >
            {submitted ? "다시 확인" : "확인"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
