"use client";

import { useCallback, useRef, useState } from "react";
import {
  GRID_H,
  GRID_W,
  formatLength,
  nearestSeg,
  nearEndpoint,
  perpendicularThrough,
  projectOnSeg,
  segLength,
  snapPoint,
  type SketchSeg,
  type Vec2,
} from "@/lib/inquiry-tangent-sketch";
import {
  ProtractorOverlay,
  RulerOverlay,
  RULER_DEFAULT,
  type OverlayPose,
} from "./SketchOverlays";

type Tool = "segment" | "perp" | "measure" | "erase";

const PAD_X = 0.85;
const PAD_Y = 0.95;
const VIEW_W = GRID_W + PAD_X * 2 + 0.4;
const VIEW_H = GRID_H + PAD_Y * 2 + 0.3;

function toSvg(p: Vec2): { x: number; y: number } {
  return { x: p.x, y: GRID_H - p.y };
}

function fromSvg(x: number, y: number): Vec2 {
  return { x, y: GRID_H - y };
}

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "segment", label: "선분", hint: "두 점을 찍어 선분을 그리세요. 격자에 붙어요." },
  { id: "perp", label: "수선", hint: "선분을 고른 뒤, 수선을 내릴 점을 찍으세요. 끝점을 누르면 바로 그려져요." },
  { id: "measure", label: "길이", hint: "길이를 볼 선분을 누르세요." },
  { id: "erase", label: "지우개", hint: "지울 선분을 누르세요." },
];

type Props = {
  locked?: boolean;
};

export default function GeometrySketchpad({ locked = false }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(1);
  const [tool, setTool] = useState<Tool>("segment");
  const [segs, setSegs] = useState<SketchSeg[]>([]);
  const [history, setHistory] = useState<SketchSeg[][]>([]);
  const [pending, setPending] = useState<Vec2 | null>(null);
  const [perpTarget, setPerpTarget] = useState<string | null>(null);
  const [hover, setHover] = useState<Vec2 | null>(null);
  const [ruler, setRuler] = useState<OverlayPose | null>(null);
  const [protractor, setProtractor] = useState<OverlayPose | null>(null);

  const nextId = () => {
    const id = `s${idRef.current}`;
    idRef.current += 1;
    return id;
  };

  const pushHistory = (prev: SketchSeg[]) => {
    setHistory((h) => [...h.slice(-29), prev]);
  };

  const clientToGrid = (e: { clientX: number; clientY: number }): Vec2 | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return null;
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W + (-PAD_X);
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H + (-PAD_Y);
    return fromSvg(x, y);
  };

  const applySnap = useCallback(
    (p: Vec2) => snapPoint(p, segs),
    [segs],
  );

  const addSeg = (a: Vec2, b: Vec2) => {
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.2) return;
    pushHistory(segs);
    setSegs((cur) => [...cur, { id: nextId(), a, b }]);
  };

  const onCanvasDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (locked) return;
    if ((e.target as Element).closest("button")) return;
    const raw = clientToGrid(e);
    if (!raw) return;
    const p = applySnap(raw);

    if (tool === "segment") {
      if (!pending) {
        setPending(p);
        return;
      }
      addSeg(pending, p);
      setPending(null);
      setHover(null);
      return;
    }

    if (tool === "perp") {
      if (!perpTarget) {
        const hit = nearestSeg(p, segs);
        if (!hit) return;
        const end = nearEndpoint(p, hit);
        if (end) {
          const line = perpendicularThrough(end, hit);
          if (line) addSeg(line.a, line.b);
          return;
        }
        setPerpTarget(hit.id);
        return;
      }
      const seg = segs.find((s) => s.id === perpTarget);
      if (!seg) {
        setPerpTarget(null);
        return;
      }
      const foot = projectOnSeg(p, seg.a, seg.b).point;
      const snappedFoot = applySnap(foot);
      const use = Math.hypot(snappedFoot.x - foot.x, snappedFoot.y - foot.y) < 0.35
        ? snappedFoot
        : foot;
      const line = perpendicularThrough(use, seg);
      if (line) addSeg(line.a, line.b);
      setPerpTarget(null);
      return;
    }

    if (tool === "measure") {
      const hit = nearestSeg(p, segs);
      if (!hit) return;
      setSegs((cur) =>
        cur.map((s) => (s.id === hit.id ? { ...s, measured: !s.measured } : s)),
      );
      return;
    }

    if (tool === "erase") {
      const hit = nearestSeg(p, segs);
      if (!hit) return;
      pushHistory(segs);
      setSegs((cur) => cur.filter((s) => s.id !== hit.id));
      if (perpTarget === hit.id) setPerpTarget(null);
    }
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (locked) return;
    const raw = clientToGrid(e);
    if (!raw) return;
    setHover(applySnap(raw));
  };

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1]!;
      setSegs(prev);
      setPending(null);
      setPerpTarget(null);
      return h.slice(0, -1);
    });
  };

  const clearAll = () => {
    if (segs.length === 0) return;
    pushHistory(segs);
    setSegs([]);
    setPending(null);
    setPerpTarget(null);
  };

  const placeOverlay = (kind: "ruler" | "protractor") => {
    const wrap = wrapRef.current;
    const cx = wrap ? wrap.clientWidth / 2 : 180;
    const cy = wrap ? wrap.clientHeight / 2 : 160;
    if (kind === "ruler") {
      setRuler((r) => (r ? null : { x: cx, y: cy + 40, angle: 0, length: RULER_DEFAULT }));
    } else {
      setProtractor((p) => (p ? null : { x: cx, y: cy + 20, angle: 0 }));
    }
  };

  const hint = TOOLS.find((t) => t.id === tool)?.hint ?? "";
  const preview =
    tool === "segment" && pending && hover
      ? { a: pending, b: hover }
      : null;

  return (
    <div className="flex h-full min-h-[22rem] flex-col overflow-hidden rounded-2xl border-2 border-wood/15 bg-[#fbf7ef]">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-wood/10 bg-cream px-2 py-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tool === t.id}
            disabled={locked}
            onClick={() => {
              setTool(t.id);
              setPending(null);
              setPerpTarget(null);
            }}
            className={[
              "rounded-lg px-2.5 py-1 text-xs font-bold",
              tool === t.id
                ? "bg-wood text-cream"
                : "bg-wood/10 text-wood hover:bg-wood/15",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-wood/20" />
        <button
          type="button"
          disabled={locked}
          onClick={() => placeOverlay("ruler")}
          className={[
            "rounded-lg px-2.5 py-1 text-xs font-bold",
            ruler ? "bg-gold/80 text-wood" : "bg-wood/10 text-wood hover:bg-wood/15",
          ].join(" ")}
        >
          자
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => placeOverlay("protractor")}
          className={[
            "rounded-lg px-2.5 py-1 text-xs font-bold",
            protractor ? "bg-sky/70 text-wood" : "bg-wood/10 text-wood hover:bg-wood/15",
          ].join(" ")}
        >
          각도기
        </button>
        <span className="ml-auto flex gap-1">
          <button
            type="button"
            disabled={locked || history.length === 0}
            onClick={undo}
            className="rounded-lg bg-wood/10 px-2 py-1 text-xs font-bold text-wood disabled:opacity-40"
          >
            실행 취소
          </button>
          <button
            type="button"
            disabled={locked || segs.length === 0}
            onClick={clearAll}
            className="rounded-lg bg-wood/10 px-2 py-1 text-xs font-bold text-wood disabled:opacity-40"
          >
            모두 지우기
          </button>
        </span>
      </div>

      <p className="px-3 py-1.5 text-[11px] font-semibold text-foreground/55">{hint}</p>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <svg
          ref={svgRef}
          viewBox={`${-PAD_X} ${-PAD_Y} ${VIEW_W} ${VIEW_H}`}
          className="h-full w-full touch-none"
          onPointerDown={onCanvasDown}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <rect
            x={0}
            y={0}
            width={GRID_W}
            height={GRID_H}
            fill="#fffdf8"
          />
          {Array.from({ length: GRID_W + 1 }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={i}
              y1={0}
              x2={i}
              y2={GRID_H}
              stroke={i === 0 ? "#8B5E3C" : i % 5 === 0 ? "#d7c4a8" : "#eee4d4"}
              strokeWidth={i === 0 ? 0.08 : 0.035}
            />
          ))}
          {Array.from({ length: GRID_H + 1 }).map((_, i) => {
            const mathY = i;
            const svgY = GRID_H - mathY;
            return (
              <line
                key={`h${i}`}
                x1={0}
                y1={svgY}
                x2={GRID_W}
                y2={svgY}
                stroke={mathY === 0 ? "#8B5E3C" : mathY % 5 === 0 ? "#d7c4a8" : "#eee4d4"}
                strokeWidth={mathY === 0 ? 0.08 : 0.035}
              />
            );
          })}
          {Array.from({ length: GRID_W + 1 }).map((_, i) =>
            i % 2 === 0 ? (
              <text
                key={`xl${i}`}
                x={i}
                y={GRID_H + 0.55}
                textAnchor="middle"
                fontSize={0.42}
                fill="#8B5E3C"
                fontWeight={700}
              >
                {i}
              </text>
            ) : null,
          )}
          {Array.from({ length: GRID_H + 1 }).map((_, i) =>
            i % 2 === 0 ? (
              <text
                key={`yl${i}`}
                x={-0.35}
                y={GRID_H - i + 0.14}
                textAnchor="end"
                fontSize={0.42}
                fill="#8B5E3C"
                fontWeight={700}
              >
                {i}
              </text>
            ) : null,
          )}

          {segs.map((s) => {
            const a = toSvg(s.a);
            const b = toSvg(s.b);
            const mid = toSvg({
              x: (s.a.x + s.b.x) / 2,
              y: (s.a.y + s.b.y) / 2,
            });
            const active = perpTarget === s.id;
            return (
              <g key={s.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={active ? "#c9a227" : "#3d4a8c"}
                  strokeWidth={active ? 0.14 : 0.1}
                  strokeLinecap="round"
                />
                <circle cx={a.x} cy={a.y} r={0.12} fill="#3d4a8c" />
                <circle cx={b.x} cy={b.y} r={0.12} fill="#3d4a8c" />
                {s.measured ? (
                  <text
                    x={mid.x}
                    y={mid.y - 0.25}
                    textAnchor="middle"
                    fontSize={0.48}
                    fontWeight={800}
                    fill="#a63a1a"
                  >
                    {formatLength(segLength(s))}
                  </text>
                ) : null}
              </g>
            );
          })}

          {preview ? (
            <line
              x1={toSvg(preview.a).x}
              y1={toSvg(preview.a).y}
              x2={toSvg(preview.b).x}
              y2={toSvg(preview.b).y}
              stroke="#8B5E3C"
              strokeWidth={0.08}
              strokeDasharray="0.25 0.18"
            />
          ) : null}

          {pending ? (
            <circle
              cx={toSvg(pending).x}
              cy={toSvg(pending).y}
              r={0.16}
              fill="#e85d4c"
            />
          ) : null}

          {hover && !locked ? (
            <circle
              cx={toSvg(hover).x}
              cy={toSvg(hover).y}
              r={0.12}
              fill="none"
              stroke="#8B5E3C"
              strokeWidth={0.06}
            />
          ) : null}
        </svg>

        {ruler && !locked ? (
          <RulerOverlay
            pose={ruler}
            onChange={setRuler}
            onClose={() => setRuler(null)}
          />
        ) : null}
        {protractor && !locked ? (
          <ProtractorOverlay
            pose={protractor}
            onChange={setProtractor}
            onClose={() => setProtractor(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
