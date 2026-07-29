"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { compileExpression, defaultParamValues, listParameters } from "@/lib/board-math";
import { CloseIcon, MinusIcon, PlusIcon } from "../icons";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

type ExprItem = { text: string; color: string };
type View = { xMin: number; xMax: number; yMin: number; yMax: number };

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316"];
const DEFAULT_VIEW: View = { xMin: -10, xMax: 10, yMin: -7, yMax: 7 };

function niceStep(range: number): number {
  const rough = range / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const base = rough / pow;
  if (base < 1.5) return pow;
  if (base < 3.5) return 2 * pow;
  if (base < 7.5) return 5 * pow;
  return 10 * pow;
}

function ticks(min: number, max: number): number[] {
  const step = niceStep(max - min);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    out.push(Math.abs(v) < step / 1e6 ? 0 : parseFloat(v.toPrecision(10)));
  }
  return out;
}

export default function GraphWidget({ state, setState }: Props) {
  const exprs = useMemo(
    () =>
      (state.exprs as ExprItem[]) ?? [{ text: "x^2", color: COLORS[0] }],
    [state.exprs],
  );
  const view = (state.view as View) ?? DEFAULT_VIEW;
  const paramValues = useMemo(
    () => (state.paramValues as Record<string, number>) ?? {},
    [state.paramValues],
  );

  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState(false);
  const [dims, setDims] = useState({ w: 300, h: 220 });
  const plotRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; view: View } | null>(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      if (rect.width > 0 && rect.height > 0) {
        setDims({ w: rect.width, h: rect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = dims;
  const toPx = useMemo(() => {
    const sx = w / (view.xMax - view.xMin);
    const sy = h / (view.yMax - view.yMin);
    return {
      x: (x: number) => (x - view.xMin) * sx,
      y: (y: number) => h - (y - view.yMin) * sy,
    };
  }, [w, h, view]);

  const compiled = useMemo(
    () =>
      exprs.map((e) => {
        const params = listParameters(e.text);
        const fn =
          params.length > 0
            ? compileExpression(e.text, {
                ...defaultParamValues(params),
                ...paramValues,
              })
            : compileExpression(e.text);
        return { ...e, fn };
      }),
    [exprs, paramValues],
  );

  const paths = useMemo(() => {
    return compiled.map(({ fn, color }) => {
      if (!fn) return { color, d: "" };
      let d = "";
      let penDown = false;
      const step = (view.xMax - view.xMin) / Math.max(w, 100);
      let prevY: number | null = null;
      for (let x = view.xMin; x <= view.xMax + step; x += step) {
        const y = fn(x);
        if (!Number.isFinite(y)) {
          penDown = false;
          prevY = null;
          continue;
        }
        // Break the path on asymptote jumps
        if (prevY !== null && Math.abs(y - prevY) > (view.yMax - view.yMin) * 4) {
          penDown = false;
        }
        prevY = y;
        const px = toPx.x(x);
        const py = toPx.y(y);
        if (py < -h * 2 || py > h * 3) {
          penDown = false;
          continue;
        }
        d += penDown ? `L${px.toFixed(1)},${py.toFixed(1)}` : `M${px.toFixed(1)},${py.toFixed(1)}`;
        penDown = true;
      }
      return { color, d };
    });
  }, [compiled, view, w, h, toPx]);

  const addExpr = () => {
    const text = input.trim();
    if (!text) return;
    if (!compileExpression(text)) {
      setInputError(true);
      return;
    }
    setInputError(false);
    const color = COLORS[exprs.length % COLORS.length];
    setState({ exprs: [...exprs, { text, color }] });
    setInput("");
  };

  const zoom = (factor: number, cx?: number, cy?: number) => {
    const centerX = cx ?? (view.xMin + view.xMax) / 2;
    const centerY = cy ?? (view.yMin + view.yMax) / 2;
    setState({
      view: {
        xMin: centerX + (view.xMin - centerX) * factor,
        xMax: centerX + (view.xMax - centerX) * factor,
        yMin: centerY + (view.yMin - centerY) * factor,
        yMax: centerY + (view.yMax - centerY) * factor,
      },
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panRef.current = { x: e.clientX, y: e.clientY, view };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const pan = panRef.current;
    if (!pan) return;
    const dx = ((e.clientX - pan.x) / w) * (pan.view.xMax - pan.view.xMin);
    const dy = ((e.clientY - pan.y) / h) * (pan.view.yMax - pan.view.yMin);
    setState({
      view: {
        xMin: pan.view.xMin - dx,
        xMax: pan.view.xMax - dx,
        yMin: pan.view.yMin + dy,
        yMax: pan.view.yMax + dy,
      },
    });
  };
  const onPointerUp = () => {
    panRef.current = null;
  };

  const xTicks = ticks(view.xMin, view.xMax);
  const yTicks = ticks(view.yMin, view.yMax);
  const axisX = Math.min(Math.max(toPx.y(0), 14), h - 6);
  const axisY = Math.min(Math.max(toPx.x(0), 6), w - 14);

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
          placeholder="f(x) 입력 · 예) 2x+1, x^2-4, sin(x)"
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
              y={e.text}
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

      <div
        ref={plotRef}
        className="relative min-h-0 flex-1 cursor-move touch-none overflow-hidden rounded-xl border-2 border-black/10 bg-white"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={(e) => zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15)}
      >
        <svg width={w} height={h} className="absolute inset-0">
          {xTicks.map((t) => (
            <line
              key={`gx${t}`}
              x1={toPx.x(t)}
              y1={0}
              x2={toPx.x(t)}
              y2={h}
              stroke={t === 0 ? "#3d2c1e" : "#e5e0d5"}
              strokeWidth={t === 0 ? 1.5 : 1}
            />
          ))}
          {yTicks.map((t) => (
            <line
              key={`gy${t}`}
              x1={0}
              y1={toPx.y(t)}
              x2={w}
              y2={toPx.y(t)}
              stroke={t === 0 ? "#3d2c1e" : "#e5e0d5"}
              strokeWidth={t === 0 ? 1.5 : 1}
            />
          ))}
          {xTicks
            .filter((t) => t !== 0)
            .map((t) => (
              <text
                key={`lx${t}`}
                x={toPx.x(t)}
                y={axisX + 12}
                textAnchor="middle"
                fontSize="10"
                fill="#8b5e3c"
              >
                {t}
              </text>
            ))}
          {yTicks
            .filter((t) => t !== 0)
            .map((t) => (
              <text
                key={`ly${t}`}
                x={axisY + 4}
                y={toPx.y(t) + 3}
                fontSize="10"
                fill="#8b5e3c"
              >
                {t}
              </text>
            ))}
          {paths.map((p, i) =>
            p.d ? (
              <path
                key={i}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            ) : null,
          )}
        </svg>
        <div className="absolute right-2 bottom-2 flex flex-col gap-1">
          <button
            type="button"
            aria-label="확대"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => zoom(1 / 1.4)}
            className="rounded-lg border-2 border-black/10 bg-white p-1.5 text-wood shadow transition hover:bg-cream"
          >
            <PlusIcon width={14} height={14} />
          </button>
          <button
            type="button"
            aria-label="축소"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => zoom(1.4)}
            className="rounded-lg border-2 border-black/10 bg-white p-1.5 text-wood shadow transition hover:bg-cream"
          >
            <MinusIcon width={14} height={14} />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setState({ view: DEFAULT_VIEW })}
            className="font-display rounded-lg border-2 border-black/10 bg-white px-1.5 py-1 text-[10px] text-wood shadow transition hover:bg-cream"
          >
            처음
          </button>
        </div>
      </div>
    </div>
  );
}
