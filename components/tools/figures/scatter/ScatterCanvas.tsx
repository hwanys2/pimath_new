"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addPointAtCanvas,
  applyEditedLabel,
  hitTestScatter,
  movePointFromCanvas,
  nudgeMovableLabel,
  parsePointLabelId,
  type ScatterHit,
} from "@/lib/diagrams/scatter/geometry";
import {
  type PointRole,
  type ScatterState,
} from "@/lib/diagrams/scatter/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildScatterScene,
  frameForPanel,
  canvasXFromValue,
  canvasYFromValue,
  type ScatterScene,
} from "@/lib/diagrams/scatter/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type ScatterSetter = (
  updater: ScatterState | ((prev: ScatterState) => ScatterState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "label"; id: string; targetId: string; x: number; y: number; moved: boolean }
  | { t: "point"; id: string };

type Props = {
  state: ScatterState;
  fonts: FontFaces;
  selectedId: string | null;
  placing: boolean;
  placeRole: PointRole;
  setState: ScatterSetter;
  persist: () => void;
  onSelect: (id: string | null) => void;
  onDeleteSelected: () => void;
  onPlaced: (id: string) => void;
};

export default function ScatterCanvas({
  state,
  fonts,
  selectedId,
  placing,
  placeRole,
  setState,
  persist,
  onSelect,
  onDeleteSelected,
  onPlaced,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ScatterScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<ScatterHit | null>(null);
  const stateRef = useRef(state);
  const selectedRef = useRef(selectedId);
  const placingRef = useRef(placing);
  const placeRoleRef = useRef(placeRole);
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
  placingRef.current = placing;
  placeRoleRef.current = placeRole;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildScatterScene(current);
    sceneRef.current = scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(scene.width * dpr);
    canvas.height = Math.round(scene.height * dpr);
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
    const scene = sceneRef.current;
    const width = scene?.width ?? 560;
    const height = scene?.height ?? 456;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: ((e.clientY - rect.top) / rect.height) * height,
    };
  }

  function hitScale() {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    const scene = sceneRef.current;
    const sceneWidth = scene?.width ?? 560;
    const width = canvas.getBoundingClientRect().width;
    return width > 1 ? sceneWidth / width : 1;
  }

  function hitAt(e: { clientX: number; clientY: number }) {
    const scene = sceneRef.current;
    if (!scene) return null;
    const p = scenePoint(e);
    return hitTestScatter(stateRef.current, scene, p.x, p.y, hitScale());
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

  function startEditForPoint(id: string) {
    const scene = sceneRef.current;
    const current = stateRef.current;
    const point = current.points.find((p) => p.id === id);
    if (!point || !scene) return;
    const frame = frameForPanel(scene.layout, point.panel);
    if (!frame) return;
    const px = canvasXFromValue(point.x, frame);
    const py = canvasYFromValue(point.y, frame);
    setEdit({
      id: `point:${id}:label`,
      value: point.label,
      x: px + point.labelDx,
      y: py + point.labelDy,
    });
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={560}
        height={456}
        className="h-auto w-full touch-none bg-white"
        tabIndex={0}
        aria-label="산점도. 점을 끌어 옮기고, 글자를 눌러 고칠 수 있어요."
        onPointerDown={(e) => {
          if (editRef.current) commitEdit(null);
          const scene = sceneRef.current;
          if (!scene) return;
          const p = scenePoint(e);
          const hit = hitAt(e);
          hoverRef.current = null;

          if (placingRef.current && (!hit || hit.kind === "plot")) {
            const next = addPointAtCanvas(
              stateRef.current,
              p.x,
              p.y,
              scene,
              placeRoleRef.current === "mark" ? "mark" : "named",
            );
            const added = next.points[next.points.length - 1];
            setState(next, true);
            if (added) {
              onSelect(added.id);
              onPlaced(added.id);
              if (added.role !== "cloud") {
                const nextScene = buildScatterScene(next);
                const frame = frameForPanel(nextScene.layout, added.panel);
                if (frame) {
                  const px = canvasXFromValue(added.x, frame);
                  const py = canvasYFromValue(added.y, frame);
                  setEdit({
                    id: `point:${added.id}:label`,
                    value: added.label,
                    x: px + added.labelDx,
                    y: py + added.labelDy,
                  });
                }
              }
            }
            return;
          }

          if (!hit || hit.kind === "plot") {
            onSelect(null);
            return;
          }

          if (hit.kind === "label") {
            dragRef.current = {
              t: "label",
              id: hit.id,
              targetId: hit.targetId,
              x: p.x,
              y: p.y,
              moved: false,
            };
            if (hit.targetId !== "title" && hit.targetId !== "axis-x" && hit.targetId !== "axis-y") {
              onSelect(hit.targetId);
            }
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          onSelect(hit.id);
          dragRef.current = { t: "point", id: hit.id };
          setCursor("grabbing");
          e.currentTarget.setPointerCapture(e.pointerId);
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
            setState((prev) => nudgeMovableLabel(prev, drag.id, dx, dy), false);
            return;
          }

          setState(
            (prev) => movePointFromCanvas(prev, drag.id, p.x, p.y, scene),
            false,
          );
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          dragRef.current = null;
          setCursor(placingRef.current ? "crosshair" : "default");
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
            } else if (parsePointLabelId(drag.id)) {
              startEditForPoint(drag.targetId);
            }
          }
          paint();
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => {
          if (dragRef.current) return;
          hoverRef.current = null;
          setCursor(placingRef.current ? "crosshair" : "default");
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
            left: `${(edit.x / (sceneRef.current?.width ?? 560)) * 100}%`,
            top: `${(edit.y / (sceneRef.current?.height ?? 456)) * 100}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: "Times New Roman, Noto Serif, Batang, serif",
          }}
        />
      ) : null}
    </div>
  );
}

function sameHit(a: ScatterHit | null, b: ScatterHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "label") return b.kind === "label" && a.id === b.id;
  if (a.kind === "point") return b.kind === "point" && a.id === b.id;
  if (a.kind === "plot") return b.kind === "plot" && a.panel === b.panel;
  return false;
}

function cursorForHit(hit: ScatterHit | null, placing: boolean): string {
  if (placing) return "crosshair";
  if (!hit) return "default";
  if (hit.kind === "label") return "text";
  if (hit.kind === "point") return "grab";
  return "default";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: ScatterScene,
  state: ScatterState,
  selectedId: string | null,
  hover: ScatterHit | null,
) {
  ctx.save();
  for (const p of state.points) {
    const selected = p.id === selectedId;
    const hovered = hover?.kind === "point" && hover.id === p.id;
    if (!selected && !hovered) continue;
    const frame = frameForPanel(scene.layout, p.panel);
    if (!frame) continue;
    const x = canvasXFromValue(p.x, frame);
    const y = canvasYFromValue(p.y, frame);
    const r =
      (p.role === "mark" ? state.style.markRadius : state.style.pointRadius) +
      (hovered ? 4.5 : 3.2);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = hovered
      ? "rgba(196, 130, 58, 0.28)"
      : "rgba(196, 130, 58, 0.16)";
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
