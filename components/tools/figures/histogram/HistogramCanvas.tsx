"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabel,
  hitTestHistogram,
  nudgeMovableLabel,
  parseSeriesLabelId,
  setFrequencyFromCanvas,
  type HistHit,
} from "@/lib/diagrams/histogram/geometry";
import {
  classBound,
  classMid,
  type HistogramState,
} from "@/lib/diagrams/histogram/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildHistogramScene,
  canvasXFromValue,
  canvasYFromValue,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type HistogramScene,
} from "@/lib/diagrams/histogram/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type HistogramSetter = (
  updater: HistogramState | ((prev: HistogramState) => HistogramState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "label"; id: string; targetId: string; x: number; y: number; moved: boolean }
  | { t: "freq"; seriesId: string; index: number };

type Props = {
  state: HistogramState;
  fonts: FontFaces;
  selectedId: string | null;
  setState: HistogramSetter;
  persist: () => void;
  onSelect: (id: string | null) => void;
};

export default function HistogramCanvas({
  state,
  fonts,
  selectedId,
  setState,
  persist,
  onSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HistogramScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<HistHit | null>(null);
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
    const scene = buildHistogramScene(current);
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
    return hitTestHistogram(
      stateRef.current,
      scene,
      p.x,
      p.y,
      hitScale(),
      selectedRef.current,
    );
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
        aria-label="히스토그램. 막대나 점을 끌어 도수를 바꾸고, 글자를 눌러 고칠 수 있어요."
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
          dragRef.current = {
            t: "freq",
            seriesId: hit.seriesId,
            index: hit.index,
          };
          setCursor("ns-resize");
          e.currentTarget.setPointerCapture(e.pointerId);
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
              setCursor(cursorForHit(hit));
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
              setFrequencyFromCanvas(
                prev,
                drag.seriesId,
                drag.index,
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

function sameHit(a: HistHit | null, b: HistHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "label") return b.kind === "label" && a.id === b.id;
  if (a.kind === "bar") {
    return b.kind === "bar" && a.seriesId === b.seriesId && a.index === b.index;
  }
  if (a.kind === "point") {
    return (
      b.kind === "point" && a.seriesId === b.seriesId && a.index === b.index
    );
  }
  return false;
}

function cursorForHit(hit: HistHit | null): string {
  if (!hit) return "default";
  if (hit.kind === "label") return "text";
  return "ns-resize";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: HistogramScene,
  state: HistogramState,
  selectedId: string | null,
  hover: HistHit | null,
) {
  const layout = scene.layout;
  ctx.save();
  if (state.kind === "polygon") {
    for (const series of state.series) {
      for (let i = 0; i < state.classCount; i += 1) {
        const x = canvasXFromValue(classMid(state, i), layout);
        const y = canvasYFromValue(series.frequencies[i] ?? 0, layout);
        const selected = series.id === selectedId;
        const hovered =
          hover?.kind === "point" &&
          hover.seriesId === series.id &&
          hover.index === i;
        if (!selected && !hovered) continue;
        ctx.beginPath();
        ctx.arc(x, y, hovered ? 8 : 6.5, 0, Math.PI * 2);
        ctx.fillStyle = hovered
          ? "rgba(196, 130, 58, 0.28)"
          : "rgba(196, 130, 58, 0.16)";
        ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      }
    }
  } else {
    for (const series of state.series) {
      for (let i = 0; i < state.classCount; i += 1) {
        const selected = series.id === selectedId;
        const hovered =
          hover?.kind === "bar" &&
          hover.seriesId === series.id &&
          hover.index === i;
        if (!selected && !hovered) continue;
        const x0 = canvasXFromValue(classBound(state, i), layout);
        const x1 = canvasXFromValue(classBound(state, i + 1), layout);
        const y = canvasYFromValue(series.frequencies[i] ?? 0, layout);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.strokeStyle = hovered ? "rgba(196, 130, 58, 0.95)" : "rgba(196, 130, 58, 0.7)";
        ctx.lineWidth = hovered ? 3 : 2.2;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
