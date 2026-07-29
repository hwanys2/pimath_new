"use client";

import { useCallback, useEffect, useRef } from "react";
import type { OverlayPose } from "./types";
import { CloseIcon, RotateIcon } from "./icons";
import {
  RULER_H,
  RULER_UNIT,
  clampRulerLength,
  rulerLength,
} from "../lib/board-ruler";

type OverlayProps = {
  pose: OverlayPose;
  nonInteractive?: boolean;
  onChange: (pose: OverlayPose) => void;
  onClose: () => void;
};

function useDragRotate(
  pose: OverlayPose,
  onChange: (pose: OverlayPose) => void,
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
          (Math.atan2(e.clientY - d.base.y, e.clientX - d.base.x) * 180) /
          Math.PI;
        let angle = Math.round(raw);
        const nearest = Math.round(angle / 45) * 45;
        if (Math.abs(angle - nearest) <= 3) angle = nearest;
        onChange({ ...d.base, angle });
      }
    },
    [onChange],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  return { startDrag, onPointerMove, endDrag };
}

export function RulerOverlay({
  pose,
  nonInteractive,
  onChange,
  onClose,
}: OverlayProps) {
  const { startDrag, onPointerMove, endDrag } = useDragRotate(pose, onChange);
  const length = rulerLength(pose);
  const units = Math.floor((length - 20) / RULER_UNIT);
  const poseRef = useRef(pose);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    poseRef.current = pose;
    onChangeRef.current = onChange;
  }, [pose, onChange]);

  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const base = poseRef.current;
    const L = rulerLength(base);
    const a = (base.angle * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const leftX = base.x - (L / 2) * cos;
    const leftY = base.y - (L / 2) * sin;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - leftX;
      const dy = ev.clientY - leftY;
      const newL = clampRulerLength(dx * cos + dy * sin);
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
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

  const interactive = !nonInteractive;

  return (
    <div
      className={`absolute touch-none select-none ${nonInteractive ? "pointer-events-none" : "pointer-events-auto"}`}
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
        className="h-full w-full cursor-grab rounded-lg border-2 border-wood/50 shadow-lg backdrop-blur-[1px] active:cursor-grabbing"
        style={{ background: "rgba(255, 244, 214, 0.82)" }}
        onPointerDown={startDrag("move")}
      >
        <svg width={length} height={RULER_H} className="pointer-events-none">
          {Array.from({ length: Math.max(0, units) * 10 + 1 }).map((_, i) => {
            const x = 10 + (i * RULER_UNIT) / 10;
            if (x > length - 10) return null;
            const major = i % 10 === 0;
            const half = i % 5 === 0;
            return (
              <line
                key={i}
                x1={x}
                y1={0}
                x2={x}
                y2={major ? 22 : half ? 15 : 9}
                stroke="#6b4423"
                strokeWidth={major ? 1.6 : 1}
              />
            );
          })}
          {Array.from({ length: units + 1 }).map((_, i) => {
            const x = 10 + i * RULER_UNIT;
            if (x > length - 10) return null;
            return (
              <text
                key={i}
                x={x}
                y={36}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#6b4423"
              >
                {i}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Length resize handle — right end */}
      <button
        type="button"
        aria-label="자 길이 조절"
        title="드래그해서 길이 조절"
        className={`absolute top-1/2 right-0 z-10 flex h-12 w-5 -translate-y-1/2 translate-x-1/2 cursor-ew-resize items-center justify-center rounded-md border-2 border-white bg-sky shadow-md ${
          interactive ? "pointer-events-auto" : "pointer-events-none"
        }`}
        onPointerDown={startResize}
      >
        <span className="flex flex-col gap-[3px]">
          <span className="h-3 w-0.5 rounded bg-[#1a4a6e]" />
          <span className="h-3 w-0.5 rounded bg-[#1a4a6e]" />
          <span className="h-3 w-0.5 rounded bg-[#1a4a6e]" />
        </span>
      </button>

      <div className="absolute bottom-1.5 left-2 flex gap-1.5">
        <button
          type="button"
          aria-label="자 회전"
          className="cursor-grab rounded-full border-2 border-wood/40 bg-white/90 p-1.5 text-wood shadow active:cursor-grabbing"
          onPointerDown={startDrag("rotate")}
        >
          <RotateIcon width={14} height={14} />
        </button>
        <button
          type="button"
          aria-label="자 닫기"
          className="rounded-full border-2 border-wood/40 bg-white/90 p-1.5 text-wood shadow transition hover:bg-red-50 hover:text-red-600"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          <CloseIcon width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

const PROT_W = 420;
const PROT_H = 240;

export function ProtractorOverlay({
  pose,
  nonInteractive,
  onChange,
  onClose,
}: OverlayProps) {
  const { startDrag, onPointerMove, endDrag } = useDragRotate(pose, onChange);
  const cx = PROT_W / 2;
  const cy = PROT_H - 20;
  const rOuter = PROT_W / 2 - 10;

  const tickLines = [];
  for (let deg = 0; deg <= 180; deg += 2) {
    const a = (Math.PI * deg) / 180;
    const major = deg % 10 === 0;
    const mid = deg % 5 === 0;
    const r1 = rOuter;
    const r2 = rOuter - (major ? 18 : mid ? 12 : 7);
    tickLines.push(
      <line
        key={deg}
        x1={cx - r1 * Math.cos(a)}
        y1={cy - r1 * Math.sin(a)}
        x2={cx - r2 * Math.cos(a)}
        y2={cy - r2 * Math.sin(a)}
        stroke="#1a4a6e"
        strokeWidth={major ? 1.5 : 0.8}
      />,
    );
  }

  const labels = [];
  for (let deg = 0; deg <= 180; deg += 10) {
    const a = (Math.PI * deg) / 180;
    const r = rOuter - 30;
    labels.push(
      <text
        key={`o${deg}`}
        x={cx - r * Math.cos(a)}
        y={cy - r * Math.sin(a)}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="700"
        fill="#1a4a6e"
        transform={`rotate(${deg - 90}, ${cx - r * Math.cos(a)}, ${cy - r * Math.sin(a)})`}
      >
        {deg}
      </text>,
    );
    if (deg % 30 === 0) {
      const r2 = rOuter - 48;
      labels.push(
        <text
          key={`i${deg}`}
          x={cx - r2 * Math.cos(a)}
          y={cy - r2 * Math.sin(a)}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="9"
          fill="#1a4a6e99"
          transform={`rotate(${deg - 90}, ${cx - r2 * Math.cos(a)}, ${cy - r2 * Math.sin(a)})`}
        >
          {180 - deg}
        </text>,
      );
    }
  }

  return (
    <div
      className={`absolute touch-none select-none ${nonInteractive ? "pointer-events-none" : "pointer-events-auto"}`}
      style={{
        left: pose.x - PROT_W / 2,
        top: pose.y - PROT_H / 2,
        width: PROT_W,
        height: PROT_H,
        transform: `rotate(${pose.angle}deg)`,
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
          d={`M ${cx - rOuter} ${cy} A ${rOuter} ${rOuter} 0 0 1 ${cx + rOuter} ${cy} L ${cx + rOuter} ${cy + 14} L ${cx - rOuter} ${cy + 14} Z`}
          fill="rgba(200, 232, 255, 0.75)"
          stroke="#1a4a6e"
          strokeWidth="2"
        />
        {tickLines}
        {labels}
        <line
          x1={cx - rOuter + 14}
          y1={cy}
          x2={cx + rOuter - 14}
          y2={cy}
          stroke="#1a4a6e"
          strokeWidth="1.5"
        />
        <circle cx={cx} cy={cy} r="4" fill="none" stroke="#ef4444" strokeWidth="1.5" />
        <line x1={cx - 10} y1={cy} x2={cx + 10} y2={cy} stroke="#ef4444" strokeWidth="1" />
        <line x1={cx} y1={cy - 10} x2={cx} y2={cy} stroke="#ef4444" strokeWidth="1" />
      </svg>
      <div className="absolute top-1 right-6 flex gap-1.5">
        <button
          type="button"
          aria-label="각도기 회전"
          className="cursor-grab rounded-full border-2 border-sky bg-white/90 p-1.5 text-[#1a4a6e] shadow active:cursor-grabbing"
          onPointerDown={startDrag("rotate")}
        >
          <RotateIcon width={14} height={14} />
        </button>
        <button
          type="button"
          aria-label="각도기 닫기"
          className="rounded-full border-2 border-sky bg-white/90 p-1.5 text-[#1a4a6e] shadow transition hover:bg-red-50 hover:text-red-600"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          <CloseIcon width={14} height={14} />
        </button>
      </div>
    </div>
  );
}
