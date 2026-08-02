"use client";

import katex from "katex";
import { useMemo } from "react";
import type { TrailEntry } from "@/lib/equation-ops-math";
import "katex/dist/katex.min.css";

type Props = {
  trail: TrailEntry[];
  compact?: boolean;
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

export default function EquationTrail({ trail, compact = false }: Props) {
  const entries = useMemo(
    () =>
      trail.map((entry) => ({
        ...entry,
        html: renderLatex(entry.latex),
      })),
    [trail],
  );

  const lastIndex = entries.length - 1;

  return (
    <div
      className={[
        "rounded-xl border-2 border-sky/30 bg-sky/10 p-4",
        compact ? "lg:max-h-[min(70vh,520px)] lg:overflow-y-auto" : "",
      ].join(" ")}
    >
      <p className="text-xs font-bold text-wood">과정</p>
      <ol className="mt-3 space-y-3">
        {entries.map((entry, i) => (
          <li
            key={`${entry.label}-${i}`}
            className={[
              "rounded-lg px-2 py-2 text-sm",
              i === lastIndex ? "bg-mint/20" : "",
            ].join(" ")}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-xs font-bold tabular-nums text-wood/50">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {i > 0 ? (
                  <p className="mb-1 text-xs font-semibold text-wood/60">
                    {entry.label}
                  </p>
                ) : (
                  <p className="mb-1 text-xs font-semibold text-wood/60">
                    시작
                  </p>
                )}
                <div
                  className={[
                    "text-wood [&_.katex]:text-base",
                    compact
                      ? "text-left"
                      : "text-center lg:text-left",
                  ].join(" ")}
                  dangerouslySetInnerHTML={{ __html: entry.html }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
