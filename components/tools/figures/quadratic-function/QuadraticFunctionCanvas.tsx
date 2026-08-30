"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addSnappedPointOnGraph,
  applyEditedLabel,
  hitTestQuadraticFunction,
  moveHorizontalLine,
  moveParabolaShape,
  movePointOnGraph,
  moveTransValue,
  moveVertex,
  nearestGraphId,
  nudgeAxisLabel,
  nudgeGraphLabel,
  nudgePointLabel,
  nudgeTransLabel,
  parseGraphLabelId,
  parseTransLabelId,
  type QuadraticHit,
  valueFromCanvasX,
  valueFromCanvasY,
} from "@/lib/diagrams/quadratic-function/geometry";
import {
  isHorizontal,
  vertexOf,
  type QuadraticFunctionState,
} from "@/lib/diagrams/quadratic-function/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildQuadraticFunctionScene,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type QuadraticFunctionScene,
} from "@/lib/diagrams/quadratic-function/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type QuadraticFunctionSetter = (
  updater:
    | QuadraticFunctionState
    | ((prev: QuadraticFunctionState) => QuadraticFunctionState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "label"; id: string; targetId: string; x: number; y: number; moved: boolean }
  | { t: "point"; pointId: string }
  | { t: "vertex"; graphId: string }
  | { t: "graphShape"; graphId: string }
  | { t: "graphShift"; graphId: string }
  | { t: "horizontal"; graphId: string }
  | { t: "transArrow"; transId: string; index: number };

type Props = {
  state: QuadraticFunctionState;
  fonts: FontFaces;
  selectedId: string | null;
  placingPoint: boolean;
  setState: QuadraticFunctionSetter;
  persist: () => void;
  onSelect: (id: string | null) => void;
  onDeleteSelected: () => void;
};

export default function QuadraticFunctionCanvas({
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
  const sceneRef = useRef<QuadraticFunctionScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<QuadraticHit | null>(null);
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
    const scene = buildQuadraticFunctionScene(current);
    sceneRef.current = scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SCENE_WIDTH * dpr);
    canvas.height = Math.round(SCENE_HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintDiagramScene(ctx, scene, fonts, current.style.lineWidth);
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
    return hitTestQuadraticFunction(
      stateRef.current,
      scene,
      p.x,
      p.y,
      hitScale(),
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
        aria-label="이차함수 그래프. 포물선을 고르고, 꼭짓점·점·평행이동 화살을 끌거나 눌러 바꿀 수 있어요."
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

          if (hit.kind === "vertex") {
            onSelect(hit.graphId);
            dragRef.current = { t: "vertex", graphId: hit.graphId };
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
            const graph = stateRef.current.graphs.find((g) => g.id === hit.graphId);
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
            if (graph && isHorizontal(graph)) {
              dragRef.current = { t: "horizontal", graphId: hit.graphId };
            } else if (graph) {
              const v = vertexOf(graph);
              const distToVertex = Math.hypot(
                p.x - scene.layout.originX,
                p.y - scene.layout.originY,
              );
              void distToVertex;
              const dataX = valueFromCanvasX(p.x, scene.layout);
              const dataY = valueFromCanvasY(p.y, scene.layout);
              const nearVertex =
                Math.hypot(dataX - v.x, dataY - v.y) <
                Math.max(stateRef.current.xTick, stateRef.current.yTick) * 0.45;
              dragRef.current = nearVertex
                ? { t: "vertex", graphId: hit.graphId }
                : { t: "graphShape", graphId: hit.graphId };
            }
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
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
                movePointOnGraph(
                  prev,
                  drag.pointId,
                  valueFromCanvasX(p.x, scene.layout),
                ),
              false,
            );
            return;
          }

          if (drag.t === "vertex" || drag.t === "graphShift") {
            setState(
              (prev) =>
                moveVertex(
                  prev,
                  drag.graphId,
                  valueFromCanvasX(p.x, scene.layout),
                  valueFromCanvasY(p.y, scene.layout),
                ),
              false,
            );
            return;
          }

          if (drag.t === "graphShape") {
            setState(
              (prev) =>
                moveParabolaShape(
                  prev,
                  drag.graphId,
                  valueFromCanvasX(p.x, scene.layout),
                  valueFromCanvasY(p.y, scene.layout),
                ),
              false,
            );
            return;
          }

          if (drag.t === "horizontal") {
            setState(
              (prev) =>
                moveHorizontalLine(
                  prev,
                  drag.graphId,
                  valueFromCanvasY(p.y, scene.layout),
                ),
              false,
            );
            return;
          }

          if (drag.t === "transArrow") {
            const trans = stateRef.current.translations.find(
              (t) => t.id === drag.transId,
            );
            setState(
              (prev) =>
                moveTransValue(
                  prev,
                  drag.transId,
                  drag.index,
                  trans?.kind === "horizontal"
                    ? valueFromCanvasY(p.y, scene.layout)
                    : valueFromCanvasX(p.x, scene.layout),
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

function sameHit(a: QuadraticHit | null, b: QuadraticHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "label") return b.kind === "label" && a.id === b.id;
  if (a.kind === "point") return b.kind === "point" && a.pointId === b.pointId;
  if (a.kind === "vertex") return b.kind === "vertex" && a.graphId === b.graphId;
  if (a.kind === "transArrow") {
    return (
      b.kind === "transArrow" && a.transId === b.transId && a.index === b.index
    );
  }
  if (a.kind === "graph") return b.kind === "graph" && a.graphId === b.graphId;
  return true;
}

function cursorForHit(hit: QuadraticHit | null, placing: boolean): string {
  if (!hit) return "default";
  if (placing && (hit.kind === "graph" || hit.kind === "plot")) {
    return "crosshair";
  }
  if (
    hit.kind === "label" ||
    hit.kind === "point" ||
    hit.kind === "vertex" ||
    hit.kind === "graph" ||
    hit.kind === "transArrow"
  ) {
    return "grab";
  }
  return "default";
}
