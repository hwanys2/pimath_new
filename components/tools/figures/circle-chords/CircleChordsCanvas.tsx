"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildCircleChordsScene,
  hitTestText,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type DiagramScene,
} from "@/lib/diagrams/circle-chords/scene";
import { paintCircleChordsScene } from "@/lib/diagrams/circle-chords/render";
import type { CircleChordsState } from "@/lib/diagrams/circle-chords/model";
import type { FontFaces } from "@/lib/diagrams/math-label";

type Props = {
  state: CircleChordsState;
  fonts: FontFaces;
  onNudgeLabel: (id: string, dx: number, dy: number) => void;
};

export default function CircleChordsCanvas({
  state,
  fonts,
  onNudgeLabel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DiagramScene | null>(null);
  const dragRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<"default" | "grab" | "grabbing">(
    "default",
  );

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = buildCircleChordsScene(state);
    sceneRef.current = scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SCENE_WIDTH * dpr);
    canvas.height = Math.round(SCENE_HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintCircleChordsScene(ctx, scene, fonts, state.style.lineWidth);
  }, [state, fonts]);

  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) paint();
    });
    paint();
    return () => {
      cancelled = true;
    };
  }, [paint]);

  function scenePoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SCENE_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * SCENE_HEIGHT,
    };
  }

  return (
    <canvas
      ref={canvasRef}
      width={SCENE_WIDTH}
      height={SCENE_HEIGHT}
      className="h-auto w-full touch-none bg-white"
      style={{ cursor }}
      aria-label="원과 현 문제 그림 미리보기. 길이 글자를 드래그하면 옮길 수 있어요."
      onPointerDown={(e) => {
        const scene = sceneRef.current;
        if (!scene) return;
        const p = scenePoint(e);
        const hit = hitTestText(scene, p.x, p.y);
        if (!hit) return;
        dragRef.current = { id: hit.id, x: p.x, y: p.y };
        setCursor("grabbing");
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const scene = sceneRef.current;
        const p = scenePoint(e);
        if (!dragRef.current) {
          const hit = scene ? hitTestText(scene, p.x, p.y) : null;
          setCursor(hit ? "grab" : "default");
          return;
        }
        const dx = p.x - dragRef.current.x;
        const dy = p.y - dragRef.current.y;
        dragRef.current = { ...dragRef.current, x: p.x, y: p.y };
        onNudgeLabel(dragRef.current.id, dx, dy);
      }}
      onPointerUp={() => {
        dragRef.current = null;
        setCursor("default");
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        setCursor("default");
      }}
    />
  );
}
