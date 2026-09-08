"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  AlkagiStone,
  AlkagiStoneColor,
} from "@/lib/alkagi-types";
import { ALKAGI_BOUND, ALKAGI_STONE_RADIUS } from "@/lib/alkagi-types";
import type { SimulationFrame } from "@/lib/alkagi-physics";
import { calculateSlopeFromPoints } from "@/lib/alkagi-physics";

type Props = {
  stones: AlkagiStone[];
  selectedStoneId: string | null;
  turn: AlkagiStoneColor | null;
  myColor: AlkagiStoneColor | null;
  slope: number | null;
  isVertical: boolean;
  disabled?: boolean;
  showGuideLine?: boolean;
  animFrames?: SimulationFrame[] | null;
  onSelectStone: (stone: AlkagiStone) => void;
  onAimSlopeChange: (slope: number | null, isVertical: boolean) => void;
  onAnimationComplete?: () => void;
};

type RenderStone = {
  id: string;
  color: AlkagiStoneColor;
  x: number;
  y: number;
  alive: boolean;
  opacity: number;
  scale: number;
};

type Spark = {
  id: string;
  x: number;
  y: number;
  startTime: number;
};

export default function AlkagiBoard({
  stones,
  selectedStoneId,
  turn,
  myColor,
  slope,
  isVertical,
  disabled = false,
  showGuideLine = true,
  animFrames = null,
  onSelectStone,
  onAimSlopeChange,
  onAnimationComplete,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [animatedStones, setAnimatedStones] = useState<RenderStone[] | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const isDraggingAimRef = useRef(false);

  const activeStones: RenderStone[] =
    animFrames && animFrames.length > 0 && animatedStones
      ? animatedStones
      : stones.map((s) => ({
          id: s.id,
          color: s.color,
          x: s.x,
          y: s.y,
          alive: s.alive,
          opacity: 1,
          scale: 1,
        }));

  // Handle animation frames playback
  useEffect(() => {
    if (!animFrames || animFrames.length === 0) return;

    let frameIndex = 0;
    let animId: number;
    const startTime = performance.now();
    const duration = animFrames[animFrames.length - 1]!.t * 1000;

    const play = (now: number) => {
      const elapsed = (now - startTime) / 1000;

      // Find frame matching elapsed time
      while (
        frameIndex < animFrames.length - 1 &&
        animFrames[frameIndex + 1]!.t <= elapsed
      ) {
        frameIndex++;
        // Check collisions for sparks
        const cur = animFrames[frameIndex]!;
        if (cur.collisions && cur.collisions.length > 0) {
          setSparks((prev) => [
            ...prev,
            ...cur.collisions!.map((c) => ({
              id: `sp-${c.x}-${c.y}-${Math.random()}`,
              x: c.x,
              y: c.y,
              startTime: performance.now(),
            })),
          ]);
        }
      }

      const curFrame = animFrames[frameIndex]!;
      // Map to render stones
      const updated: RenderStone[] = curFrame.stones.map((fs) => {
        const base = stones.find((s) => s.id === fs.id);
        return {
          id: fs.id,
          color: base?.color ?? "black",
          x: fs.x,
          y: fs.y,
          alive: fs.alive,
          opacity: fs.opacity ?? 1,
          scale: fs.scale ?? 1,
        };
      });
      setAnimatedStones(updated);

      if (elapsed * 1000 >= duration || frameIndex >= animFrames.length - 1) {
        setAnimatedStones(null);
        onAnimationComplete?.();
      } else {
        animId = requestAnimationFrame(play);
      }
    };

    animId = requestAnimationFrame(play);

    return () => cancelAnimationFrame(animId);
  }, [animFrames, stones, onAnimationComplete]);

  // Clean old sparks
  useEffect(() => {
    if (sparks.length === 0) return;
    const timer = setTimeout(() => {
      const now = performance.now();
      setSparks((prev) => prev.filter((s) => now - s.startTime < 400));
    }, 100);
    return () => clearTimeout(timer);
  }, [sparks]);

  // Board coordinate math
  // Board space: x, y in [-8, 8]
  const PAD = 36;
  const CELL = 28; // pixels per unit
  const SPAN = ALKAGI_BOUND * 2; // 16 units
  const SIZE = PAD * 2 + SPAN * CELL; // 36*2 + 16*28 = 520px

  const toSvgX = (x: number) => PAD + (x + ALKAGI_BOUND) * CELL;
  const toSvgY = (y: number) => PAD + (ALKAGI_BOUND - y) * CELL;

  const fromSvgCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return null;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = SIZE / rect.width;
      const scaleY = SIZE / rect.height;
      const svgX = (clientX - rect.left) * scaleX;
      const svgY = (clientY - rect.top) * scaleY;

      const gridX = (svgX - PAD) / CELL - ALKAGI_BOUND;
      const gridY = ALKAGI_BOUND - (svgY - PAD) / CELL;
      return { x: gridX, y: gridY };
    },
    [SIZE, PAD, CELL],
  );

  const selectedStone = activeStones.find((s) => s.id === selectedStoneId);

  // Line of slope through selectedStone
  let lineP1 = { x: 0, y: 0 };
  let lineP2 = { x: 0, y: 0 };
  if (selectedStone) {
    if (isVertical) {
      lineP1 = { x: toSvgX(selectedStone.x), y: toSvgY(-ALKAGI_BOUND) };
      lineP2 = { x: toSvgX(selectedStone.x), y: toSvgY(ALKAGI_BOUND) };
    } else {
      const m = slope ?? 0;
      // y = m(x - x0) + y0
      const xLeft = -ALKAGI_BOUND;
      const yLeft = m * (xLeft - selectedStone.x) + selectedStone.y;
      const xRight = ALKAGI_BOUND;
      const yRight = m * (xRight - selectedStone.x) + selectedStone.y;
      lineP1 = { x: toSvgX(xLeft), y: toSvgY(yLeft) };
      lineP2 = { x: toSvgX(xRight), y: toSvgY(yRight) };
    }
  }

  // Pointer drag aiming on the board (only when guide line is enabled)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || !selectedStone || turn !== myColor || !showGuideLine) return;
    isDraggingAimRef.current = true;
    const pt = fromSvgCoords(e.clientX, e.clientY);
    if (pt) {
      const aim = calculateSlopeFromPoints(selectedStone, pt);
      onAimSlopeChange(aim.slope, aim.isVertical);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingAimRef.current || disabled || !selectedStone || !showGuideLine) return;
    const pt = fromSvgCoords(e.clientX, e.clientY);
    if (pt) {
      const aim = calculateSlopeFromPoints(selectedStone, pt);
      onAimSlopeChange(aim.slope, aim.isVertical);
    }
  };

  const handlePointerUp = () => {
    isDraggingAimRef.current = false;
  };

  // Generate grid lines
  const gridIndices: number[] = [];
  for (let i = -ALKAGI_BOUND; i <= ALKAGI_BOUND; i++) gridIndices.push(i);

  const isMyTurn = turn === myColor && !disabled;

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-amber-50/50 p-2 sm:p-4 ring-1 ring-wood/10 shadow-inner">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto block h-auto w-full max-w-[560px] touch-none select-none drop-shadow-sm"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          {/* Board surface gradient */}
          <radialGradient id="boardSurface" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#FFFDF9" />
            <stop offset="70%" stopColor="#F8EFE4" />
            <stop offset="100%" stopColor="#EFE3D3" />
          </radialGradient>

          {/* Black stone 3D gradient */}
          <radialGradient id="blackStoneGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#555555" />
            <stop offset="40%" stopColor="#222222" />
            <stop offset="100%" stopColor="#0B0B0B" />
          </radialGradient>

          {/* White stone 3D gradient */}
          <radialGradient id="whiteStoneGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#F5F5F7" />
            <stop offset="100%" stopColor="#D5D8DC" />
          </radialGradient>

          {/* Spark gradient */}
          <radialGradient id="sparkGrad">
            <stop offset="0%" stopColor="#FFE066" stopOpacity="1" />
            <stop offset="60%" stopColor="#FF6B6B" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0" />
          </radialGradient>

          <filter id="stoneShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="1.5"
              dy="2.5"
              stdDeviation="2"
              floodColor="#2A1B0E"
              floodOpacity="0.35"
            />
          </filter>
        </defs>

        {/* Board Background */}
        <rect
          x={PAD - 12}
          y={PAD - 12}
          width={SPAN * CELL + 24}
          height={SPAN * CELL + 24}
          rx={20}
          fill="url(#boardSurface)"
          stroke="#8B5E3C"
          strokeWidth={3}
        />

        {/* Out-of-bounds safety boundary line */}
        <rect
          x={PAD}
          y={PAD}
          width={SPAN * CELL}
          height={SPAN * CELL}
          rx={8}
          fill="none"
          stroke="#8B5E3C40"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />

        {/* Grid lines */}
        {gridIndices.map((i) => {
          const isAxis = i === 0;
          const stroke = isAxis ? "#8B5E3C" : "#8B5E3C25";
          const strokeWidth = isAxis ? 2 : 0.8;

          const vx = toSvgX(i);
          const hy = toSvgY(i);

          return (
            <g key={`grid-${i}`}>
              {/* Vertical line */}
              <line
                x1={vx}
                y1={PAD}
                x2={vx}
                y2={SIZE - PAD}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />
              {/* Horizontal line */}
              <line
                x1={PAD}
                y1={hy}
                x2={SIZE - PAD}
                y2={hy}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />

              {/* Tick numbers on axes */}
              {i !== 0 && i % 2 === 0 ? (
                <>
                  {/* x numbers */}
                  <text
                    x={vx}
                    y={toSvgY(0) + 12}
                    textAnchor="middle"
                    className="fill-wood/60 text-[9px] font-bold font-mono"
                  >
                    {i}
                  </text>
                  {/* y numbers */}
                  <text
                    x={toSvgX(0) - 5}
                    y={hy + 3}
                    textAnchor="end"
                    className="fill-wood/60 text-[9px] font-bold font-mono"
                  >
                    {i}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}

        {/* Origin (0,0) label */}
        <text
          x={toSvgX(0) - 4}
          y={toSvgY(0) + 12}
          textAnchor="end"
          className="fill-wood/60 text-[9px] font-bold font-mono"
        >
          O
        </text>

        {/* Axis labels */}
        <text
          x={SIZE - PAD + 10}
          y={toSvgY(0) + 4}
          textAnchor="start"
          className="fill-wood text-[11px] font-black italic"
        >
          x
        </text>
        <text
          x={toSvgX(0)}
          y={PAD - 12}
          textAnchor="middle"
          className="fill-wood text-[11px] font-black italic"
        >
          y
        </text>

        {/* Slope Trajectory Line passing through selected stone (only on first turn) */}
        {selectedStone && showGuideLine && (
          <g className="pointer-events-none">
            {/* Clip path inside board */}
            <clipPath id="boardClip">
              <rect
                x={PAD}
                y={PAD}
                width={SPAN * CELL}
                height={SPAN * CELL}
              />
            </clipPath>

            <g clipPath="url(#boardClip)">
              {/* Glow line */}
              <line
                x1={lineP1.x}
                y1={lineP1.y}
                x2={lineP2.x}
                y2={lineP2.y}
                stroke="#F59E0B"
                strokeWidth={5}
                strokeOpacity={0.4}
              />
              {/* Sharp dashed trajectory */}
              <line
                x1={lineP1.x}
                y1={lineP1.y}
                x2={lineP2.x}
                y2={lineP2.y}
                stroke="#D97706"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            </g>
          </g>
        )}

        {/* Stones */}
        {activeStones.map((stone) => {
          if (!stone.alive && stone.opacity <= 0) return null;

          const cx = toSvgX(stone.x);
          const cy = toSvgY(stone.y);
          const r = ALKAGI_STONE_RADIUS * CELL * (stone.scale ?? 1);
          const isSelected = stone.id === selectedStoneId;
          const isMine = stone.color === myColor;
          const canSelect = isMyTurn && isMine && stone.alive;

          return (
            <g
              key={stone.id}
              opacity={stone.opacity ?? 1}
              className={canSelect ? "cursor-pointer" : "cursor-default"}
              onClick={(e) => {
                if (canSelect) {
                  e.stopPropagation();
                  onSelectStone(stone);
                }
              }}
            >
              <title>{`${stone.color === "black" ? "흑돌" : "백돌"} (${Math.round(stone.x * 10) / 10}, ${Math.round(stone.y * 10) / 10})`}</title>
              {/* Selection pulse ring */}
              {isSelected && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + 5}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                  className="animate-pulse"
                />
              )}

              {/* Baduk stone body with 3D gradient */}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={
                  stone.color === "black"
                    ? "url(#blackStoneGrad)"
                    : "url(#whiteStoneGrad)"
                }
                filter="url(#stoneShadow)"
                stroke={stone.color === "white" ? "#C2C5C9" : "#1A1A1A"}
                strokeWidth={0.8}
              />

              {/* Inner glossy reflection dot */}
              <circle
                cx={cx - r * 0.3}
                cy={cy - r * 0.35}
                r={r * 0.28}
                fill="#FFFFFF"
                opacity={stone.color === "black" ? 0.3 : 0.6}
              />
            </g>
          );
        })}

        {/* Collision Sparks */}
        {sparks.map((sp) => {
          const cx = toSvgX(sp.x);
          const cy = toSvgY(sp.y);
          return (
            <g key={sp.id} className="pointer-events-none animate-ping">
              <circle cx={cx} cy={cy} r={18} fill="url(#sparkGrad)" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
