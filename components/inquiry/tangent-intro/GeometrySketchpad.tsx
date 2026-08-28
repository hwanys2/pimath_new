"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  allIntersections,
  ANGLE_DIAL_MAX,
  ANGLE_DIAL_RADIUS,
  angleDialPoint,
  baseDirection,
  dist,
  elevationDegFromBase,
  formatLength,
  GRID_H,
  GRID_W,
  leftVertex,
  measureLabelGridPos,
  nearestMeasureLabel,
  nearestSeg,
  nearestSubSegment,
  nearEndpoint,
  perpendicularThrough,
  projectOnSeg,
  rayEndpoint,
  snapPoint,
  subSegments,
  chunkKey,
  type LabelOffset,
  type SketchSeg,
  type Vec2,
} from "@/lib/inquiry-tangent-sketch";
import {
  readSketchDraft,
  writeSketchDraft,
  type SketchpadPersisted,
} from "@/lib/inquiry-sketch-persist";
import { AngleDegreeMark } from "./SketchOverlays";
import { clientToSvgUser } from "@/lib/svg-pointer";

type Tool = "segment" | "perp" | "angle" | "measure" | "move" | "erase";

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
  {
    id: "perp",
    label: "수선",
    hint: "선분을 고른 뒤, 수선을 내릴 점을 찍으세요. 끝점을 누르면 바로 그려져요.",
  },
  {
    id: "angle",
    label: "각",
    hint: "밑변 선분을 고른 뒤, 단위원 눈금을 따라 1° 단위로 각을 맞추고 떼면 반직선이 그려져요.",
  },
  {
    id: "measure",
    label: "길이",
    hint: "길이를 볼 선분 조각을 누르세요. 누른 부분만 길이가 표시돼요.",
  },
  {
    id: "move",
    label: "이동",
    hint: "길이 숫자를 드래그해 겹치지 않게 옮길 수 있어요.",
  },
  { id: "erase", label: "지우개", hint: "지울 선분을 누르세요." },
];

type Props = {
  locked?: boolean;
  /** When set, sketch state is saved to localStorage for refresh recovery. */
  persistKey?: string | null;
};

type AngleSession = {
  segId: string;
  origin: Vec2;
  baseDir: Vec2;
  deg: number;
};

function semicirclePath(origin: Vec2, baseDir: Vec2, radius: number, maxDeg: number): string {
  const baseAng = Math.atan2(baseDir.y, baseDir.x);
  const steps = Math.max(8, maxDeg);
  const pts: Vec2[] = [];
  for (let d = 0; d <= maxDeg; d += 1) {
    const rad = baseAng + (d * Math.PI) / 180;
    pts.push({
      x: origin.x + radius * Math.cos(rad),
      y: origin.y + radius * Math.sin(rad),
    });
  }
  const first = toSvg(pts[0]!);
  const rest = pts
    .slice(1)
    .map((p) => {
      const s = toSvg(p);
      return `${s.x} ${s.y}`;
    })
    .join(" L ");
  return `M ${first.x} ${first.y} L ${rest}`;
}

export default function GeometrySketchpad({
  locked = false,
  persistKey = null,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(1);
  const draggingAngle = useRef(false);
  const draggingLabel = useRef<{
    key: string;
    pointerStart: Vec2;
    offsetStart: LabelOffset;
  } | null>(null);

  const [tool, setTool] = useState<Tool>("segment");
  const [segs, setSegs] = useState<SketchSeg[]>([]);
  const [history, setHistory] = useState<SketchSeg[][]>([]);
  const [pending, setPending] = useState<Vec2 | null>(null);
  const [perpTarget, setPerpTarget] = useState<string | null>(null);
  const [angleSession, setAngleSession] = useState<AngleSession | null>(null);
  const [measuredChunks, setMeasuredChunks] = useState<Set<string>>(new Set());
  const [labelOffsets, setLabelOffsets] = useState<Record<string, LabelOffset>>(
    {},
  );
  const [hover, setHover] = useState<Vec2 | null>(null);

  const intersections = useMemo(() => allIntersections(segs), [segs]);

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
    const local = clientToSvgUser(svg, e.clientX, e.clientY);
    if (!local) return null;
    return fromSvg(local.x, local.y);
  };

  const applySnap = useCallback((p: Vec2) => snapPoint(p, segs), [segs]);

  const resetToolState = () => {
    setPending(null);
    setPerpTarget(null);
    setAngleSession(null);
    draggingAngle.current = false;
    draggingLabel.current = null;
  };

  useEffect(() => {
    if (!persistKey) return;
    const saved = readSketchDraft(persistKey);
    if (!saved) return;
    setSegs(saved.segs);
    setMeasuredChunks(new Set(saved.measuredChunks));
    setLabelOffsets(saved.labelOffsets);
    idRef.current = Math.max(1, saved.nextId);
    setHistory([]);
    resetToolState();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per persistKey
  }, [persistKey]);

  useEffect(() => {
    if (!persistKey) return;
    const payload: SketchpadPersisted = {
      v: 1,
      segs,
      measuredChunks: [...measuredChunks],
      labelOffsets,
      nextId: idRef.current,
    };
    writeSketchDraft(persistKey, payload);
  }, [persistKey, segs, measuredChunks, labelOffsets]);

  const addSeg = (a: Vec2, b: Vec2, extra?: Pick<SketchSeg, "angle">) => {
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.2) return;
    pushHistory(segs);
    setSegs((cur) => [...cur, { id: nextId(), a, b, ...extra }]);
  };

  const openAngleSession = (seg: SketchSeg, pointer?: Vec2) => {
    const origin = leftVertex(seg);
    const baseDir = baseDirection(seg);
    const deg = pointer
      ? elevationDegFromBase(origin, baseDir, pointer)
      : 45;
    setAngleSession({ segId: seg.id, origin, baseDir, deg });
    setPerpTarget(null);
  };

  const updateAngleFromPointer = (session: AngleSession, pointer: Vec2): AngleSession => {
    const deg = elevationDegFromBase(session.origin, session.baseDir, pointer);
    return { ...session, deg: Math.min(ANGLE_DIAL_MAX, Math.max(0, deg)) };
  };

  const commitAngleSession = (session: AngleSession) => {
    if (session.deg <= 0) {
      setAngleSession(null);
      draggingAngle.current = false;
      return;
    }
    const end = rayEndpoint(session.origin, session.baseDir, session.deg);
    if (end) {
      addSeg(session.origin, end, {
        angle: {
          origin: session.origin,
          baseDir: session.baseDir,
          deg: session.deg,
          sign: 1,
        },
      });
    }
    setAngleSession(null);
    draggingAngle.current = false;
  };

  const onCanvasDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (locked) return;
    if ((e.target as Element).closest("button")) return;
    const raw = clientToGrid(e);
    if (!raw) return;

    if (tool === "angle") {
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      if (angleSession) {
        e.currentTarget.setPointerCapture(e.pointerId);
        draggingAngle.current = true;
        setAngleSession((s) => (s ? updateAngleFromPointer(s, raw) : s));
        return;
      }
      const hit = nearestSeg(raw, segs);
      if (!hit) {
        setAngleSession(null);
        return;
      }
      openAngleSession(hit, raw);
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingAngle.current = true;
      return;
    }

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
        setAngleSession(null);
        return;
      }
      const seg = segs.find((s) => s.id === perpTarget);
      if (!seg) {
        setPerpTarget(null);
        return;
      }
      const foot = projectOnSeg(p, seg.a, seg.b).point;
      const snappedFoot = applySnap(foot);
      const use =
        Math.hypot(snappedFoot.x - foot.x, snappedFoot.y - foot.y) < 0.35
          ? snappedFoot
          : foot;
      const line = perpendicularThrough(use, seg);
      if (line) addSeg(line.a, line.b);
      setPerpTarget(null);
      return;
    }

    if (tool === "measure") {
      const hit = nearestSubSegment(p, segs);
      if (!hit) return;
      const key = chunkKey(hit.seg.id, hit.chunkIndex);
      setMeasuredChunks((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      return;
    }

    if (tool === "move") {
      const hit = nearestMeasureLabel(raw, segs, measuredChunks, labelOffsets);
      if (!hit) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingLabel.current = {
        key: hit.key,
        pointerStart: raw,
        offsetStart: labelOffsets[hit.key] ?? { dx: 0, dy: 0 },
      };
      return;
    }

    if (tool === "erase") {
      const hit = nearestSeg(p, segs);
      if (!hit) return;
      pushHistory(segs);
      setSegs((cur) => cur.filter((s) => s.id !== hit.id));
      setMeasuredChunks((prev) => {
        const next = new Set(prev);
        for (const k of prev) {
          if (k.startsWith(`${hit.id}:`)) next.delete(k);
        }
        return next;
      });
      setLabelOffsets((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(prev)) {
          if (k.startsWith(`${hit.id}:`)) delete next[k];
        }
        return next;
      });
      if (perpTarget === hit.id) setPerpTarget(null);
      if (angleSession?.segId === hit.id) setAngleSession(null);
    }
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (locked) return;
    const raw = clientToGrid(e);
    if (!raw) return;

    if (tool === "angle" && draggingAngle.current && angleSession) {
      e.preventDefault();
      setAngleSession(updateAngleFromPointer(angleSession, raw));
      return;
    }

    if (tool === "move" && draggingLabel.current) {
      const drag = draggingLabel.current;
      setLabelOffsets((prev) => ({
        ...prev,
        [drag.key]: {
          dx: drag.offsetStart.dx + (raw.x - drag.pointerStart.x),
          dy: drag.offsetStart.dy + (raw.y - drag.pointerStart.y),
        },
      }));
      return;
    }

    if (tool === "angle" && angleSession) {
      setAngleSession(updateAngleFromPointer(angleSession, raw));
      return;
    }

    setHover(applySnap(raw));
  };

  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === "move" && draggingLabel.current) {
      draggingLabel.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (tool === "angle" && draggingAngle.current && angleSession) {
      commitAngleSession(angleSession);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1]!;
      setSegs(prev);
      resetToolState();
      setMeasuredChunks(new Set());
      setLabelOffsets({});
      return h.slice(0, -1);
    });
  };

  const clearAll = () => {
    if (segs.length === 0) return;
    pushHistory(segs);
    setSegs([]);
    resetToolState();
    setMeasuredChunks(new Set());
    setLabelOffsets({});
  };

  const hint =
    tool === "move"
      ? "길이 숫자를 드래그해 보이는 위치로 옮기세요."
      : tool === "angle" && angleSession
      ? draggingAngle.current
        ? `${angleSession.deg}° — 손을 떼면 반직선이 그려져요.`
        : "단위원을 드래그해 각을 1° 단위로 맞추세요."
      : (TOOLS.find((t) => t.id === tool)?.hint ?? "");

  const preview =
    tool === "segment" && pending && hover ? { a: pending, b: hover } : null;

  const dialPreviewEnd =
    angleSession && angleSession.deg > 0
      ? rayEndpoint(angleSession.origin, angleSession.baseDir, angleSession.deg)
      : null;

  return (
    <div className="flex h-full min-h-[22rem] flex-col overflow-hidden rounded-2xl border-2 border-wood/15 bg-[#fbf7ef] select-none">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-wood/10 bg-cream px-2 py-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tool === t.id}
            disabled={locked}
            onClick={() => {
              setTool(t.id);
              resetToolState();
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

      <div ref={wrapRef} className="relative min-h-0 flex-1 select-none">
        <svg
          ref={svgRef}
          viewBox={`${-PAD_X} ${-PAD_Y} ${VIEW_W} ${VIEW_H}`}
          className="h-full w-full touch-none select-none"
          style={{ userSelect: "none" }}
          onPointerDown={onCanvasDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={() => {
            if (!draggingAngle.current) setHover(null);
          }}
        >
          <rect x={0} y={0} width={GRID_W} height={GRID_H} fill="#fffdf8" />
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
                className="pointer-events-none select-none"
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
                className="pointer-events-none select-none"
              >
                {i}
              </text>
            ) : null,
          )}

          {segs.map((s) => {
            const a = toSvg(s.a);
            const b = toSvg(s.b);
            const active =
              perpTarget === s.id || angleSession?.segId === s.id;
            const parts = subSegments(s, segs);
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
                {parts.map((part, i) => {
                  const key = chunkKey(s.id, i);
                  if (!measuredChunks.has(key)) return null;
                  const labelGrid = measureLabelGridPos(
                    part,
                    labelOffsets[key] ?? { dx: 0, dy: 0 },
                  );
                  const pos = toSvg(labelGrid);
                  const activeMove =
                    tool === "move" && draggingLabel.current?.key === key;
                  return (
                    <text
                      key={key}
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      fontSize={0.44}
                      fontWeight={800}
                      fill="#a63a1a"
                      style={{ pointerEvents: "none" }}
                      opacity={activeMove ? 0.85 : 1}
                    >
                      {formatLength(dist(part.a, part.b))}
                    </text>
                  );
                })}
              </g>
            );
          })}

          {segs.map((s) =>
            s.angle ? (
              <AngleDegreeMark key={`ang-${s.id}`} angle={s.angle} toSvg={toSvg} />
            ) : null,
          )}

          {intersections.map((pt, i) => {
            const s = toSvg(pt);
            return (
              <circle
                key={`ix${i}`}
                cx={s.x}
                cy={s.y}
                r={0.18}
                fill="#e85d4c"
                stroke="#fff"
                strokeWidth={0.05}
              />
            );
          })}

          {angleSession ? (
            (() => {
              const { origin, baseDir, deg } = angleSession;
              const o = toSvg(origin);
              const dialPath = semicirclePath(
                origin,
                baseDir,
                ANGLE_DIAL_RADIUS,
                ANGLE_DIAL_MAX,
              );
              const handle = toSvg(
                angleDialPoint(origin, baseDir, deg, ANGLE_DIAL_RADIUS),
              );
              const baseTip = toSvg(
                angleDialPoint(origin, baseDir, 0, ANGLE_DIAL_RADIUS * 0.92),
              );
              const label = toSvg(
                angleDialPoint(origin, baseDir, deg, ANGLE_DIAL_RADIUS + 0.75),
              );
              const ticks = [];
              for (let d = 0; d <= ANGLE_DIAL_MAX; d += 5) {
                const outer = angleDialPoint(origin, baseDir, d, ANGLE_DIAL_RADIUS);
                const inner = angleDialPoint(
                  origin,
                  baseDir,
                  d,
                  ANGLE_DIAL_RADIUS - (d % 10 === 0 ? 0.22 : 0.12),
                );
                const a = toSvg(outer);
                const b = toSvg(inner);
                ticks.push(
                  <line
                    key={`tick-${d}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#8B5E3C"
                    strokeWidth={d % 10 === 0 ? 0.06 : 0.035}
                    opacity={0.55}
                  />,
                );
                if (d % 10 === 0 && d > 0) {
                  const t = toSvg(
                    angleDialPoint(origin, baseDir, d, ANGLE_DIAL_RADIUS + 0.45),
                  );
                  ticks.push(
                    <text
                      key={`lbl-${d}`}
                      x={t.x}
                      y={t.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={0.38}
                      fontWeight={700}
                      fill="#6b4423"
                      opacity={0.75}
                      className="pointer-events-none select-none"
                    >
                      {d}
                    </text>,
                  );
                }
              }
              return (
                <g>
                  <path
                    d={dialPath}
                    fill="none"
                    stroke="#b8a0e8"
                    strokeWidth={0.07}
                    strokeDasharray="0.12 0.1"
                    opacity={0.85}
                  />
                  {Array.from({ length: ANGLE_DIAL_MAX + 1 }).map((_, d) => {
                    if (d % 2 !== 0) return null;
                    const pt = toSvg(
                      angleDialPoint(origin, baseDir, d, ANGLE_DIAL_RADIUS),
                    );
                    return (
                      <circle
                        key={`dot-${d}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={0.045}
                        fill="#b8a0e8"
                        opacity={0.45}
                      />
                    );
                  })}
                  {ticks}
                  <line
                    x1={o.x}
                    y1={o.y}
                    x2={baseTip.x}
                    y2={baseTip.y}
                    stroke="#8B5E3C"
                    strokeWidth={0.07}
                    opacity={0.65}
                  />
                  {dialPreviewEnd ? (
                    <line
                      x1={o.x}
                      y1={o.y}
                      x2={toSvg(dialPreviewEnd).x}
                      y2={toSvg(dialPreviewEnd).y}
                      stroke="#6b4a9e"
                      strokeWidth={0.09}
                      strokeDasharray="0.18 0.12"
                    />
                  ) : null}
                  <line
                    x1={o.x}
                    y1={o.y}
                    x2={handle.x}
                    y2={handle.y}
                    stroke="#e85d4c"
                    strokeWidth={0.08}
                  />
                  <circle
                    cx={handle.x}
                    cy={handle.y}
                    r={0.18}
                    fill="#e85d4c"
                    stroke="#fff"
                    strokeWidth={0.05}
                  />
                  <circle
                    cx={o.x}
                    cy={o.y}
                    r={0.14}
                    fill="#c9a227"
                    stroke="#fff"
                    strokeWidth={0.04}
                  />
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={0.58}
                    fontWeight={800}
                    fill="#a63a1a"
                    className="pointer-events-none select-none"
                  >
                    {deg}°
                  </text>
                </g>
              );
            })()
          ) : null}

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
            <circle cx={toSvg(pending).x} cy={toSvg(pending).y} r={0.16} fill="#e85d4c" />
          ) : null}

          {hover && !locked && !angleSession ? (
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
      </div>
    </div>
  );
}
