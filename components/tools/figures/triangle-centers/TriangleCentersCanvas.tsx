"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabel,
  hitTestCenters,
  moveVertex,
  nudgeLabel,
  toggleAngle,
  toggleLength,
  type CentersHit,
  type CentersSelection,
} from "@/lib/diagrams/triangle-centers/geometry";
import { angleId, lengthId, type TriangleCentersState } from "@/lib/diagrams/triangle-centers/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildCentersScene,
  canvasToMath,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type CentersScene,
} from "@/lib/diagrams/triangle-centers/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type CentersSetter = (
  updater: TriangleCentersState | ((prev: TriangleCentersState) => TriangleCentersState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "vertex"; index: number; x: number; y: number; moved: boolean }
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "dimLine"; id: string; x: number; y: number; moved: boolean };

type Props = {
  state: TriangleCentersState;
  fonts: FontFaces;
  selected: CentersSelection | null;
  setState: CentersSetter;
  persist: () => void;
  onSelect: (sel: CentersSelection | null) => void;
  onDeleteSelected: () => void;
};

const MOVE_PX = 3;

export default function TriangleCentersCanvas({
  state,
  fonts,
  selected,
  setState,
  persist,
  onSelect,
  onDeleteSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CentersScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<CentersHit | null>(null);
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
    const scene = buildCentersScene(current);
    sceneRef.current = scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SCENE_WIDTH * dpr);
    canvas.height = Math.round(SCENE_HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintDiagramScene(ctx, scene, fonts, current.style.lineWidth);
    paintOverlays(ctx, scene, hoverRef.current, selectedRef.current);
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
    return hitTestCenters(
      stateRef.current,
      scene.canvasPts,
      scene.texts,
      scene.cmds,
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
          if (hit?.kind === "vertex") {
            dragRef.current = {
              t: "vertex",
              index: hit.index,
              x: p.x,
              y: p.y,
              moved: false,
            };
            onSelect({ t: "vertex", i: hit.index });
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (hit?.kind === "center") {
            onSelect({ t: "center", which: hit.which });
            return;
          }
          if (hit?.kind === "angleWedge") {
            setState((prev) => toggleAngle(prev, hit.at, hit.from, hit.to));
            onSelect({
              t: "angle",
              id: angleId(hit.at, hit.from, hit.to),
            });
            return;
          }
          if (hit?.kind === "segment") {
            setState((prev) => toggleLength(prev, hit.a, hit.b));
            onSelect({
              t: "length",
              id: lengthId(hit.a, hit.b),
            });
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
          if (drag.t === "vertex") {
            const scene = sceneRef.current;
            if (!scene) return;
            const math = canvasToMath(p, scene.layout);
            setState((prev) => moveVertex(prev, drag.index, math), false);
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
            if (drag.id.startsWith("ang:")) onSelect({ t: "angle", id: drag.id });
            if (drag.id.startsWith("len:")) onSelect({ t: "length", id: drag.id });
          }
          if (drag?.t === "dimLine" && !drag.moved) {
            onSelect({ t: "length", id: drag.id });
            const mark = stateRef.current.lengths.find((m) => m.id === drag.id);
            if (mark) setState((prev) => toggleLength(prev, mark.a, mark.b));
          }
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
          aria-label="그림 글자 수정"
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

function sameHit(a: CentersHit | null, b: CentersHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function cursorForHit(hit: CentersHit | null): string {
  if (!hit) return "default";
  if (hit.kind === "label") return "text";
  if (hit.kind === "vertex") return "grab";
  return "pointer";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: CentersScene,
  hover: CentersHit | null,
  selected: CentersSelection | null,
) {
  ctx.save();
  function ring(p: { x: number; y: number } | undefined, strong: boolean) {
    if (!p) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, strong ? 10 : 8, 0, Math.PI * 2);
    ctx.fillStyle = strong ? "rgba(196, 130, 58, 0.28)" : "rgba(196, 130, 58, 0.16)";
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = strong ? 2.2 : 1.6;
    ctx.fill();
    ctx.stroke();
  }
  const pts = scene.canvasPts;
  if (selected?.t === "vertex") ring(pts[["A", "B", "C"][selected.i]!], true);
  if (selected?.t === "center") ring(pts[selected.which === "circum" ? "O" : "I"], true);
  if (hover?.kind === "vertex") ring(pts[["A", "B", "C"][hover.index]!], false);
  if (hover?.kind === "center") ring(pts[hover.which === "circum" ? "O" : "I"], false);
  if (hover?.kind === "segment") {
    const a = pts[hover.a];
    const b = pts[hover.b];
    if (a && b) {
      ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}
