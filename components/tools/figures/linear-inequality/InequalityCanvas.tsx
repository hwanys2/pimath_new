"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  applyBoundMove,
  hitTestInequality,
  nearestBound,
  toggleInclusive,
  type InequalityHit,
} from "@/lib/diagrams/linear-inequality/geometry";
import {
  boundKeys,
  type BoundKey,
  type InequalityState,
} from "@/lib/diagrams/linear-inequality/model";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildInequalityScene,
  canvasXFromValue,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type InequalityScene,
} from "@/lib/diagrams/linear-inequality/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type InequalitySetter = (
  updater: InequalityState | ((prev: InequalityState) => InequalityState),
  persist?: boolean,
) => void;

type Drag = { which: BoundKey };

type Props = {
  state: InequalityState;
  fonts: FontFaces;
  selected: BoundKey | null;
  setState: InequalitySetter;
  persist: () => void;
  onSelect: (which: BoundKey | null) => void;
};

export default function InequalityCanvas({
  state,
  fonts,
  selected,
  setState,
  persist,
  onSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<InequalityScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<InequalityHit | null>(null);
  const stateRef = useRef(state);
  const selectedRef = useRef(selected);
  const lastClickRef = useRef<{ which: BoundKey; at: number } | null>(null);
  stateRef.current = state;
  selectedRef.current = selected;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildInequalityScene(current);
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
    return hitTestInequality(stateRef.current, scene, p.x, p.y, hitScale());
  }

  function setCursor(value: string) {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = value;
  }

  return (
    <canvas
      ref={canvasRef}
      width={SCENE_WIDTH}
      height={SCENE_HEIGHT}
      className="h-auto w-full touch-none bg-white"
      tabIndex={0}
      aria-label="일차부등식 수직선. 경계 점을 끌어 옮기고, 두 번 눌러 같다를 켜고 끌 수 있어요."
      onPointerDown={(e) => {
        const scene = sceneRef.current;
        if (!scene) return;
        const hit = hitAt(e);
        hoverRef.current = null;

        if (!hit) {
          onSelect(null);
          return;
        }

        if (hit.kind === "bound") {
          const prev = lastClickRef.current;
          const now = Date.now();
          if (
            prev &&
            prev.which === hit.which &&
            now - prev.at < 380
          ) {
            lastClickRef.current = null;
            setState((s) => toggleInclusive(s, hit.which), true);
            onSelect(hit.which);
            return;
          }
          lastClickRef.current = { which: hit.which, at: now };
          onSelect(hit.which);
          dragRef.current = { which: hit.which };
          setCursor("grabbing");
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }

        if (hit.kind === "axis") {
          const which =
            selectedRef.current &&
            boundKeys(stateRef.current.kind).includes(selectedRef.current)
              ? selectedRef.current
              : nearestBound(stateRef.current, hit.value);
          if (!which) return;
          onSelect(which);
          setState((s) => applyBoundMove(s, which, hit.value), true);
        }
      }}
      onPointerMove={(e) => {
        const scene = sceneRef.current;
        if (!scene) return;
        const p = scenePoint(e);
        const drag = dragRef.current;

        if (!drag) {
          const hit = hitAt(e);
          if (!sameHit(hoverRef.current, hit)) {
            hoverRef.current = hit;
            setCursor(cursorForHit(hit));
            paint();
          }
          return;
        }

        const value = valueFromSceneX(p.x, scene);
        setState((s) => applyBoundMove(s, drag.which, value), false);
      }}
      onPointerUp={(e) => {
        dragRef.current = null;
        setCursor("default");
        persist();
        paint();
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
  );
}

function valueFromSceneX(x: number, scene: InequalityScene): number {
  const { left, right, min, max } = scene.layout;
  const span = right - left;
  if (span <= 1e-9) return min;
  const t = (x - left) / span;
  return min + t * (max - min);
}

function sameHit(a: InequalityHit | null, b: InequalityHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "bound") {
    return b.kind === "bound" && a.which === b.which;
  }
  return true;
}

function cursorForHit(hit: InequalityHit | null): string {
  if (!hit) return "default";
  if (hit.kind === "axis") return "ew-resize";
  return "grab";
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: InequalityScene,
  state: InequalityState,
  selected: BoundKey | null,
  hover: InequalityHit | null,
) {
  ctx.save();
  for (const which of boundKeys(state.kind)) {
    const x = canvasXFromValue(state[which].value, scene.layout);
    const isSelected = which === selected;
    const hovered = hover?.kind === "bound" && hover.which === which;
    if (!isSelected && !hovered) continue;
    ctx.beginPath();
    ctx.arc(
      x,
      scene.layout.axisY,
      hovered ? 11 : 9.5,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = hovered
      ? "rgba(196, 130, 58, 0.28)"
      : "rgba(196, 130, 58, 0.18)";
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 2.2;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
