"use client";

import { useCallback, useRef, type ReactNode } from "react";
import type { WidgetInstance } from "./types";
import { CloseIcon } from "./icons";

const HEADER_H = 36;

type Props = {
  widget: WidgetInstance;
  title: string;
  accent: string;
  minW: number;
  minH: number;
  onPatch: (patch: Partial<WidgetInstance>) => void;
  onFocus: () => void;
  onClose: () => void;
  children: ReactNode;
};

export default function WidgetWindow({
  widget,
  title,
  accent,
  minW,
  minH,
  onPatch,
  onFocus,
  onClose,
  children,
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
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseX: widget.x,
        baseY: widget.y,
        baseW: widget.w,
        baseH: widget.h,
        mode,
      };
    },
    [widget.x, widget.y, widget.w, widget.h],
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
        onPatch({
          x: Math.min(Math.max(d.baseX + dx, 12 - d.baseW + 60), vw - 60),
          y: Math.min(Math.max(d.baseY + dy, 8), vh - HEADER_H - 8),
        });
      } else {
        onPatch({
          w: Math.min(Math.max(d.baseW + dx, minW), vw - 16),
          h: Math.min(Math.max(d.baseH + dy, minH), vh - 16),
        });
      }
    },
    [onPatch, minW, minH],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div
      className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border-2 border-black/10 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      style={{
        left: widget.x,
        top: widget.y,
        width: widget.w,
        height: widget.h,
        zIndex: widget.z,
      }}
      onPointerDown={onFocus}
    >
      <div
        className="flex shrink-0 cursor-grab touch-none items-center gap-2 px-3 active:cursor-grabbing"
        style={{ height: HEADER_H, background: accent }}
        onPointerDown={onPointerDown("move")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="font-display flex-1 select-none truncate text-sm text-[#3d2c1e]">
          {title}
        </span>
        <button
          type="button"
          aria-label="닫기"
          className="rounded-lg p-1 text-[#3d2c1e]/70 transition hover:bg-black/10 hover:text-[#3d2c1e]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto">{children}</div>
      <div
        className="absolute right-0 bottom-0 h-5 w-5 cursor-nwse-resize touch-none"
        onPointerDown={onPointerDown("resize")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <svg viewBox="0 0 20 20" className="h-full w-full text-black/25">
          <path
            d="M17 9v8H9M17 13v4h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
