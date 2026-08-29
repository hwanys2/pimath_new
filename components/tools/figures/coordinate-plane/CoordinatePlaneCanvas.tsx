"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addPolylineVertex,
  addSnappedPoint,
  applyEditedLabel,
  hitTestCoordPlane,
  movePoint,
  moveVertex,
  nudgeAxisLabel,
  nudgeGraphLabel,
  nudgePointLabel,
  parseGraphLabelId,
  type CoordHit,
} from "@/lib/diagrams/coordinate-plane/geometry";
import type { CoordPlaneState } from "@/lib/diagrams/coordinate-plane/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildCoordPlaneScene,
  canvasXFromValue,
  canvasYFromValue,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  valueFromCanvasX,
  valueFromCanvasY,
  type CoordPlaneScene,
} from "@/lib/diagrams/coordinate-plane/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type CoordPlaneSetter = (
  updater:
    | CoordPlaneState
    | ((prev: CoordPlaneState) => CoordPlaneState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "label"; id: string; targetId: string; isGraph: boolean; x: number; y: number; moved: boolean }
  | { t: "point"; pointId: string }
  | { t: "vertex"; graphId: string; index: number };

type Props = {
  state: CoordPlaneState;
  fonts: FontFaces;
  selectedId: string | null;
  placingVertices: boolean;
  setState: CoordPlaneSetter;
  persist: () => void;
  onSelect: (id: string | null) => void;
  onDeleteSelected: () => void;
};

export default function CoordinatePlaneCanvas({
  state,
  fonts,
  selectedId,
  placingVertices,
  setState,
  persist,
  onSelect,
  onDeleteSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CoordPlaneScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<CoordHit | null>(null);
  const stateRef = useRef(state);
  const selectedRef = useRef(selectedId);
  const placingRef = useRef(placingVertices);
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
  placingRef.current = placingVertices;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildCoordPlaneScene(current);
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
    return hitTestCoordPlane(stateRef.current, scene, p.x, p.y, hitScale());
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
        aria-label="좌표평면. 칸을 눌러 점을 넣고, 점·식을 끌거나 눌러 바꿀 수 있어요."
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
              isGraph: parseGraphLabelId(hit.id) != null,
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
            dragRef.current = {
              t: "vertex",
              graphId: hit.graphId,
              index: hit.index,
            };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          if (hit.kind === "plot") {
            if (placingRef.current && selectedRef.current) {
              setState(
                (prev) =>
                  addPolylineVertex(
                    prev,
                    selectedRef.current!,
                    scene.layout,
                    p.x,
                    p.y,
                  ),
                true,
              );
              return;
            }
            const next = addSnappedPoint(
              stateRef.current,
              scene.layout,
              p.x,
              p.y,
            );
            const added = next.points[next.points.length - 1];
            setState(next, true);
            if (added) onSelect(added.id);
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
              if (drag.isGraph) return nudgeGraphLabel(prev, drag.targetId, dx, dy);
              return nudgePointLabel(prev, drag.targetId, dx, dy);
            }, false);
            return;
          }

          if (drag.t === "point") {
            setState(
              (prev) =>
                movePoint(
                  prev,
                  drag.pointId,
                  valueFromCanvasX(p.x, scene.layout),
                  valueFromCanvasY(p.y, scene.layout),
                ),
              false,
            );
            return;
          }

          if (drag.t === "vertex") {
            setState(
              (prev) =>
                moveVertex(
                  prev,
                  drag.graphId,
                  drag.index,
                  valueFromCanvasX(p.x, scene.layout),
                  valueFromCanvasY(p.y, scene.layout),
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

function sameHit(a: CoordHit | null, b: CoordHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "label") return b.kind === "label" && a.id === b.id;
  if (a.kind === "point") return b.kind === "point" && a.pointId === b.pointId;
  if (a.kind === "vertex") {
    return (
      b.kind === "vertex" && a.graphId === b.graphId && a.index === b.index
    );
  }
  return true;
}

function cursorForHit(hit: CoordHit | null, placing: boolean): string {
  if (!hit) return "default";
  if (hit.kind === "label") return "text";
  if (hit.kind === "plot") return placing ? "crosshair" : "copy";
  return "grab";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: CoordPlaneScene,
  state: CoordPlaneState,
  selectedId: string | null,
  hover: CoordHit | null,
) {
  ctx.save();
  for (const point of state.points) {
    const x = canvasXFromValue(point.x, scene.layout);
    const y = canvasYFromValue(point.y, scene.layout);
    const selected = point.id === selectedId;
    const hovered = hover?.kind === "point" && hover.pointId === point.id;
    if (!selected && !hovered) continue;
    ctx.beginPath();
    ctx.arc(x, y, hovered ? 10 : 8.5, 0, Math.PI * 2);
    ctx.fillStyle = hovered
      ? "rgba(196, 130, 58, 0.28)"
      : "rgba(196, 130, 58, 0.18)";
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 2.2;
    ctx.fill();
    ctx.stroke();
  }
  const poly = state.graphs.find(
    (g) => g.id === selectedId && g.t === "polyline",
  );
  if (poly && poly.t === "polyline") {
    poly.vertices.forEach((v, i) => {
      const x = canvasXFromValue(v.x, scene.layout);
      const y = canvasYFromValue(v.y, scene.layout);
      const hovered =
        hover?.kind === "vertex" &&
        hover.graphId === poly.id &&
        hover.index === i;
      ctx.beginPath();
      ctx.arc(x, y, hovered ? 7 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = hovered ? "rgba(232, 74, 140, 0.35)" : "#fff";
      ctx.strokeStyle = "#e84a8c";
      ctx.lineWidth = 1.8;
      ctx.fill();
      ctx.stroke();
    });
  }
  ctx.restore();
}
