"use client";

import { useMemo, useState } from "react";
import { parseInequality } from "../../lib/graph-inequality";
import { classifyMathInput } from "../../lib/math-classify";
import { normalizeGraphExpression } from "../../lib/board-math";
import { compileExpression } from "../../lib/board-math";
import BoardGraph from "../BoardGraph";
import GraphSettingsPanel from "../GraphSettingsPanel";
import { mergeGraphSettings, type GraphSettings } from "../graph-types";
import { CloseIcon } from "../icons";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

type ExprItem = { text: string; color: string };

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316"];

export default function GraphWidget({ state, setState }: Props) {
  const exprs = useMemo(
    () => (state.exprs as ExprItem[]) ?? [{ text: "x^2", color: COLORS[0] }],
    [state.exprs],
  );
  const graphSettings = useMemo(
    () =>
      mergeGraphSettings(
        state.graphSettings as Partial<GraphSettings> | undefined,
        state.view as GraphSettings["view"] | undefined,
      ),
    [state.graphSettings, state.view],
  );
  const paramValues = useMemo(
    () => (state.paramValues as Record<string, number>) ?? {},
    [state.paramValues],
  );

  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const series = useMemo(() => {
    return exprs.map((e) => {
      const classified = classifyMathInput("", e.text);
      return {
        expr: e.text,
        color: e.color,
        kind:
          classified.kind === "inequality"
            ? ("inequality" as const)
            : ("function" as const),
      };
    });
  }, [exprs]);

  const setGraphSettings = (next: GraphSettings) => {
    setState({ graphSettings: next, view: next.view });
  };

  const addExpr = () => {
    const text = input.trim();
    if (!text) return;
    const ok =
      compileExpression(normalizeGraphExpression(text)) ||
      parseInequality(text);
    if (!ok) {
      setInputError(true);
      return;
    }
    setInputError(false);
    const color = COLORS[exprs.length % COLORS.length];
    setState({ exprs: [...exprs, { text, color }] });
    setInput("");
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setInputError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") addExpr();
          }}
          placeholder="f(x) 또는 부등식 · 예) x^2, y>2x+1"
          className={`min-w-0 flex-1 rounded-lg border-2 bg-white px-3 py-1.5 font-mono text-sm ${
            inputError ? "border-red-400" : "border-black/10"
          }`}
        />
        <button
          type="button"
          onClick={addExpr}
          className="font-display rounded-lg bg-sky px-3 text-sm text-[#1a4a6e] transition hover:brightness-105"
        >
          추가
        </button>
      </div>

      {exprs.length > 0 ? (
        <div className="flex max-h-14 flex-wrap gap-1 overflow-auto">
          {exprs.map((e, i) => (
            <span
              key={`${e.text}-${i}`}
              className="flex items-center gap-1.5 rounded-full border-2 bg-white py-0.5 pr-1 pl-2 font-mono text-xs font-semibold"
              style={{ borderColor: e.color, color: e.color }}
            >
              {e.text}
              <button
                type="button"
                aria-label="삭제"
                onClick={() =>
                  setState({ exprs: exprs.filter((_, j) => j !== i) })
                }
                className="rounded-full p-0.5 hover:bg-black/10"
              >
                <CloseIcon width={11} height={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <button
          type="button"
          className="absolute top-2 left-2 z-10 rounded-lg border border-black/10 bg-white/90 px-2 py-1 text-[11px] font-semibold text-wood shadow"
          onClick={() => setSettingsOpen((v) => !v)}
        >
          설정
        </button>
        {settingsOpen ? (
          <GraphSettingsPanel
            settings={graphSettings}
            onChange={setGraphSettings}
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
    </div>
  );
}
