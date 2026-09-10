"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabelDetailed,
  cycleLength,
  cycleNamedPoint,
  findLength,
  lengthEndpoints,
  moveExternalPoint,
  moveQuadTouch,
  moveTriangleVertex,
  nudgeMeasureLabel,
  nudgeMeasureLine,
  nudgePointLabel,
  type TangentsSelection,
} from "@/lib/diagrams/circle-tangents/geometry";
import type { CircleTangentsState } from "@/lib/diagrams/circle-tangents/model";
import {
  buildTangentsScene,
  canvasToMath,
  hitTestFigure,
  mathToCanvas,
  measureFrame,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  sceneTextPlain,
  type DiagramScene,
  type FigureHit,
} from "@/lib/diagrams/circle-tangents/scene";
import { paintDiagramScene } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const MOVE_PX = 5;

type Drag =
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "dimLine"; id: string; x: number; y: number; moved: boolean }
  | { t: "point"; id: string; x: number; y: number; moved: boolean };

export type TangentsSetter = (
  updater: CircleTangentsState | ((prev: CircleTangentsState) => CircleTangentsState),
  persist?: boolean,
) => void;

type Props = {
  state: CircleTangentsState;
  fonts: FontFaces;
  selected: TangentsSelection | null;
  setState: TangentsSetter;
  persist: () => void;
  onSelect: (sel: TangentsSelection | null) => void;
  onStatus?: (message: string) => void;
};

function sameHit(a: FigureHit | null, b: FigureHit | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && a.id === b.id;
}

function cursorForHit(hit: FigureHit | null, dragging: boolean): string {
  if (dragging) return "grabbing";
  if (!hit) return "default";
  if (hit.kind === "point") return "grab";
  if (hit.kind === "label") return "text";
  if (hit.kind === "dimLine") return "move";
  if (hit.kind === "seg") return "pointer";
  return "default";
}

export default function CircleTangentsCanvas({
  state,
  fonts,
  selected,
  setState,
  persist,
  onSelect,
  onStatus,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DiagramScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<FigureHit | null>(null);
  const stateRef = useRef(state);
  const selectedRef = useRef(selected);
  const [edit, setEdit] = useState<{
    id: string;
    value: string;
    x: number;
    y: number;
  } | null>(null);
  const editRef = useRef(edit);

  useEffect(() => {
    editRef.current = edit;
    stateRef.current = state;
    selectedRef.current = selected;
  });

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildTangentsScene(current);
    sceneRef.current = scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SCENE_WIDTH * dpr);
    canvas.height = Math.round(SCENE_HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintDiagramScene(ctx, scene, fonts, current.style.lineWidth);
    paintOverlays(ctx, current, scene, selectedRef.current, hoverRef.current);
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
  }, [paint, state, selected]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dragRef.current = null;
        setEdit(null);
        onSelect(null);
        paint();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect, paint]);

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
    return hitTestFigure(stateRef.current, scene, p.x, p.y, hitScale());
  }

  function selectionFromHit(hit: FigureHit | null): TangentsSelection | null {
    if (!hit) return null;
    if (hit.kind === "point") return { t: "point", id: hit.id };
    if (hit.kind === "label") {
      if (hit.id.startsWith("pt:")) return { t: "point", id: hit.id.slice(3) };
      if (hit.id.startsWith("ang")) return { t: "angle", id: hit.id };
      return { t: "length", id: hit.id };
    }
    if (hit.kind === "dimLine") return { t: "length", id: hit.id };
    if (hit.kind === "seg") return { t: "length", id: hit.id };
    return null;
  }

  function commitEdit(next: string | null) {
    const current = editRef.current;
    if (!current) return;
    const value = next ?? current.value;
    editRef.current = null;
    setEdit(null);
    setState((prev) => {
      const result = applyEditedLabelDetailed(prev, current.id, value);
      if (!result.ok) {
        onStatus?.(
          result.message ?? "고정된 길이로는 그런 그림이 존재하지 않아요.",
        );
        return prev;
      }
      onStatus?.("");
      return result.state;
    }, true);
  }

  function dragPoint(id: string, math: { x: number; y: number }) {
    const current = stateRef.current;
    if (current.kind === "two-tangents") {
      if (id === "P") {
        setState((prev) => moveExternalPoint(prev, math), false);
        return;
      }
      return;
    }
    if (current.kind === "incircle-triangle" || current.kind === "three-tangents") {
      const idx = id === "A" ? 0 : id === "B" ? 1 : id === "C" ? 2 : -1;
      if (idx >= 0) {
        setState(
          (prev) => moveTriangleVertex(prev, idx as 0 | 1 | 2, math),
          false,
        );
      }
      return;
    }
    if (current.kind === "tangential-quad") {
      const idx = id === "P" ? 0 : id === "Q" ? 1 : id === "R" ? 2 : id === "S" ? 3 : -1;
      if (idx >= 0) {
        setState((prev) => moveQuadTouch(prev, idx as 0 | 1 | 2 | 3, math), false);
      }
    }
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={SCENE_WIDTH}
        height={SCENE_HEIGHT}
        className="h-auto w-full touch-none bg-white"
        tabIndex={0}
        aria-label="원과 접선. 점을 끌어 옮기고, 글자를 눌러 바꿀 수 있어요."
        onPointerDown={(e) => {
          if (editRef.current) commitEdit(null);
          const scene = sceneRef.current;
          if (!scene) return;
          const p = scenePoint(e);
          const hit = hitAt(e);
          hoverRef.current = null;

          if (!hit) {
            onSelect(null);
            paint();
            return;
          }

          if (hit.kind === "seg") {
            onSelect({ t: "length", id: hit.id });
            setState((prev) => cycleLength(prev, hit.id), true);
            paint();
            return;
          }

          onSelect(selectionFromHit(hit));

          if (hit.kind === "label") {
            dragRef.current = { t: "label", id: hit.id, x: p.x, y: p.y, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
            paint();
            return;
          }
          if (hit.kind === "dimLine") {
            dragRef.current = { t: "dimLine", id: hit.id, x: p.x, y: p.y, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
            paint();
            return;
          }
          if (hit.kind === "point") {
            dragRef.current = {
              t: "point",
              id: hit.id,
              x: p.x,
              y: p.y,
              moved: false,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
            paint();
          }
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          const p = scenePoint(e);
          const scene = sceneRef.current;
          const hit = hitAt(e);
          if (canvasRef.current) {
            canvasRef.current.style.cursor = cursorForHit(hit, Boolean(drag));
          }
          if (!drag) {
            if (!sameHit(hoverRef.current, hit)) {
              hoverRef.current = hit;
              paint();
            }
            return;
          }
          if (!scene) return;

          if (drag.t === "label" || drag.t === "dimLine") {
            const dx = p.x - drag.x;
            const dy = p.y - drag.y;
            if (!drag.moved && Math.hypot(dx, dy) < MOVE_PX) return;
            dragRef.current = { ...drag, x: p.x, y: p.y, moved: true };
            const id = drag.id.startsWith("pt:") ? drag.id.slice(3) : drag.id;
            if (drag.t === "label" && drag.id.startsWith("pt:")) {
              setState((prev) => nudgePointLabel(prev, id, dx, dy), false);
              return;
            }
            const current = stateRef.current;
            const frame = scene ? measureFrame(current, scene, id) : null;
            if (drag.t === "dimLine") {
              setState(
                (prev) =>
                  nudgeMeasureLine(
                    prev,
                    id,
                    dx,
                    dy,
                    frame?.along,
                    frame?.outward,
                  ),
                false,
              );
              return;
            }
            setState(
              (prev) =>
                nudgeMeasureLabel(
                  prev,
                  id,
                  dx,
                  dy,
                  frame?.along,
                  frame?.outward,
                  frame?.halfSpan,
                ),
              false,
            );
            return;
          }

          if (drag.t === "point") {
            const dist = Math.hypot(p.x - drag.x, p.y - drag.y);
            if (!drag.moved && dist < MOVE_PX) return;
            dragRef.current = { ...drag, moved: true };
            const math = canvasToMath(p, scene.layout);
            dragPoint(drag.id, math);
          }
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          dragRef.current = null;
          if (!drag) return;
          if (drag.t === "point" && !drag.moved) {
            setState((prev) => cycleNamedPoint(prev, drag.id), true);
            onSelect({ t: "point", id: drag.id });
            paint();
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            return;
          }
          if (
            (drag.t === "label" || drag.t === "dimLine") &&
            !drag.moved &&
            drag.t === "label"
          ) {
            const scene = sceneRef.current;
            const text = scene?.texts.find((t) => t.id === drag.id);
            if (text) {
              setEdit({
                id: drag.id.startsWith("pt:") ? drag.id : drag.id,
                value: sceneTextPlain(text),
                x: text.x,
                y: text.y,
              });
            }
          }
          persist();
          paint();
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
      />
      {edit ? (
        <input
          autoFocus
          className="absolute z-10 rounded border border-wood/30 bg-white px-2 py-1 text-sm shadow"
          style={{
            left: Math.min(Math.max(edit.x - 40, 8), SCENE_WIDTH - 120),
            top: Math.min(Math.max(edit.y - 14, 8), SCENE_HEIGHT - 36),
            width: 110,
          }}
          value={edit.value}
          onChange={(e) => setEdit({ ...edit, value: e.target.value })}
          onBlur={() => commitEdit(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit(null);
            if (e.key === "Escape") {
              editRef.current = null;
              setEdit(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  state: CircleTangentsState,
  scene: DiagramScene,
  selected: TangentsSelection | null,
  hover: FigureHit | null,
) {
  const mark = (id: string, color: string) => {
    const text = scene.texts.find((t) => t.id === id || t.id === `pt:${id}`);
    if (!text) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.arc(text.x, text.y, 12, 0, Math.PI * 2);
    ctx.stroke();
  };
  if (selected?.t === "point") mark(selected.id, "#c45c26");
  if (hover?.kind === "point") mark(hover.id, "#7a9bb8");

  const drawSegOverlay = (id: string, color: string, width: number) => {
    const ends = lengthEndpoints(state, id);
    if (!ends) return;
    const c1 = mathToCanvas(ends[0], scene.layout);
    const c2 = mathToCanvas(ends[1], scene.layout);
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.stroke();
    ctx.restore();
  };

  if (hover?.kind === "seg" && !(selected?.t === "length" && selected.id === hover.id)) {
    drawSegOverlay(hover.id, "rgba(70, 130, 180, 0.45)", 4);
  }
  if (selected?.t === "length") {
    drawSegOverlay(selected.id, "rgba(196, 92, 38, 0.5)", 4);
  }
}
