"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabel,
  hitTestNumberLine,
  movePointValue,
  nudgePointLabel,
  snapValue,
  type NumberLineHit,
} from "@/lib/diagrams/number-line/geometry";
import {
  addPointAtValue,
  type NumberLineState,
} from "@/lib/diagrams/number-line/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildNumberLineScene,
  canvasXFromValue,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type NumberLineScene,
} from "@/lib/diagrams/number-line/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type NumberLineSetter = (
  updater:
    | NumberLineState
    | ((prev: NumberLineState) => NumberLineState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "label"; id: string; pointId: string; x: number; y: number; moved: boolean }
  | { t: "point"; pointId: string };

type Props = {
  state: NumberLineState;
  fonts: FontFaces;
  selectedId: string | null;
  setState: NumberLineSetter;
  persist: () => void;
  onSelect: (id: string | null) => void;
  onDeleteSelected: () => void;
};

export default function NumberLineCanvas({
  state,
  fonts,
  selectedId,
  setState,
  persist,
  onSelect,
  onDeleteSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<NumberLineScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<NumberLineHit | null>(null);
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
    const scene = buildNumberLineScene(current);
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
    return hitTestNumberLine(stateRef.current, scene, p.x, p.y, hitScale());
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
        aria-label="수직선. 축을 눌러 점을 넣고, 점을 끌거나 글자를 눌러 바꿀 수 있어요."
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
              pointId: hit.pointId,
              x: p.x,
              y: p.y,
              moved: false,
            };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            onSelect(hit.pointId);
            return;
          }

          if (hit.kind === "point") {
            onSelect(hit.pointId);
            dragRef.current = { t: "point", pointId: hit.pointId };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          if (hit.kind === "axis") {
            const next = addPointAtValue(
              stateRef.current,
              snapValue(hit.value, stateRef.current),
            );
            const added = next.points[next.points.length - 1];
            setState(next, true);
            if (added) onSelect(added.id);
            return;
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
            setState(
              (prev) => nudgePointLabel(prev, drag.pointId, dx, dy),
              false,
            );
            return;
          }

          if (drag.t === "point") {
            const value = valueFromSceneX(p.x, scene);
            setState(
              (prev) => movePointValue(prev, drag.pointId, value),
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
          aria-label="점 이름 수정"
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
          className="absolute z-10 min-w-[3.5rem] rounded-lg border-2 border-wood bg-white px-2 py-0.5 text-center text-[15px] text-black shadow-md outline-none"
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

function valueFromSceneX(x: number, scene: NumberLineScene): number {
  const { left, right, min, max } = scene.layout;
  const span = right - left;
  if (span <= 1e-9) return min;
  const t = (x - left) / span;
  return min + t * (max - min);
}

function sameHit(a: NumberLineHit | null, b: NumberLineHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "label") {
    return b.kind === "label" && a.id === b.id;
  }
  if (a.kind === "point") {
    return b.kind === "point" && a.pointId === b.pointId;
  }
  return true;
}

function cursorForHit(hit: NumberLineHit | null): string {
  if (!hit) return "default";
  if (hit.kind === "label") return "text";
  if (hit.kind === "axis") return "copy";
  return "grab";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: NumberLineScene,
  state: NumberLineState,
  selectedId: string | null,
  hover: NumberLineHit | null,
) {
  ctx.save();
  for (const point of state.points) {
    const x = canvasXFromValue(point.value, scene.layout);
    const selected = point.id === selectedId;
    const hovered =
      hover?.kind === "point" && hover.pointId === point.id;
    if (!selected && !hovered) continue;
    ctx.beginPath();
    ctx.arc(x, scene.layout.axisY, hovered ? 10 : 8.5, 0, Math.PI * 2);
    ctx.fillStyle = hovered
      ? "rgba(196, 130, 58, 0.28)"
      : "rgba(196, 130, 58, 0.18)";
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 2.2;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
