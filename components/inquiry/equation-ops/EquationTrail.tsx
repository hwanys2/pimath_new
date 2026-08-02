"use client";

import katex from "katex";
import { useMemo } from "react";
import type { TrailEntry } from "@/lib/equation-ops-math";
import "katex/dist/katex.min.css";

type Props = {
  trail: TrailEntry[];
};

function renderLatex(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
    });
  } catch {
    return latex;
  }
}

export default function EquationTrail({ trail }: Props) {
  const entries = useMemo(
    () =>
      trail.map((entry) => ({
        ...entry,
        html: renderLatex(entry.latex),
      })),
    [trail],
  );

  return (
    <div className="rounded-xl border-2 border-sky/30 bg-sky/10 p-4">
      <p className="text-xs font-bold text-wood">식 흔적</p>
      <ol className="mt-3 space-y-3">
        {entries.map((entry, i) => (
          <li key={`${entry.label}-${i}`} className="text-sm">
            {i > 0 ? (
              <p className="mb-1 text-xs font-semibold text-wood/60">
                {entry.label}
              </p>
            ) : null}
            <div
              className="text-center text-wood [&_.katex]:text-base"
              dangerouslySetInnerHTML={{ __html: entry.html }}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
