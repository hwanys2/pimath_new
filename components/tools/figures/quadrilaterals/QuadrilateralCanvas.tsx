"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabel,
  hitTestQuad,
  moveVertexQuad,
  nudgeLabel,
  toCanonicalPoint,
  type QuadHit,
  type QuadSelection,
} from "@/lib/diagrams/quadrilaterals/geometry";
import { type QuadState } from "@/lib/diagrams/quadrilaterals/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildQuadScene,
  canvasToMath,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type QuadScene,
} from "@/lib/diagrams/quadrilaterals/scene";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type QuadSetter = (
  updater: QuadState | ((prev: QuadState) => QuadState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "vertex"; index: number; x: number; y: number; moved: boolean }
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "dimLine"; id: string; x: number; y: number; moved: boolean };

type Props = {
  state: QuadState;
  fonts: FontFaces;
  selected: QuadSelection | null;
  setState: QuadSetter;
  persist: () => void;
  onSelect: (sel: QuadSelection | null) => void;
  onDeleteSelected: () => void;
};

const MOVE_PX = 3;

export default function QuadrilateralCanvas({
  state,
  fonts,
  selected,
  setState,
  persist,
  onSelect,
  onDeleteSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<QuadScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<QuadHit | null>(null);
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
    const scene = buildQuadScene(current);
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
    const current = stateRef.current;
    return hitTestQuad(
      scene.layout.canvas,
      scene.layout.o,
      scene.layout.exts,
      scene.texts,
      scene.cmds,
      p.x,
      p.y,
      hitScale(),
      current.showDiagAC || current.showO,
      current.showDiagBD || current.showO,
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
          if (hit?.kind === "o") {
            onSelect({ t: "o" });
            return;
          }
          if (hit?.kind === "extension") {
            onSelect({ t: "extension", i: hit.index });
            return;
          }
          if (hit?.kind === "edge") {
            onSelect({ t: "edge", i: hit.index });
            setState((prev) => toggleEdgeLength(prev, hit.index));
            return;
          }
          if (hit?.kind === "seg") {
            onSelect({ t: "seg", id: hit.id });
            setState((prev) => toggleSeg(prev, hit.id));
            return;
          }
          if (hit?.kind === "diag") {
            onSelect({ t: "diag", which: hit.which });
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
            setState(
              (prev) => moveVertexQuad(prev, drag.index, toCanonicalPoint(prev, math)),
              false,
            );
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

function toggleEdgeLength(state: QuadState, index: number): QuadState {
  return {
    ...state,
    edges: state.edges.map((edge, i) =>
      i === index ? { ...edge, showLength: !edge.showLength } : edge,
    ),
  };
}

function toggleSeg(state: QuadState, id: QuadState["diagSegs"] extends Record<infer K, unknown> ? K : never): QuadState {
  return {
    ...state,
    diagSegs: {
      ...state.diagSegs,
      [id]: { ...state.diagSegs[id], show: !state.diagSegs[id].show },
    },
  };
}

function sameHit(a: QuadHit | null, b: QuadHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "label" || a.kind === "dimLine") {
    return a.id === (b as { id: string }).id;
  }
  if (a.kind === "vertex") return b.kind === "vertex" && a.index === b.index;
  if (a.kind === "edge") return b.kind === "edge" && a.index === b.index;
  if (a.kind === "seg") return b.kind === "seg" && a.id === b.id;
  if (a.kind === "diag") return b.kind === "diag" && a.which === b.which;
  if (a.kind === "extension") return b.kind === "extension" && a.index === b.index;
  return true;
}

function cursorForHit(hit: QuadHit | null): string {
  if (!hit) return "default";
  if (hit.kind === "label") return "text";
  if (hit.kind === "dimLine") return "grab";
  if (hit.kind === "vertex") return "grab";
  return "pointer";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: QuadScene,
  hover: QuadHit | null,
  selected: QuadSelection | null,
) {
  ctx.save();
  const verts = scene.layout.canvas;
  const o = scene.layout.o;
  const exts = scene.layout.exts;
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
  if (selected?.t === "o" && o) ringAt(o, true);
  if (selected?.t === "extension") {
    const p = exts[selected.i];
    if (p) ringAt(p, true);
  }
  if (selected?.t === "edge") {
    strokeSeg(verts[selected.i]!, verts[(selected.i + 1) % 4]!);
  }
  if (selected?.t === "diag") {
    if (selected.which === "AC") strokeSeg(verts[0]!, verts[2]!);
    else strokeSeg(verts[1]!, verts[3]!);
  }
  if (selected?.t === "seg" && o) {
    const map = {
      AO: [verts[0]!, o],
      OC: [o, verts[2]!],
      BO: [verts[1]!, o],
      OD: [o, verts[3]!],
      AC: [verts[0]!, verts[2]!],
      BD: [verts[1]!, verts[3]!],
    } as const;
    const pair = map[selected.id];
    strokeSeg(pair[0], pair[1]);
  }
  if (hover?.kind === "vertex") ringAt(verts[hover.index]!, false);
  if (hover?.kind === "o" && o) ringAt(o, false);
  if (hover?.kind === "extension") {
    const p = exts[hover.index];
    if (p) ringAt(p, false);
  }
  if (hover?.kind === "edge") {
    strokeSeg(verts[hover.index]!, verts[(hover.index + 1) % 4]!);
  }
  ctx.restore();
}
