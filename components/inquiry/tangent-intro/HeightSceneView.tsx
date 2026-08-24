"use client";

import { useCallback, useRef, type ReactNode } from "react";
import {
  HEIGHT_SCENE_GROUND_LINE_END,
  HEIGHT_SCENE_GROUND_Y,
  HEIGHT_SCENE_OBJECT_FACE_X,
  HEIGHT_SCENE_VB_H,
  HEIGHT_SCENE_VB_W,
  distanceFromSceneX,
  getHeightSceneLayout,
  type HeightScene,
} from "@/lib/inquiry-tangent-intro";

const BUILDING_W = 78;
const BUILDING_ROOF_H = 14;
/** Unscaled art height (ground to roof/peak). Scaled to match heightPx. */
const DESIGN_H: Record<HeightScene["id"], number> = {
  building: 148 + BUILDING_ROOF_H,
  tree: 118,
  lighthouse: 162,
};

type Props = {
  scene: HeightScene;
  distanceM: number;
  onDistanceChange: (d: number) => void;
  locked?: boolean;
};

function Building({ faceX, groundY, bodyH }: { faceX: number; groundY: number; bodyH: number }) {
  const bodyTop = groundY - bodyH;
  const roofTop = bodyTop - BUILDING_ROOF_H;
  const w = BUILDING_W;
  return (
    <g>
      <rect x={faceX} y={bodyTop} width={w} height={bodyH} rx={3} fill="#c9b8e8" stroke="#6b4a9e" strokeWidth={2} />
      <rect
        x={faceX}
        y={roofTop}
        width={w + 8}
        height={BUILDING_ROOF_H + 3}
        fill="#8b6cc4"
        stroke="#5a3d8a"
        strokeWidth={1.5}
      />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={faceX + 10 + col * 22}
            y={bodyTop + 18 + row * 36}
            width={14}
            height={18}
            rx={2}
            fill="#fff6c8"
            stroke="#6b4a9e"
            strokeWidth={1}
          />
        )),
      )}
      <rect x={faceX + w / 2 - 10} y={groundY - 28} width={20} height={28} rx={2} fill="#6b4a9e" />
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

function ScaledObject({
  faceX,
  groundY,
  designH,
  heightPx,
  children,
}: {
  faceX: number;
  groundY: number;
  designH: number;
  heightPx: number;
  children: ReactNode;
}) {
  const s = designH <= 0 ? 1 : heightPx / designH;
  return (
    <g transform={`translate(${faceX} ${groundY}) scale(${s}) translate(${-faceX} ${-groundY})`}>
      {children}
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

  const layout = getHeightSceneLayout(scene, distanceM);
  const {
    observerX,
    faceX,
    topX,
    topY,
    groundY,
    heightPx,
    distancePx,
    visualAngleDeg,
    displayedAngleDeg,
    distanceM: d,
  } = layout;
  const mid = observerX + distancePx / 2;
  const designH = DESIGN_H[scene.id];

  const setFromClientX = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * HEIGHT_SCENE_VB_W;
      onDistanceChange(distanceFromSceneX(scene, x));
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

  const losLen = Math.hypot(distancePx, heightPx);
  const angRad = (visualAngleDeg * Math.PI) / 180;
  const arcR = Math.min(54, Math.max(28, losLen * 0.3));
  const arcEndX = observerX + arcR * Math.cos(angRad);
  const arcEndY = groundY - arcR * Math.sin(angRad);
  const halfAngRad = angRad / 2;
  const labelR = arcR + 16;
  const labelX = observerX + labelR * Math.cos(halfAngRad);
  const labelY = groundY - labelR * Math.sin(halfAngRad);
  const ra = Math.min(14, heightPx * 0.14, distancePx * 0.12);

  return (
    <div className="select-none overflow-hidden rounded-2xl border-2 border-wood/15 bg-gradient-to-b from-[#d7efff] to-[#fef9f0]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${HEIGHT_SCENE_VB_W} ${HEIGHT_SCENE_VB_H}`}
        className={`block h-auto w-full touch-none select-none ${locked ? "cursor-default" : "cursor-ew-resize"}`}
        role="img"
        aria-label={`${scene.title} 높이 재기. 거리 ${d}미터, 각 ${displayedAngleDeg}도`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <rect width={HEIGHT_SCENE_VB_W} height={HEIGHT_SCENE_VB_H} fill="transparent" />
        <circle cx={70} cy={42} r={18} fill="#ffe08a" opacity={0.9} />
        <ellipse cx={120} cy={50} rx={28} ry={12} fill="white" opacity={0.7} />
        <ellipse cx={138} cy={54} rx={18} ry={10} fill="white" opacity={0.65} />

        {scene.id === "lighthouse" ? (
          <rect x={0} y={groundY} width={HEIGHT_SCENE_VB_W} height={HEIGHT_SCENE_VB_H - groundY} fill="#b8dff0" />
        ) : (
          <rect x={0} y={groundY} width={HEIGHT_SCENE_VB_W} height={HEIGHT_SCENE_VB_H - groundY} fill="#c8e6b0" />
        )}
        {scene.id === "lighthouse" ? (
          <path
            d={`M ${faceX - 36} ${groundY} Q ${faceX + 12} ${groundY + 8} ${faceX + 50} ${groundY}`}
            fill="#7ec8e8"
            opacity={0.55}
          />
        ) : null}
        <line
          x1={16}
          y1={groundY}
          x2={HEIGHT_SCENE_GROUND_LINE_END}
          y2={groundY}
          stroke="#8B5E3C"
          strokeWidth={3}
        />

        <ScaledObject faceX={faceX} groundY={groundY} designH={designH} heightPx={heightPx}>
          {scene.id === "building" ? (
            <Building faceX={HEIGHT_SCENE_OBJECT_FACE_X} groundY={HEIGHT_SCENE_GROUND_Y} bodyH={148} />
          ) : scene.id === "tree" ? (
            <Tree baseX={HEIGHT_SCENE_OBJECT_FACE_X} groundY={HEIGHT_SCENE_GROUND_Y} h={DESIGN_H.tree} />
          ) : (
            <Lighthouse
              baseX={HEIGHT_SCENE_OBJECT_FACE_X + 22}
              groundY={HEIGHT_SCENE_GROUND_Y}
              h={DESIGN_H.lighthouse}
            />
          )}
        </ScaledObject>

        <polygon
          points={`${observerX},${groundY} ${faceX},${groundY} ${topX},${topY}`}
          fill="#5a3d8a"
          opacity={0.08}
        />
        <line
          x1={faceX}
          y1={groundY}
          x2={topX}
          y2={topY}
          stroke="#5a3d8a"
          strokeWidth={1.8}
        />
        <path
          d={`M ${faceX - ra} ${groundY} L ${faceX - ra} ${groundY - ra} L ${faceX} ${groundY - ra}`}
          fill="none"
          stroke="#5a3d8a"
          strokeWidth={1.6}
        />

        <line
          x1={observerX}
          y1={groundY}
          x2={topX}
          y2={topY}
          stroke="#5a3d8a"
          strokeWidth={2.2}
          strokeDasharray="6 5"
        />
        <path
          d={`M ${observerX} ${groundY} L ${observerX + arcR} ${groundY} A ${arcR} ${arcR} 0 0 0 ${arcEndX} ${arcEndY} Z`}
          fill="#e85d4c"
          opacity={0.18}
        />
        <path
          d={`M ${observerX + arcR} ${groundY} A ${arcR} ${arcR} 0 0 0 ${arcEndX} ${arcEndY}`}
          fill="none"
          stroke="#e85d4c"
          strokeWidth={2.4}
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
          {displayedAngleDeg}°
        </text>

        <line
          x1={observerX}
          y1={groundY + 10}
          x2={faceX}
          y2={groundY + 10}
          stroke="#8B5E3C"
          strokeWidth={1.6}
        />
        <polyline
          points={`${observerX},${groundY + 6} ${observerX},${groundY + 14}`}
          stroke="#8B5E3C"
          strokeWidth={1.6}
        />
        <polyline
          points={`${faceX},${groundY + 6} ${faceX},${groundY + 14}`}
          stroke="#8B5E3C"
          strokeWidth={1.6}
        />
        <text
          x={mid}
          y={groundY + 28}
          textAnchor="middle"
          fill="#6b4423"
          fontSize={14}
          fontWeight={800}
          className="pointer-events-none select-none"
        >
          {d} m
        </text>

        <circle cx={observerX} cy={groundY} r={5} fill="#e85d4c" stroke="#fff" strokeWidth={1.5} />
        <circle cx={topX} cy={topY} r={4} fill="#5a3d8a" stroke="#fff" strokeWidth={1.4} />
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-wood/10 bg-cream/80 px-3 py-2.5">
        <span className="rounded-xl bg-sky/50 px-3 py-1 text-sm font-bold tabular-nums text-wood">
          거리 {d} m
        </span>
        <span className="rounded-xl bg-[#e85d4c]/15 px-3 py-1 text-sm font-bold tabular-nums text-[#a63a1a]">
          각 {displayedAngleDeg}°
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
