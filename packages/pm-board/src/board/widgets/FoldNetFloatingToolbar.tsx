"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";

type NetBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type Props = {
  containerRef: RefObject<HTMLDivElement | null>;
  netBounds: NetBounds | null;
  unfoldT: number;
  foldable: boolean;
  disabledHint?: string;
  onUnfoldTChange: (t: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export default function FoldNetFloatingToolbar({
  containerRef,
  netBounds,
  unfoldT,
  foldable,
  disabledHint,
  onUnfoldTChange,
  onDuplicate,
  onDelete,
}: Props) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !netBounds) {
      setPos(null);
      return;
    }
    const update = () => {
      const rect = el.getBoundingClientRect();
      const cx = (netBounds.minX + netBounds.maxX) / 2;
      const bottom = netBounds.maxY + 12;
      setPos({
        left: cx,
        top: Math.min(bottom, rect.height - 48),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, netBounds]);

  if (!foldable || !pos) return null;

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left: pos.left,
        top: pos.top,
        transform: "translate(-50%, 0)",
      }}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#2d2d2d] px-3 py-2 text-white shadow-lg ring-1 ring-black/20">
        <span className="shrink-0 text-xs font-medium text-white/90">펴다</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={unfoldT}
          onChange={(e) => onUnfoldTChange(Number(e.target.value))}
          className="h-1 w-28 cursor-pointer accent-blue-400"
          title={disabledHint}
        />
        <button
          type="button"
          className="rounded-md p-1 text-white/80 hover:bg-white/10"
          title="복제"
          onClick={onDuplicate}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <rect
              x="5"
              y="5"
              width="8"
              height="8"
              rx="1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <rect
              x="3"
              y="3"
              width="8"
              height="8"
              rx="1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </button>
        <button
          type="button"
          className="rounded-md p-1 text-white/80 hover:bg-white/10"
          title="삭제"
          onClick={onDelete}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path
              d="M5 5l6 6M11 5l-6 6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <rect
              x="3"
              y="4"
              width="10"
              height="9"
              rx="1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path d="M6 2h4" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
