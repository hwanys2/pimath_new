"use client";

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Round, TapChord } from "@/lib/starlight-seal-math";
import {
  chordLength,
  tangentLength,
  distFromSvgY,
  poFromSvgY,
  isDragRound,
} from "@/lib/starlight-seal-math";

const CX = 160;
const CY = 125;
const PR = 88;
const VIEW = "0 0 320 300";

type Props = {
  round: Round;
  value: number;
  onValueChange: (v: number) => void;
  inZone: boolean;
  locked?: boolean;
  selectedTapId?: string | null;
  onTapChord?: (id: string) => void;
  disabled?: boolean;
};

function clientToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function ChordAt({
  dist,
  r,
  color,
  label,
  lengthLabel,
  thick,
  dim,
}: {
  dist: number;
  r: number;
  color: string;
  label?: string;
  lengthLabel?: string;
  thick?: boolean;
  dim?: boolean;
}) {
  const dVis = Math.min(PR - 4, Math.max(0, (dist / Math.max(r, 1)) * PR));
  const half = Math.sqrt(Math.max(4, PR * PR - dVis * dVis));
  const y = CY + dVis;
  return (
    <g opacity={dim ? 0.45 : 1}>
      <line
        x1={CX - half}
        y1={y}
        x2={CX + half}
        y2={y}
        stroke={color}
        strokeWidth={thick ? 5 : 3.5}
        strokeLinecap="round"
      />
      <line
        x1={CX}
        y1={CY}
        x2={CX}
        y2={y}
        stroke="#8B5E3C"
        strokeWidth={1.5}
        strokeDasharray="3 3"
        opacity={0.7}
      />
      {label ? (
        <text
          x={CX + half + 8}
          y={y + 4}
          fontSize={12}
          fontWeight={800}
          fill="#5c4030"
        >
          {label}
        </text>
      ) : null}
      {lengthLabel != null ? (
        <text
          x={CX}
          y={y + 18}
          textAnchor="middle"
          fontSize={13}
          fontWeight={800}
          fill={thick ? "#7c3aed" : "#5c4030"}
        >
          {lengthLabel}
        </text>
      ) : null}
    </g>
  );
}

export default function StarlightSealScene({
  round,
  value,
  onValueChange,
  inZone,
  locked,
  selectedTapId,
  onTapChord,
  disabled,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const applyPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg || disabled || locked) return;
      const { y } = clientToSvg(svg, clientX, clientY);
      if (round.kind === "tangent-length") {
        onValueChange(poFromSvgY(y, CY, PR, round.dragMin, round.dragMax));
      } else if (isDragRound(round.kind)) {
        onValueChange(distFromSvgY(y, CY, PR, round.dragMin, round.dragMax));
      }
    },
    [disabled, locked, onValueChange, round],
  );

  const onPointerDown = (e: ReactPointerEvent) => {
    if (disabled || locked || !isDragRound(round.kind)) return;
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    applyPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    applyPointer(e.clientX, e.clientY);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const liveLen =
    round.kind === "tangent-length"
      ? tangentLength(value, round.r)
      : chordLength(round.r, value);

  return (
    <svg
      ref={svgRef}
      viewBox={VIEW}
      className="mx-auto h-auto w-full max-w-lg touch-none select-none"
      role="img"
      aria-label={round.title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <radialGradient id="drag-bg" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#F3ECFF" />
          <stop offset="100%" stopColor="#FEF9F0" />
        </radialGradient>
      </defs>
      <rect width="320" height="300" rx="18" fill="url(#drag-bg)" />

      {/* Magic circle */}
      <circle
        cx={CX}
        cy={CY}
        r={PR + 10}
        fill="none"
        stroke="#D4C4FF"
        strokeWidth={1.5}
        strokeDasharray="5 7"
        opacity={0.55}
      />
      <circle
        cx={CX}
        cy={CY}
        r={PR}
        fill={
          locked
            ? "rgba(255,215,106,0.28)"
            : inZone
              ? "rgba(94,196,176,0.22)"
              : "rgba(184,160,232,0.16)"
        }
        stroke={locked ? "#FFD76A" : inZone ? "#5EC4B0" : "#B8A0E8"}
        strokeWidth={locked || inZone ? 3.5 : 2.5}
      />
      <circle cx={CX} cy={CY} r={4.5} fill="#8B5E3C" />
      <text x={CX + 8} y={CY - 8} fontSize={12} fontWeight={800} fill="#8B5E3C">
        O
      </text>
      <text
        x={CX + PR * 0.55}
        y={CY - PR * 0.55}
        fontSize={12}
        fontWeight={800}
        fill="#5c4030"
      >
        r={round.r}
      </text>

      {/* Tap longest */}
      {round.kind === "tap-longest" && round.tapChords
        ? round.tapChords.map((ch: TapChord, i) => {
            const colors = ["#7c3aed", "#5EC4B0", "#e85d4c"];
            const selected = selectedTapId === ch.id;
            const dVis = Math.min(
              PR - 6,
              Math.max(8, (ch.dist / Math.max(round.r, 1)) * PR),
            );
            const angle = ((i - 1) * 22 * Math.PI) / 180;
            const mx = CX + Math.sin(angle) * dVis;
            const my = CY + Math.cos(angle) * dVis;
            const half = Math.sqrt(Math.max(8, PR * PR - dVis * dVis)) * 0.8;
            const dx = Math.cos(angle) * half;
            const dy = -Math.sin(angle) * half;
            return (
              <g key={ch.id}>
                <line
                  x1={mx - dx}
                  y1={my - dy}
                  x2={mx + dx}
                  y2={my + dy}
                  stroke="transparent"
                  strokeWidth={26}
                  strokeLinecap="round"
                  style={{ cursor: "pointer" }}
                  onClick={() => onTapChord?.(ch.id)}
                />
                <line
                  x1={mx - dx}
                  y1={my - dy}
                  x2={mx + dx}
                  y2={my + dy}
                  stroke={selected ? "#FFD76A" : colors[i % 3]!}
                  strokeWidth={selected ? 6 : 3.5}
                  strokeLinecap="round"
                  style={{ cursor: "pointer" }}
                  onClick={() => onTapChord?.(ch.id)}
                />
                <text
                  x={mx}
                  y={my - 12}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={800}
                  fill="#5c4030"
                >
                  {ch.label} · d={Math.round(ch.dist)}
                </text>
              </g>
            );
          })
        : null}

      {/* Chord drag modes */}
      {(round.kind === "chord-length" ||
        round.kind === "chord-dist" ||
        round.kind === "chord-equal") && (
        <>
          {round.kind === "chord-equal" && round.fixedDist != null ? (
            <ChordAt
              dist={round.fixedDist}
              r={round.r}
              color="#5EC4B0"
              label="AB"
              lengthLabel={`AB=${round.fixedLength}`}
              dim
            />
          ) : null}
          <ChordAt
            dist={value}
            r={round.r}
            color={inZone ? "#5EC4B0" : "#7c3aed"}
            label={round.kind === "chord-equal" ? "CD" : undefined}
            lengthLabel={
              round.kind === "chord-dist"
                ? `길이 ${liveLen.toFixed(1)}`
                : `길이 ${liveLen.toFixed(1)}`
            }
            thick
          />
          {/* Drag handle on midpoint */}
          <circle
            cx={CX}
            cy={CY + Math.min(PR - 4, (value / Math.max(round.r, 1)) * PR)}
            r={11}
            fill={inZone ? "#5EC4B0" : "#B8A0E8"}
            stroke="#fff"
            strokeWidth={2.5}
            style={{ cursor: disabled || locked ? "default" : "grab" }}
          />
          <text
            x={CX - 36}
            y={
              (CY +
                CY +
                Math.min(PR - 4, (value / Math.max(round.r, 1)) * PR)) /
                2 +
              4
            }
            fontSize={12}
            fontWeight={800}
            fill="#8B5E3C"
          >
            d={value.toFixed(1)}
          </text>
        </>
      )}

      {/* Tangent drag */}
      {round.kind === "tangent-length" && (
        <>
          {(() => {
            const poVis = Math.min(
              120,
              20 + ((value - round.dragMin) / Math.max(0.1, round.dragMax - round.dragMin)) * 100,
            );
            const px = CX;
            const py = CY + PR + poVis * 0.15 + 20;
            // Approximate touch point on right side of circle toward P
            const ax = CX - PR * 0.75;
            const ay = CY + PR * 0.55;
            return (
              <g>
                <line
                  x1={CX}
                  y1={CY}
                  x2={ax}
                  y2={ay}
                  stroke="#8B5E3C"
                  strokeWidth={1.6}
                />
                <line
                  x1={CX}
                  y1={CY}
                  x2={px}
                  y2={py}
                  stroke="#8B5E3C"
                  strokeWidth={1.3}
                  strokeDasharray="3 3"
                />
                <line
                  x1={px}
                  y1={py}
                  x2={ax}
                  y2={ay}
                  stroke={inZone ? "#5EC4B0" : "#7c3aed"}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
                {/* right angle mark */}
                <path
                  d={`M ${ax + 8} ${ay} L ${ax + 8} ${ay + 8} L ${ax} ${ay + 8}`}
                  fill="none"
                  stroke="#8B5E3C"
                  strokeWidth={1.4}
                />
                <circle cx={ax} cy={ay} r={4} fill="#7c3aed" />
                <text x={ax - 12} y={ay - 8} fontSize={12} fontWeight={800} fill="#5c4030">
                  A
                </text>
                <circle
                  cx={px}
                  cy={py}
                  r={12}
                  fill={inZone ? "#5EC4B0" : "#B8A0E8"}
                  stroke="#fff"
                  strokeWidth={2.5}
                  style={{ cursor: disabled || locked ? "default" : "grab" }}
                />
                <text
                  x={px}
                  y={py + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={900}
                  fill="#5c4030"
                >
                  P
                </text>
                <text
                  x={(px + ax) / 2 - 14}
                  y={(py + ay) / 2}
                  fontSize={13}
                  fontWeight={800}
                  fill={inZone ? "#0f766e" : "#7c3aed"}
                >
                  PA={liveLen.toFixed(1)}
                </text>
                <text
                  x={CX + 16}
                  y={CY + PR * 0.35}
                  fontSize={12}
                  fontWeight={800}
                  fill="#8B5E3C"
                >
                  PO={value.toFixed(1)}
                </text>
              </g>
            );
          })()}
        </>
      )}

      {/* Tangent equal (static figure) */}
      {round.kind === "tangent-equal" && (
        <>
          {(() => {
            const px = CX;
            const py = CY + PR + 55;
            const ax = CX - PR * 0.75;
            const ay = CY + PR * 0.55;
            const bx = CX + PR * 0.75;
            const by = CY + PR * 0.55;
            return (
              <g>
                <line x1={CX} y1={CY} x2={ax} y2={ay} stroke="#8B5E3C" strokeWidth={1.5} />
                <line x1={CX} y1={CY} x2={bx} y2={by} stroke="#8B5E3C" strokeWidth={1.5} />
                <line
                  x1={px}
                  y1={py}
                  x2={ax}
                  y2={ay}
                  stroke="#7c3aed"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                <line
                  x1={px}
                  y1={py}
                  x2={bx}
                  y2={by}
                  stroke="#5EC4B0"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                <path
                  d={`M ${ax + 8} ${ay} L ${ax + 8} ${ay + 8} L ${ax} ${ay + 8}`}
                  fill="none"
                  stroke="#8B5E3C"
                  strokeWidth={1.3}
                />
                <path
                  d={`M ${bx - 8} ${by} L ${bx - 8} ${by + 8} L ${bx} ${by + 8}`}
                  fill="none"
                  stroke="#8B5E3C"
                  strokeWidth={1.3}
                />
                <circle cx={ax} cy={ay} r={3.5} fill="#7c3aed" />
                <circle cx={bx} cy={by} r={3.5} fill="#5EC4B0" />
                <circle cx={px} cy={py} r={4.5} fill="#8B5E3C" />
                <text x={ax - 12} y={ay - 6} fontSize={12} fontWeight={800} fill="#5c4030">
                  A
                </text>
                <text x={bx + 8} y={by - 6} fontSize={12} fontWeight={800} fill="#5c4030">
                  B
                </text>
                <text x={px} y={py + 16} textAnchor="middle" fontSize={12} fontWeight={800} fill="#5c4030">
                  P
                </text>
                <text
                  x={(px + ax) / 2 - 10}
                  y={(py + ay) / 2}
                  fontSize={13}
                  fontWeight={800}
                  fill="#7c3aed"
                >
                  PA={round.shownPa}
                </text>
                <text
                  x={(px + bx) / 2 + 10}
                  y={(py + by) / 2}
                  fontSize={13}
                  fontWeight={800}
                  fill="#0f766e"
                >
                  PB=?
                </text>
              </g>
            );
          })()}
        </>
      )}

      {locked ? (
        <text x={160} y={22} textAnchor="middle" fontSize={16} fontWeight={900} fill="#8B5E3C">
          ✦ 잠금 ✦
        </text>
      ) : inZone && isDragRound(round.kind) ? (
        <text x={160} y={22} textAnchor="middle" fontSize={14} fontWeight={900} fill="#0f766e">
          초록이면 손을 떼세요!
        </text>
      ) : isDragRound(round.kind) ? (
        <text x={160} y={22} textAnchor="middle" fontSize={13} fontWeight={700} fill="#8B5E3C" opacity={0.75}>
          손잡이를 위·아래로 드래그
        </text>
      ) : null}
    </svg>
  );
}
