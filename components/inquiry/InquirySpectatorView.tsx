"use client";

import { useState } from "react";
import InquiryRadicalFillStep, {
  emptyTexts,
} from "@/components/inquiry/radical-fill/InquiryRadicalFillStep";
import { radicalFillProblemAt } from "@/lib/inquiry-radical-fill";
import { PROBLEM_COUNT } from "@/lib/radical-fill-math";

type Props = {
  title: string;
  subtitle?: string;
};

export default function InquirySpectatorView({ title, subtitle }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const problem = radicalFillProblemAt(stepIndex);
  const [texts, setTexts] = useState(() => emptyTexts(problem));

  const goToStep = (next: number) => {
    const clamped = Math.max(0, Math.min(PROBLEM_COUNT - 1, next));
    setStepIndex(clamped);
    setTexts(emptyTexts(radicalFillProblemAt(clamped)));
  };

  return (
    <div className="space-y-4">
      <section className="quest-card bg-gradient-to-br from-lavender/50 via-sky/25 to-mint/30 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">탐구 미리보기</p>
        <h1 className="font-display mt-1 text-2xl text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          {subtitle ??
            "문제를 둘러볼 수 있어요. 학생은 선생님이 수업을 시작할 때만 참여할 수 있습니다."}
        </p>
      </section>

      <InquiryRadicalFillStep
        problem={problem}
        stepIndex={stepIndex}
        stepCount={PROBLEM_COUNT}
        texts={texts}
        onTextsChange={setTexts}
        readOnly
      />

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
          disabled={stepIndex >= PROBLEM_COUNT - 1}
          className="rounded-xl border-2 border-wood/20 px-4 py-2 text-sm font-bold text-wood disabled:opacity-40"
        >
          다음 문제
        </button>
      </div>
    </div>
  );
}
