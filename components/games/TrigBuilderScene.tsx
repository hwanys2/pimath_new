"use client";

import { useEffect, useRef, useState } from "react";
import type { StageDef, TriangleLayout } from "@/lib/trig-builder-math";
export type SceneStatus = "idle" | "wrong-short" | "wrong-long" | "success" | "falling";

type Props = {
  stage: StageDef;
  /** Expression length ÷ target. Used only when confirming (status ≠ idle). */
  ratio: number | null;
  status: SceneStatus;
  onAnimComplete?: (status: SceneStatus) => void;
};

type Pts = {
  A: { x: number; y: number }; // right angle
  B: { x: number; y: number }; // theta vertex
  C: { x: number; y: number }; // other acute
};

/**
 * Build right-triangle vertices in a 640×360 viewBox.
 * Side AB = adjacent (to θ at B), AC = opposite, BC = hypotenuse.
 * (Wait — if θ is at B: adj = AB, opp = AC? No:
 *  θ at B: adjacent legs from B are BA and BC? 
 *  Standard: right angle at A, θ at B:
 *    - adj to θ = AB (leg along from B to right angle)
 *    - opp to θ = AC
 *    - hyp = BC
 */
function layoutPoints(layout: TriangleLayout, stage: StageDef): Pts {
  const hyp =
    stage.givenSide === "hyp"
      ? stage.givenLength
      : stage.givenSide === "adj"
        ? stage.givenLength / Math.cos((stage.theta * Math.PI) / 180)
        : stage.givenLength / Math.sin((stage.theta * Math.PI) / 180);
  const adj = hyp * Math.cos((stage.theta * Math.PI) / 180);
  const opp = hyp * Math.sin((stage.theta * Math.PI) / 180);
  // Normalize so the larger leg fits ~220 px
  const scale = 220 / Math.max(adj, opp, 1);

  const ax = adj * scale;
  const oy = opp * scale;

  // Canonical: A at origin (right∠), B at (ax,0) (θ), C at (0,-oy)
  let A = { x: 0, y: 0 };
  let B = { x: ax, y: 0 };
  let C = { x: 0, y: -oy };

  switch (layout) {
    case "floor-right": {
      // Place with A near left cliff, bridge along AB (adj) or AC (opp) or BC
      A = { x: 160, y: 260 };
      B = { x: 160 + ax, y: 260 };
      C = { x: 160, y: 260 - oy };
      break;
    }
    case "floor-left": {
      // Mirror horizontally: θ on the left
      A = { x: 480, y: 260 };
      B = { x: 480 - ax, y: 260 };
      C = { x: 480, y: 260 - oy };
      break;
    }
    case "wall-up": {
      // Vertical climb: adj vertical, opp horizontal
      A = { x: 200, y: 280 };
      B = { x: 200, y: 280 - ax }; // θ up the wall
      C = { x: 200 + oy, y: 280 };
      break;
    }
    case "wall-down": {
      A = { x: 200, y: 80 };
      B = { x: 200, y: 80 + ax };
      C = { x: 200 + oy, y: 80 };
      break;
    }
    case "roof": {
      A = { x: 420, y: 100 };
      B = { x: 420 - ax, y: 100 };
      C = { x: 420, y: 100 + oy };
      break;
    }
    case "lean-left": {
      A = { x: 360, y: 260 };
      B = { x: 360 - ax, y: 260 };
      C = { x: 360, y: 260 - oy };
      break;
    }
  }

  return { A, B, C };
}

function sideEndpoints(
  pts: Pts,
  side: "hyp" | "adj" | "opp",
): [{ x: number; y: number }, { x: number; y: number }] {
  // θ at B, right∠ at A: adj=AB, opp=AC, hyp=BC
  switch (side) {
    case "adj":
      return [pts.A, pts.B];
    case "opp":
      return [pts.A, pts.C];
    case "hyp":
      return [pts.B, pts.C];
  }
}

function mid(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lerp(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export default function TrigBuilderScene({
  stage,
  ratio,
  status,
  onAnimComplete,
}: Props) {
  const pts = layoutPoints(stage.layout, stage);
  const [bridgeFrom, bridgeTo] = sideEndpoints(pts, stage.unknownSide);
  const [givenFrom, givenTo] = sideEndpoints(pts, stage.givenSide);
  const givenMid = mid(givenFrom, givenTo);
  const bridgeMid = mid(bridgeFrom, bridgeTo);
  const bridgeLen = Math.max(dist(bridgeFrom, bridgeTo), 1);
  const centroid = {
    x: (pts.A.x + pts.B.x + pts.C.x) / 3,
    y: (pts.A.y + pts.B.y + pts.C.y) / 3,
  };
  // x sits at the midpoint of the unknown side, slightly outside the fill
  const bdx = (bridgeTo.x - bridgeFrom.x) / bridgeLen;
  const bdy = (bridgeTo.y - bridgeFrom.y) / bridgeLen;
  let nx = -bdy;
  let ny = bdx;
  if (nx * (centroid.x - bridgeMid.x) + ny * (centroid.y - bridgeMid.y) > 0) {
    nx = -nx;
    ny = -ny;
  }
  const xLabel = { x: bridgeMid.x + nx * 18, y: bridgeMid.y + ny * 18 };

  /** Solid bridge is hidden until confirm; then grows to `ratio`. */
  const [bridgeDraw, setBridgeDraw] = useState(0);
  const [charT, setCharT] = useState(0);
  const [fallY, setFallY] = useState(0);
  const [shake, setShake] = useState(0);
  const animRef = useRef<number | null>(null);
  const completeRef = useRef(onAnimComplete);
  completeRef.current = onAnimComplete;

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);

    if (status === "idle") {
      setBridgeDraw(0);
      setCharT(0);
      setFallY(0);
      setShake(0);
      return;
    }

    const targetRatio = Math.max(
      0.05,
      Math.min(1.55, ratio === null ? 0.05 : ratio),
    );
    const start = performance.now();

    if (status === "falling") {
      // Keep bridge as drawn; only fall
      const duration = 900;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setShake(Math.sin(t * Math.PI * 8) * (1 - t) * 6);
        setFallY(t * t * 120);
        if (t < 1) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          completeRef.current?.(status);
        }
      };
      animRef.current = requestAnimationFrame(tick);
      return () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
      };
    }

    // Confirm: grow the bridge first, then success walk / wrong shake
    const GROW_MS = 550;
    const ACT_MS = status === "success" ? 1200 : 650;
    const total = GROW_MS + ACT_MS;

    setCharT(0);
    setFallY(0);
    setShake(0);
    setBridgeDraw(0);

    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < GROW_MS) {
        const g = Math.min(1, elapsed / GROW_MS);
        const eased = 1 - Math.pow(1 - g, 3);
        setBridgeDraw(targetRatio * eased);
      } else {
        setBridgeDraw(targetRatio);
        const a = Math.min(1, (elapsed - GROW_MS) / ACT_MS);
        if (status === "success") {
          setCharT(a);
        } else if (status === "wrong-short") {
          setShake(Math.sin(a * Math.PI * 8) * (1 - a) * 6);
        } else if (status === "wrong-long") {
          setShake(Math.sin(a * Math.PI * 6) * (1 - a) * 4);
        }
      }
      if (elapsed < total) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        completeRef.current?.(status);
      }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [status, stage.id, ratio]);

  const tip = lerp(bridgeFrom, bridgeTo, bridgeDraw);
  const showBridge = bridgeDraw > 0.02;

  const charPos =
    status === "success"
      ? lerp(bridgeFrom, bridgeTo, charT)
      : status === "falling"
        ? {
            x: lerp(bridgeFrom, tip, 0.55).x + shake,
            y: lerp(bridgeFrom, tip, 0.55).y + fallY,
          }
        : {
            x: bridgeFrom.x - 22 + shake,
            y: bridgeFrom.y - 28,
          };

  const connected = status === "success";

  // Right-angle mark near A
  const markSize = 14;
  const vAB = {
    x: (pts.B.x - pts.A.x) / dist(pts.A, pts.B),
    y: (pts.B.y - pts.A.y) / dist(pts.A, pts.B),
  };
  const vAC = {
    x: (pts.C.x - pts.A.x) / dist(pts.A, pts.C),
    y: (pts.C.y - pts.A.y) / dist(pts.A, pts.C),
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
  const arcR = 28;
  const vBA = {
    x: (pts.A.x - pts.B.x) / dist(pts.B, pts.A),
    y: (pts.A.y - pts.B.y) / dist(pts.B, pts.A),
  };
  const vBC = {
    x: (pts.C.x - pts.B.x) / dist(pts.B, pts.C),
    y: (pts.C.y - pts.B.y) / dist(pts.B, pts.C),
  };
  const arcStart = {
    x: pts.B.x + vBA.x * arcR,
    y: pts.B.y + vBA.y * arcR,
  };
  const arcEnd = {
    x: pts.B.x + vBC.x * arcR,
    y: pts.B.y + vBC.y * arcR,
  };
  // SVG arc sweep: pick the short arc that sits inside ∠ABC (convex toward exterior of angle rays)
  const cross =
    (pts.A.x - pts.B.x) * (pts.C.y - pts.B.y) -
    (pts.A.y - pts.B.y) * (pts.C.x - pts.B.x);
  const sweep = cross < 0 ? 0 : 1;

  const bridgeColor =
    status === "success" || connected
      ? "#5EC4B0"
      : status === "wrong-short" || status === "falling"
        ? "#e85d4c"
        : status === "wrong-long"
          ? "#c9892a"
          : "#B8A0E8";

  return (
    <svg
      viewBox="0 0 640 360"
      className="h-auto w-full select-none"
      role="img"
      aria-label={`스테이지 ${stage.id}: 기준각 ${stage.theta}도, 주어진 변 길이 ${stage.givenLength}`}
    >
      <defs>
        <linearGradient id="tb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8F4FF" />
          <stop offset="100%" stopColor="#FEF9F0" />
        </linearGradient>
        <linearGradient id="tb-cliff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C4A882" />
          <stop offset="100%" stopColor="#8B5E3C" />
        </linearGradient>
      </defs>

      <rect width="640" height="360" fill="url(#tb-sky)" rx="20" />

      {/* Soft ground / cliffs */}
      <path
        d="M0 300 L0 360 L640 360 L640 300 Q520 280 400 300 Q280 320 160 295 Q80 280 0 300 Z"
        fill="#9DE8C8"
        opacity="0.35"
      />
      <path
        d={`M0 0 L0 360 L${Math.min(bridgeFrom.x, bridgeTo.x) - 8} 360 L${Math.min(bridgeFrom.x, bridgeTo.x) - 8} ${bridgeFrom.y + 4} Q40 ${bridgeFrom.y - 40} 0 ${bridgeFrom.y - 80} Z`}
        fill="url(#tb-cliff)"
        opacity="0.85"
      />
      <path
        d={`M640 0 L640 360 L${Math.max(bridgeFrom.x, bridgeTo.x) + 8} 360 L${Math.max(bridgeFrom.x, bridgeTo.x) + 8} ${bridgeTo.y + 4} Q600 ${bridgeTo.y - 40} 640 ${bridgeTo.y - 80} Z`}
        fill="url(#tb-cliff)"
        opacity="0.85"
      />

      {/* Triangle outline (known sides solid, unknown dashed ghost) */}
      <polygon
        points={`${pts.A.x},${pts.A.y} ${pts.B.x},${pts.B.y} ${pts.C.x},${pts.C.y}`}
        fill="#D4C4FF"
        fillOpacity="0.25"
        stroke="#8B5E3C"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Right-angle square */}
      <polyline
        points={`${ra1.x},${ra1.y} ${ra2.x},${ra2.y} ${ra3.x},${ra3.y}`}
        fill="none"
        stroke="#8B5E3C"
        strokeWidth="2"
      />

      {/* Angle arc + label */}
      <path
        d={`M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 0 ${sweep} ${arcEnd.x} ${arcEnd.y}`}
        fill="none"
        stroke="#7EC8F5"
        strokeWidth="2.5"
      />
      <text
        x={pts.B.x + (vBA.x + vBC.x) * 22}
        y={pts.B.y + (vBA.y + vBC.y) * 22}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-wood text-[13px] font-bold"
        fill="#5a3a22"
      >
        {stage.theta}°
      </text>

      {/* Given side label */}
      <rect
        x={givenMid.x - 28}
        y={givenMid.y - 28}
        width="56"
        height="22"
        rx="8"
        fill="#FFD76A"
        opacity="0.95"
      />
      <text
        x={givenMid.x}
        y={givenMid.y - 15}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#5a3a22"
        className="text-[13px] font-black"
      >
        {stage.givenLength}
      </text>

      {/* Ghost full bridge path (always visible as the gap to span) */}
      <line
        x1={bridgeFrom.x}
        y1={bridgeFrom.y}
        x2={bridgeTo.x}
        y2={bridgeTo.y}
        stroke="#B8A0E8"
        strokeWidth="4"
        strokeDasharray="8 8"
        opacity="0.45"
      />

      {/* Solid bridge — only after "다리 놓기 확인" */}
      {showBridge ? (
        <>
          <line
            x1={bridgeFrom.x}
            y1={bridgeFrom.y}
            x2={tip.x}
            y2={tip.y}
            stroke={bridgeColor}
            strokeWidth="10"
            strokeLinecap="round"
          />
          {bridgeDraw > 0.15
            ? Array.from({ length: Math.floor(bridgeDraw * 8) }, (_, i) => {
                const t0 = (i + 0.5) / 8;
                if (t0 > bridgeDraw) return null;
                const p = lerp(bridgeFrom, bridgeTo, t0);
                const pnx = -bdy * 7;
                const pny = bdx * 7;
                return (
                  <line
                    key={i}
                    x1={p.x - pnx}
                    y1={p.y - pny}
                    x2={p.x + pnx}
                    y2={p.y + pny}
                    stroke="#8B5E3C"
                    strokeWidth="2"
                    opacity="0.55"
                  />
                );
              })
            : null}
        </>
      ) : null}

      {/* x label at midpoint of the unknown side */}
      <text
        x={xLabel.x}
        y={xLabel.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#B8A0E8"
        className="text-[20px] font-black italic"
      >
        x
      </text>

      {/* Character (별빛-inspired simple adventurer) */}
      <g transform={`translate(${charPos.x}, ${charPos.y})`}>
        <circle cx="0" cy="-18" r="10" fill="#B8A0E8" />
        <circle cx="-3" cy="-19" r="1.5" fill="#3a2a55" />
        <circle cx="3" cy="-19" r="1.5" fill="#3a2a55" />
        <path
          d="M -3 -15 Q 0 -13 3 -15"
          fill="none"
          stroke="#3a2a55"
          strokeWidth="1.2"
        />
        <rect x="-8" y="-8" width="16" height="18" rx="5" fill="#7EC8F5" />
        <rect x="-11" y="-4" width="5" height="10" rx="2" fill="#5EC4B0" />
        <rect x="6" y="-4" width="5" height="10" rx="2" fill="#5EC4B0" />
        <circle cx="10" cy="-20" r="3" fill="#FFD76A" />
      </g>

    </svg>
  );
}
