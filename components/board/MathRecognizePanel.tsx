"use client";

import katex from "katex";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  compileExpression,
  defaultParamValues,
  listParameters,
  normalizeGraphExpression,
} from "@/lib/board-math";
import { latexToExpr } from "@/lib/math-latex-to-expr";
import FunctionPlotSvg from "./FunctionPlotSvg";

type Props = {
  imageDataUrl: string;
  canUseApi: boolean;
  onApply: (payload: {
    latex: string;
    expr: string;
    paramValues: Record<string, number>;
  }) => void;
  onCancel: () => void;
};

export default function MathRecognizePanel({
  imageDataUrl,
  canUseApi,
  onApply,
  onCancel,
}: Props) {
  const [latex, setLatex] = useState("");
  const [exprDraft, setExprDraft] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(canUseApi);
  const [error, setError] = useState<string | null>(null);

  const recognize = useCallback(async () => {
    if (!canUseApi) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/board/recognize-math", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });
      const data = (await res.json()) as { latex?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "인식에 실패했어요.");
        return;
      }
      const raw = data.latex ?? "";
      setLatex(raw);
      const expr = normalizeGraphExpression(latexToExpr(raw));
      setExprDraft(expr);
      const params = listParameters(expr);
      setParamValues(defaultParamValues(params));
    } catch {
      setError("네트워크 오류가 났어요.");
    } finally {
      setLoading(false);
    }
  }, [canUseApi, imageDataUrl]);

  useEffect(() => {
    const id = setTimeout(() => {
      void recognize();
    }, 0);
    return () => clearTimeout(id);
  }, [recognize]);

  const expr = normalizeGraphExpression(exprDraft);
  const params = useMemo(() => listParameters(expr), [expr]);
  const mergedParams = useMemo(() => {
    const base = defaultParamValues(params);
    return { ...base, ...paramValues };
  }, [params, paramValues]);

  const fn = useMemo(() => {
    if (!expr) return null;
    if (params.length > 0) {
      return compileExpression(expr, mergedParams);
    }
    return compileExpression(expr);
  }, [expr, mergedParams, params.length]);

  const latexHtml = useMemo(() => {
    const src = latex.trim() || expr;
    if (!src) return "";
    try {
      return katex.renderToString(src, { throwOnError: false, displayMode: true });
    } catch {
      return "";
    }
  }, [latex, expr]);

  const onExprChange = (next: string) => {
    setExprDraft(next);
    const e = normalizeGraphExpression(next);
    const p = listParameters(e);
    setParamValues((prev) => ({ ...defaultParamValues(p), ...prev }));
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-auto rounded-2xl border-2 border-wood/25 bg-cream p-4 shadow-2xl">
        <h2 className="font-display text-lg text-wood">수식 인식</h2>

        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview */}
          <img
            src={imageDataUrl}
            alt="선택 영역"
            className="h-24 w-32 shrink-0 rounded-lg border border-black/10 bg-white object-contain"
          />
          <div className="min-h-[4rem] flex-1 overflow-auto rounded-xl bg-white/80 p-2">
            {loading ? (
              <p className="text-sm text-wood/70">인식 중…</p>
            ) : latexHtml ? (
              <div dangerouslySetInnerHTML={{ __html: latexHtml }} />
            ) : (
              <p className="text-sm text-wood/60">아래에 수식을 입력하세요</p>
            )}
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        <label className="flex flex-col gap-1 text-xs font-semibold text-wood">
          LaTeX / 수식
          <textarea
            value={latex}
            onChange={(e) => {
              setLatex(e.target.value);
              onExprChange(latexToExpr(e.target.value));
            }}
            rows={2}
            className="resize-none rounded-lg border-2 border-black/10 bg-white p-2 font-mono text-sm"
            placeholder="인식 결과 또는 직접 입력"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-wood">
          그래프용 식 (x 또는 a,b 매개변수)
          <input
            value={exprDraft}
            onChange={(e) => onExprChange(e.target.value)}
            className="rounded-lg border-2 border-black/10 bg-white p-2 font-mono text-sm"
            placeholder="예) ax+b, x^2-4"
          />
        </label>

        {params.length > 0 ? (
          <div className="flex flex-col gap-2">
            {params.map((p) => (
              <label
                key={p}
                className="flex items-center gap-2 text-xs font-semibold text-wood"
              >
                <span className="w-6">{p}</span>
                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={0.1}
                  value={mergedParams[p] ?? 0}
                  onChange={(e) =>
                    setParamValues((prev) => ({
                      ...prev,
                      [p]: Number(e.target.value),
                    }))
                  }
                  className="flex-1"
                />
                <span className="w-10 text-right font-mono">
                  {(mergedParams[p] ?? 0).toFixed(1)}
                </span>
              </label>
            ))}
          </div>
        ) : null}

        <div className="h-36 overflow-hidden rounded-xl border-2 border-black/10 bg-white">
          <FunctionPlotSvg fn={fn} width={440} height={140} />
        </div>

        <div className="flex justify-end gap-2">
          {canUseApi ? (
            <button
              type="button"
              onClick={() => recognize()}
              disabled={loading}
              className="font-display rounded-lg border-2 border-wood/20 px-3 py-1.5 text-sm text-wood"
            >
              다시 인식
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="font-display rounded-lg px-3 py-1.5 text-sm text-wood"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!latex.trim() && !expr.trim()}
            onClick={() =>
              onApply({
                latex: latex.trim() || expr,
                expr,
                paramValues: mergedParams,
              })
            }
            className="font-display rounded-lg bg-sky px-4 py-1.5 text-sm text-[#1a4a6e] disabled:opacity-40"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
