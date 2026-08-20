"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { StageDef, TrigFn } from "@/lib/trig-builder-math";
import {
  HINT_PENALTY,
  distPoints,
  layoutPoints,
  lerpPts,
  midPoint,
  sideEndpoints,
  sideLabelKo,
  standardHintPoints,
  suggestedTrig,
} from "@/lib/trig-builder-math";

type Props = {
  stage: StageDef;
  open: boolean;
  onClose: () => void;
};

function Latex({ latex, className }: { latex: string; className?: string }) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      }),
    [latex],
  );
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

const DEFS: {
  fn: TrigFn;
  latex: string;
  ko: string;
}[] = [
  { fn: "sin", latex: "\\sin\\theta=\\dfrac{\\text{대변}}{\\text{빗변}}", ko: "높이(대변) ÷ 빗변" },
  { fn: "cos", latex: "\\cos\\theta=\\dfrac{\\text{인접변}}{\\text{빗변}}", ko: "밑변(인접변) ÷ 빗변" },
  { fn: "tan", latex: "\\tan\\theta=\\dfrac{\\text{대변}}{\\text{인접변}}", ko: "대변 ÷ 인접변" },
];

export default function TrigBuilderHintModal({
  stage,
  open,
  onClose,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const fromPts = useMemo(
    () => layoutPoints(stage.layout, stage),
    [stage],
  );
  const toPts = useMemo(() => standardHintPoints(stage), [stage]);
  const [t, setT] = useState(0);
  const suggested = suggestedTrig(stage);

  useEffect(() => {
    if (!open) {
      setT(0);
      return;
    }
    closeRef.current?.focus();
    const start = performance.now();
    const DURATION = 900;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      // ease-in-out cubic
      const eased =
        p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      setT(eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, stage.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const pts = lerpPts(fromPts, toPts, t);
  const [givenFrom, givenTo] = sideEndpoints(pts, stage.givenSide);
  const [unkFrom, unkTo] = sideEndpoints(pts, stage.unknownSide);
  const givenMid = midPoint(givenFrom, givenTo);
  const unkMid = midPoint(unkFrom, unkTo);

  // Right-angle mark
  const markSize = 14;
  const dAB = Math.max(distPoints(pts.A, pts.B), 1);
  const dAC = Math.max(distPoints(pts.A, pts.C), 1);
  const vAB = {
    x: (pts.B.x - pts.A.x) / dAB,
    y: (pts.B.y - pts.A.y) / dAB,
  };
  const vAC = {
    x: (pts.C.x - pts.A.x) / dAC,
    y: (pts.C.y - pts.A.y) / dAC,
  };
  const ra1 = {
    x: pts.A.x + vAB.x * markSize,
    y: pts.A.y + vAB.y * markSize,
  };
  const ra2 = {
    x: pts.A.x + vAB.x * markSize + vAC.x * markSize,
    y: pts.A.y + vAB.y * markSize + vAC.y * markSize,
  };
  const ra3 = {
    x: pts.A.x + vAC.x * markSize,
    y: pts.A.y + vAC.y * markSize,
  };

  // Angle arc at B
  const arcR = 26;
  const dBA = Math.max(distPoints(pts.B, pts.A), 1);
  const dBC = Math.max(distPoints(pts.B, pts.C), 1);
  const vBA = {
    x: (pts.A.x - pts.B.x) / dBA,
    y: (pts.A.y - pts.B.y) / dBA,
  };
  const vBC = {
    x: (pts.C.x - pts.B.x) / dBC,
    y: (pts.C.y - pts.B.y) / dBC,
  };
  const arcStart = {
    x: pts.B.x + vBA.x * arcR,
    y: pts.B.y + vBA.y * arcR,
  };
  const arcEnd = {
    x: pts.B.x + vBC.x * arcR,
    y: pts.B.y + vBC.y * arcR,
  };
  const cross =
    (pts.A.x - pts.B.x) * (pts.C.y - pts.B.y) -
    (pts.A.y - pts.B.y) * (pts.C.x - pts.B.x);
  const sweep = cross < 0 ? 0 : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-wood/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border-2 border-lavender/50 bg-cream shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-wood/10 bg-gradient-to-r from-lavender/40 via-sky/25 to-gold/30 px-4 py-3 sm:px-5">
          <div>
            <h2
              id={titleId}
              className="font-display text-xl text-wood sm:text-2xl"
            >
              힌트 · 그림 바로잡기
            </h2>
            <p className="mt-1 text-xs font-semibold text-foreground/60 sm:text-sm">
              힌트 1회 −{HINT_PENALTY}점 · 같은 스테이지에서 다시 열어도 추가
              차감 없음
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl bg-wood/10 px-3 py-2 text-sm font-bold text-wood hover:bg-wood/15"
          >
            닫기
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <p className="text-sm font-semibold leading-relaxed text-foreground/70">
            비틀린 삼각형을{" "}
            <strong className="text-wood">왼쪽 = 기준각 θ</strong>,{" "}
            <strong className="text-wood">오른쪽 = 직각</strong>인 익숙한
            형태로 돌려 볼게요.{" "}
            <span className="text-amber-800">노란 변</span>은 주어진 길이,{" "}
            <span className="text-violet-700">보라 변</span>은 구할{" "}
            <Latex latex="x" /> 예요.
          </p>

          <div className="overflow-hidden rounded-2xl border border-wood/10 bg-gradient-to-b from-[#E8F4FF] to-[#FEF9F0]">
            <svg
              viewBox="0 0 640 320"
              className="h-auto w-full"
              role="img"
              aria-label="기준각이 왼쪽, 직각이 오른쪽에 오도록 회전하는 힌트 그림"
            >
              <polygon
                points={`${pts.A.x},${pts.A.y} ${pts.B.x},${pts.B.y} ${pts.C.x},${pts.C.y}`}
                fill="#D4C4FF"
                fillOpacity="0.28"
                stroke="#8B5E3C"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />

              {/* Dim other sides */}
              <line
                x1={pts.A.x}
                y1={pts.A.y}
                x2={pts.B.x}
                y2={pts.B.y}
                stroke="#8B5E3C"
                strokeWidth="2"
                opacity="0.35"
              />
              <line
                x1={pts.A.x}
                y1={pts.A.y}
                x2={pts.C.x}
                y2={pts.C.y}
                stroke="#8B5E3C"
                strokeWidth="2"
                opacity="0.35"
              />
              <line
                x1={pts.B.x}
                y1={pts.B.y}
                x2={pts.C.x}
                y2={pts.C.y}
                stroke="#8B5E3C"
                strokeWidth="2"
                opacity="0.35"
              />

              {/* Given side highlight */}
              <line
                x1={givenFrom.x}
                y1={givenFrom.y}
                x2={givenTo.x}
                y2={givenTo.y}
                stroke="#E8A317"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.95"
              />
              {/* Unknown side highlight */}
              <line
                x1={unkFrom.x}
                y1={unkFrom.y}
                x2={unkTo.x}
                y2={unkTo.y}
                stroke="#9B7EDE"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="10 8"
                opacity="0.95"
              />

              <polyline
                points={`${ra1.x},${ra1.y} ${ra2.x},${ra2.y} ${ra3.x},${ra3.y}`}
                fill="none"
                stroke="#8B5E3C"
                strokeWidth="2"
              />
              <path
                d={`M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 0 ${sweep} ${arcEnd.x} ${arcEnd.y}`}
                fill="none"
                stroke="#7EC8F5"
                strokeWidth="2.5"
              />
              <text
                x={pts.B.x + (vBA.x + vBC.x) * 20}
                y={pts.B.y + (vBA.y + vBC.y) * 20}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#5a3a22"
                className="text-[13px] font-bold"
              >
                {stage.theta}°
              </text>
              <text
                x={pts.A.x + 10}
                y={pts.A.y + 18}
                fill="#8B5E3C"
                className="text-[11px] font-bold"
                opacity={0.55 + 0.45 * t}
              >
                직각
              </text>

              {/* Given badge */}
              <rect
                x={givenMid.x - 36}
                y={givenMid.y - 32}
                width="72"
                height="36"
                rx="10"
                fill="#FFD76A"
              />
              <text
                x={givenMid.x}
                y={givenMid.y - 20}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#5a3a22"
                className="text-[11px] font-bold"
              >
                주어짐
              </text>
              <text
                x={givenMid.x}
                y={givenMid.y - 6}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#5a3a22"
                className="text-[14px] font-black"
              >
                {stage.givenLength}
              </text>

              {/* x badge */}
              <rect
                x={unkMid.x - 28}
                y={unkMid.y - 28}
                width="56"
                height="36"
                rx="10"
                fill="#D4C4FF"
              />
              <text
                x={unkMid.x}
                y={unkMid.y - 16}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#5a3a22"
                className="text-[11px] font-bold"
              >
                구할 변
              </text>
              <text
                x={unkMid.x}
                y={unkMid.y - 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#6B4FA0"
                className="text-[16px] font-black italic"
              >
                x
              </text>

              {/* Orientation caption after rotate */}
              <text
                x="320"
                y="300"
                textAnchor="middle"
                fill="#8B5E3C"
                opacity={0.35 + 0.65 * t}
                className="text-[12px] font-semibold"
              >
                ← 기준각 θ &nbsp;&nbsp; 직각 →
              </text>
            </svg>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-bold sm:text-sm">
            <span className="rounded-xl bg-gold/50 px-3 py-1.5 text-wood">
              주어진 {sideLabelKo(stage.givenSide)} = {stage.givenLength}
            </span>
            <span className="rounded-xl bg-lavender/50 px-3 py-1.5 text-wood">
              구할 {sideLabelKo(stage.unknownSide)} = x
            </span>
            <span className="rounded-xl bg-sky/45 px-3 py-1.5 text-wood">
              기준각 θ = {stage.theta}°
            </span>
          </div>

          <div>
            <h3 className="mb-2 font-display text-lg text-wood">
              삼각비의 정의
            </h3>
            <ul className="space-y-2">
              {DEFS.map((d) => {
                const active = suggested === d.fn;
                return (
                  <li
                    key={d.fn}
                    className={[
                      "flex flex-col gap-1 rounded-2xl border-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
                      active
                        ? "border-wood bg-mint/35 shadow-sm"
                        : "border-wood/10 bg-white/60",
                    ].join(" ")}
                  >
                    <div className="text-base font-bold text-wood">
                      <Latex latex={d.latex} />
                    </div>
                    <p className="text-xs font-semibold text-foreground/60 sm:text-sm">
                      {d.ko}
                      {active ? (
                        <span className="ml-2 rounded-lg bg-wood px-2 py-0.5 text-[10px] font-black text-cream">
                          이번 다리에 유용
                        </span>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="rounded-2xl bg-wood/5 px-4 py-3 text-sm font-semibold text-foreground/70">
            {stage.hint}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream"
          >
            알겠어요, 다시 도전!
          </button>
        </div>
      </div>
    </div>
  );
}
