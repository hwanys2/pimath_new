"use client";

import katex from "katex";
import { useMemo } from "react";
import { expressionDisplayToLatex } from "@/lib/graph-expression-latex";
import "katex/dist/katex.min.css";

type Props = {
  /** 원문 표시 (y = x^2) 또는 저장된 LaTeX */
  display?: string | null;
  latex?: string | null;
  className?: string;
  /** false면 인라인 크기 */
  block?: boolean;
};

export default function MathExpression({
  display,
  latex,
  className = "",
  block = true,
}: Props) {
  const html = useMemo(() => {
    const src = (latex?.trim() || (display ? expressionDisplayToLatex(display) : "")).trim();
    if (!src) return null;
    try {
      return katex.renderToString(src, {
        throwOnError: false,
        displayMode: block,
      });
    } catch {
      return null;
    }
  }, [display, latex, block]);

  if (!html) {
    return display ? (
      <span className={`font-mono ${className}`}>{display}</span>
    ) : null;
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
