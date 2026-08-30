"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabel,
  draggableIds,
  figureStrokes,
  hitTestPythagorean,
  movePoint,
  nudgeLabel,
  toggleSeg,
  type PythHit,
  type PythSelection,
} from "@/lib/diagrams/pythagorean/geometry";
import type { PythagoreanState } from "@/lib/diagrams/pythagorean/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildPythagoreanScene,
  canvasToMath,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type PythagoreanScene,
} from "@/lib/diagrams/pythagorean/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type PythSetter = (
  updater: PythagoreanState | ((prev: PythagoreanState) => PythagoreanState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "point"; id: string; x: number; y: number; moved: boolean }
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "dimLine"; id: string; x: number; y: number; moved: boolean };

type Props = {
  state: PythagoreanState;
  fonts: FontFaces;
  selected: PythSelection | null;
  setState: PythSetter;
  persist: () => void;
  onSelect: (sel: PythSelection | null) => void;
  onDeleteSelected: () => void;
};

const MOVE_PX = 3;

function sameHit(a: PythHit | null, b: PythHit | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && ("id" in a ? a.id === (b as { id: string }).id : true);
}

function cursorForHit(hit: PythHit | null): string {
  if (!hit) return "default";
  if (hit.kind === "point") return "grab";
  if (hit.kind === "label" || hit.kind === "dimLine") return "grab";
  if (hit.kind === "seg") return "pointer";
  return "default";
}

export default function PythagoreanCanvas({
  state,
  fonts,
  selected,
  setState,
  persist,
  onSelect,
  onDeleteSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PythagoreanScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<PythHit | null>(null);
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

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildPythagoreanScene(current);
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
    return hitTestPythagorean(
      scene.layout.canvas,
      scene.texts,
      scene.cmds,
      figureStrokes(current),
      current.segs,
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
            onSelect({ t: "point", id: hit.id });
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
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
          const p = scenePoint(e);
          const drag = dragRef.current;
          if (!drag) {
            const hit = hitAt(e);
            const changed = !sameHit(hoverRef.current, hit);
            hoverRef.current = hit;
            setCursor(cursorForHit(hit));
            if (changed) paint();
            return;
          }
          const dx = p.x - drag.x;
          const dy = p.y - drag.y;
          const moved = drag.moved || Math.hypot(dx, dy) > MOVE_PX;
          dragRef.current = { ...drag, x: p.x, y: p.y, moved };
          if (!moved) return;
          if (drag.t === "point") {
            const scene = sceneRef.current;
            if (!scene) return;
            const math = canvasToMath(p, scene.layout);
            setState((prev) => movePoint(prev, drag.id, math), false);
            return;
          }
          setState(
            (prev) => nudgeLabel(prev, drag.id, dx, dy, drag.t === "dimLine"),
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
          if (drag?.t === "dimLine" && !drag.moved) {
            const sid = drag.id.startsWith("s:") ? drag.id.slice(2) : drag.id;
            onSelect({ t: "seg", id: sid });
            setState((prev) => toggleSeg(prev, sid));
          }
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => {
          if (dragRef.current) return;
          hoverRef.current = null;
          setCursor("default");
          paint();
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
