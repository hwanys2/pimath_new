"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabel,
  hitTestBoxPlot,
  nudgeMovableLabel,
  parseSeriesLabelId,
  setStatFromCanvas,
  type BoxHit,
} from "@/lib/diagrams/boxplot/geometry";
import {
  type BoxPlotState,
  type StatKey,
} from "@/lib/diagrams/boxplot/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  bandForSeries,
  buildBoxPlotScene,
  fenceSegment,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type BoxPlotScene,
} from "@/lib/diagrams/boxplot/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type BoxPlotSetter = (
  updater: BoxPlotState | ((prev: BoxPlotState) => BoxPlotState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "label"; id: string; targetId: string; x: number; y: number; moved: boolean }
  | { t: "stat"; seriesId: string; key: StatKey };

type Props = {
  state: BoxPlotState;
  fonts: FontFaces;
  selectedId: string | null;
  setState: BoxPlotSetter;
  persist: () => void;
  onSelect: (id: string | null) => void;
};

export default function BoxPlotCanvas({
  state,
  fonts,
  selectedId,
  setState,
  persist,
  onSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BoxPlotScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<BoxHit | null>(null);
  const stateRef = useRef(state);
  const selectedRef = useRef(selectedId);
  const [edit, setEdit] = useState<{
    id: string;
    value: string;
    x: number;
    y: number;
  } | null>(null);
  const editRef = useRef(edit);
  editRef.current = edit;
  stateRef.current = state;
  selectedRef.current = selectedId;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildBoxPlotScene(current);
    sceneRef.current = scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SCENE_WIDTH * dpr);
    canvas.height = Math.round(SCENE_HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintDiagramScene(ctx, scene, fonts, current.style.lineWidth);
    paintOverlays(ctx, scene, current, selectedRef.current, hoverRef.current);
  }, [fonts]);

  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) paint();
    });
    paint();
    return () => {
      cancelled = true;
    };
  }, [paint, state, selectedId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dragRef.current = null;
        setEdit(null);
        paint();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paint]);

  function scenePoint(e: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SCENE_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * SCENE_HEIGHT,
    };
  }

  function hitScale() {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    const width = canvas.getBoundingClientRect().width;
    return width > 1 ? SCENE_WIDTH / width : 1;
  }

  function hitAt(e: { clientX: number; clientY: number }) {
    const scene = sceneRef.current;
    if (!scene) return null;
    const p = scenePoint(e);
    return hitTestBoxPlot(stateRef.current, scene, p.x, p.y, hitScale());
  }

  function setCursor(value: string) {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = value;
  }

  function commitEdit(next: string | null) {
    const current = editRef.current;
    if (!current) return;
    const value = next ?? current.value;
    editRef.current = null;
    setEdit(null);
    setState((prev) => applyEditedLabel(prev, current.id, value), true);
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={SCENE_WIDTH}
        height={SCENE_HEIGHT}
        className="h-auto w-full touch-none bg-white"
        tabIndex={0}
        aria-label="상자수염 그림. 최솟값·사분위수·중앙값·최댓값을 끌어 바꾸고, 글자를 눌러 고칠 수 있어요."
        onPointerDown={(e) => {
          if (editRef.current) commitEdit(null);
          const scene = sceneRef.current;
          if (!scene) return;
          const p = scenePoint(e);
          const hit = hitAt(e);
          hoverRef.current = null;

          if (!hit) {
            onSelect(null);
            return;
          }

          if (hit.kind === "label") {
            dragRef.current = {
              t: "label",
              id: hit.id,
              targetId: hit.targetId,
              x: p.x,
              y: p.y,
              moved: false,
            };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            const seriesId = parseSeriesLabelId(hit.id);
            if (seriesId) onSelect(seriesId);
            return;
          }

          onSelect(hit.seriesId);
          if (hit.kind === "stat") {
            dragRef.current = { t: "stat", seriesId: hit.seriesId, key: hit.key };
            setCursor(
              stateRef.current.orientation === "horizontal"
                ? "ew-resize"
                : "ns-resize",
            );
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          dragRef.current = null;
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          const scene = sceneRef.current;
          if (!scene) return;
          const p = scenePoint(e);

          if (!drag) {
            const hit = hitAt(e);
            if (!sameHit(hoverRef.current, hit)) {
              hoverRef.current = hit;
              setCursor(cursorForHit(hit, stateRef.current.orientation));
              paint();
            }
            return;
          }

          if (drag.t === "label") {
            const dx = p.x - drag.x;
            const dy = p.y - drag.y;
            if (!drag.moved && Math.hypot(dx, dy) < 3) return;
            drag.moved = true;
            drag.x = p.x;
            drag.y = p.y;
            setState((prev) => nudgeMovableLabel(prev, drag.id, dx, dy), false);
            return;
          }

          setState(
            (prev) =>
              setStatFromCanvas(
                prev,
                drag.seriesId,
                drag.key,
                p.x,
                p.y,
                scene.layout,
              ),
            false,
          );
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          dragRef.current = null;
          setCursor("default");
          persist();
          if (drag?.t === "label" && !drag.moved) {
            const scene = sceneRef.current;
            const text = scene?.texts.find((t) => t.id === drag.id);
            if (text) {
              setEdit({
                id: drag.id,
                value: sceneTextPlain(text),
                x: text.x,
                y: text.y,
              });
            }
          }
          paint();
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => {
          if (dragRef.current) return;
          hoverRef.current = null;
          setCursor("default");
          paint();
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          hoverRef.current = null;
          setCursor("default");
          persist();
          paint();
        }}
      />
      {edit ? (
        <input
          autoFocus
          value={edit.value}
          aria-label="글자 수정"
          onChange={(e) => setEdit({ ...edit, value: e.target.value })}
          onBlur={() => commitEdit(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit(edit.value);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              editRef.current = null;
              setEdit(null);
            }
          }}
          className="absolute z-10 min-w-[4.5rem] rounded-lg border-2 border-wood bg-white px-2 py-0.5 text-center text-[15px] text-black shadow-md outline-none"
          style={{
            left: `${(edit.x / SCENE_WIDTH) * 100}%`,
            top: `${(edit.y / SCENE_HEIGHT) * 100}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: "Times New Roman, Noto Serif, Batang, serif",
          }}
        />
      ) : null}
    </div>
  );
}

function sameHit(a: BoxHit | null, b: BoxHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "label") return b.kind === "label" && a.id === b.id;
  if (a.kind === "stat") {
    return b.kind === "stat" && a.seriesId === b.seriesId && a.key === b.key;
  }
  if (a.kind === "box") return b.kind === "box" && a.seriesId === b.seriesId;
  return false;
}

function cursorForHit(
  hit: BoxHit | null,
  orientation: BoxPlotState["orientation"],
): string {
  if (!hit) return "default";
  if (hit.kind === "label") return "text";
  if (hit.kind === "stat") {
    return orientation === "horizontal" ? "ew-resize" : "ns-resize";
  }
  return "pointer";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: BoxPlotScene,
  state: BoxPlotState,
  selectedId: string | null,
  hover: BoxHit | null,
) {
  const layout = scene.layout;
  ctx.save();
  for (const series of state.series) {
    const band = bandForSeries(layout, series.id);
    if (!band) continue;
    const selected = series.id === selectedId;
    const hoverStat =
      hover?.kind === "stat" && hover.seriesId === series.id ? hover.key : null;
    if (!selected && !hoverStat && hover?.kind !== "box") continue;
    if (hover?.kind === "box" && hover.seriesId !== series.id && !selected) {
      continue;
    }
    const keys = hoverStat
      ? [hoverStat]
      : (["min", "q1", "median", "q3", "max"] as const);
    for (const key of keys) {
      if (!selected && key !== hoverStat) continue;
      const seg = fenceSegment(layout, band, key, series.values[key]);
      const active = hoverStat === key;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.strokeStyle = active
        ? "rgba(196, 130, 58, 0.95)"
        : "rgba(196, 130, 58, 0.55)";
      ctx.lineWidth = active ? 3 : 2;
      ctx.stroke();
    }
  }
  ctx.restore();
}
