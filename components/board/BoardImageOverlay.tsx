"use client";

import { useCallback, useRef } from "react";
import type { BoardImage } from "./types";
import { CloseIcon } from "./icons";

const MIN_W = 80;
const MIN_H = 60;

type Props = {
  image: BoardImage;
  src: string;
  onChange: (image: BoardImage) => void;
  onClose: () => void;
  onFocus: () => void;
};

export default function BoardImageOverlay({
  image,
  src,
  onChange,
  onClose,
  onFocus,
}: Props) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    baseW: number;
    baseH: number;
    mode: "move" | "resize";
  } | null>(null);

  const onPointerDown = useCallback(
    (mode: "move" | "resize") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onFocus();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseX: image.x,
        baseY: image.y,
        baseW: image.w,
        baseH: image.h,
        mode,
      };
    },
    [image.x, image.y, image.w, image.h, onFocus],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (d.mode === "move") {
        onChange({
          ...image,
          x: Math.min(Math.max(d.baseX + dx, 8), vw - d.baseW - 8),
          y: Math.min(Math.max(d.baseY + dy, 8), vh - d.baseH - 8),
        });
      } else {
        onChange({
          ...image,
          w: Math.min(Math.max(d.baseW + dx, MIN_W), vw - 16),
          h: Math.min(Math.max(d.baseH + dy, MIN_H), vh - 16),
        });
      }
    },
    [image, onChange],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div
      className="pointer-events-auto absolute touch-none"
      style={{
        left: image.x,
        top: image.y,
        width: image.w,
        height: image.h,
        zIndex: image.zIndex,
      }}
      onPointerDown={onFocus}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-xl border-2 border-wood/25 bg-white/90 shadow-lg backdrop-blur-sm">
        <div
          className="flex h-2 shrink-0 cursor-grab items-center bg-wood/15 active:cursor-grabbing"
          onPointerDown={onPointerDown("move")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <button
          type="button"
          aria-label="닫기"
          className="absolute top-0.5 right-0.5 z-10 rounded-md bg-white/90 p-1 text-wood/80 shadow hover:bg-black/10"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <CloseIcon width={14} height={14} />
        </button>
        <div className="relative min-h-0 flex-1 bg-white/50 p-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob object URL */}
          <img
            src={src}
            alt=""
            draggable={false}
            className="h-full w-full object-contain select-none"
          />
        </div>
        <div
          className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
          onPointerDown={onPointerDown("resize")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
}
