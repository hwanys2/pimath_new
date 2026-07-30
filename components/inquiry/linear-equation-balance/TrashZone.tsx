"use client";

import { forwardRef } from "react";

type Props = {
  active: boolean;
};

const TrashZone = forwardRef<HTMLDivElement, Props>(function TrashZone(
  { active },
  ref,
) {
  return (
    <div
      ref={ref}
      className={[
        "flex shrink-0 flex-col items-center justify-center rounded-2xl border-2 px-4 py-3 transition-all",
        active
          ? "border-[#e85d4c] bg-[#e85d4c]/15 shadow-md scale-105"
          : "border-wood/20 bg-white/80",
      ].join(" ")}
      aria-label="휴지통 — 막대를 끌어다 놓으면 삭제"
    >
      <svg
        width={52}
        height={60}
        viewBox="0 0 52 60"
        aria-hidden
        className="pointer-events-none"
      >
        {/* lid */}
        <rect
          x={6}
          y={active ? 2 : 6}
          width={40}
          height={7}
          rx={3}
          fill={active ? "#e85d4c" : "#9a9a9a"}
        />
        <rect x={20} y={active ? 0 : 4} width={12} height={5} rx={2} fill={active ? "#c44a3a" : "#7a7a7a"} />
        {/* body */}
        <path
          d="M 10 14 L 14 52 Q 14 56 18 56 L 34 56 Q 38 56 38 52 L 42 14 Z"
          fill={active ? "#f0c0b8" : "#e0e0e0"}
          stroke={active ? "#c44a3a" : "#909090"}
          strokeWidth={1.5}
        />
        {/* vertical lines */}
        <line x1={20} y1={20} x2={18} y2={50} stroke={active ? "#d08070" : "#b0b0b0"} strokeWidth={1.5} />
        <line x1={26} y1={20} x2={26} y2={50} stroke={active ? "#d08070" : "#b0b0b0"} strokeWidth={1.5} />
        <line x1={32} y1={20} x2={34} y2={50} stroke={active ? "#d08070" : "#b0b0b0"} strokeWidth={1.5} />
      </svg>
      <span
        className={[
          "mt-1 text-[11px] font-bold",
          active ? "text-[#a63a1a]" : "text-wood/60",
        ].join(" ")}
      >
        휴지통
      </span>
    </div>
  );
});

export default TrashZone;
