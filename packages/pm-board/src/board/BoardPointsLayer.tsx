"use client";

import type { BoardPoint } from "./types";

type Props = {
  points: BoardPoint[];
  color: string;
  defaultRadius: number;
  hiddenIds?: string[];
  active: boolean;
  onPlace: (x: number, y: number) => void;
};

export default function BoardPointsLayer({
  points,
  color,
  defaultRadius,
  hiddenIds = [],
  active,
  onPlace,
}: Props) {
  const hidden = new Set(hiddenIds);
  const visible = points.filter((pt) => !hidden.has(pt.id));

  if (!active && visible.length === 0) return null;

  return (
    <div
      className={`absolute inset-0 z-[11] ${active ? "pointer-events-auto touch-none" : "pointer-events-none"}`}
      style={{ cursor: active ? "crosshair" : undefined }}
      onPointerDown={(e) => {
        if (!active || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        onPlace(e.clientX, e.clientY);
      }}
    >
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {visible.map((pt) => {
          const R = pt.r ?? defaultRadius;
          return (
            <circle
              key={pt.id}
              cx={pt.x}
              cy={pt.y}
              r={R}
              fill={color}
              pointerEvents="none"
            />
          );
        })}
      </svg>
    </div>
  );
}
