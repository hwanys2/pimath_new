"use client";

import { useEffect, useState } from "react";
import type { BackgroundId } from "./types";

export const BACKGROUND_DEFS: { id: BackgroundId; label: string; dark: boolean }[] = [
  { id: "chalkboard", label: "칠판", dark: true },
  { id: "whiteboard", label: "화이트보드", dark: false },
  { id: "grid", label: "모눈종이", dark: false },
  { id: "coordinate", label: "좌표평면", dark: false },
  { id: "dots", label: "점판", dark: false },
  { id: "lined", label: "줄노트", dark: false },
  { id: "numberline", label: "수직선", dark: false },
];

const GRID_LINE = "rgba(70, 110, 160, 0.16)";
const GRID_HEAVY = "rgba(70, 110, 160, 0.32)";

function backgroundStyle(id: BackgroundId): React.CSSProperties {
  switch (id) {
    case "chalkboard":
      return {
        background:
          "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.05) 0%, transparent 55%)," +
          "radial-gradient(ellipse at 75% 80%, rgba(0,0,0,0.14) 0%, transparent 55%)," +
          "linear-gradient(160deg, #315c4b 0%, #2a5142 45%, #234639 100%)",
      };
    case "whiteboard":
      return { background: "#fcfcf8" };
    case "grid":
      return {
        background: `
          linear-gradient(to right, ${GRID_HEAVY} 1px, transparent 1px),
          linear-gradient(to bottom, ${GRID_HEAVY} 1px, transparent 1px),
          linear-gradient(to right, ${GRID_LINE} 1px, transparent 1px),
          linear-gradient(to bottom, ${GRID_LINE} 1px, transparent 1px),
          #fcfcf8`,
        backgroundSize: "200px 200px, 200px 200px, 40px 40px, 40px 40px",
      };
    case "coordinate":
      return {
        background: `
          linear-gradient(to right, transparent calc(50% - 1px), rgba(61,44,30,0.65) calc(50% - 1px), rgba(61,44,30,0.65) calc(50% + 1px), transparent calc(50% + 1px)),
          linear-gradient(to bottom, transparent calc(50% - 1px), rgba(61,44,30,0.65) calc(50% - 1px), rgba(61,44,30,0.65) calc(50% + 1px), transparent calc(50% + 1px)),
          linear-gradient(to right, ${GRID_LINE} 1px, transparent 1px),
          linear-gradient(to bottom, ${GRID_LINE} 1px, transparent 1px),
          #fcfcf8`,
        backgroundSize: "100% 100%, 100% 100%, 40px 40px, 40px 40px",
        backgroundPosition: "0 0, 0 0, calc(50% - 20px) calc(50% - 20px), calc(50% - 20px) calc(50% - 20px)",
      };
    case "dots":
      return {
        background: `radial-gradient(circle, rgba(70,110,160,0.4) 2px, transparent 2.5px), #fcfcf8`,
        backgroundSize: "36px 36px",
        backgroundPosition: "18px 18px",
      };
    case "lined":
      return {
        background: `linear-gradient(to bottom, transparent calc(100% - 2px), rgba(70,110,160,0.25) calc(100% - 2px)), #fdfcf5`,
        backgroundSize: "100% 56px",
      };
    case "numberline":
      return { background: "#fcfcf8" };
  }
}

function NumberLine() {
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { w, h } = dims;
  if (w === 0) return null;

  const unit = 80;
  const cx = w / 2;
  const cy = h / 2;
  const count = Math.floor((w / 2 - 60) / unit);
  const values: number[] = [];
  for (let i = -count; i <= count; i++) values.push(i);

  return (
    <svg width={w} height={h} className="absolute inset-0">
      <line x1={20} y1={cy} x2={w - 24} y2={cy} stroke="#3d2c1e" strokeWidth="2.5" />
      <path d={`M ${w - 18} ${cy} l -16 -8 v 16 z`} fill="#3d2c1e" />
      <path d={`M 18 ${cy} l 16 -8 v 16 z`} fill="#3d2c1e" />
      {values.map((v) => {
        const x = cx + v * unit;
        return (
          <g key={v}>
            <line
              x1={x}
              y1={cy - 13}
              x2={x}
              y2={cy + 13}
              stroke="#3d2c1e"
              strokeWidth={v === 0 ? 2.5 : 1.8}
            />
            <text
              x={x}
              y={cy + 40}
              textAnchor="middle"
              fontSize="20"
              fontWeight={v === 0 ? 800 : 600}
              fill="#3d2c1e"
            >
              {v}
            </text>
          </g>
        );
      })}
      {values.slice(0, -1).map((v) => {
        const x = cx + v * unit + unit / 2;
        return (
          <line
            key={`h${v}`}
            x1={x}
            y1={cy - 7}
            x2={x}
            y2={cy + 7}
            stroke="#3d2c1e88"
            strokeWidth="1.2"
          />
        );
      })}
    </svg>
  );
}

export default function BoardBackground({ id }: { id: BackgroundId }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={backgroundStyle(id)}>
      {id === "numberline" ? <NumberLine /> : null}
    </div>
  );
}
