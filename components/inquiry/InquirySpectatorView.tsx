"use client";

import { useState } from "react";
import {
  InquiryLinearEquationBalanceStep,
  InquiryRadicalFillStep,
  balanceInitialState,
  balanceProblem,
  getInquiryContent,
  isInquiryContentKey,
  radicalFillInitialState,
  radicalFillProblem,
} from "@/lib/inquiry-content-registry";

type Props = {
  contentKey: string;
  title: string;
  subtitle?: string;
};

export default function InquirySpectatorView({
  contentKey,
  title,
  subtitle,
}: Props) {
  const config = getInquiryContent(contentKey);
  const validKey = isInquiryContentKey(contentKey) ? contentKey : null;

  const [stepIndex, setStepIndex] = useState(0);
  const [texts, setTexts] = useState(() =>
    validKey === "g3-u1-radical-fill"
      ? radicalFillInitialState(0)
      : [],
  );
  const [balanceState, setBalanceState] = useState(() =>
    validKey === "g1-u2-2-linear-equation-balance"
      ? balanceInitialState(0)
      : { left: { x: 0, unit: 0 }, right: { x: 0, unit: 0 } },
  );

  if (!config || !validKey) {
    return (
      <section className="quest-card p-8 text-center">
        <p className="font-display text-xl text-wood">미리보기를 열 수 없어요.</p>
      </section>
    );
  }

  const stepCount = config.stepCount;

  const goToStep = (next: number) => {
    const clamped = Math.max(0, Math.min(stepCount - 1, next));
    setStepIndex(clamped);
    if (validKey === "g3-u1-radical-fill") {
      setTexts(radicalFillInitialState(clamped));
    } else {
      setBalanceState(balanceInitialState(clamped));
    }
  };

  return (
    <div className="space-y-4">
      <section
        className={`quest-card bg-gradient-to-br ${config.headerGradient} p-5 sm:p-7`}
      >
        <p className="text-sm font-bold text-wood">탐구 미리보기</p>
        <h1 className="font-display mt-1 text-2xl text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          {subtitle ?? config.spectatorSubtitle}
        </p>
      </section>

      {validKey === "g3-u1-radical-fill" ? (
        <InquiryRadicalFillStep
          problem={radicalFillProblem(stepIndex)}
          stepIndex={stepIndex}
          stepCount={stepCount}
          texts={texts}
          onTextsChange={setTexts}
          readOnly
        />
      ) : (
        <InquiryLinearEquationBalanceStep
          problem={balanceProblem(stepIndex)}
          stepIndex={stepIndex}
          stepCount={stepCount}
          state={balanceState}
          onStateChange={setBalanceState}
          readOnly
        />
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => goToStep(stepIndex - 1)}
          disabled={stepIndex <= 0}
          className="rounded-xl border-2 border-wood/20 px-4 py-2 text-sm font-bold text-wood disabled:opacity-40"
        >
          이전 문제
        </button>
        <button
          type="button"
          onClick={() => goToStep(stepIndex + 1)}
          disabled={stepIndex >= stepCount - 1}
          className="rounded-xl border-2 border-wood/20 px-4 py-2 text-sm font-bold text-wood disabled:opacity-40"
        >
          다음 문제
        </button>
      </div>
    </div>
  );
}
