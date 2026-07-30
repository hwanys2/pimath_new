"use client";

type Props = {
  x: number;
  y: number;
  active: boolean;
  uid: string;
};

export default function TrashZone({ x, y, active, uid }: Props) {
  const gradId = `trash-${uid}`;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={-36}
        y={-8}
        width={72}
        height={56}
        rx={10}
        fill={active ? "rgba(232,93,76,0.18)" : "rgba(0,0,0,0.04)"}
        stroke={active ? "#e85d4c" : "#c0c0c0"}
        strokeWidth={active ? 2.5 : 1.5}
        strokeDasharray={active ? undefined : "4 3"}
      />
      {/* lid */}
      <rect
        x={-28}
        y={active ? -18 : -12}
        width={56}
        height={8}
        rx={3}
        fill={active ? "#e85d4c" : "#a0a0a0"}
        style={{ transition: "y 0.15s" }}
      />
      {/* bin body */}
      <path
        d="M -22 4 L -18 44 L 18 44 L 22 4 Z"
        fill={`url(#${gradId})`}
        stroke={active ? "#c44a3a" : "#909090"}
        strokeWidth={1.5}
      />
      <text
        x={0}
        y={68}
        textAnchor="middle"
        fontSize={11}
        fontWeight="bold"
        fill={active ? "#a63a1a" : "#808080"}
      >
        휴지통
      </text>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8e8e8" />
          <stop offset="100%" stopColor="#c8c8c8" />
        </linearGradient>
      </defs>
    </g>
  );
}
