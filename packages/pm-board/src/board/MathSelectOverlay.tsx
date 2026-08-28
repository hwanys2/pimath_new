"use client";

import { useCallback, useRef, useState } from "react";
import type { BoardRect } from "../lib/board-stroke-bounds";
import { capturePointer, isPrimaryDrawPointer } from "../lib/board-pointer";

const MIN_SIZE = 40;

type Props = {
  onComplete: (rect: BoardRect) => void;
  onCancel: () => void;
  hintText?: string;
};

export default function MathSelectOverlay({
  onComplete,
  onCancel,
  hintText = "수식이 있는 영역을 드래그하세요 · Esc로 취소",
}: Props) {
  const [rect, setRect] = useState<BoardRect | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isPrimaryDrawPointer(e)) return;
    e.preventDefault();
    capturePointer(e.currentTarget, e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setRect({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s) return;
    setRect({ x0: s.x, y0: s.y, x1: e.clientX, y1: e.clientY });
  };

  const finish = useCallback(
    (r: BoardRect | null) => {
      startRef.current = null;
      if (!r) {
        onCancel();
        return;
      }
      const x0 = Math.min(r.x0, r.x1);
      const y0 = Math.min(r.y0, r.y1);
      const x1 = Math.max(r.x0, r.x1);
      const y1 = Math.max(r.y0, r.y1);
      if (x1 - x0 < MIN_SIZE || y1 - y0 < MIN_SIZE) {
        onCancel();
        return;
      }
      onComplete({ x0, y0, x1, y1 });
    },
    [onCancel, onComplete],
  );

  const onPointerUp = () => {
    finish(rect);
    setRect(null);
  };

  const box =
    rect &&
    (() => {
      const x0 = Math.min(rect.x0, rect.x1);
      const y0 = Math.min(rect.y0, rect.y1);
      const w = Math.abs(rect.x1 - rect.x0);
      const h = Math.abs(rect.y1 - rect.y0);
      return { left: x0, top: y0, w, h };
    })();

  return (
    <div
      className="absolute inset-0 z-[38] touch-none"
      style={{ cursor: "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/25" />
      <p className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 rounded-xl bg-black/50 px-4 py-2 text-sm text-white">
        {hintText}
      </p>
      {box ? (
        <div
          className="pointer-events-none absolute border-2 border-sky bg-sky/15"
          style={{
            left: box.left,
            top: box.top,
            width: box.w,
            height: box.h,
          }}
        />
      ) : null}
    </div>
  );
}
