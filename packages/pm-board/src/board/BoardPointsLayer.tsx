"use client";

import type { BoardPoint } from "./types";

const R = 5;
const HIT = 16;

type Props = {
  points: BoardPoint[];
  color: string;
  active: boolean;
  onPlace: (x: number, y: number) => void;
};

export default function BoardPointsLayer({
  points,
  color,
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
        {points.map((pt) => (
          <g key={pt.id} pointerEvents="none">
            <circle
              cx={pt.x}
              cy={pt.y}
              r={HIT}
              fill="transparent"
            />
            <circle
              cx={pt.x}
              cy={pt.y}
              r={R + 2}
              fill="#fff8eb"
              stroke={color}
              strokeWidth={2}
            />
            <circle cx={pt.x} cy={pt.y} r={2.2} fill={color} />
          </g>
        ))}
      </svg>
    </div>
  );
}
