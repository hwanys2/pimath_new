"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Target angle in degrees (0–180). */
  degrees: number;
  /** Bump to restart the open animation (e.g. round id). */
  animKey: string | number;
  /** Called once the sweep reaches the target. */
  onAnimComplete?: () => void;
  className?: string;
};

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2 + 20;
const RADIUS = 100;
const DURATION_MS = 900;

function polar(deg: number, r: number): { x: number; y: number } {
  // 0° = east (positive x), counter-clockwise — matches school protractor feel
  // but we draw from east baseline opening upward (standard math: CCW from +x).
  // For middle-school "벌어지는 각", use baseline to the right and open CCW.
  const rad = (deg * Math.PI) / 180;
  return {
    x: CX + r * Math.cos(rad),
    y: CY - r * Math.sin(rad),
  };
}

function wedgePath(fromDeg: number, toDeg: number, r: number): string {
  const start = polar(fromDeg, r);
  const end = polar(toDeg, r);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return [
    `M ${CX} ${CY}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export default function AngleDisplay({
  degrees,
  animKey,
  onAnimComplete,
  className,
}: Props) {
  const target = Math.max(0, Math.min(180, degrees));
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number | null>(null);
  const completeRef = useRef(onAnimComplete);
  completeRef.current = onAnimComplete;

  useEffect(() => {
    setShown(0);
    setDone(false);
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(target * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setShown(target);
        setDone(true);
        completeRef.current?.();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [animKey, target]);

  const tip = polar(shown, RADIUS);
  const base = polar(0, RADIUS);
  const arcR = 36;
  const showWedge = shown > 0.4;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-auto w-full max-w-[min(100%,20rem)]"
        role="img"
        aria-label={done ? `각 ${Math.round(target)}도` : "각이 벌어지는 중"}
      >
        {/* Soft ground disc */}
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS + 18}
          fill="rgba(157, 232, 200, 0.22)"
        />

        {/* Tick marks every 30° for orientation */}
        {Array.from({ length: 7 }, (_, i) => {
          const d = i * 30;
          const inner = polar(d, RADIUS - 6);
          const outer = polar(d, RADIUS + 8);
          return (
            <line
              key={d}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(92, 64, 51, 0.28)"
              strokeWidth={d % 90 === 0 ? 2.5 : 1.5}
              strokeLinecap="round"
            />
          );
        })}

        {/* Angle wedge */}
        {showWedge ? (
          <path
            d={wedgePath(0, shown, RADIUS * 0.72)}
            fill="rgba(77, 182, 160, 0.35)"
            stroke="none"
          />
        ) : null}

        {/* Small arc near vertex */}
        {showWedge ? (
          <path
            d={[
              `M ${polar(0, arcR).x} ${polar(0, arcR).y}`,
              `A ${arcR} ${arcR} 0 ${shown > 180 ? 1 : 0} 0 ${polar(shown, arcR).x} ${polar(shown, arcR).y}`,
            ].join(" ")}
            fill="none"
            stroke="#4DB6A0"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null}

        {/* Baseline (0°) */}
        <line
          x1={CX}
          y1={CY}
          x2={base.x}
          y2={base.y}
          stroke="#5C4033"
          strokeWidth={3.5}
          strokeLinecap="round"
        />

        {/* Moving ray */}
        <line
          x1={CX}
          y1={CY}
          x2={tip.x}
          y2={tip.y}
          stroke="#2A9D8F"
          strokeWidth={3.5}
          strokeLinecap="round"
        />

        {/* Vertex */}
        <circle cx={CX} cy={CY} r={6} fill="#5C4033" />
        <circle cx={CX} cy={CY} r={3} fill="#FFF8E7" />
      </svg>
    </div>
  );
}
