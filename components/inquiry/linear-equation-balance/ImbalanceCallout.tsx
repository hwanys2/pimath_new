"use client";

type Props = {
  x: number;
  y: number;
  actionText: string;
};

export default function ImbalanceCallout({ x, y, actionText }: Props) {
  const sub = "반대쪽에도 똑같이 해보세요";
  const width = Math.min(320, Math.max(200, actionText.length * 14 + 48));

  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <rect
        x={-width / 2}
        y={-34}
        width={width}
        height={58}
        rx={14}
        fill="#fff8f6"
        stroke="#e85d4c"
        strokeWidth={2.5}
      />
      <text
        x={0}
        y={-12}
        textAnchor="middle"
        fontSize={13}
        fontWeight="bold"
        fill="#a63a1a"
      >
        {actionText}
      </text>
      <text
        x={0}
        y={8}
        textAnchor="middle"
        fontSize={11}
        fontWeight="bold"
        fill="#9a8e80"
      >
        {sub}
      </text>
    </g>
  );
}
