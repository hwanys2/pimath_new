"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabel,
  hitTestIso,
  moveFoot,
  moveVertexIso,
  nudgeLabel,
  type IsoHit,
  type IsoSelection,
} from "@/lib/diagrams/isosceles-triangle/geometry";
import {
  mapCevian,
  type CevianFrom,
  type IsoscelesState,
} from "@/lib/diagrams/isosceles-triangle/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildIsoscelesScene,
  canvasToMath,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type IsoScene,
} from "@/lib/diagrams/isosceles-triangle/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type IsoSetter = (
  updater: IsoscelesState | ((prev: IsoscelesState) => IsoscelesState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "vertex"; index: number; x: number; y: number; moved: boolean }
  | { t: "foot"; from: CevianFrom; x: number; y: number; moved: boolean }
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "dimLine"; id: string; x: number; y: number; moved: boolean };

type Props = {
  state: IsoscelesState;
  fonts: FontFaces;
  selected: IsoSelection | null;
  setState: IsoSetter;
  persist: () => void;
  onSelect: (sel: IsoSelection | null) => void;
  onDeleteSelected: () => void;
};

const MOVE_PX = 3;

export default function IsoscelesCanvas({
  state,
  fonts,
  selected,
  setState,
  persist,
  onSelect,
  onDeleteSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<IsoScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<IsoHit | null>(null);
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
    const scene = buildIsoscelesScene(current);
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
    return hitTestIso(
      scene.layout.canvas,
      scene.layout.feet,
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
          if (hit?.kind === "foot") {
            dragRef.current = { t: "foot", from: hit.from, x: p.x, y: p.y, moved: false };
            onSelect({ t: "foot", from: hit.from });
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
          if (hit?.kind === "edge") {
            onSelect({ t: "edge", i: hit.index });
            setState((prev) => toggleEdgeLength(prev, hit.index));
            return;
          }
          if (hit?.kind === "cevian") {
            onSelect({ t: "cevian", from: hit.from });
            setState((prev) =>
              mapCevian(prev, hit.from, (c) => ({
                ...c,
                length: { ...c.length, show: !c.length.show },
              })),
            );
            return;
          }
          if (hit?.kind === "part") {
            onSelect({ t: "part", from: hit.from, which: hit.which });
            setState((prev) => togglePartLength(prev, hit.from, hit.which));
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
            setState((prev) => moveVertexIso(prev, drag.index, math), false);
            return;
          }
          if (drag.t === "foot") {
            const scene = sceneRef.current;
            if (!scene) return;
            const math = canvasToMath(p, scene.layout);
            setState((prev) => moveFoot(prev, drag.from, math), false);
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
                sceneRef.current?.layout,
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

function toggleEdgeLength(state: IsoscelesState, index: number): IsoscelesState {
  return {
    ...state,
    edges: state.edges.map((edge, i) =>
      i === index ? { ...edge, showLength: !edge.showLength } : edge,
    ),
  };
}

function togglePartLength(
  state: IsoscelesState,
  from: CevianFrom,
  which: "left" | "right",
): IsoscelesState {
  const field = which === "left" ? "leftLen" : "rightLen";
  return mapCevian(state, from, (c) => ({
    ...c,
    [field]: { ...c[field], show: !c[field].show },
  }));
}

function sameHit(a: IsoHit | null, b: IsoHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "label" || a.kind === "dimLine") {
    return a.id === (b as { id: string }).id;
  }
  if (a.kind === "vertex") return b.kind === "vertex" && a.index === b.index;
  if (a.kind === "edge") return b.kind === "edge" && a.index === b.index;
  if (a.kind === "part") {
    return b.kind === "part" && a.from === b.from && a.which === b.which;
  }
  if (a.kind === "foot" || a.kind === "cevian") {
    return b.kind === a.kind && a.from === (b as { from: CevianFrom }).from;
  }
  return true;
}

function cursorForHit(hit: IsoHit | null): string {
  if (!hit) return "default";
  if (hit.kind === "label") return "text";
  if (hit.kind === "dimLine") return "grab";
  if (hit.kind === "vertex" || hit.kind === "foot") return "grab";
  return "pointer";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: IsoScene,
  hover: IsoHit | null,
  selected: IsoSelection | null,
) {
  ctx.save();
  const verts = scene.layout.canvas;
  const feet = scene.layout.feet;
  function footCanvas(from: CevianFrom) {
    return feet.find((f) => f.from === from)?.canvas;
  }
  function ringAt(p: { x: number; y: number }, strong: boolean) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, strong ? 10 : 8, 0, Math.PI * 2);
    ctx.fillStyle = strong ? "rgba(196, 130, 58, 0.28)" : "rgba(196, 130, 58, 0.16)";
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = strong ? 2.2 : 1.6;
    ctx.fill();
    ctx.stroke();
  }
  function strokeSeg(a: { x: number; y: number }, b: { x: number; y: number }) {
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (selected?.t === "vertex") ringAt(verts[selected.i]!, true);
  if (selected?.t === "foot") {
    const p = footCanvas(selected.from);
    if (p) ringAt(p, true);
  }
  if (selected?.t === "edge") {
    strokeSeg(verts[selected.i]!, verts[(selected.i + 1) % 3]!);
  }
  if (selected?.t === "cevian") {
    const p = footCanvas(selected.from);
    const idx = feet.find((f) => f.from === selected.from)?.index;
    if (p && idx != null) strokeSeg(verts[idx]!, p);
  }
  if (selected?.t === "part") {
    const p = footCanvas(selected.from);
    const idx = feet.find((f) => f.from === selected.from)?.index;
    if (p && idx != null) {
      const [li, ri] = [(idx + 1) % 3, (idx + 2) % 3];
      const end = selected.which === "left" ? li : ri;
      strokeSeg(verts[end]!, p);
    }
  }
  if (hover?.kind === "vertex") ringAt(verts[hover.index]!, false);
  if (hover?.kind === "foot") {
    const p = footCanvas(hover.from);
    if (p) ringAt(p, false);
  }
  if (hover?.kind === "edge") {
    strokeSeg(verts[hover.index]!, verts[(hover.index + 1) % 3]!);
  }
  if (hover?.kind === "cevian") {
    const p = footCanvas(hover.from);
    const idx = feet.find((f) => f.from === hover.from)?.index;
    if (p && idx != null) strokeSeg(verts[idx]!, p);
  }
  if (hover?.kind === "part") {
    const p = footCanvas(hover.from);
    const idx = feet.find((f) => f.from === hover.from)?.index;
    if (p && idx != null) {
      const [li, ri] = [(idx + 1) % 3, (idx + 2) % 3];
      const end = hover.which === "left" ? li : ri;
      strokeSeg(verts[end]!, p);
    }
  }
  if (hover?.kind === "dimLine") {
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 2.4;
    ctx.setLineDash([5, 4]);
    for (const cmd of scene.cmds) {
      if (!("id" in cmd) || cmd.id !== `${hover.id}:line`) continue;
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
