"use client";

import { useCallback, useRef } from "react";
import {
  clampDistance,
  elevationAngleDeg,
  type HeightScene,
} from "@/lib/inquiry-tangent-intro";

const VB_W = 440;
const VB_H = 268;
const GROUND_Y = 214;
const OBJ_BASE_X = 352;
const LEFT_X = 40;
const CLOSE_GAP = 42;

const VISUAL_H: Record<HeightScene["id"], number> = {
  building: 148,
  tree: 118,
  lighthouse: 162,
};

type Props = {
  scene: HeightScene;
  distanceM: number;
  onDistanceChange: (d: number) => void;
  locked?: boolean;
};

function observerXFor(scene: HeightScene, distanceM: number): number {
  const d = clampDistance(scene, distanceM);
  const closestX = OBJ_BASE_X - CLOSE_GAP;
  const span = scene.maxDistanceM - scene.minDistanceM;
  const t = span <= 0 ? 0 : (d - scene.minDistanceM) / span;
  return closestX - t * (closestX - LEFT_X);
}

function distanceForX(scene: HeightScene, x: number): number {
  const closestX = OBJ_BASE_X - CLOSE_GAP;
  const spanPx = closestX - LEFT_X;
  const t = spanPx <= 0 ? 0 : (closestX - x) / spanPx;
  const d = scene.minDistanceM + t * (scene.maxDistanceM - scene.minDistanceM);
  return clampDistance(scene, d);
}

function Building({ baseX, groundY, h }: { baseX: number; groundY: number; h: number }) {
  const top = groundY - h;
  const w = 78;
  const x = baseX - w + 8;
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} rx={4} fill="#c9b8e8" stroke="#6b4a9e" strokeWidth={2} />
      <rect x={x - 6} y={top - 14} width={w + 12} height={16} rx={3} fill="#8b6cc4" stroke="#5a3d8a" strokeWidth={1.5} />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={x + 10 + col * 22}
            y={top + 18 + row * 36}
            width={14}
            height={18}
            rx={2}
            fill="#fff6c8"
            stroke="#6b4a9e"
            strokeWidth={1}
          />
        )),
      )}
      <rect x={x + w / 2 - 10} y={groundY - 28} width={20} height={28} rx={2} fill="#6b4a9e" />
    </g>
  );
}

function Tree({ baseX, groundY, h }: { baseX: number; groundY: number; h: number }) {
  const top = groundY - h;
  return (
    <g>
      <rect x={baseX - 9} y={groundY - h * 0.38} width={16} height={h * 0.38} rx={3} fill="#8B5E3C" />
      <ellipse cx={baseX - 2} cy={top + 38} rx={36} ry={32} fill="#5aae72" />
      <ellipse cx={baseX + 16} cy={top + 48} rx={28} ry={26} fill="#4c9a62" />
      <ellipse cx={baseX - 18} cy={top + 52} rx={26} ry={24} fill="#6bc07f" />
      <circle cx={baseX + 4} cy={top + 22} r={22} fill="#57b56e" />
    </g>
  );
}

function Lighthouse({ baseX, groundY, h }: { baseX: number; groundY: number; h: number }) {
  const top = groundY - h;
  return (
    <g>
      <path d={`M ${baseX - 36} ${groundY} Q ${baseX - 10} ${groundY + 8} ${baseX + 28} ${groundY}`} fill="#7ec8e8" opacity={0.55} />
      <polygon
        points={`${baseX - 22},${groundY} ${baseX + 18},${groundY} ${baseX + 12},${top + 28} ${baseX - 16},${top + 28}`}
        fill="#f4efe4"
        stroke="#8B5E3C"
        strokeWidth={1.6}
      />
      {[0, 1, 2].map((i) => (
        <polygon
          key={i}
          points={`${baseX - 20 + i * 1.4},${groundY - 18 - i * 42} ${baseX + 16 - i * 1.4},${groundY - 18 - i * 42} ${baseX + 14 - i * 1.4},${groundY - 42 - i * 42} ${baseX - 18 + i * 1.4},${groundY - 42 - i * 42}`}
          fill={i % 2 === 0 ? "#e85d4c" : "#f4efe4"}
          opacity={0.92}
        />
      ))}
      <rect x={baseX - 18} y={top + 10} width={32} height={20} rx={3} fill="#d4c4ff" stroke="#6b4a9e" strokeWidth={1.4} />
      <rect x={baseX - 22} y={top} width={40} height={12} rx={2} fill="#8B5E3C" />
      <circle cx={baseX - 2} cy={top + 20} r={5} fill="#ffd76a" />
    </g>
  );
}

export default function HeightSceneView({
  scene,
  distanceM,
  onDistanceChange,
  locked = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);

  const d = clampDistance(scene, distanceM);
  const angle = elevationAngleDeg(scene.heightM, d);
  const groundX = observerXFor(scene, d);
  const visualH = VISUAL_H[scene.id];
  const topX = OBJ_BASE_X - 8;
  const topY = GROUND_Y - visualH;
  const mid = groundX + (OBJ_BASE_X - groundX) / 2;

  const setFromClientX = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * VB_W;
      onDistanceChange(distanceForX(scene, x));
    },
    [onDistanceChange, scene],
  );

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (locked) return;
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current || locked) return;
    e.preventDefault();
    setFromClientX(e.clientX);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const losLen = Math.hypot(topX - groundX, topY - GROUND_Y);
  const arcR = Math.min(46, losLen * 0.28);
  const angRad = (angle * Math.PI) / 180;
  const arcEndX = groundX + arcR * Math.cos(angRad);
  const arcEndY = GROUND_Y - arcR * Math.sin(angRad);
  const halfAngRad = angRad / 2;
  const labelR = arcR + 14;
  const labelX = groundX + labelR * Math.cos(halfAngRad);
  const labelY = GROUND_Y - labelR * Math.sin(halfAngRad);

  return (
    <div className="select-none overflow-hidden rounded-2xl border-2 border-wood/15 bg-gradient-to-b from-[#d7efff] to-[#fef9f0]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={`block h-auto w-full touch-none select-none ${locked ? "cursor-default" : "cursor-ew-resize"}`}
        role="img"
        aria-label={`${scene.title} 높이 재기. 거리 ${d}미터, 각 ${angle}도`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <rect width={VB_W} height={VB_H} fill="transparent" />
        <circle cx={70} cy={42} r={18} fill="#ffe08a" opacity={0.9} />
        <ellipse cx={120} cy={50} rx={28} ry={12} fill="white" opacity={0.7} />
        <ellipse cx={138} cy={54} rx={18} ry={10} fill="white" opacity={0.65} />

        {scene.id === "lighthouse" ? (
          <rect x={0} y={GROUND_Y} width={VB_W} height={VB_H - GROUND_Y} fill="#b8dff0" />
        ) : (
          <rect x={0} y={GROUND_Y} width={VB_W} height={VB_H - GROUND_Y} fill="#c8e6b0" />
        )}
        <line x1={16} y1={GROUND_Y} x2={424} y2={GROUND_Y} stroke="#8B5E3C" strokeWidth={3} />

        {scene.id === "building" ? (
          <Building baseX={OBJ_BASE_X} groundY={GROUND_Y} h={visualH} />
        ) : scene.id === "tree" ? (
          <Tree baseX={OBJ_BASE_X} groundY={GROUND_Y} h={visualH} />
        ) : (
          <Lighthouse baseX={OBJ_BASE_X} groundY={GROUND_Y} h={visualH} />
        )}

        <line
          x1={groundX}
          y1={GROUND_Y}
          x2={topX}
          y2={topY}
          stroke="#5a3d8a"
          strokeWidth={2}
          strokeDasharray="6 5"
        />
        <path
          d={`M ${groundX + arcR} ${GROUND_Y} A ${arcR} ${arcR} 0 0 0 ${arcEndX} ${arcEndY}`}
          fill="none"
          stroke="#e85d4c"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#a63a1a"
          fontSize={15}
          fontWeight={800}
          className="pointer-events-none select-none"
        >
          {angle}°
        </text>

        <line x1={groundX} y1={GROUND_Y + 10} x2={OBJ_BASE_X} y2={GROUND_Y + 10} stroke="#8B5E3C" strokeWidth={1.6} />
        <polyline points={`${groundX},${GROUND_Y + 6} ${groundX},${GROUND_Y + 14}`} stroke="#8B5E3C" strokeWidth={1.6} />
        <polyline points={`${OBJ_BASE_X},${GROUND_Y + 6} ${OBJ_BASE_X},${GROUND_Y + 14}`} stroke="#8B5E3C" strokeWidth={1.6} />
        <text
          x={mid}
          y={GROUND_Y + 28}
          textAnchor="middle"
          fill="#6b4423"
          fontSize={14}
          fontWeight={800}
          className="pointer-events-none select-none"
        >
          {d} m
        </text>

        <circle cx={groundX} cy={GROUND_Y} r={5} fill="#e85d4c" stroke="#fff" strokeWidth={1.5} />
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-wood/10 bg-cream/80 px-3 py-2.5">
        <span className="rounded-xl bg-sky/50 px-3 py-1 text-sm font-bold tabular-nums text-wood">
          거리 {d} m
        </span>
        <span className="rounded-xl bg-[#e85d4c]/15 px-3 py-1 text-sm font-bold tabular-nums text-[#a63a1a]">
          각 {angle}°
        </span>
        {!locked ? (
          <span className="text-xs font-semibold text-foreground/55">
            땅 위를 눌러 관찰 위치를 옮기세요
          </span>
        ) : null}
      </div>
    </div>
  );
}
