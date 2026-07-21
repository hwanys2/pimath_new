import type { QuadShape } from "@/lib/quadrilateral-maker-math";

const SHAPE_POINTS: Record<QuadShape, string> = {
  parallelogram: "6,28 18,8 42,8 30,28",
  rectangle: "8,8 40,8 40,28 8,28",
  rhombus: "24,6 42,18 24,30 6,18",
  square: "13,6 35,6 35,28 13,28",
};

type Props = {
  shape: QuadShape;
  className?: string;
};

export default function QuadShapeIcon({ shape, className }: Props) {
  return (
    <svg
      viewBox="0 0 48 36"
      className={className}
      role="img"
      aria-hidden="true"
    >
      <polygon
        points={SHAPE_POINTS[shape]}
        fill="#8B6914"
        fillOpacity={0.18}
        stroke="#8B6914"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
