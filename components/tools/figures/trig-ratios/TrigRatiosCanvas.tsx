"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabel,
  draggableIds,
  figureStrokes,
  hitTestTrig,
  movePoint,
  nudgeDimLine,
  nudgeLabel,
  toggleSeg,
  type TrigHit,
  type TrigSelection,
} from "@/lib/diagrams/trig-ratios/geometry";
import type { TrigRatiosState } from "@/lib/diagrams/trig-ratios/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildTrigScene,
  canvasToMath,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type TrigScene,
} from "@/lib/diagrams/trig-ratios/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type TrigSetter = (
  updater: TrigRatiosState | ((prev: TrigRatiosState) => TrigRatiosState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "point"; id: string; x: number; y: number; moved: boolean }
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "dimLine"; id: string; x: number; y: number; moved: boolean };

type Props = {
  state: TrigRatiosState;
  fonts: FontFaces;
  selected: TrigSelection | null;
  setState: TrigSetter;
  persist: () => void;
  onSelect: (sel: TrigSelection | null) => void;
  onDeleteSelected: () => void;
};

const MOVE_PX = 3;

function cursorForHit(hit: TrigHit | null): string {
  if (!hit) return "default";
  if (hit.kind === "point") return "grab";
  if (hit.kind === "label" || hit.kind === "dimLine") return "grab";
  if (hit.kind === "seg") return "pointer";
  return "default";
}

export default function TrigRatiosCanvas({
  state,
  fonts,
  selected,
  setState,
  persist,
  onSelect,
  onDeleteSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TrigScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<TrigHit | null>(null);
  const stateRef = useRef(state);
  const selectedRef = useRef(selected);
  const [edit, setEdit] = useState<{
    id: string;
    value: string;
    x: number;
    y: number;
  } | null>(null);
  const editRef = useRef(edit);
  editRef.current = edit;
  stateRef.current = state;
  selectedRef.current = selected;

  const segs =
    state.kind === "triangle-area" ? state.triSegs : state.segs;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildTrigScene(current);
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
  }, [paint, state, selected]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      onDeleteSelected();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDeleteSelected]);

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
    const current = stateRef.current;
    const pool = current.kind === "triangle-area" ? current.triSegs : current.segs;
    return hitTestTrig(
      scene.layout.canvas,
      scene.texts,
      scene.cmds,
      figureStrokes(current),
      pool,
      p.x,
      p.y,
      hitScale(),
      draggableIds(current),
    );
  }

  function setCursor(value: string) {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = value;
  }

  function commitEdit(next: string | null) {
    const current = editRef.current;
    editRef.current = null;
    setEdit(null);
    if (!current || next == null) return;
    setState((prev) => applyEditedLabel(prev, current.id, next), true);
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={SCENE_WIDTH}
        height={SCENE_HEIGHT}
        className="h-auto w-full touch-none select-none"
        style={{ aspectRatio: `${SCENE_WIDTH} / ${SCENE_HEIGHT}` }}
        onPointerDown={(e) => {
          if (editRef.current) commitEdit(editRef.current.value);
          const hit = hitAt(e);
          const p = scenePoint(e);
          if (hit?.kind === "label") {
            dragRef.current = { t: "label", id: hit.id, x: p.x, y: p.y, moved: false };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (hit?.kind === "dimLine") {
            dragRef.current = { t: "dimLine", id: hit.id, x: p.x, y: p.y, moved: false };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (hit?.kind === "point" && draggableIds(state).includes(hit.id)) {
            dragRef.current = { t: "point", id: hit.id, x: p.x, y: p.y, moved: false };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            onSelect({ t: "point", id: hit.id });
            return;
          }
          if (hit?.kind === "seg") {
            onSelect({ t: "seg", id: hit.id });
            setState((prev) => toggleSeg(prev, hit.id), true);
            return;
          }
          onSelect(null);
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          const p = scenePoint(e);
          if (drag) {
            const dx = p.x - drag.x;
            const dy = p.y - drag.y;
            if (!drag.moved && Math.hypot(dx, dy) > MOVE_PX) drag.moved = true;
            if (drag.t === "point" && drag.moved) {
              const layout = sceneRef.current!.layout;
              const math = canvasToMath(p, layout);
              setState((prev) => movePoint(prev, drag.id, math), false);
            } else if (drag.t === "label" && drag.moved) {
              setState(
                (prev) => nudgeLabel(prev, drag.id, dx, dy),
                false,
              );
              dragRef.current = { ...drag, x: p.x, y: p.y };
            } else if (drag.t === "dimLine" && drag.moved) {
              setState(
                (prev) => nudgeDimLine(prev, drag.id.replace(/:dim$/, ""), dx, dy),
                false,
              );
              dragRef.current = { ...drag, x: p.x, y: p.y };
            }
            return;
          }
          const hit = hitAt(e);
          hoverRef.current = hit;
          setCursor(cursorForHit(hit));
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          dragRef.current = null;
          if (drag?.t === "point" && drag.moved) persist();
          if (drag?.t === "label" && drag.moved) persist();
          if (drag?.t === "dimLine" && drag.moved) persist();
          if (drag?.t === "label" && !drag.moved) {
            const text = sceneRef.current?.texts.find((t) => t.id === drag.id);
            if (text) {
              setEdit({
                id: drag.id,
                value: sceneTextPlain(text),
                x: text.x,
                y: text.y,
              });
            }
          }
          setCursor(cursorForHit(hoverRef.current));
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => {
          if (!dragRef.current) setCursor("default");
        }}
        onDoubleClick={(e) => {
          const hit = hitAt(e);
          if (hit?.kind === "label") {
            const text = sceneRef.current?.texts.find((t) => t.id === hit.id);
            if (text) {
              setEdit({
                id: hit.id,
                value: sceneTextPlain(text),
                x: text.x,
                y: text.y,
              });
            }
          }
        }}
      />
      {edit ? (
        <input
          autoFocus
          className="absolute z-10 min-w-[3rem] -translate-x-1/2 -translate-y-1/2 rounded border border-wood/30 bg-white/95 px-1 py-0.5 text-center text-sm shadow"
          style={{
            left: `${(edit.x / SCENE_WIDTH) * 100}%`,
            top: `${(edit.y / SCENE_HEIGHT) * 100}%`,
            fontFamily: fonts.math,
          }}
          value={edit.value}
          onChange={(ev) => setEdit({ ...edit, value: ev.target.value })}
          onBlur={() => commitEdit(edit.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") commitEdit(edit.value);
            if (ev.key === "Escape") commitEdit(null);
          }}
        />
      ) : null}
    </div>
  );
}
