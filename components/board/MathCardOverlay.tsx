"use client";

import katex from "katex";
import { useCallback, useMemo, useRef } from "react";
import {
  compileExpression,
  defaultParamValues,
  listParameters,
  normalizeGraphExpression,
} from "@/lib/board-math";
import type { MathCard } from "./types";
import { CloseIcon } from "./icons";
import FunctionPlotSvg from "./FunctionPlotSvg";

type Props = {
  card: MathCard;
  onChange: (card: MathCard) => void;
  onClose: () => void;
  onOpenGraph?: (expr: string, paramValues: Record<string, number>) => void;
};

export default function MathCardOverlay({
  card,
  onChange,
  onClose,
  onOpenGraph,
}: Props) {
  const dragRef = useRef<{
    x: number;
    y: number;
    cardX: number;
    cardY: number;
  } | null>(null);

  const expr = normalizeGraphExpression(card.expr);
  const params = useMemo(() => listParameters(expr), [expr]);
  const paramValues = useMemo(() => {
    const base = defaultParamValues(params);
    return { ...base, ...card.paramValues };
  }, [params, card.paramValues]);

  const fn = useMemo(() => {
    if (!expr) return null;
    if (params.length > 0) return compileExpression(expr, paramValues);
    return compileExpression(expr);
  }, [expr, paramValues, params.length]);

  const latexHtml = useMemo(() => {
    if (!card.latex) return "";
    return katex.renderToString(card.latex, {
      throwOnError: false,
      displayMode: true,
    });
  }, [card.latex]);

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      cardX: card.x,
      cardY: card.y,
    };
  };

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    onChange({
      ...card,
      x: d.cardX + (e.clientX - d.x),
      y: d.cardY + (e.clientY - d.y),
    });
  };

  const onHeaderPointerUp = () => {
    dragRef.current = null;
  };

  const setParam = useCallback(
    (name: string, value: number) => {
      onChange({
        ...card,
        paramValues: { ...card.paramValues, [name]: value },
      });
    },
    [card, onChange],
  );

  return (
    <div
      className="pointer-events-auto absolute touch-none"
      style={{ left: card.x, top: card.y, width: card.w }}
    >
      <div className="overflow-hidden rounded-2xl border-2 border-wood/25 bg-cream/95 shadow-xl backdrop-blur-sm">
        <div
          className="flex cursor-grab items-center gap-2 bg-wood/10 px-2 py-1.5 active:cursor-grabbing"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          <span className="font-display flex-1 text-xs text-wood">수식</span>
          {onOpenGraph && fn ? (
            <button
              type="button"
              onClick={() => onOpenGraph(expr, paramValues)}
              className="font-display rounded-md bg-sky/80 px-2 py-0.5 text-[10px] text-[#1a4a6e]"
            >
              큰 그래프
            </button>
          ) : null}
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="rounded-lg p-1 text-wood hover:bg-black/10"
          >
            <CloseIcon width={14} height={14} />
          </button>
        </div>
        <div className="space-y-2 p-3">
          <div
            className="min-h-[2rem] overflow-x-auto text-center"
            dangerouslySetInnerHTML={{ __html: latexHtml }}
          />
          {params.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {params.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 text-[10px] font-semibold text-wood"
                >
                  {p}
                  <input
                    type="range"
                    min={-10}
                    max={10}
                    step={0.1}
                    value={paramValues[p] ?? 0}
                    onChange={(e) => setParam(p, Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-8 font-mono">
                    {(paramValues[p] ?? 0).toFixed(1)}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
          <div className="h-28 overflow-hidden rounded-lg border border-black/10 bg-white">
            <FunctionPlotSvg fn={fn} width={card.w - 24} height={112} />
          </div>
        </div>
      </div>
    </div>
  );
}
