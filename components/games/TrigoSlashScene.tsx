"use client";

import { useCallback, useRef, useState } from "react";
import type {
  Point,
  Round,
  VertexMap,
} from "@/lib/trigo-slash-math";
import {
  ROLE_COLOR,
  ROLE_LABEL,
  SIDE_IDS,
  VERTEX_IDS,
  VIEW,
  angleArc,
  centroid,
  dist,
  midpoint,
  outwardLabel,
  polyString,
  rightAngleMark,
  roleOfSide,
  sideSegment,
  sidesForRatio,
} from "@/lib/trigo-slash-math";

export type Shard = {
  points: Point[];
  dx: number;
  dy: number;
  rot: number;
};

type Flash = "hit" | "miss" | "reverse" | null;

function clientToView(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 50, y: 50 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function vertexLabelPos(verts: VertexMap, id: keyof VertexMap): Point {
  const c = centroid(verts);
  const p = verts[id];
  const d = dist(c, p) || 1;
  const extra = 9;
  return {
    x: p.x + ((p.x - c.x) / d) * extra,
    y: p.y + ((p.y - c.y) / d) * extra,
  };
}

export default function TrigoSlashScene({
  verts,
  round,
  shards,
  showRoles,
  flash,
  fever,
  disabled,
  reducedMotion,
  onStrokeStart,
  onStrokeEnd,
}: {
  verts: VertexMap;
  round: Round;
  shards: Shard[] | null;
  showRoles: boolean;
  flash: Flash;
  fever: boolean;
  disabled: boolean;
  reducedMotion: boolean;
  onStrokeStart?: () => void;
  onStrokeEnd: (pts: Point[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drawingRef = useRef(false);
  const draftRef = useRef<Point[]>([]);
  const [draft, setDraft] = useState<Point[]>([]);

  const target = sidesForRatio(round.fn, round.rightAt, round.refAt);
  const fill =
    flash === "miss"
      ? "rgba(232, 93, 76, 0.42)"
      : flash === "reverse"
        ? "rgba(255, 215, 106, 0.5)"
        : fever
          ? "rgba(212, 196, 255, 0.55)"
          : "rgba(168, 216, 255, 0.42)";
  const strokeTri =
    flash === "hit" ? "#d4a017" : flash === "miss" ? "#e85d4c" : "#8b5e3c";

  const append = useCallback((p: Point) => {
    const prev = draftRef.current;
    const last = prev[prev.length - 1];
    if (last && dist(last, p) < 0.7) return;
    const next = prev.length > 80 ? [...prev.slice(-70), p] : [...prev, p];
    draftRef.current = next;
    setDraft(next);
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled || shards) return;
    const svg = svgRef.current;
    if (!svg) return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    onStrokeStart?.();
    const p = clientToView(svg, e.clientX, e.clientY);
    draftRef.current = [p];
    setDraft([p]);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current || disabled) return;
    const svg = svgRef.current;
    if (!svg) return;
    append(clientToView(svg, e.clientX, e.clientY));
  };

  const finishStroke = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const pts = draftRef.current;
    draftRef.current = [];
    setDraft([]);
    if (pts.length >= 2) onStrokeEnd(pts);
  };

  const mark = rightAngleMark(verts, round.rightAt);
  const arc = angleArc(verts, round.refAt);
  const hideBody = Boolean(shards && shards.length > 0);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
              className="h-full w-full touch-none overscroll-none select-none"
      role="application"
      aria-label="삼각비를 베는 놀이 판"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
    >
      <defs>
        <linearGradient id="trigo-slash-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={fever ? "#efe6ff" : "#d9f3ff"} />
          <stop offset="50%" stopColor={fever ? "#ffe7a8" : "#efe4ff"} />
          <stop offset="100%" stopColor={fever ? "#ffd4e8" : "#fff4d0"} />
        </linearGradient>
        <filter id="trigo-slash-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={VIEW} height={VIEW} fill="url(#trigo-slash-bg)" />

      {fever
        ? Array.from({ length: 8 }, (_, i) => (
            <circle
              key={i}
              cx={12 + ((i * 37) % 80)}
              cy={10 + ((i * 19) % 78)}
              r={0.9 + (i % 3) * 0.35}
              fill="#ffd76a"
              opacity={0.55}
            />
          ))
        : null}

      {hideBody && shards
        ? shards.map((sh, i) => (
            <polygon
              key={i}
              points={polyString(sh.points)}
              fill={fill}
              stroke={strokeTri}
              strokeWidth={1.4}
              strokeLinejoin="round"
              className={reducedMotion ? "" : "trigo-slash-shard"}
              style={
                reducedMotion
                  ? { opacity: 0.35 }
                  : {
                      ["--shard-dx" as string]: `${sh.dx}`,
                      ["--shard-dy" as string]: `${sh.dy}`,
                      ["--shard-rot" as string]: `${sh.rot}deg`,
                    }
              }
            />
          ))
        : (
          <polygon
            points={polyString([verts.A, verts.B, verts.C])}
            fill={fill}
            stroke="none"
            className={flash === "miss" ? "trigo-slash-shake" : undefined}
          />
        )}

      {!hideBody
        ? SIDE_IDS.map((side) => {
            const role = roleOfSide(side, round.rightAt, round.refAt);
            const [a, b] = sideSegment(verts, side);
            const orderIdx = target[0] === side ? 1 : target[1] === side ? 2 : 0;
            const tint = showRoles || round.showOrderHints;
            const color = tint ? ROLE_COLOR[role] : strokeTri;
            const wide = tint || orderIdx > 0;
            return (
              <g key={side}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={color}
                  strokeWidth={wide ? 2.4 : 1.7}
                  strokeLinecap="round"
                  opacity={hideBody ? 0 : 1}
                />
                {round.showOrderHints && orderIdx > 0 ? (
                  <OrderChip
                    at={midpoint(a, b)}
                    n={orderIdx}
                    color={color}
                    role={role}
                  />
                ) : tint ? (
                  <text
                    x={outwardLabel(verts, a, b, 6).x}
                    y={outwardLabel(verts, a, b, 6).y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={color}
                    fontSize="3.6"
                    fontWeight={800}
                    style={{ fontFamily: "var(--font-noto-sans-kr), sans-serif" }}
                  >
                    {ROLE_LABEL[role]}
                  </text>
                ) : round.showSideLetters ? (
                  <text
                    x={outwardLabel(verts, a, b, 6.2).x}
                    y={outwardLabel(verts, a, b, 6.2).y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#6b4423"
                    fontSize="4.2"
                    fontWeight={800}
                    style={{ fontFamily: "var(--font-jua), sans-serif" }}
                  >
                    {side}
                  </text>
                ) : null}
              </g>
            );
          })
        : null}

      {!hideBody ? (
        <>
          <polyline
            points={polyString(mark)}
            fill="none"
            stroke="#8b5e3c"
            strokeWidth={1.15}
            strokeLinejoin="miter"
          />
          <path
            d={arc}
            fill="none"
            stroke={ROLE_COLOR.opp}
            strokeWidth={1.35}
            opacity={0.95}
          />
          {VERTEX_IDS.map((id) => {
            const p = vertexLabelPos(verts, id);
            const isRef = id === round.refAt;
            return (
              <g key={id}>
                <circle
                  cx={verts[id].x}
                  cy={verts[id].y}
                  r={isRef ? 2.1 : 1.35}
                  fill={isRef ? ROLE_COLOR.opp : "#8b5e3c"}
                />
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isRef ? ROLE_COLOR.opp : "#3d2c1e"}
                  fontSize={isRef ? 6.2 : 5.2}
                  fontWeight={800}
                  style={{ fontFamily: "var(--font-jua), sans-serif" }}
                >
                  {id}
                </text>
              </g>
            );
          })}
        </>
      ) : null}

      {draft.length > 1 ? (
        <polyline
          points={polyString(draft)}
          fill="none"
          stroke="#f3c14a"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#trigo-slash-glow)"
          opacity={0.95}
        />
      ) : null}

      {flash === "hit" && !reducedMotion ? (
        <circle
          cx={centroid(verts).x}
          cy={centroid(verts).y}
          r={18}
          fill="none"
          stroke="#ffd76a"
          strokeWidth={1.2}
          className="trigo-slash-ring"
        />
      ) : null}
    </svg>
  );
}

function OrderChip({
  at,
  n,
  color,
  role,
}: {
  at: Point;
  n: number;
  color: string;
  role: "opp" | "adj" | "hyp";
}) {
  const label = ROLE_LABEL[role];
  return (
    <g>
      <circle cx={at.x} cy={at.y} r={4.4} fill="#fff8eb" stroke={color} strokeWidth={1.1} />
      <text
        x={at.x}
        y={at.y - 0.2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize="3.8"
        fontWeight={800}
        style={{ fontFamily: "var(--font-jua), sans-serif" }}
      >
        {n}
      </text>
      <text
        x={at.x}
        y={at.y + 7.2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize="3.3"
        fontWeight={800}
        style={{ fontFamily: "var(--font-noto-sans-kr), sans-serif" }}
      >
        {label}
      </text>
    </g>
  );
}
