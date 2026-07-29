"use client";

import katex from "katex";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  defaultParamValues,
  listParameters,
  normalizeGraphExpression,
} from "@/lib/board-math";
import type { MathCard } from "./types";
import { CloseIcon } from "./icons";
import BoardGraph from "./BoardGraph";
import GraphSettingsPanel from "./GraphSettingsPanel";
import MathRichText from "./MathRichText";
import { DEFAULT_GRAPH_SETTINGS } from "./graph-types";

const MIN_W = 180;
const MIN_H = 100;

type Props = {
  card: MathCard;
  onChange: (card: MathCard) => void;
  onClose: () => void;
  onFocus: () => void;
};

export default function MathCardOverlay({
  card,
  onChange,
  onClose,
  onFocus,
}: Props) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    baseW: number;
    baseH: number;
    mode: "move" | "resize";
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const expr = normalizeGraphExpression(card.expr);
  const params = useMemo(() => listParameters(expr), [expr]);
  const paramValues = useMemo(() => {
    const base = defaultParamValues(params);
    return { ...base, ...card.paramValues };
  }, [params, card.paramValues]);

  const graphSettings = card.graphSettings ?? DEFAULT_GRAPH_SETTINGS;

  const series = useMemo(() => {
    if (!card.showGraph || !card.expr.trim()) return [];
    return [
      {
        expr: card.expr,
        color: "#3b82f6",
        kind:
          card.kind === "inequality"
            ? ("inequality" as const)
            : ("function" as const),
      },
    ];
  }, [card.showGraph, card.expr, card.kind]);

  const latexHtml = useMemo(() => {
    if (!card.latex) return "";
    return katex.renderToString(card.latex, {
      throwOnError: false,
      displayMode: true,
    });
  }, [card.latex]);

  const plotH = Math.max(80, card.h - (card.showSolution ? 140 : 80));

  const onPointerDown = useCallback(
    (mode: "move" | "resize") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onFocus();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseX: card.x,
        baseY: card.y,
        baseW: card.w,
        baseH: card.h,
        mode,
      };
    },
    [card.x, card.y, card.w, card.h, onFocus],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.mode === "move") {
        onChange({ ...card, x: d.baseX + dx, y: d.baseY + dy });
      } else {
        onChange({
          ...card,
          w: Math.max(MIN_W, d.baseW + dx),
          h: Math.max(MIN_H, d.baseH + dy),
        });
      }
    },
    [card, onChange],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

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
      style={{
        left: card.x,
        top: card.y,
        width: card.w,
        height: card.h,
        zIndex: card.zIndex,
      }}
      onPointerDown={onFocus}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-xl border-2 border-wood/20 bg-cream/95 shadow-lg backdrop-blur-sm">
        <div
          className="h-2 shrink-0 cursor-grab bg-wood/15 active:cursor-grabbing"
          onPointerDown={onPointerDown("move")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <button
          type="button"
          aria-label="닫기"
          className="absolute top-1 right-1 z-10 rounded-md p-1 text-wood/80 hover:bg-black/10"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <CloseIcon width={14} height={14} />
        </button>
        <div className="min-h-0 flex-1 overflow-auto px-3 pt-1 pb-2">
          <div
            className="pr-6 text-center"
            dangerouslySetInnerHTML={{ __html: latexHtml }}
          />
          {card.showSolution && card.solutionSteps?.length ? (
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs text-wood">
              {card.solutionSteps.map((step, i) => (
                <li key={i}>
                  <MathRichText text={step} />
                </li>
              ))}
              {card.answerLatex ? (
                <li className="list-none font-semibold">
                  답: <MathRichText text={`$${card.answerLatex}$`} />
                </li>
              ) : null}
            </ol>
          ) : null}
          {params.length > 0 ? (
            <div className="mt-2 flex flex-col gap-1">
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
                </label>
              ))}
            </div>
          ) : null}
          {card.showGraph ? (
            <div
              className="relative mt-2 overflow-hidden rounded-lg border border-black/10 bg-white"
              style={{ height: plotH }}
            >
              <button
                type="button"
                className="absolute top-1 left-1 z-10 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-wood shadow"
                onClick={() => setSettingsOpen((v) => !v)}
              >
                설정
              </button>
              {settingsOpen ? (
                <GraphSettingsPanel
                  compact
                  settings={graphSettings}
                  onChange={(g) => onChange({ ...card, graphSettings: g })}
                  onClose={() => setSettingsOpen(false)}
                />
              ) : null}
              <BoardGraph
                series={series}
                settings={graphSettings}
                paramValues={paramValues}
                className="h-full"
              />
            </div>
          ) : null}
        </div>
        <div
          className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
          onPointerDown={onPointerDown("resize")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
}
