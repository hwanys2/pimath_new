"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabel,
  derivedPoints,
  dimResizeCursor,
  draggableIds,
  figureStrokes,
  hitTestSimilar,
  movePoint,
  moveSlide,
  nudgeLabel,
  segDimAxes,
  slideSegments,
  toggleSeg,
  type SimHit,
  type SimSelection,
} from "@/lib/diagrams/similar-triangles/geometry";
import { type SimilarTrianglesState } from "@/lib/diagrams/similar-triangles/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildSimilarTrianglesScene,
  canvasToMath,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type SimilarScene,
} from "@/lib/diagrams/similar-triangles/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type SimSetter = (
  updater: SimilarTrianglesState | ((prev: SimilarTrianglesState) => SimilarTrianglesState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "point"; id: string; x: number; y: number; moved: boolean }
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "dimLine"; id: string; x: number; y: number; moved: boolean }
  | { t: "slide"; id: string; x: number; y: number; moved: boolean };

type Props = {
  state: SimilarTrianglesState;
  fonts: FontFaces;
  selected: SimSelection | null;
  setState: SimSetter;
  persist: () => void;
  onSelect: (sel: SimSelection | null) => void;
  onDeleteSelected: () => void;
};

const MOVE_PX = 3;

export default function SimilarTrianglesCanvas({
  state,
  fonts,
  selected,
  setState,
  persist,
  onSelect,
  onDeleteSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SimilarScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<SimHit | null>(null);
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
    const scene = buildSimilarTrianglesScene(current);
    sceneRef.current = scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SCENE_WIDTH * dpr);
    canvas.height = Math.round(SCENE_HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintDiagramScene(ctx, scene, fonts, current.style.lineWidth);
    paintOverlays(ctx, scene, hoverRef.current, selectedRef.current, current);
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
    return hitTestSimilar(
      scene.layout.canvas,
      scene.texts,
      scene.cmds,
      figureStrokes(current),
      current.segs,
      p.x,
      p.y,
      hitScale(),
      draggableIds(current),
      slideSegments(current, scene.layout.canvas),
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
          if (hit?.kind === "point") {
            dragRef.current = { t: "point", id: hit.id, x: p.x, y: p.y, moved: false };
            onSelect({ t: "point", id: hit.id });
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (hit?.kind === "slide") {
            dragRef.current = { t: "slide", id: hit.id, x: p.x, y: p.y, moved: false };
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
            setCursor(cursorForHit(hit, stateRef.current, sceneRef.current?.layout.canvas));
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
          if (drag.t === "slide") {
            const scene = sceneRef.current;
            if (!scene) return;
            const math = canvasToMath(p, scene.layout);
            setState((prev) => moveSlide(prev, drag.id, math), false);
            return;
          }
          setState(
            (prev) =>
              nudgeLabel(
                prev,
                drag.id,
                dx,
                dy,
                drag.t === "dimLine",
                sceneRef.current?.layout.canvas,
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
          }
          if (drag?.t === "slide" && !drag.moved && drag.id === "DE") {
            onSelect({ t: "seg", id: "DE" });
            setState((prev) => toggleSeg(prev, "DE"));
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

function sameHit(a: SimHit | null, b: SimHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  return a.id === b.id;
}

function cursorForHit(
  hit: SimHit | null,
  state?: SimilarTrianglesState,
  canvasPts?: Record<string, { x: number; y: number }>,
): string {
  if (!hit) return "default";
  if (hit.kind === "label") return "text";
  if (hit.kind === "dimLine") {
    if (state && canvasPts) {
      const sid = hit.id.startsWith("s:") ? hit.id.slice(2) : hit.id;
      const seg = state.segs.find((s) => s.id === sid);
      const axes = seg ? segDimAxes(state, canvasPts, seg.a, seg.b) : null;
      if (axes) return dimResizeCursor(axes.along);
    }
    return "grab";
  }
  if (hit.kind === "point") return "grab";
  if (hit.kind === "slide") return hit.id === "DE" ? "grab" : "ns-resize";
  return "pointer";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: SimilarScene,
  hover: SimHit | null,
  selected: SimSelection | null,
  state: SimilarTrianglesState,
) {
  ctx.save();
  const pts = scene.layout.canvas;
  function ring(id: string, strong: boolean) {
    const p = pts[id];
    if (!p) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, strong ? 10 : 8, 0, Math.PI * 2);
    ctx.fillStyle = strong ? "rgba(196, 130, 58, 0.28)" : "rgba(196, 130, 58, 0.16)";
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = strong ? 2.2 : 1.6;
    ctx.fill();
    ctx.stroke();
  }
  function edge(id: string) {
    const seg = state.segs.find((s) => s.id === id);
    const math = derivedPoints(state);
    const aId = seg?.a ?? id.slice(0, 1);
    const bId = seg?.b ?? id.slice(1);
    const a = pts[aId];
    const b = pts[bId];
    if (!a || !b) return;
    void math;
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (selected?.t === "point") ring(selected.id, true);
  if (selected?.t === "seg") edge(selected.id);
  if (hover?.kind === "point" && !(selected?.t === "point" && selected.id === hover.id)) {
    ring(hover.id, false);
  }
  if (hover?.kind === "seg" && !(selected?.t === "seg" && selected.id === hover.id)) {
    edge(hover.id);
  }
  if (hover?.kind === "slide") {
    const slides = slideSegments(state, pts);
    const line = slides.find((s) => s.id === hover.id);
    if (line) {
      ctx.strokeStyle = "rgba(196, 130, 58, 0.85)";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(line.a.x, line.a.y);
      ctx.lineTo(line.b.x, line.b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (hover?.kind === "dimLine") {
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 2.4;
    ctx.setLineDash([5, 4]);
    for (const cmd of scene.cmds) {
      if (cmd.id !== `${hover.id}:line`) continue;
      if (cmd.t === "line") {
        ctx.beginPath();
        ctx.moveTo(cmd.x1, cmd.y1);
        ctx.lineTo(cmd.x2, cmd.y2);
        ctx.stroke();
      }
      if (cmd.t === "arc") {
        ctx.beginPath();
        ctx.arc(cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}
