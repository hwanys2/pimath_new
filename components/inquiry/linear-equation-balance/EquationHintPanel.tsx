"use client";

import katex from "katex";
import { useMemo, useState } from "react";
import type { BalanceProblem } from "@/lib/linear-equation-balance-math";
import "katex/dist/katex.min.css";

type Props = {
  problem: BalanceProblem;
  hintIndex: number;
  onShowHint: () => void;
  canShowMoreHints: boolean;
};

function renderTargetLatex(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
    });
  } catch {
    return latex;
  }
}

export default function EquationHintPanel({
  problem,
  hintIndex,
  onShowHint,
  canShowMoreHints,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const visibleHints = problem.hints.slice(0, hintIndex + 1);
  const equationHtml = useMemo(
    () => renderTargetLatex(problem.targetLatex),
    [problem.targetLatex],
  );

  return (
    <div className="rounded-xl border-2 border-mint/40 bg-mint/15 p-4">
      <p className="font-display text-lg text-wood">{problem.title}</p>
      <div
        className="mt-1 text-center text-wood [&_.katex]:text-[1.15rem]"
        dangerouslySetInnerHTML={{ __html: equationHtml }}
      />
      <p className="mt-3 text-sm font-semibold text-foreground/75">
        {problem.instruction}
      </p>

      {expanded && visibleHints.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm font-medium text-foreground/70">
          {visibleHints.map((h, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-bold text-mint">💡</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg border border-wood/20 bg-cream px-3 py-1.5 text-xs font-bold text-wood hover:bg-wood/5"
        >
          {expanded ? "힌트 숨기기" : "힌트 보기"}
        </button>
        {canShowMoreHints ? (
          <button
            type="button"
            onClick={onShowHint}
            className="rounded-lg bg-sky/50 px-3 py-1.5 text-xs font-bold text-wood hover:bg-sky/70"
          >
            힌트 더 보기
          </button>
        ) : null}
      </div>
    </div>
  );
}
