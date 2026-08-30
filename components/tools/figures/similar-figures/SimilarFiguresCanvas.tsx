"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applySimilarLabel,
  hitTestSimilar,
  moveSourceVertex,
  nudgeSimilarLabel,
  setShiftB,
  snapShiftB,
  toggleEdgeLength,
  type SimilarHit,
  type SimilarSelection,
} from "@/lib/diagrams/similar-figures/geometry";
import { type SimilarFiguresState } from "@/lib/diagrams/similar-figures/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildSimilarFiguresScene,
  canvasToMath,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type SceneView,
  type SimilarScene,
} from "@/lib/diagrams/similar-figures/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type SimilarSetter = (
  updater: SimilarFiguresState | ((prev: SimilarFiguresState) => SimilarFiguresState),
  persist?: boolean,
) => void;

type Drag =
  | {
      t: "vertex";
      index: number;
      grabX: number;
      grabY: number;
      startX: number;
      startY: number;
      moved: boolean;
    }
  | {
      t: "b";
      grabX: number;
      grabY: number;
      shiftX: number;
      shiftY: number;
      startX: number;
      startY: number;
      moved: boolean;
    }
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "dimLine"; id: string; x: number; y: number; moved: boolean };

type Props = {
  state: SimilarFiguresState;
  fonts: FontFaces;
  selected: SimilarSelection | null;
  setState: SimilarSetter;
  persist: () => void;
  onSelect: (sel: SimilarSelection | null) => void;
  onDeleteSelected: () => void;
};

const MOVE_PX = 3;

export default function SimilarFiguresCanvas({
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
  const viewRef = useRef<SceneView | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<SimilarHit | null>(null);
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
    const scene = buildSimilarFiguresScene(current, viewRef.current ?? undefined);
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
    return hitTestSimilar(
      scene.layout.canvasA,
      scene.layout.canvasB,
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

  function freezeView() {
    const layout = sceneRef.current?.layout;
    if (!layout) return;
    viewRef.current = {
      origin: layout.origin,
      mid: layout.mid,
      scale: layout.scale,
    };
  }

  function unfreezeView() {
    viewRef.current = null;
  }

  function beginFigureBDrag(p: { x: number; y: number }) {
    const scene = sceneRef.current;
    if (!scene) return;
    freezeView();
    const math = canvasToMath(p, scene.layout);
    const shift = stateRef.current.shiftB;
    dragRef.current = {
      t: "b",
      grabX: math.x,
      grabY: math.y,
      shiftX: shift.x,
      shiftY: shift.y,
      startX: p.x,
      startY: p.y,
      moved: false,
    };
  }

  function commitEdit(next: string | null) {
    const current = editRef.current;
    editRef.current = null;
    setEdit(null);
    if (!current || next == null) return;
    setState((prev) => applySimilarLabel(prev, current.id, next), true);
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
          if (hit?.kind === "vertex" && hit.figure === "a") {
            const scene = sceneRef.current;
            const vertex = stateRef.current.points[hit.index];
            if (scene && vertex) {
              freezeView();
              const math = canvasToMath(p, scene.layout);
              dragRef.current = {
                t: "vertex",
                index: hit.index,
                grabX: math.x - vertex.x,
                grabY: math.y - vertex.y,
                startX: p.x,
                startY: p.y,
                moved: false,
              };
            }
            onSelect({ figure: "a", t: "vertex", i: hit.index });
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (hit?.kind === "vertex" && hit.figure === "b") {
            beginFigureBDrag(p);
            onSelect({ figure: "b", t: "vertex", i: hit.index });
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (hit?.kind === "edge") {
            onSelect({ figure: hit.figure, t: "edge", i: hit.index });
            setState((prev) => toggleEdgeLength(prev, hit.figure, hit.index));
            return;
          }
          if (hit?.kind === "body") {
            beginFigureBDrag(p);
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
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
          if (drag.t === "vertex" || drag.t === "b") {
            const moved =
              drag.moved || Math.hypot(p.x - drag.startX, p.y - drag.startY) > MOVE_PX;
            if (!moved) return;
            dragRef.current = { ...drag, moved: true };
            const scene = sceneRef.current;
            if (!scene) return;
            const math = canvasToMath(p, scene.layout);
            if (drag.t === "vertex") {
              setState(
                (prev) =>
                  moveSourceVertex(prev, drag.index, {
                    x: math.x - drag.grabX,
                    y: math.y - drag.grabY,
                  }),
                false,
              );
              return;
            }
            setState((prev) => {
              const next = setShiftB(
                prev,
                drag.shiftX + (math.x - drag.grabX),
                drag.shiftY + (math.y - drag.grabY),
              );
              return next.snapToGrid ? snapShiftB(next) : next;
            }, false);
            return;
          }
          const dx = p.x - drag.x;
          const dy = p.y - drag.y;
          const moved = drag.moved || Math.hypot(dx, dy) > MOVE_PX;
          dragRef.current = { ...drag, x: p.x, y: p.y, moved };
          if (!moved) return;
          setState(
            (prev) => nudgeSimilarLabel(prev, drag.id, dx, dy, drag.t === "dimLine"),
            false,
          );
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          dragRef.current = null;
          unfreezeView();
          setCursor("default");
          if (drag?.t === "b") {
            setState((prev) => snapShiftB(prev), true);
          } else {
            persist();
          }
          paint();
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
            const parsed = edgeFromLabelId(drag.id);
            if (parsed) {
              onSelect({ figure: parsed.figure, t: "edge", i: parsed.index });
              setState((prev) => toggleEdgeLength(prev, parsed.figure, parsed.index));
            }
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
          unfreezeView();
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

function edgeFromLabelId(
  id: string,
): { figure: "a" | "b"; index: number } | null {
  const match = /^([ab]):e:(\d+):length$/.exec(id);
  if (!match) return null;
  return { figure: match[1] as "a" | "b", index: Number(match[2]) };
}

function sameHit(a: SimilarHit | null, b: SimilarHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "label" || a.kind === "dimLine") {
    return a.id === (b as { id: string }).id;
  }
  if (a.kind === "body") return b.kind === "body";
  if (a.kind === "vertex") {
    return b.kind === "vertex" && a.figure === b.figure && a.index === b.index;
  }
  if (a.kind === "edge") {
    return b.kind === "edge" && a.figure === b.figure && a.index === b.index;
  }
  return true;
}

function cursorForHit(hit: SimilarHit | null): string {
  if (!hit) return "default";
  if (hit.kind === "label") return "text";
  if (hit.kind === "vertex" || hit.kind === "body") return "grab";
  return "pointer";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: SimilarScene,
  hover: SimilarHit | null,
  selected: SimilarSelection | null,
) {
  ctx.save();
  function verts(figure: "a" | "b") {
    return figure === "a" ? scene.layout.canvasA : scene.layout.canvasB;
  }
  function ring(figure: "a" | "b", i: number, strong: boolean) {
    const p = verts(figure)[i];
    if (!p) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, strong ? 10 : 8, 0, Math.PI * 2);
    ctx.fillStyle = strong ? "rgba(196, 130, 58, 0.28)" : "rgba(196, 130, 58, 0.16)";
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = strong ? 2.2 : 1.6;
    ctx.fill();
    ctx.stroke();
  }
  function edge(figure: "a" | "b", i: number) {
    const pts = verts(figure);
    const n = pts.length;
    const a = pts[i];
    const b = pts[(i + 1) % n];
    if (!a || !b) return;
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (selected?.t === "vertex") ring(selected.figure, selected.i, true);
  if (selected?.t === "edge") edge(selected.figure, selected.i);
  if (hover?.kind === "vertex") {
    if (!(selected?.t === "vertex" && selected.figure === hover.figure && selected.i === hover.index)) {
      ring(hover.figure, hover.index, false);
    }
  }
  if (hover?.kind === "edge") {
    if (!(selected?.t === "edge" && selected.figure === hover.figure && selected.i === hover.index)) {
      edge(hover.figure, hover.index);
    }
  }
  ctx.restore();
}
