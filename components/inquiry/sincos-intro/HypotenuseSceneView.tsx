"use client";

import { useCallback, useRef } from "react";
import {
  clampAngle,
  clampBaseT,
  type HypScene,
} from "@/lib/inquiry-sincos-intro";
import { clientToSvgUser } from "@/lib/svg-pointer";

const VB_W = 440;
const VB_H = 276;
const GROUND_Y = 220;
const LEFT_X = 48;
const RIGHT_X = 400;

type DragKind = "base" | "tip";

type Props = {
  scene: HypScene;
  angleDeg: number;
  baseT: number;
  onChange: (next: { angleDeg: number; baseT: number }) => void;
  locked?: boolean;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clientToVb(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  return clientToSvgUser(svg, clientX, clientY) ?? { x: 0, y: 0 };
}

function KiteArt({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const w = 22 * s;
  const h = 28 * s;
  return (
    <g>
      <polygon
        points={`${x},${y - h} ${x + w},${y} ${x},${y + h * 0.55} ${x - w},${y}`}
        fill="#e85d4c"
        stroke="#8B5E3C"
        strokeWidth={1.6}
      />
      <line x1={x} y1={y - h} x2={x} y2={y + h * 0.55} stroke="#fff6c8" strokeWidth={1.2} />
      <line x1={x - w} y1={y} x2={x + w} y2={y} stroke="#fff6c8" strokeWidth={1.2} />
      <path
        d={`M ${x} ${y + h * 0.55} q ${8 * s} ${14 * s} ${-2 * s} ${22 * s}`}
        fill="none"
        stroke="#6b4a9e"
        strokeWidth={1.4}
      />
    </g>
  );
}

function Person({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y - 28} r={7} fill="#f4d7b5" stroke="#8B5E3C" strokeWidth={1.3} />
      <line x1={x} y1={y - 21} x2={x} y2={y - 8} stroke="#5a3d8a" strokeWidth={2.4} strokeLinecap="round" />
      <line x1={x} y1={y - 16} x2={x + 10} y2={y - 10} stroke="#5a3d8a" strokeWidth={2.2} strokeLinecap="round" />
      <line x1={x} y1={y - 16} x2={x - 8} y2={y - 6} stroke="#5a3d8a" strokeWidth={2.2} strokeLinecap="round" />
      <line x1={x} y1={y - 8} x2={x - 6} y2={y} stroke="#8B5E3C" strokeWidth={2.2} strokeLinecap="round" />
      <line x1={x} y1={y - 8} x2={x + 7} y2={y} stroke="#8B5E3C" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  );
}

function Wall({ x, groundY }: { x: number; groundY: number }) {
  return (
    <g>
      <rect x={x} y={36} width={28} height={groundY - 36} fill="#d7c4f0" stroke="#6b4a9e" strokeWidth={1.6} />
      {[0, 1, 2, 3].map((row) =>
        [0, 1].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={x + 5 + col * 11}
            y={48 + row * 38}
            width={8}
            height={12}
            rx={1}
            fill="#fff6c8"
            stroke="#6b4a9e"
            strokeWidth={0.8}
          />
        )),
      )}
    </g>
  );
}

function TabletBody({
  hingeX,
  hingeY,
  angRad,
  len,
}: {
  hingeX: number;
  hingeY: number;
  angRad: number;
  len: number;
}) {
  const ux = Math.cos(angRad);
  const uy = -Math.sin(angRad);
  const px = -uy;
  const py = ux;
  const tabletLength = 52;
  const tabletWidth = 18;
  const lift = 16;
  const gap = 4;
  const start = {
    x: hingeX + ux * (len - tabletLength - 2) - px * lift,
    y: hingeY + uy * (len - tabletLength - 2) - py * lift,
  };
  const end = {
    x: start.x + ux * tabletLength,
    y: start.y + uy * tabletLength,
  };
  const topLeft = {
    x: start.x - px * (tabletWidth / 2),
    y: start.y - py * (tabletWidth / 2),
  };
  const topRight = {
    x: end.x - px * (tabletWidth / 2),
    y: end.y - py * (tabletWidth / 2),
  };
  const bottomLeft = {
    x: start.x + px * (tabletWidth / 2),
    y: start.y + py * (tabletWidth / 2),
  };
  const bottomRight = {
    x: end.x + px * (tabletWidth / 2),
    y: end.y + py * (tabletWidth / 2),
  };
  const supportNear = {
    x: hingeX + ux * (len - tabletLength - 6),
    y: hingeY + uy * (len - tabletLength - 6),
  };
  const supportFar = {
    x: hingeX + ux * (len - 10),
    y: hingeY + uy * (len - 10),
  };
  const supportTopNear = {
    x: supportNear.x - px * (lift - gap),
    y: supportNear.y - py * (lift - gap),
  };
  const supportTopFar = {
    x: supportFar.x - px * (lift - gap),
    y: supportFar.y - py * (lift - gap),
  };
  const lipOuter = {
    x: hingeX + ux * (len - tabletLength + 1) - px * (lift - 2),
    y: hingeY + uy * (len - tabletLength + 1) - py * (lift - 2),
  };
  const lipInner = {
    x: lipOuter.x + ux * 10,
    y: lipOuter.y + uy * 10,
  };
  const homeButton = {
    x: start.x + ux * (tabletLength * 0.12),
    y: start.y + uy * (tabletLength * 0.12),
  };
  return (
    <g>
      <line
        x1={hingeX}
        y1={hingeY}
        x2={supportNear.x}
        y2={supportNear.y}
        stroke="#694733"
        strokeWidth={4.4}
        strokeLinecap="round"
      />
      <line
        x1={supportTopNear.x}
        y1={supportTopNear.y}
        x2={supportTopFar.x}
        y2={supportTopFar.y}
        stroke="#8c6547"
        strokeWidth={5.2}
        strokeLinecap="round"
      />
      <line
        x1={supportNear.x}
        y1={supportNear.y}
        x2={supportTopNear.x}
        y2={supportTopNear.y}
        stroke="#7b563d"
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      <ellipse
        cx={(start.x + end.x) / 2 + px * 7}
        cy={(start.y + end.y) / 2 + py * 7}
        rx={26}
        ry={9}
        fill="#000"
        opacity={0.12}
        transform={`rotate(${(-angRad * 180) / Math.PI} ${(start.x + end.x) / 2 + px * 7} ${(start.y + end.y) / 2 + py * 7})`}
      />
      <polygon
        points={`${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`}
        fill="#44529b"
        stroke="#24306b"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <polygon
        points={`${topLeft.x + ux * 5 + px * 2},${topLeft.y + uy * 5 + py * 2} ${topRight.x - ux * 5 + px * 2},${topRight.y - uy * 5 + py * 2} ${bottomRight.x - ux * 5 - px * 2},${bottomRight.y - uy * 5 - py * 2} ${bottomLeft.x + ux * 5 - px * 2},${bottomLeft.y + uy * 5 - py * 2}`}
        fill="#a8defe"
        opacity={0.92}
      />
      <line
        x1={topLeft.x}
        y1={topLeft.y}
        x2={topRight.x}
        y2={topRight.y}
        stroke="#8895d4"
        strokeWidth={1}
        opacity={0.7}
      />
      <circle
        cx={homeButton.x}
        cy={homeButton.y}
        r={1.7}
        fill="#d6e7ff"
        opacity={0.95}
      />
      <line
        x1={lipOuter.x}
        y1={lipOuter.y}
        x2={lipInner.x}
        y2={lipInner.y}
        stroke="#6f4e3c"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </g>
  );
}

export default function HypotenuseSceneView({
  scene,
  angleDeg,
  baseT,
  onChange,
  locked = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragKind | null>(null);

  const angle = clampAngle(scene, angleDeg);
  const t = clampBaseT(baseT);
  const angRad = (angle * Math.PI) / 180;

  const visR =
    scene.id === "ladder" ? 168 : scene.id === "tablet" ? 132 : 150;
  const wallX = 372;

  let baseX: number;
  let baseY = GROUND_Y;
  let tipX: number;
  let tipY: number;

  if (scene.id === "ladder") {
    const run = visR * Math.cos(angRad);
    const rise = visR * Math.sin(angRad);
    tipX = wallX;
    tipY = GROUND_Y - rise;
    baseX = wallX - run;
    baseY = GROUND_Y;
  } else {
    const minX = LEFT_X;
    const maxX =
      scene.id === "tablet"
        ? 210
        : RIGHT_X - visR * Math.cos((scene.minAngleDeg * Math.PI) / 180) - 24;
    baseX = lerp(minX, maxX, t);
    tipX = baseX + visR * Math.cos(angRad);
    tipY = GROUND_Y - visR * Math.sin(angRad);
  }

  const footX = scene.id === "ladder" ? wallX : tipX;
  const footY = GROUND_Y;
  const midHypX = (baseX + tipX) / 2;
  const midHypY = (baseY + tipY) / 2;

  const baseMovable =
    !locked && scene.id !== "ladder" && scene.id !== "tablet";
  const angleMovable = !locked && scene.angleAdjustable;
  const interactive = baseMovable || angleMovable;

  const applyPointer = useCallback(
    (kind: DragKind, x: number, y: number) => {
      if (scene.id === "ladder") {
        if (!scene.angleAdjustable) return;
        if (kind === "base") {
          const run = Math.min(visR * 0.97, Math.max(visR * 0.26, wallX - x));
          const deg = (Math.acos(run / visR) * 180) / Math.PI;
          onChange({ angleDeg: clampAngle(scene, deg), baseT: t });
          return;
        }
        const rise = Math.min(visR * 0.97, Math.max(visR * 0.26, GROUND_Y - y));
        const deg = (Math.asin(rise / visR) * 180) / Math.PI;
        onChange({ angleDeg: clampAngle(scene, deg), baseT: t });
        return;
      }
      if (kind === "base") {
        if (scene.id === "tablet") return;
        const minX = LEFT_X;
        const maxX =
          RIGHT_X - visR * Math.cos((scene.minAngleDeg * Math.PI) / 180) - 24;
        const span = maxX - minX;
        const nextT = span <= 0 ? t : (x - minX) / span;
        onChange({ angleDeg: angle, baseT: clampBaseT(nextT) });
        return;
      }
      if (!scene.angleAdjustable) return;
      const dx = x - baseX;
      const dy = GROUND_Y - y;
      if (dx * dx + dy * dy < 16) return;
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      onChange({ angleDeg: clampAngle(scene, deg), baseT: t });
    },
    [angle, baseX, onChange, scene, t, visR, wallX],
  );

  const pickKind = (x: number, y: number): DragKind | null => {
    const dBase = Math.hypot(x - baseX, y - baseY);
    const dTip = Math.hypot(x - tipX, y - tipY);
    const kind: DragKind = dTip < dBase ? "tip" : "base";
    if (kind === "tip" && !angleMovable) return null;
    if (kind === "base" && scene.id === "ladder" && !angleMovable) return null;
    if (kind === "base" && scene.id === "tablet") {
      return angleMovable ? "tip" : null;
    }
    if (kind === "base" && !baseMovable && !angleMovable) return null;
    return kind;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const svg = svgRef.current;
    if (!svg) return;
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    const p = clientToVb(svg, e.clientX, e.clientY);
    const kind = pickKind(p.x, p.y);
    if (!kind) return;
    dragRef.current = kind;
    e.currentTarget.setPointerCapture(e.pointerId);
    applyPointer(kind, p.x, p.y);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || locked) return;
    const svg = svgRef.current;
    if (!svg) return;
    e.preventDefault();
    const p = clientToVb(svg, e.clientX, e.clientY);
    applyPointer(dragRef.current, p.x, p.y);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const losLen = Math.hypot(tipX - baseX, tipY - baseY);
  const arcR = Math.min(44, losLen * 0.3);
  const arcEndX = baseX + arcR * Math.cos(angRad);
  const arcEndY = GROUND_Y - arcR * Math.sin(angRad);
  const half = angRad / 2;
  const labelR = arcR + 16;
  const labelX = baseX + labelR * Math.cos(half);
  const labelY = GROUND_Y - labelR * Math.sin(half);

  const sky =
    scene.id === "kite"
      ? "from-[#c8e8ff] to-[#fef9f0]"
      : scene.id === "ladder"
        ? "from-[#efe7d8] to-[#f7f1e6]"
        : "from-[#e8eef8] to-[#f6f0e8]";

  return (
    <div className={`select-none overflow-hidden rounded-2xl border-2 border-wood/15 bg-gradient-to-b ${sky}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={`block h-auto w-full touch-none select-none ${interactive ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        role="img"
        aria-label={`${scene.title}. 빗변 ${scene.hyp}${scene.unit}, 각 ${angle}도`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <rect width={VB_W} height={VB_H} fill="transparent" />
        {scene.id === "kite" ? (
          <>
            <circle cx={72} cy={40} r={16} fill="#ffe08a" opacity={0.9} />
            <ellipse cx={124} cy={48} rx={26} ry={11} fill="white" opacity={0.7} />
            <ellipse cx={142} cy={52} rx={16} ry={9} fill="white" opacity={0.6} />
            <rect x={0} y={GROUND_Y} width={VB_W} height={VB_H - GROUND_Y} fill="#b7dd8e" />
          </>
        ) : scene.id === "ladder" ? (
          <>
            <rect x={0} y={GROUND_Y} width={VB_W} height={VB_H - GROUND_Y} fill="#c8b48a" />
            <Wall x={wallX} groundY={GROUND_Y} />
          </>
        ) : (
          <>
            <rect x={0} y={GROUND_Y} width={VB_W} height={VB_H - GROUND_Y} fill="#d8c4a4" />
            <rect x={18} y={GROUND_Y - 10} width={404} height={14} rx={3} fill="#b08968" stroke="#8B5E3C" strokeWidth={1.4} />
            <rect x={28} y={GROUND_Y + 4} width={18} height={40} fill="#8B5E3C" />
            <rect x={394} y={GROUND_Y + 4} width={18} height={40} fill="#8B5E3C" />
          </>
        )}
        <line x1={16} y1={GROUND_Y} x2={424} y2={GROUND_Y} stroke="#8B5E3C" strokeWidth={3} />

        <line
          x1={baseX}
          y1={GROUND_Y}
          x2={footX}
          y2={footY}
          stroke="#8B5E3C"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          opacity={0.55}
        />
        <line
          x1={tipX}
          y1={tipY}
          x2={footX}
          y2={GROUND_Y}
          stroke="#8B5E3C"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          opacity={0.55}
        />
        <path
          d={`M ${footX - 8} ${GROUND_Y} L ${footX - 8} ${GROUND_Y - 8} L ${footX} ${GROUND_Y - 8}`}
          fill="none"
          stroke="#8B5E3C"
          strokeWidth={1.4}
          opacity={0.7}
        />

        {scene.id === "tablet" ? (
          <TabletBody hingeX={baseX} hingeY={GROUND_Y} angRad={angRad} len={visR} />
        ) : null}

        <line
          x1={baseX}
          y1={baseY}
          x2={tipX}
          y2={tipY}
          stroke="#5a3d8a"
          strokeWidth={scene.id === "ladder" ? 7 : scene.id === "tablet" ? 2.4 : 3.2}
          strokeLinecap="round"
          strokeDasharray={scene.id === "tablet" ? "4 3" : undefined}
          opacity={scene.id === "tablet" ? 0.7 : 1}
        />
        {scene.id === "ladder" ? (
          <>
            <line
              x1={baseX + 5}
              y1={baseY - 6}
              x2={tipX + 5}
              y2={tipY - 6}
              stroke="#c9a227"
              strokeWidth={2.2}
              strokeLinecap="round"
            />
            {[0.2, 0.4, 0.6, 0.8].map((u) => (
              <line
                key={u}
                x1={baseX + (tipX - baseX) * u}
                y1={baseY + (tipY - baseY) * u}
                x2={baseX + (tipX - baseX) * u + 5}
                y2={baseY + (tipY - baseY) * u - 6}
                stroke="#8B5E3C"
                strokeWidth={1.6}
              />
            ))}
          </>
        ) : null}

        <text
          x={scene.id === "tablet" ? midHypX - 6 : midHypX + 10}
          y={scene.id === "tablet" ? midHypY + 20 : midHypY - 8}
          fill="#5a3d8a"
          fontSize={13}
          fontWeight={800}
          className="pointer-events-none select-none"
        >
          {scene.hyp} {scene.unit}
        </text>

        <path
          d={`M ${baseX + arcR} ${GROUND_Y} A ${arcR} ${arcR} 0 0 0 ${arcEndX} ${arcEndY}`}
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

        {scene.id === "kite" ? <Person x={baseX} y={GROUND_Y} /> : null}
        {scene.id === "kite" ? <KiteArt x={tipX} y={tipY} /> : null}

        <circle cx={baseX} cy={baseY} r={6} fill="#e85d4c" stroke="#fff" strokeWidth={1.6} />
        <circle cx={tipX} cy={tipY} r={6} fill="#c9a227" stroke="#fff" strokeWidth={1.6} />
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-wood/10 bg-cream/80 px-3 py-2.5">
        <span className="rounded-xl bg-lavender/45 px-3 py-1 text-sm font-bold tabular-nums text-wood">
          빗변 {scene.hyp} {scene.unit}
        </span>
        <span className="rounded-xl bg-[#e85d4c]/15 px-3 py-1 text-sm font-bold tabular-nums text-[#a63a1a]">
          각 {angle}°
        </span>
        {angleMovable ? (
          <span className="text-xs font-semibold text-foreground/55">
            빗변의 양 끝점을 끌어 각을 바꾸세요
          </span>
        ) : !locked ? (
          <span className="text-xs font-semibold text-foreground/55">
            각은 {angle}°로 고정되어 있어요
          </span>
        ) : null}
      </div>
    </div>
  );
}
