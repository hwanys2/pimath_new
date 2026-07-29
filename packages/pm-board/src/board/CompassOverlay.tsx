"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CompassPose, Stroke } from "./types";
import { CloseIcon } from "./icons";
import type { SnapFn } from "./DrawingCanvas";

const RULER_UNIT = 40;
const MIN_RADIUS = 48;
const MAX_RADIUS = 504;
const MIN_DRAW_DELTA = 0.08; // ~4.5°

type Props = {
  pose: CompassPose;
  color: string;
  size: number;
  nonInteractive?: boolean;
  snap?: SnapFn;
  onChange: (pose: CompassPose) => void;
  onCommit: (stroke: Stroke) => void;
  onClose: () => void;
};

type DragMode = "move" | "radius" | "draw";

type DragState = {
  mode: DragMode;
  startX: number;
  startY: number;
  base: CompassPose;
  /** draw: cumulative unwrapped angle in radians */
  cumAngle?: number;
  startAngleRad?: number;
};

function degToRad(d: number) {
  return (d * Math.PI) / 180;
}
function radToDeg(r: number) {
  return (r * 180) / Math.PI;
}

function unwrapAngle(prev: number, next: number): number {
  let d = next - prev;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return prev + d;
}

function clampRadius(r: number) {
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, r));
}

function tipAt(pose: CompassPose) {
  const a = degToRad(pose.angle);
  return {
    x: pose.cx + pose.radius * Math.cos(a),
    y: pose.cy + pose.radius * Math.sin(a),
  };
}

/** Hinge apex above the midpoint of the two tips. */
function hingeAt(pose: CompassPose) {
  const tip = tipAt(pose);
  const midX = (pose.cx + tip.x) / 2;
  const midY = (pose.cy + tip.y) / 2;
  const a = degToRad(pose.angle);
  const half = pose.radius / 2;
  const leg = Math.max(half + 58, 204);
  const h = Math.sqrt(Math.max(leg * leg - half * half, 4));
  // Perpendicular "up" (CCW from needle→pencil)
  const px = -Math.sin(a);
  const py = Math.cos(a);
  return { x: midX + px * h, y: midY + py * h, leg };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): string {
  const delta = a1 - a0;
  const abs = Math.abs(delta);
  if (abs < 0.001) return "";
  if (abs >= Math.PI * 2 - 0.02) {
    // Full circle as two semicircles (SVG arc can't do full 360 in one A)
    const x0 = cx + r;
    const y0 = cy;
    const x1 = cx - r;
    const y1 = cy;
    return `M ${x0} ${y0} A ${r} ${r} 0 1 1 ${x1} ${y1} A ${r} ${r} 0 1 1 ${x0} ${y0}`;
  }
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = abs > Math.PI ? 1 : 0;
  const sweep = delta > 0 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
}

export default function CompassOverlay({
  pose,
  color,
  size,
  nonInteractive,
  snap,
  onChange,
  onCommit,
  onClose,
}: Props) {
  const dragRef = useRef<DragState | null>(null);
  const poseRef = useRef(pose);
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  const snapRef = useRef(snap);
  const [preview, setPreview] = useState<{ a0: number; a1: number } | null>(
    null,
  );

  useEffect(() => {
    poseRef.current = pose;
    onChangeRef.current = onChange;
    onCommitRef.current = onCommit;
    colorRef.current = color;
    sizeRef.current = size;
    snapRef.current = snap;
  }, [pose, onChange, onCommit, color, size, snap]);

  const tip = tipAt(pose);
  const hinge = hingeAt(pose);
  // Midpoints along each leg for hit targets
  const needleMid = {
    x: (pose.cx + hinge.x) / 2,
    y: (pose.cy + hinge.y) / 2,
  };
  const pencilMid = {
    x: (tip.x + hinge.x) / 2,
    y: (tip.y + hinge.y) / 2,
  };

  const startDrag = useCallback(
    (mode: DragMode) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const base = poseRef.current;
      const startAngleRad = Math.atan2(e.clientY - base.cy, e.clientX - base.cx);
      const state: DragState = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        base,
        cumAngle: startAngleRad,
        startAngleRad,
      };
      dragRef.current = state;
      if (mode === "draw") {
        setPreview({ a0: startAngleRad, a1: startAngleRad });
      }

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        if (d.mode === "move") {
          let cx = d.base.cx + (ev.clientX - d.startX);
          let cy = d.base.cy + (ev.clientY - d.startY);
          const snapped = snapRef.current?.(cx, cy);
          if (snapped) {
            cx = snapped.x;
            cy = snapped.y;
          }
          onChangeRef.current({
            ...d.base,
            cx,
            cy,
          });
          return;
        }
        if (d.mode === "radius") {
          let tx = ev.clientX;
          let ty = ev.clientY;
          const snapped = snapRef.current?.(tx, ty);
          if (snapped) {
            tx = snapped.x;
            ty = snapped.y;
          }
          const dx = tx - d.base.cx;
          const dy = ty - d.base.cy;
          onChangeRef.current({
            ...d.base,
            radius: clampRadius(Math.hypot(dx, dy)),
            angle: radToDeg(Math.atan2(dy, dx)),
          });
          return;
        }
        const raw = Math.atan2(ev.clientY - d.base.cy, ev.clientX - d.base.cx);
        const cum = unwrapAngle(d.cumAngle ?? raw, raw);
        d.cumAngle = cum;
        onChangeRef.current({
          ...d.base,
          angle: radToDeg(cum),
          cx: d.base.cx,
          cy: d.base.cy,
          radius: d.base.radius,
        });
        setPreview({ a0: d.startAngleRad ?? raw, a1: cum });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        const d = dragRef.current;
        dragRef.current = null;
        if (
          !d ||
          d.mode !== "draw" ||
          d.startAngleRad == null ||
          d.cumAngle == null
        ) {
          setPreview(null);
          return;
        }
        const a0 = d.startAngleRad;
        let a1 = d.cumAngle;
        const delta = a1 - a0;
        if (Math.abs(delta) < MIN_DRAW_DELTA) {
          setPreview(null);
          return;
        }
        if (Math.abs(delta) >= Math.PI * 2 - 0.05) {
          const dir = delta > 0 ? 1 : -1;
          a1 = a0 + dir * Math.PI * 2;
        }
        onCommitRef.current({
          tool: "arc",
          color: colorRef.current,
          size: sizeRef.current,
          points: [d.base.cx, d.base.cy, d.base.radius, a0, a1],
        });
        setPreview(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [],
  );

  // Bounding box padded so rotated legs stay inside hit container
  const pad = pose.radius + 144;
  const boxLeft = pose.cx - pad;
  const boxTop = pose.cy - pad;
  const boxSize = pad * 2;

  const local = (p: { x: number; y: number }) => ({
    x: p.x - boxLeft,
    y: p.y - boxTop,
  });
  const n = local({ x: pose.cx, y: pose.cy });
  const p = local(tip);
  const h = local(hinge);
  const nm = local(needleMid);
  const pm = local(pencilMid);

  const radiusLabel = (pose.radius / RULER_UNIT).toFixed(1);
  const previewD =
    preview &&
    arcPath(n.x, n.y, pose.radius, preview.a0, preview.a1);

  // Pencil orientation along the pencil leg
  const pencilAngle = radToDeg(Math.atan2(tip.y - hinge.y, tip.x - hinge.x));

  return (
    <div
      className={`absolute touch-none select-none ${nonInteractive ? "pointer-events-none" : "pointer-events-auto"}`}
      style={{
        left: boxLeft,
        top: boxTop,
        width: boxSize,
        height: boxSize,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <svg
        width={boxSize}
        height={boxSize}
        className="absolute inset-0 overflow-visible drop-shadow-lg"
      >
        <defs>
          <linearGradient id="pm-compass-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3f4f6" />
            <stop offset="45%" stopColor="#9ca3af" />
            <stop offset="100%" stopColor="#4b5563" />
          </linearGradient>
          <linearGradient id="pm-compass-metal-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d1d5db" />
            <stop offset="100%" stopColor="#374151" />
          </linearGradient>
          <filter id="pm-compass-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Ghost circle guide */}
        <circle
          cx={n.x}
          cy={n.y}
          r={pose.radius}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.2"
          strokeDasharray="5 6"
          pointerEvents="none"
        />

        {/* Live draw preview */}
        {previewD ? (
          <path
            d={previewD}
            fill="none"
            stroke={color}
            strokeWidth={size}
            strokeLinecap="round"
            opacity={0.9}
            pointerEvents="none"
          />
        ) : null}

        {/* Needle leg */}
        <g filter="url(#pm-compass-soft)">
          <line
            x1={h.x}
            y1={h.y}
            x2={n.x}
            y2={n.y}
            stroke="url(#pm-compass-metal)"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <line
            x1={h.x}
            y1={h.y}
            x2={n.x}
            y2={n.y}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Needle point — continues past the center slightly */}
          {(() => {
            const ang = Math.atan2(pose.cy - hinge.y, pose.cx - hinge.x);
            const tx = n.x + Math.cos(ang) * 14;
            const ty = n.y + Math.sin(ang) * 14;
            const lx = n.x + Math.cos(ang + Math.PI / 2) * 4;
            const ly = n.y + Math.sin(ang + Math.PI / 2) * 4;
            const rx = n.x + Math.cos(ang - Math.PI / 2) * 4;
            const ry = n.y + Math.sin(ang - Math.PI / 2) * 4;
            return (
              <polygon
                points={`${tx},${ty} ${lx},${ly} ${rx},${ry}`}
                fill="#111827"
              />
            );
          })()}
          <circle cx={n.x} cy={n.y} r="3" fill="#ef4444" stroke="#fff" strokeWidth="1" />
        </g>

        {/* Pencil leg */}
        <g filter="url(#pm-compass-soft)">
          <line
            x1={h.x}
            y1={h.y}
            x2={p.x}
            y2={p.y}
            stroke="url(#pm-compass-metal-dark)"
            strokeWidth="11"
            strokeLinecap="round"
          />
          {/* Pencil holder sleeve */}
          <g transform={`rotate(${pencilAngle}, ${p.x}, ${p.y})`}>
            <rect
              x={p.x - 30}
              y={p.y - 8}
              width="24"
              height="16"
              rx="2.5"
              fill="#6b4423"
              stroke="#3d2c1e"
              strokeWidth="1.2"
            />
            <rect
              x={p.x - 28}
              y={p.y - 6}
              width="11"
              height="12"
              rx="1"
              fill="#fbbf24"
            />
            {/* Wood pencil body + graphite */}
            <polygon
              points={`${p.x + 4},${p.y} ${p.x - 12},${p.y - 6} ${p.x - 12},${p.y + 6}`}
              fill="#1f2937"
            />
            <circle cx={p.x + 1} cy={p.y} r="2.5" fill={color} stroke="#fff" strokeWidth="0.8" />
          </g>
          {/* Draw affordance ring */}
          <circle
            cx={p.x}
            cy={p.y}
            r="16"
            fill="none"
            stroke="rgba(255,215,106,0.7)"
            strokeWidth="2"
            strokeDasharray="3 3"
            pointerEvents="none"
          />
        </g>

        {/* Hinge + handle */}
        <g filter="url(#pm-compass-soft)">
          <circle
            cx={h.x}
            cy={h.y}
            r="14"
            fill="url(#pm-compass-metal)"
            stroke="#374151"
            strokeWidth="2"
          />
          <circle cx={h.x} cy={h.y} r="5" fill="#1f2937" />
          {/* Knurled screw / top handle */}
          <rect
            x={h.x - 6}
            y={h.y - 36}
            width="12"
            height="24"
            rx="3"
            fill="#9ca3af"
            stroke="#4b5563"
            strokeWidth="1.5"
          />
          <rect
            x={h.x - 8}
            y={h.y - 40}
            width="16"
            height="8"
            rx="2"
            fill="#6b7280"
            stroke="#374151"
            strokeWidth="1"
          />
          {[0, 1, 2].map((i) => (
            <line
              key={i}
              x1={h.x - 5}
              y1={h.y - 36 + 6 + i * 5}
              x2={h.x + 5}
              y2={h.y - 36 + 6 + i * 5}
              stroke="#4b5563"
              strokeWidth="1"
            />
          ))}
        </g>

        {/* Radius label near midpoint */}
        <g pointerEvents="none">
          <rect
            x={(n.x + p.x) / 2 - 22}
            y={(n.y + p.y) / 2 - 10}
            width="44"
            height="20"
            rx="6"
            fill="rgba(255,248,235,0.92)"
            stroke="#8b5e3c"
            strokeWidth="1.5"
          />
          <text
            x={(n.x + p.x) / 2}
            y={(n.y + p.y) / 2 + 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#6b4423"
          >
            {radiusLabel}
          </text>
        </g>

        {/* Invisible hit targets (order: draw tip > radius > move) */}
        {/* Move: hinge + needle leg */}
        <circle
          cx={h.x}
          cy={h.y}
          r="28"
          fill="transparent"
          className="cursor-grab"
          onPointerDown={startDrag("move")}
        />
        <circle
          cx={nm.x}
          cy={nm.y}
          r="22"
          fill="transparent"
          className="cursor-grab"
          onPointerDown={startDrag("move")}
        />
        <circle
          cx={n.x}
          cy={n.y}
          r="18"
          fill="transparent"
          className="cursor-grab"
          onPointerDown={startDrag("move")}
        />
        {/* Radius: mid pencil leg */}
        <circle
          cx={pm.x}
          cy={pm.y}
          r="24"
          fill="transparent"
          className="cursor-ew-resize"
          onPointerDown={startDrag("radius")}
        />
        {/* Draw: pencil tip */}
        <circle
          cx={p.x}
          cy={p.y}
          r="26"
          fill="transparent"
          className="cursor-crosshair"
          onPointerDown={startDrag("draw")}
        />
      </svg>

      {/* Close button near hinge */}
      <button
        type="button"
        aria-label="컴퍼스 닫기"
        className="absolute z-10 rounded-full border-2 border-wood/40 bg-white/95 p-1.5 text-wood shadow transition hover:bg-red-50 hover:text-red-600"
        style={{
          left: h.x + 18,
          top: h.y - 44,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
      >
        <CloseIcon width={14} height={14} />
      </button>
    </div>
  );
}
