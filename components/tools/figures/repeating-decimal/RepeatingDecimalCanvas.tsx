"use client";

import { useCallback, useEffect, useRef } from "react";
import { paintDiagramScene } from "@/lib/diagrams/render";
import {
  buildRepeatingDecimalScene,
  hitQuotient,
  type RepeatingDecimalScene,
} from "@/lib/diagrams/repeating-decimal/scene";
import type { RepeatingDecimalState } from "@/lib/diagrams/repeating-decimal/model";
import type { FontFaces } from "@/lib/diagrams/math-label";

export type RepeatingDecimalSetter = (
  updater:
    | RepeatingDecimalState
    | ((prev: RepeatingDecimalState) => RepeatingDecimalState),
  persist?: boolean,
) => void;

type Props = {
  state: RepeatingDecimalState;
  fonts: FontFaces;
  setState: RepeatingDecimalSetter;
};

export default function RepeatingDecimalCanvas({
  state,
  fonts,
  setState,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RepeatingDecimalScene | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildRepeatingDecimalScene(current);
    sceneRef.current = scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(scene.width * dpr);
    canvas.height = Math.round(scene.height * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.aspectRatio = `${scene.width} / ${scene.height}`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintDiagramScene(ctx, scene, fonts, current.style.lineWidth);
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
    const scene = sceneRef.current;
    if (!canvas || !scene) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * scene.width,
      y: ((e.clientY - rect.top) / rect.height) * scene.height,
    };
  }

  return (
    <canvas
      ref={canvasRef}
      className="block w-full cursor-pointer bg-white"
      aria-label="순환소수 나눗셈 그림. 몫을 클릭하면 보였다 숨길 수 있어요."
      onClick={(e) => {
        const scene = sceneRef.current;
        if (!scene) return;
        const pt = scenePoint(e);
        if (hitQuotient(scene, pt.x, pt.y)) {
          setState((prev) => ({ ...prev, showQuotient: !prev.showQuotient }));
        }
      }}
    />
  );
}
