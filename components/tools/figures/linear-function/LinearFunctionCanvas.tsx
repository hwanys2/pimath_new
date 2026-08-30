"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addSnappedPointOnGraph,
  applyEditedLabel,
  canvasXFromValue,
  canvasYFromValue,
  hitTestLinearFunction,
  moveIntercept,
  movePointOnLine,
  moveSlopeEnd,
  moveTransArrow,
  nearestGraphId,
  nudgeAxisLabel,
  nudgeGraphLabel,
  nudgePointLabel,
  nudgeSlopeLabel,
  nudgeTransLabel,
  parseGraphLabelId,
  parseSlopeLabelId,
  parseTransLabelId,
  shiftAxisLine,
  type LinearHit,
  valueFromCanvasX,
  valueFromCanvasY,
} from "@/lib/diagrams/linear-function/geometry";
import {
  isHorizontal,
  isVertical,
  pointCoords,
  yOnLine,
  type LinearFunctionState,
} from "@/lib/diagrams/linear-function/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildLinearFunctionScene,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type LinearFunctionScene,
} from "@/lib/diagrams/linear-function/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type LinearFunctionSetter = (
  updater:
    | LinearFunctionState
    | ((prev: LinearFunctionState) => LinearFunctionState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "label"; id: string; targetId: string; x: number; y: number; moved: boolean }
  | { t: "point"; pointId: string }
  | { t: "slopeEnd"; stepId: string; which: 1 | 2 }
  | { t: "intercept"; graphId: string; which: "x" | "y" }
  | { t: "transArrow"; transId: string; index: number }
  | { t: "graphShift"; graphId: string };

type Props = {
  state: LinearFunctionState;
  fonts: FontFaces;
  selectedId: string | null;
  placingPoint: boolean;
  setState: LinearFunctionSetter;
  persist: () => void;
  onSelect: (id: string | null) => void;
  onDeleteSelected: () => void;
};

export default function LinearFunctionCanvas({
  state,
  fonts,
  selectedId,
  placingPoint,
  setState,
  persist,
  onSelect,
  onDeleteSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<LinearFunctionScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<LinearHit | null>(null);
  const stateRef = useRef(state);
  const selectedRef = useRef(selectedId);
  const placingRef = useRef(placingPoint);
  const [edit, setEdit] = useState<{
    id: string;
    value: string;
    x: number;
    y: number;
  } | null>(null);
  const editRef = useRef(edit);

  useEffect(() => {
    editRef.current = edit;
  }, [edit]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    placingRef.current = placingPoint;
  }, [placingPoint]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildLinearFunctionScene(current);
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
        return;
      }
      if (editRef.current) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        onDeleteSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDeleteSelected, paint]);

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
    return hitTestLinearFunction(stateRef.current, scene, p.x, p.y, hitScale());
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
        aria-label="일차함수 그래프. 직선을 고르고, 점·절편·기울기 화살을 끌거나 눌러 바꿀 수 있어요."
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
            onSelect(hit.targetId);
            return;
          }

          if (hit.kind === "point") {
            onSelect(hit.pointId);
            dragRef.current = { t: "point", pointId: hit.pointId };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          if (hit.kind === "slopeEnd") {
            onSelect(hit.stepId);
            dragRef.current = {
              t: "slopeEnd",
              stepId: hit.stepId,
              which: hit.which,
            };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          if (hit.kind === "intercept") {
            onSelect(hit.graphId);
            dragRef.current = {
              t: "intercept",
              graphId: hit.graphId,
              which: hit.which,
            };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          if (hit.kind === "transArrow") {
            onSelect(hit.transId);
            dragRef.current = {
              t: "transArrow",
              transId: hit.transId,
              index: hit.index,
            };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          if (hit.kind === "graph") {
            if (placingRef.current) {
              const next = addSnappedPointOnGraph(
                stateRef.current,
                hit.graphId,
                scene.layout,
                p.x,
                p.y,
              );
              const added = next.points[next.points.length - 1];
              setState(next, true);
              if (added) onSelect(added.id);
              return;
            }
            onSelect(hit.graphId);
            const graph = stateRef.current.graphs.find((g) => g.id === hit.graphId);
            if (graph && (isVertical(graph) || isHorizontal(graph))) {
              dragRef.current = { t: "graphShift", graphId: hit.graphId };
              setCursor("grabbing");
              e.currentTarget.setPointerCapture(e.pointerId);
            }
            return;
          }

          if (hit.kind === "plot") {
            if (placingRef.current) {
              const graphId =
                selectedRef.current &&
                stateRef.current.graphs.some((g) => g.id === selectedRef.current)
                  ? selectedRef.current
                  : nearestGraphId(stateRef.current, scene.layout, p.x, p.y);
              if (!graphId) return;
              const next = addSnappedPointOnGraph(
                stateRef.current,
                graphId,
                scene.layout,
                p.x,
                p.y,
              );
              const added = next.points[next.points.length - 1];
              setState(next, true);
              if (added) onSelect(added.id);
              return;
            }
            onSelect(null);
          }
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
              setCursor(cursorForHit(hit, placingRef.current));
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
            setState((prev) => {
              if (drag.id === "axis-x" || drag.id === "axis-y") {
                return nudgeAxisLabel(prev, drag.id, dx, dy);
              }
              if (parseGraphLabelId(drag.id)) {
                return nudgeGraphLabel(prev, drag.targetId, drag.id, dx, dy);
              }
              if (parseSlopeLabelId(drag.id)) {
                return nudgeSlopeLabel(prev, drag.targetId, drag.id, dx, dy);
              }
              if (parseTransLabelId(drag.id)) {
                return nudgeTransLabel(prev, drag.targetId, dx, dy);
              }
              return nudgePointLabel(prev, drag.targetId, dx, dy);
            }, false);
            return;
          }

          if (drag.t === "point") {
            setState(
              (prev) =>
                movePointOnLine(
                  prev,
                  drag.pointId,
                  valueFromCanvasX(p.x, scene.layout),
                  valueFromCanvasY(p.y, scene.layout),
                ),
              false,
            );
            return;
          }

          if (drag.t === "graphShift") {
            setState(
              (prev) =>
                shiftAxisLine(
                  prev,
                  drag.graphId,
                  valueFromCanvasX(p.x, scene.layout),
                  valueFromCanvasY(p.y, scene.layout),
                ),
              false,
            );
            return;
          }

          if (drag.t === "slopeEnd") {
            setState(
              (prev) =>
                moveSlopeEnd(
                  prev,
                  drag.stepId,
                  drag.which,
                  valueFromCanvasX(p.x, scene.layout),
                ),
              false,
            );
            return;
          }

          if (drag.t === "intercept") {
            const value =
              drag.which === "x"
                ? valueFromCanvasX(p.x, scene.layout)
                : valueFromCanvasY(p.y, scene.layout);
            setState(
              (prev) => moveIntercept(prev, drag.graphId, drag.which, value),
              false,
            );
            return;
          }

          if (drag.t === "transArrow") {
            setState(
              (prev) =>
                moveTransArrow(
                  prev,
                  drag.transId,
                  drag.index,
                  valueFromCanvasX(p.x, scene.layout),
                ),
              false,
            );
          }
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

function sameHit(a: LinearHit | null, b: LinearHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "label") return b.kind === "label" && a.id === b.id;
  if (a.kind === "point") return b.kind === "point" && a.pointId === b.pointId;
  if (a.kind === "slopeEnd") {
    return (
      b.kind === "slopeEnd" && a.stepId === b.stepId && a.which === b.which
    );
  }
  if (a.kind === "intercept") {
    return (
      b.kind === "intercept" && a.graphId === b.graphId && a.which === b.which
    );
  }
  if (a.kind === "transArrow") {
    return (
      b.kind === "transArrow" && a.transId === b.transId && a.index === b.index
    );
  }
  if (a.kind === "graph") return b.kind === "graph" && a.graphId === b.graphId;
  return true;
}

function cursorForHit(hit: LinearHit | null, placing: boolean): string {
  if (!hit) return "default";
  if (hit.kind === "label") return "text";
  if (hit.kind === "plot") return placing ? "crosshair" : "default";
  if (hit.kind === "graph") return placing ? "crosshair" : "pointer";
  return "grab";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: LinearFunctionScene,
  state: LinearFunctionState,
  selectedId: string | null,
  hover: LinearHit | null,
) {
  ctx.save();
  const layout = scene.layout;

  for (const point of state.points) {
    const graph = state.graphs.find((g) => g.id === point.graphId);
    if (!graph) continue;
    const coords = pointCoords(graph, point);
    const x = canvasXFromValue(coords.x, layout);
    const y = canvasYFromValue(coords.y, layout);
    const selected = point.id === selectedId;
    const hovered = hover?.kind === "point" && hover.pointId === point.id;
    if (!selected && !hovered) continue;
    ring(ctx, x, y, hovered ? 10 : 8.5, hovered);
  }

  const step = state.slopeSteps.find((s) => s.id === selectedId);
  if (step) {
    const graph = state.graphs.find((g) => g.id === step.graphId);
    if (graph) {
      const ends: { x: number; which: 1 | 2 }[] = [
        { x: step.x1, which: 1 },
        { x: step.x2, which: 2 },
      ];
      for (const end of ends) {
        const px = canvasXFromValue(end.x, layout);
        const py = canvasYFromValue(yOnLine(graph, end.x), layout);
        const hovered =
          hover?.kind === "slopeEnd" &&
          hover.stepId === step.id &&
          hover.which === end.which;
        ctx.beginPath();
        ctx.arc(px, py, hovered ? 7 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = hovered ? "rgba(232, 160, 69, 0.4)" : "#fff";
        ctx.strokeStyle = "#e8a045";
        ctx.lineWidth = 1.8;
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  const graph = state.graphs.find((g) => g.id === selectedId);
  if (graph) {
    const hovered = hover?.kind === "graph" && hover.graphId === graph.id;
    if (hovered) {
      const y = yOnLine(graph, 0);
      ring(
        ctx,
        canvasXFromValue(0, layout),
        canvasYFromValue(y, layout),
        6,
        true,
      );
    }
  }
  ctx.restore();
}

function ring(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  hovered: boolean,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = hovered
    ? "rgba(196, 130, 58, 0.28)"
    : "rgba(196, 130, 58, 0.18)";
  ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
  ctx.lineWidth = 2.2;
  ctx.fill();
  ctx.stroke();
}
