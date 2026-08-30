"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  hitTestPair,
  nudgePairById,
  orbitPairView,
  applyPairEditedLabel,
  togglePairEdge,
  pairHitId,
  type PairHit,
} from "@/lib/diagrams/similar-solids/geometry";
import { type SimilarSolidsState } from "@/lib/diagrams/similar-solids/model";
import {
  buildSimilarSolidsScene,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type SimilarSolidsScene,
} from "@/lib/diagrams/similar-solids/scene";
import { paintDiagramScene } from "@/lib/diagrams/render";
import { sceneTextPlain } from "@/lib/diagrams/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type SimilarSolidsSetter = (
  updater: SimilarSolidsState | ((prev: SimilarSolidsState) => SimilarSolidsState),
  persist?: boolean,
) => void;

type Drag =
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "dimLine"; id: string; x: number; y: number; moved: boolean }
  | { t: "orbit"; x: number; y: number; moved: boolean };

type Props = {
  state: SimilarSolidsState;
  fonts: FontFaces;
  setState: SimilarSolidsSetter;
  persist: () => void;
};

const MOVE_PX = 3;

export default function SimilarSolidsCanvas({
  state,
  fonts,
  setState,
  persist,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SimilarSolidsScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<PairHit | null>(null);
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
    const scene = buildSimilarSolidsScene(current);
    sceneRef.current = scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SCENE_WIDTH * dpr);
    canvas.height = Math.round(SCENE_HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintDiagramScene(ctx, scene, fonts, current.source.style.lineWidth);
    paintOverlays(ctx, scene, hoverRef.current);
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
    return hitTestPair(stateRef.current, scene, p.x, p.y, hitScale());
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
    setState((prev) => applyPairEditedLabel(prev, current.id, next), true);
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
          if (hit?.kind === "label" || hit?.kind === "figure") {
            dragRef.current = {
              t: "label",
              id: pairHitId(hit),
              x: p.x,
              y: p.y,
              moved: false,
            };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (hit?.kind === "dimLine") {
            dragRef.current = {
              t: "dimLine",
              id: pairHitId(hit),
              x: p.x,
              y: p.y,
              moved: false,
            };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (hit?.kind === "edge") {
            setState((prev) => togglePairEdge(prev, hit.key), true);
            return;
          }
          dragRef.current = { t: "orbit", x: p.x, y: p.y, moved: false };
          setCursor("grabbing");
          e.currentTarget.setPointerCapture(e.pointerId);
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
          if (drag.t === "orbit") {
            dragRef.current = { ...drag, x: p.x, y: p.y, moved };
            if (moved) {
              setState((prev) => orbitPairView(prev, dx, dy), false);
            }
            return;
          }
          dragRef.current = { ...drag, x: p.x, y: p.y, moved };
          if (!moved) return;
          const scene = sceneRef.current;
          if (!scene) return;
          setState(
            (prev) =>
              nudgePairById(prev, scene, drag.id, dx, dy, drag.t === "dimLine"),
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

function sameHit(a: PairHit | null, b: PairHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "figure") {
    return b.kind === "figure" && a.which === b.which;
  }
  if (a.kind === "label" || a.kind === "dimLine") {
    return (
      (b.kind === "label" || b.kind === "dimLine") &&
      a.id === b.id &&
      a.side === b.side
    );
  }
  if (a.kind === "vertex") {
    return b.kind === "vertex" && a.index === b.index && a.side === b.side;
  }
  if (a.kind === "edge") {
    return b.kind === "edge" && a.key === b.key && a.side === b.side;
  }
  return a.side === (b as { side?: string }).side;
}

function cursorForHit(hit: PairHit | null): string {
  if (!hit) return "grab";
  if (hit.kind === "label" || hit.kind === "figure") return "text";
  if (hit.kind === "edge") return "pointer";
  return "grab";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: SimilarSolidsScene,
  hover: PairHit | null,
) {
  if (!hover) return;
  ctx.save();
  const layout =
    hover.kind === "figure"
      ? null
      : hover.side === "right"
        ? scene.right
        : scene.left;
  if (hover.kind === "vertex" && layout) {
    const p = layout.vertices[hover.index];
    if (p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(196, 130, 58, 0.22)";
      ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    }
  }
  if (hover.kind === "edge" && layout) {
    const e = layout.edges.find((item) => item.key === hover.key);
    if (e) {
      const a = layout.vertices[e.a]!;
      const b = layout.vertices[e.b]!;
      ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  if (hover.kind === "dimLine") {
    const prefix = hover.side === "right" ? "R:" : "L:";
    const targetId = `${prefix}${hover.id}`;
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    for (const cmd of scene.cmds) {
      if (!("id" in cmd) || !cmd.id) continue;
      const target = cmd.id.endsWith(":line") ? cmd.id.slice(0, -5) : cmd.id;
      if (target !== targetId) continue;
      if (cmd.t === "arc") {
        ctx.beginPath();
        ctx.arc(cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw);
        ctx.stroke();
      } else if (cmd.t === "line") {
        ctx.beginPath();
        ctx.moveTo(cmd.x1, cmd.y1);
        ctx.lineTo(cmd.x2, cmd.y2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
