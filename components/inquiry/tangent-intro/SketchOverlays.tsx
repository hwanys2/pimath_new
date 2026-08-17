"use client";

import { useCallback, useEffect, useRef } from "react";

export type OverlayPose = {
  x: number;
  y: number;
  angle: number;
  length?: number;
};

const RULER_H = 52;
const RULER_UNIT = 28;
const RULER_MIN = 160;
const RULER_MAX = 420;
export const RULER_DEFAULT = 260;

const PROT_W = 300;
const PROT_H = 168;
const PROT_CX = PROT_W / 2;
const PROT_CY = PROT_H - 16;

function clampLen(n: number): number {
  return Math.min(RULER_MAX, Math.max(RULER_MIN, Math.round(n)));
}

function useDragRotate(
  pose: OverlayPose,
  onChange: (pose: OverlayPose) => void,
  origin: { x: number; y: number },
) {
  const dragRef = useRef<{
    mode: "move" | "rotate";
    startX: number;
    startY: number;
    base: OverlayPose;
  } | null>(null);

  const startDrag = useCallback(
    (mode: "move" | "rotate") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        base: pose,
      };
    },
    [pose],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.mode === "move") {
        onChange({
          ...d.base,
          x: d.base.x + (e.clientX - d.startX),
          y: d.base.y + (e.clientY - d.startY),
        });
      } else {
        const raw =
          (Math.atan2(e.clientY - origin.y, e.clientX - origin.x) * 180) /
          Math.PI;
        let angle = Math.round(raw);
        const nearest = Math.round(angle / 5) * 5;
        if (Math.abs(angle - nearest) <= 2) angle = nearest;
        onChange({ ...d.base, angle });
      }
    },
    [onChange, origin.x, origin.y],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  return { startDrag, onPointerMove, endDrag };
}

export function RulerOverlay({
  pose,
  onChange,
  onClose,
}: {
  pose: OverlayPose;
  onChange: (pose: OverlayPose) => void;
  onClose: () => void;
}) {
  const length = clampLen(pose.length ?? RULER_DEFAULT);
  const { startDrag, onPointerMove, endDrag } = useDragRotate(pose, onChange, {
    x: pose.x,
    y: pose.y,
  });
  const poseRef = useRef(pose);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    poseRef.current = pose;
    onChangeRef.current = onChange;
  }, [pose, onChange]);

  const units = Math.floor((length - 16) / RULER_UNIT);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const base = poseRef.current;
    const L = clampLen(base.length ?? RULER_DEFAULT);
    const a = (base.angle * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const leftX = base.x - (L / 2) * cos;
    const leftY = base.y - (L / 2) * sin;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - leftX;
      const dy = ev.clientY - leftY;
      const newL = clampLen(dx * cos + dy * sin);
      onChangeRef.current({
        ...base,
        length: newL,
        x: leftX + (newL / 2) * cos,
        y: leftY + (newL / 2) * sin,
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className="absolute z-20 touch-none select-none"
      style={{
        left: pose.x - length / 2,
        top: pose.y - RULER_H / 2,
        width: length,
        height: RULER_H,
        transform: `rotate(${pose.angle}deg)`,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="h-full w-full cursor-grab rounded-lg border-2 border-wood/50 shadow-lg active:cursor-grabbing"
        style={{ background: "rgba(255, 244, 214, 0.88)" }}
        onPointerDown={startDrag("move")}
      >
        <svg width={length} height={RULER_H} className="pointer-events-none">
          {Array.from({ length: Math.max(0, units) * 10 + 1 }).map((_, i) => {
            const x = 8 + (i * RULER_UNIT) / 10;
            if (x > length - 8) return null;
            const major = i % 10 === 0;
            const half = i % 5 === 0;
            return (
              <line
                key={i}
                x1={x}
                y1={0}
                x2={x}
                y2={major ? 18 : half ? 12 : 7}
                stroke="#6b4423"
                strokeWidth={major ? 1.5 : 1}
              />
            );
          })}
          {Array.from({ length: units + 1 }).map((_, i) => {
            const x = 8 + i * RULER_UNIT;
            if (x > length - 8) return null;
            return (
              <text
                key={i}
                x={x}
                y={32}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#6b4423"
              >
                {i}
              </text>
            );
          })}
        </svg>
      </div>
      <button
        type="button"
        aria-label="자 길이 조절"
        className="absolute top-1/2 right-0 z-10 flex h-10 w-4 -translate-y-1/2 translate-x-1/2 cursor-ew-resize items-center justify-center rounded-md border-2 border-white bg-sky shadow"
        onPointerDown={startResize}
      >
        <span className="h-4 w-0.5 rounded bg-[#1a4a6e]" />
      </button>
      <div className="absolute bottom-1 left-1.5 flex gap-1">
        <button
          type="button"
          aria-label="자 회전"
          className="cursor-grab rounded-full border border-wood/40 bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-wood shadow"
          onPointerDown={startDrag("rotate")}
        >
          회전
        </button>
        <button
          type="button"
          aria-label="자 닫기"
          className="rounded-full border border-wood/40 bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-wood shadow"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export function ProtractorOverlay({
  pose,
  onChange,
  onClose,
}: {
  pose: OverlayPose;
  onChange: (pose: OverlayPose) => void;
  onClose: () => void;
}) {
  const { startDrag, onPointerMove, endDrag } = useDragRotate(pose, onChange, {
    x: pose.x,
    y: pose.y,
  });
  const rOuter = PROT_W / 2 - 8;

  const ticks = [];
  for (let deg = 0; deg <= 180; deg += 2) {
    const a = (Math.PI * deg) / 180;
    const major = deg % 10 === 0;
    const mid = deg % 5 === 0;
    const r2 = rOuter - (major ? 16 : mid ? 11 : 6);
    ticks.push(
      <line
        key={deg}
        x1={PROT_CX - rOuter * Math.cos(a)}
        y1={PROT_CY - rOuter * Math.sin(a)}
        x2={PROT_CX - r2 * Math.cos(a)}
        y2={PROT_CY - r2 * Math.sin(a)}
        stroke="#1a4a6e"
        strokeWidth={major ? 1.4 : 0.8}
      />,
    );
  }
  const labels = [];
  for (let deg = 0; deg <= 180; deg += 10) {
    const a = (Math.PI * deg) / 180;
    const r = rOuter - 26;
    labels.push(
      <text
        key={deg}
        x={PROT_CX - r * Math.cos(a)}
        y={PROT_CY - r * Math.sin(a)}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10"
        fontWeight="700"
        fill="#1a4a6e"
      >
        {deg}
      </text>,
    );
  }

  return (
    <div
      className="absolute z-20 touch-none select-none"
      style={{
        left: pose.x - PROT_CX,
        top: pose.y - PROT_CY,
        width: PROT_W,
        height: PROT_H,
        transform: `rotate(${pose.angle}deg)`,
        transformOrigin: `${PROT_CX}px ${PROT_CY}px`,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <svg
        width={PROT_W}
        height={PROT_H}
        className="cursor-grab drop-shadow-lg active:cursor-grabbing"
        onPointerDown={startDrag("move")}
      >
        <path
          d={`M ${PROT_CX - rOuter} ${PROT_CY} A ${rOuter} ${rOuter} 0 0 1 ${PROT_CX + rOuter} ${PROT_CY} L ${PROT_CX + rOuter} ${PROT_CY + 12} L ${PROT_CX - rOuter} ${PROT_CY + 12} Z`}
          fill="rgba(200, 232, 255, 0.8)"
          stroke="#1a4a6e"
          strokeWidth="2"
        />
        {ticks}
        {labels}
        <circle cx={PROT_CX} cy={PROT_CY} r="3.5" fill="#ef4444" />
        <line x1={PROT_CX - 9} y1={PROT_CY} x2={PROT_CX + 9} y2={PROT_CY} stroke="#ef4444" strokeWidth="1.2" />
        <line x1={PROT_CX} y1={PROT_CY - 9} x2={PROT_CX} y2={PROT_CY} stroke="#ef4444" strokeWidth="1.2" />
      </svg>
      <div className="absolute top-1 right-8 flex gap-1">
        <button
          type="button"
          aria-label="각도기 회전"
          className="cursor-grab rounded-full border border-sky bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-[#1a4a6e] shadow"
          onPointerDown={startDrag("rotate")}
        >
          회전
        </button>
        <button
          type="button"
          aria-label="각도기 닫기"
          className="rounded-full border border-sky bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-[#1a4a6e] shadow"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
