"use client";

import type { BoardPoint } from "./types";

const HIT = 16;

type Props = {
  points: BoardPoint[];
  color: string;
  defaultRadius: number;
  active: boolean;
  onPlace: (x: number, y: number) => void;
};

export default function BoardPointsLayer({
  points,
  color,
  defaultRadius,
  active,
  onPlace,
}: Props) {
  if (!active && points.length === 0) return null;

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
        {points.map((pt) => {
          const R = pt.r ?? defaultRadius;
          return (
            <g key={pt.id} pointerEvents="none">
              <circle cx={pt.x} cy={pt.y} r={HIT} fill="transparent" />
              <circle
                cx={pt.x}
                cy={pt.y}
                r={R + 1.5}
                fill="#fff8eb"
                stroke={color}
                strokeWidth={2}
              />
              <circle cx={pt.x} cy={pt.y} r={Math.max(1.8, R * 0.45)} fill={color} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
