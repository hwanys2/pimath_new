"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyDrag,
  canvasToScene,
  isDraggableHit,
  isTextEditableHit,
  selectionFromHit,
  startDrag,
  type DragState,
} from "@/lib/diagrams/counting-probability/geometry";
import type { CountingState } from "@/lib/diagrams/counting-probability/model";
import {
  buildCountingScene,
  hitTestCounting,
  hitTestUiControl,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type CountingHit,
  type CountingScene,
} from "@/lib/diagrams/counting-probability/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";
import { paintDiagramScene } from "@/lib/diagrams/render";
import { sceneTextPlain } from "@/lib/diagrams/scene";

export type CountingSetter = (
  updater: CountingState | ((prev: CountingState) => CountingState),
  persist?: boolean,
) => void;

type Props = {
  state: CountingState;
  fonts: FontFaces;
  selected: string | null;
  setState: CountingSetter;
  persist: () => void;
  onSelect: (id: string | null) => void;
  onEdgeCountChange?: (edgeId: string, delta: number) => void;
};

export default function CountingCanvas({
  state,
  fonts,
  selected,
  setState,
  persist,
  onSelect,
  onEdgeCountChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CountingScene | null>(null);
  const dragRef = useRef<DragState | null>(null);
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
    const scene = buildCountingScene(current, selectedRef.current);
    sceneRef.current = scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SCENE_WIDTH * dpr);
    canvas.height = Math.round(SCENE_HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintDiagramScene(ctx, scene, fonts, current.style.lineWidth);
    paintUiOverlays(ctx, scene, current.kind === "paths");
  }, [fonts]);

  function paintUiOverlays(
    ctx: CanvasRenderingContext2D,
    scene: CountingScene,
    showPathControls: boolean,
  ) {
    if (!showPathControls || !scene.uiControls?.length) return;
    for (const c of scene.uiControls) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = c.action === "inc" ? "#4a90d9" : "#e85a5a";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(c.action === "inc" ? "+" : "−", c.x, c.y + 0.5);
      ctx.restore();
    }
  }

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

  function scenePoint(e: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return canvasToScene(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
    );
  }

  function hitAt(p: { x: number; y: number }): CountingHit | null {
    const scene = sceneRef.current;
    if (!scene) return null;
    return hitTestCounting(scene, p.x, p.y);
  }

  function labelForKind(): string {
    switch (state.kind) {
      case "dice":
        return "주사위. 끌어 재배치할 수 있어요.";
      case "cards":
        return "카드. 끌어 재배치하고 글자를 눌러 고칠 수 있어요.";
      case "pouches":
        return "주머니와 공. 끌어 재배치하고 글자를 눌러 고칠 수 있어요.";
      case "spinner":
        return "등분할 원판. 칸을 눌러 고르고 글자를 바꿀 수 있어요.";
      case "paths":
        return "길. 장소를 끌고 +/−로 길 개수를 바꿀 수 있어요.";
      default:
        return "경우의 수와 확률 그림";
    }
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={SCENE_WIDTH}
        height={SCENE_HEIGHT}
        className="h-auto w-full touch-none bg-white"
        tabIndex={0}
        aria-label={labelForKind()}
        onPointerDown={(e) => {
          if (editRef.current) {
            setEdit(null);
            editRef.current = null;
          }
          const scene = sceneRef.current;
          if (!scene) return;
          const p = scenePoint(e);

          const ui = hitTestUiControl(scene, p.x, p.y);
          if (ui && onEdgeCountChange) {
            onEdgeCountChange(ui.edgeId, ui.action === "inc" ? 1 : -1);
            return;
          }

          const hit = hitAt(p);
          if (!hit) {
            onSelect(null);
            return;
          }
          onSelect(selectionFromHit(hit));

          if (isDraggableHit(hit)) {
            const drag = startDrag(hit, p.x, p.y, stateRef.current);
            if (drag) {
              dragRef.current = drag;
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          const p = scenePoint(e);
          setState((prev) => applyDrag(drag, p.x, p.y, prev), false);
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          dragRef.current = null;
          persist();
          if (drag && drag.t !== "edge") {
            const p = scenePoint(e);
            const hit = hitAt(p);
            if (hit && isTextEditableHit(hit)) {
              const scene = sceneRef.current;
              const textId =
                hit.t === "card"
                  ? `card:${hit.id}`
                  : hit.t === "ball"
                    ? `ball:${hit.pouchId}:${hit.id}`
                    : hit.t === "slice"
                      ? `slice:${hit.id}`
                      : hit.t === "place"
                        ? `place:${hit.id}`
                        : hit.t === "pouch"
                          ? `pouch:${hit.id}`
                          : null;
              const text = scene?.texts.find((t) => t.id === textId);
              if (text && Math.hypot(p.x - text.x, p.y - text.y) < 24) {
                setEdit({
                  id: textId!,
                  value: sceneTextPlain(text),
                  x: text.x,
                  y: text.y,
                });
              }
            }
          }
          paint();
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          persist();
          paint();
        }}
      />
      {edit ? (
        <input
          autoFocus
          value={edit.value}
          onChange={(ev) => setEdit({ ...edit, value: ev.target.value })}
          onBlur={() => {
            const current = editRef.current;
            if (!current) return;
            setEdit(null);
            setState((prev) => {
              const parts = current.id.split(":");
              if (parts[0] === "card" && parts[1]) {
                return {
                  ...prev,
                  cards: prev.cards.map((c) =>
                    c.id === parts[1] ? { ...c, text: current.value } : c,
                  ),
                };
              }
              if (parts[0] === "ball" && parts[1] && parts[2]) {
                return {
                  ...prev,
                  pouches: prev.pouches.map((p) =>
                    p.id === parts[1]
                      ? {
                          ...p,
                          balls: p.balls.map((b) =>
                            b.id === parts[2]
                              ? { ...b, text: current.value }
                              : b,
                          ),
                        }
                      : p,
                  ),
                };
              }
              if (parts[0] === "slice" && parts[1]) {
                return {
                  ...prev,
                  spinner: {
                    ...prev.spinner,
                    slices: prev.spinner.slices.map((s) =>
                      s.id === parts[1] ? { ...s, text: current.value } : s,
                    ),
                  },
                };
              }
              if (parts[0] === "place" && parts[1]) {
                return {
                  ...prev,
                  paths: {
                    ...prev.paths,
                    places: prev.paths.places.map((p) =>
                      p.id === parts[1] ? { ...p, label: current.value } : p,
                    ),
                  },
                };
              }
              if (parts[0] === "pouch" && parts[1]) {
                return {
                  ...prev,
                  pouches: prev.pouches.map((p) =>
                    p.id === parts[1] ? { ...p, label: current.value } : p,
                  ),
                };
              }
              return prev;
            }, true);
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
            if (ev.key === "Escape") {
              setEdit(null);
              editRef.current = null;
            }
          }}
          className="absolute z-10 min-w-[2.5rem] -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-wood bg-white px-2 py-1 text-center text-sm outline-none"
          style={{
            left: `${(edit.x / SCENE_WIDTH) * 100}%`,
            top: `${(edit.y / SCENE_HEIGHT) * 100}%`,
          }}
        />
      ) : null}
    </div>
  );
}
