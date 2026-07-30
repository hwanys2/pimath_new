"use client";

type Props = {
  x: number;
  y: number;
  active: boolean;
  uid: string;
};

export const TRASH_HIT_R = 46;

export default function TrashZone({ x, y, active, uid }: Props) {
  const gradId = `trash-${uid}`;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={-TRASH_HIT_R}
        y={-18}
        width={TRASH_HIT_R * 2}
        height={78}
        rx={12}
        fill={active ? "rgba(232,93,76,0.14)" : "rgba(255,255,255,0.55)"}
        stroke={active ? "#e85d4c" : "#c8c0b4"}
        strokeWidth={active ? 2.5 : 1.5}
      />
      {/* lid */}
      <rect
        x={-26}
        y={active ? -10 : -6}
        width={52}
        height={8}
        rx={3}
        fill={active ? "#e85d4c" : "#9a9a9a"}
      />
      <rect
        x={-8}
        y={active ? -14 : -10}
        width={16}
        height={6}
        rx={2}
        fill={active ? "#c44a3a" : "#7a7a7a"}
      />
      {/* body */}
      <path
        d="M -20 2 L -16 46 Q -16 50 -12 50 L 12 50 Q 16 50 16 46 L 20 2 Z"
        fill={`url(#${gradId})`}
        stroke={active ? "#c44a3a" : "#909090"}
        strokeWidth={1.5}
      />
      <line
        x1={-8}
        y1={10}
        x2={-10}
        y2={42}
        stroke={active ? "#d08070" : "#b0b0b0"}
        strokeWidth={1.5}
      />
      <line
        x1={0}
        y1={10}
        x2={0}
        y2={42}
        stroke={active ? "#d08070" : "#b0b0b0"}
        strokeWidth={1.5}
      />
      <line
        x1={8}
        y1={10}
        x2={10}
        y2={42}
        stroke={active ? "#d08070" : "#b0b0b0"}
        strokeWidth={1.5}
      />
      <text
        x={0}
        y={62}
        textAnchor="middle"
        fontSize={11}
        fontWeight="bold"
        fill={active ? "#a63a1a" : "#808080"}
      >
        휴지통
      </text>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ececec" />
          <stop offset="100%" stopColor="#c0c0c0" />
        </linearGradient>
      </defs>
    </g>
  );
}
