"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabel,
  hitTestSqrtNumberLine,
  moveOrigin,
  moveVertexA,
  nudgeLabel,
  snapLocalFromCanvas,
  type SqrtHit,
} from "@/lib/diagrams/sqrt-number-line/geometry";
import type { SqrtNumberLineState } from "@/lib/diagrams/sqrt-number-line/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildSqrtNumberLineScene,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  valueFromCanvasX,
  type SqrtNumberLineScene,
} from "@/lib/diagrams/sqrt-number-line/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type SqrtSetter = (
  updater: SqrtNumberLineState | ((prev: SqrtNumberLineState) => SqrtNumberLineState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "origin"; x: number; y: number; moved: boolean }
  | { t: "vertexA"; x: number; y: number; moved: boolean };

type Props = {
  state: SqrtNumberLineState;
  fonts: FontFaces;
  setState: SqrtSetter;
  persist: () => void;
};

const MOVE_PX = 3;

function cursorForHit(hit: SqrtHit | null): string {
  if (!hit) return "default";
  if (hit.kind === "point" && hit.id === "O") return "ew-resize";
  if (hit.kind === "point" && hit.id === "A") return "grab";
  if (hit.kind === "label") return "grab";
  if (hit.kind === "axis") return "crosshair";
  return "default";
}

export default function SqrtNumberLineCanvas({
  state,
  fonts,
  setState,
  persist,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SqrtNumberLineScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<SqrtHit | null>(null);
  const stateRef = useRef(state);
  const [edit, setEdit] = useState<{
    id: string;
    value: string;
    x: number;
    y: number;
  } | null>(null);
  const editRef = useRef(edit);
  editRef.current = edit;
  stateRef.current = state;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildSqrtNumberLineScene(current);
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
  }, [paint, state]);

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
    return hitTestSqrtNumberLine(stateRef.current, scene, p.x, p.y, hitScale());
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
        aria-label="제곱근 수직선. O를 끌어 시작점을, A를 끌어 직각변을 바꿀 수 있어요."
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
          if (hit?.kind === "point" && hit.id === "O") {
            dragRef.current = { t: "origin", x: p.x, y: p.y, moved: false };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (hit?.kind === "point" && hit.id === "A") {
            dragRef.current = { t: "vertexA", x: p.x, y: p.y, moved: false };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
        }}
        onPointerMove={(e) => {
          const p = scenePoint(e);
          const drag = dragRef.current;
          if (!drag) {
            const hit = hitAt(e);
            hoverRef.current = hit;
            setCursor(cursorForHit(hit));
            return;
          }
          const dx = p.x - drag.x;
          const dy = p.y - drag.y;
          const moved = drag.moved || Math.hypot(dx, dy) > MOVE_PX;
          dragRef.current = { ...drag, x: p.x, y: p.y, moved };
          if (!moved) return;
          const scene = sceneRef.current;
          if (!scene) return;
          if (drag.t === "origin") {
            const value = valueFromCanvasX(p.x, scene.layout);
            setState((prev) => moveOrigin(prev, value), false);
            return;
          }
          if (drag.t === "vertexA") {
            const local = snapLocalFromCanvas(stateRef.current, scene.layout, p.x, p.y);
            setState((prev) => moveVertexA(prev, local), false);
            return;
          }
          setState((prev) => nudgeLabel(prev, drag.id, dx, dy), false);
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          dragRef.current = null;
          setCursor(cursorForHit(hoverRef.current));
          persist();
          if (drag?.t === "label" && !drag.moved) {
            const scene = sceneRef.current;
            const text = scene?.texts.find((item) => item.id === drag.id);
            if (text) {
              setEdit({
                id: drag.id,
                value: sceneTextPlain(text),
                x: text.x,
                y: text.y,
              });
            }
          }
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => {
          if (dragRef.current) return;
          hoverRef.current = null;
          setCursor("default");
        }}
      />
      {edit ? (
        <input
          autoFocus
          className="absolute z-10 min-w-[3rem] -translate-x-1/2 -translate-y-1/2 rounded border border-wood/30 bg-white px-1.5 py-0.5 text-center text-sm shadow"
          style={{
            left: `${(edit.x / SCENE_WIDTH) * 100}%`,
            top: `${(edit.y / SCENE_HEIGHT) * 100}%`,
          }}
          value={edit.value}
          onChange={(ev) =>
            setEdit((prev) => (prev ? { ...prev, value: ev.target.value } : null))
          }
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
