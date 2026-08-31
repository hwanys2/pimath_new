"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addPointAt,
  applyEditedLabel,
  movePoint,
  nudgeById,
  nudgeMeasureLabel,
  nudgeMeasureLine,
  toggleRadius,
  type InscribedSelection,
} from "@/lib/diagrams/inscribed-angles/geometry";
import type { InscribedState } from "@/lib/diagrams/inscribed-angles/model";
import {
  buildInscribedScene,
  canvasToMath,
  hitTestFigure,
  measureFrame,
  pointCanvasPos,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  sceneTextPlain,
  type DiagramScene,
  type FigureHit,
} from "@/lib/diagrams/inscribed-angles/scene";
import { paintDiagramScene } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const MOVE_PX = 5;

type Tool = "select" | "draw";

type Drag =
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "dimLine"; id: string; x: number; y: number; moved: boolean }
  | { t: "point"; id: string; moved: boolean }
  | { t: "view"; lastX: number; lastY: number };

export type InscribedSetter = (
  updater: InscribedState | ((prev: InscribedState) => InscribedState),
  persist?: boolean,
) => void;

type Props = {
  state: InscribedState;
  fonts: FontFaces;
  tool: Tool;
  selected: InscribedSelection | null;
  setState: InscribedSetter;
  persist: () => void;
  onSelect: (sel: InscribedSelection | null) => void;
  onToolChange: (tool: Tool) => void;
  onDeleteSelected: () => void;
};

export default function InscribedAnglesCanvas({
  state,
  fonts,
  tool,
  selected,
  setState,
  persist,
  onSelect,
  onToolChange,
  onDeleteSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DiagramScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<FigureHit | null>(null);
  const lastClickRef = useRef<{ id: string; at: number } | null>(null);
  const stateRef = useRef(state);
  const toolRef = useRef(tool);
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
  toolRef.current = tool;
  selectedRef.current = selected;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildInscribedScene(current);
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
  }, [paint, state, selected]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dragRef.current = null;
        setEdit(null);
        onToolChange("select");
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
  }, [onToolChange, onDeleteSelected, paint]);

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

  function selectionFromHit(hit: FigureHit | null): InscribedSelection | null {
    if (!hit) return null;
    if (hit.kind === "point") return { t: "point", id: hit.id };
    if (hit.kind === "edge") return { t: "edge", id: hit.id };
    if (hit.kind === "angle") return { t: "angle", id: hit.id };
    if (hit.kind === "arc" || hit.kind === "dimLine") {
      const id = hit.id;
      if (stateRef.current.arcs.some((a) => a.id === id)) return { t: "arc", id };
      if (stateRef.current.angles.some((a) => a.id === id)) return { t: "angle", id };
    }
    if (hit.kind === "center" || hit.kind === "label" && hit.id === "center-name") {
      return { t: "center" };
    }
    if (hit.kind === "tangent") return { t: "tangent" };
    if (hit.kind === "extension") return { t: "extension" };
    if (hit.kind === "label") {
      if (hit.id.startsWith("pt:") && hit.id.endsWith(":name")) {
        return { t: "point", id: hit.id.slice(3, -5) };
      }
      if (stateRef.current.angles.some((a) => a.id === hit.id)) return { t: "angle", id: hit.id };
      if (stateRef.current.arcs.some((a) => a.id === hit.id)) return { t: "arc", id: hit.id };
    }
    return null;
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={SCENE_WIDTH}
        height={SCENE_HEIGHT}
        className="h-auto w-full touch-none bg-white"
        tabIndex={0}
        aria-label="원주각. 원 위 점을 끌어 옮기고, 글자를 눌러 바꿀 수 있어요."
        onPointerDown={(e) => {
          if (editRef.current) commitEdit(null);
          const scene = sceneRef.current;
          if (!scene) return;
          const p = scenePoint(e);
          const math = canvasToMath(p, scene.layout);
          const hit = hitAt(e);
          hoverRef.current = null;
          const drawing = toolRef.current === "draw";

          if (drawing && hit?.kind !== "label" && hit?.kind !== "dimLine") {
            const added = addPointAt(stateRef.current, math);
            if (added) {
              const newPt = added.points[added.points.length - 1];
              setState(() => added, true);
              if (newPt) onSelect({ t: "point", id: newPt.id });
              onToolChange("select");
            }
            paint();
            return;
          }

          if (!hit) {
            onSelect(null);
            return;
          }

          if (hit.kind === "label") {
            onSelect(selectionFromHit(hit));
            dragRef.current = { t: "label", id: hit.id, x: p.x, y: p.y, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
            paint();
            return;
          }

          if (hit.kind === "dimLine") {
            onSelect(selectionFromHit(hit));
            dragRef.current = { t: "dimLine", id: hit.id, x: p.x, y: p.y, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
            paint();
            return;
          }

          if (hit.kind === "point") {
            const now = Date.now();
            const last = lastClickRef.current;
            const dbl = last && last.id === hit.id && now - last.at < 380;
            lastClickRef.current = { id: hit.id, at: now };
            if (dbl) {
              setState((s) => toggleRadius(s, hit.id), true);
              onSelect({ t: "point", id: hit.id });
              paint();
              return;
            }
            onSelect({ t: "point", id: hit.id });
            dragRef.current = { t: "point", id: hit.id, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
            paint();
            return;
          }

          if (hit.kind === "circle" && selectedRef.current?.t === "point") {
            onSelect(null);
            return;
          }

          onSelect(selectionFromHit(hit));
          if (hit.kind === "center") {
            dragRef.current = { t: "view", lastX: p.x, lastY: p.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          paint();
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          const p = scenePoint(e);
          const scene = sceneRef.current;
          const current = stateRef.current;
          if (!drag) {
            const hit = hitAt(e);
            if (!sameHit(hoverRef.current, hit)) {
              hoverRef.current = hit;
              setCursor(cursorForHit(hit, toolRef.current));
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
            const frame = measureFrame(current, scene, drag.id);
            if (frame && drag.t === "dimLine") {
              setState(
                (prev) => {
                  const arc = prev.arcs.find((a) => a.id === drag.id);
                  if (!arc) return prev;
                  return {
                    ...prev,
                    arcs: prev.arcs.map((a) =>
                      a.id === drag.id
                        ? {
                            ...a,
                            label: nudgeMeasureLine(
                              a.label,
                              dx,
                              dy,
                              frame.along,
                              frame.outward,
                              frame.halfSpan,
                            ),
                          }
                        : a,
                    ),
                  };
                },
                false,
              );
              return;
            }
            if (frame && drag.t === "label") {
              const arc = current.arcs.find((a) => a.id === drag.id);
              const angle = current.angles.find((a) => a.id === drag.id);
              if (arc) {
                setState(
                  (prev) => ({
                    ...prev,
                    arcs: prev.arcs.map((a) =>
                      a.id === drag.id
                        ? {
                            ...a,
                            label: nudgeMeasureLabel(
                              a.label,
                              dx,
                              dy,
                              frame.along,
                              frame.outward,
                              frame.halfSpan,
                            ),
                          }
                        : a,
                    ),
                  }),
                  false,
                );
                return;
              }
              if (angle) {
                setState(
                  (prev) => ({
                    ...prev,
                    angles: prev.angles.map((a) =>
                      a.id === drag.id
                        ? {
                            ...a,
                            label: nudgeMeasureLabel(
                              a.label,
                              dx,
                              dy,
                              frame.along,
                              frame.outward,
                              frame.halfSpan,
                            ),
                          }
                        : a,
                    ),
                  }),
                  false,
                );
                return;
              }
            }
            setState((prev) => nudgeById(prev, drag.id, dx, dy), false);
            return;
          }

          if (drag.t === "point") {
            const math = canvasToMath(p, scene.layout);
            dragRef.current = { ...drag, moved: true };
            setState((prev) => movePoint(prev, drag.id, math), false);
            return;
          }

          if (drag.t === "view") {
            const origin = scene.layout.origin;
            const a0 = Math.atan2(origin.y - drag.lastY, drag.lastX - origin.x);
            const a1 = Math.atan2(origin.y - p.y, p.x - origin.x);
            const delta = ((a1 - a0) * 180) / Math.PI;
            dragRef.current = { t: "view", lastX: p.x, lastY: p.y };
            setState(
              (prev) => ({ ...prev, viewRotationDeg: prev.viewRotationDeg + delta }),
              false,
            );
          }
        }}
        onPointerUp={() => {
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
          value={edit.value}
          onChange={(e) => setEdit({ ...edit, value: e.target.value })}
          onBlur={() => commitEdit(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit(null);
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

function sameHit(a: FigureHit | null, b: FigureHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if ("id" in a && "id" in b) return a.id === b.id;
  return true;
}

function cursorForHit(hit: FigureHit | null, tool: Tool): string {
  if (tool === "draw") return "crosshair";
  if (!hit) return "default";
  if (hit.kind === "circle") return "crosshair";
  if (hit.kind === "label") return "text";
  return "grab";
}

function paintHandle(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  selected: boolean,
  hovered: boolean,
) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, hovered ? 10 : selected ? 8.5 : 7, 0, Math.PI * 2);
  if (selected || hovered) {
    ctx.fillStyle = hovered ? "rgba(196, 130, 58, 0.28)" : "rgba(196, 130, 58, 0.18)";
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 2.2;
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.strokeStyle = "rgba(17, 17, 17, 0.38)";
    ctx.lineWidth = 1.4;
  }
  ctx.fill();
  ctx.stroke();
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: DiagramScene,
  state: InscribedState,
  selected: InscribedSelection | null,
  hover: FigureHit | null,
) {
  for (const p of state.points) {
    const c = pointCanvasPos(state, scene, p.id);
    if (!c) continue;
    const sel = selected?.t === "point" && selected.id === p.id;
    const hov = hover?.kind === "point" && hover.id === p.id;
    paintHandle(ctx, c, sel, hov);
  }
}
