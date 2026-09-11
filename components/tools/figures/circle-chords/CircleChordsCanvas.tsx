"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditedLabel,
  chordFromTwoPoints,
  chordMath,
  cycleIntersectionMode,
  findChordIntersections,
  isMeasureKey,
  mapChord,
  moveChordDistance,
  nextChordNames,
  nudgeById,
  nudgeMeasureLabel,
  nudgeMeasureLine,
  parseMeasureId,
  projectOnCircle,
  rotateChordToPoint,
  toggleChordSegmentLength,
  toggleRadius,
  type ChordSegKey,
} from "@/lib/diagrams/circle-chords/geometry";
import {
  chordMidpointMode,
  cycleCenterPointMode,
  cycleChordPointMode,
  type CircleChordsState,
} from "@/lib/diagrams/circle-chords/model";
import { paintCircleChordsScene } from "@/lib/diagrams/circle-chords/render";
import {
  buildCircleChordsScene,
  canvasToMath,
  hitTestFigure,
  mathToCanvas,
  measureFrame,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  sceneTextPlain,
  type DiagramScene,
  type FigureHit,
} from "@/lib/diagrams/circle-chords/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";

const MOVE_PX = 5;

type Tool = "select" | "draw";

type Drag =
  | { t: "label"; id: string; x: number; y: number; moved: boolean }
  | { t: "dimLine"; id: string; x: number; y: number; moved: boolean }
  | {
      t: "rotate";
      chordId: string;
      which: "start" | "end";
      startX: number;
      startY: number;
      moved: boolean;
      fromChord?: boolean;
    }
  | {
      t: "distance";
      chordId: string;
      startX: number;
      startY: number;
      moved: boolean;
      fromChord?: boolean;
    }
  | {
      t: "intersectionPoint";
      id: string;
      startX: number;
      startY: number;
      moved: boolean;
    }
  | { t: "view"; lastX: number; lastY: number; moved?: boolean }
  | { t: "draw"; a: { x: number; y: number }; b: { x: number; y: number } };

export type CircleChordsSetter = (
  updater:
    | CircleChordsState
    | ((prev: CircleChordsState) => CircleChordsState),
  persist?: boolean,
) => void;

type Props = {
  state: CircleChordsState;
  fonts: FontFaces;
  tool: Tool;
  selectedId: string | null;
  selectedSeg?: ChordSegKey | null;
  setState: CircleChordsSetter;
  persist: () => void;
  onSelect: (id: string | null, segKey?: ChordSegKey) => void;
  onToolChange: (tool: Tool) => void;
  onDeleteSelected: () => void;
};

export default function CircleChordsCanvas({
  state,
  fonts,
  tool,
  selectedId,
  selectedSeg,
  setState,
  persist,
  onSelect,
  onToolChange,
  onDeleteSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DiagramScene | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<FigureHit | null>(null);
  const pendingDrawRef = useRef<{ x: number; y: number } | null>(null);
  const stateRef = useRef(state);
  const toolRef = useRef(tool);
  const selectedRef = useRef(selectedId);
  const [edit, setEdit] = useState<{
    id: string;
    value: string;
    x: number;
    y: number;
  } | null>(null);
  const editRef = useRef(edit);
  editRef.current = edit;

  stateRef.current = state;
  toolRef.current = tool;
  selectedRef.current = selectedId;
  const selectedSegRef = useRef(selectedSeg);
  selectedSegRef.current = selectedSeg;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = stateRef.current;
    const scene = buildCircleChordsScene(current);
    sceneRef.current = scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SCENE_WIDTH * dpr);
    canvas.height = Math.round(SCENE_HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintCircleChordsScene(ctx, scene, fonts, current.style.lineWidth);
    paintOverlays(
      ctx,
      scene,
      current,
      selectedRef.current,
      selectedSegRef.current,
      hoverRef.current,
      dragRef.current,
      pendingDrawRef.current,
    );
  }, [fonts]);

  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) paint();
    });
    paint();
    return () => {
      cancelled = true;
    };
  }, [paint, state, selectedId, selectedSeg]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dragRef.current = null;
        pendingDrawRef.current = null;
        setEdit(null);
        onToolChange("select");
        paint();
        return;
      }
      if (editRef.current) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        onDeleteSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToolChange, onDeleteSelected, paint]);

  function scenePoint(e: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SCENE_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * SCENE_HEIGHT,
    };
  }

  function hitScale() {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    const width = canvas.getBoundingClientRect().width;
    return width > 1 ? SCENE_WIDTH / width : 1;
  }

  function hitAt(e: { clientX: number; clientY: number }) {
    const scene = sceneRef.current;
    if (!scene) return null;
    const p = scenePoint(e);
    return hitTestFigure(stateRef.current, scene, p.x, p.y, hitScale());
  }

  function setCursor(value: string) {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = value;
  }

  function commitEdit(next: string | null) {
    const current = editRef.current;
    if (!current) return;
    const value = next ?? current.value;
    editRef.current = null;
    setEdit(null);
    setState((prev) => applyEditedLabel(prev, current.id, value), true);
  }

  function finishChord(
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) {
    const radius = stateRef.current.radius;
    if (Math.hypot(b.x - a.x, b.y - a.y) <= radius * 0.08) return false;
    if (stateRef.current.chords.length >= 4) return false;
    const chord = chordFromTwoPoints(
      a,
      b,
      radius,
      nextChordNames(stateRef.current),
    );
    setState((prev) => {
      if (prev.chords.length >= 4) return prev;
      return { ...prev, chords: [...prev.chords, chord] };
    }, true);
    onSelect(chord.id, "chord");
    onToolChange("select");
    pendingDrawRef.current = null;
    return true;
  }

  function startDraw(math: { x: number; y: number }) {
    if (stateRef.current.chords.length >= 4) return;
    const point = projectOnCircle(math, stateRef.current.radius);
    if (pendingDrawRef.current) {
      finishChord(pendingDrawRef.current, point);
      dragRef.current = null;
      paint();
      return;
    }
    dragRef.current = { t: "draw", a: point, b: point };
    setCursor("crosshair");
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={SCENE_WIDTH}
        height={SCENE_HEIGHT}
        className="h-auto w-full touch-none bg-white"
        tabIndex={0}
        aria-label="원과 현. 원 위를 끌어 현을 그리고, 점을 옮기거나 글자를 눌러 바꿀 수 있어요."
        onPointerDown={(e) => {
          if (editRef.current) commitEdit(null);
          const scene = sceneRef.current;
          if (!scene) return;
          const p = scenePoint(e);
          const math = canvasToMath(p, scene.layout);
          const hit = hitAt(e);
          hoverRef.current = null;
          const drawing = toolRef.current === "draw";

          if (drawing && !isKeepSelectHit(hit)) {
            startDraw(math);
            e.currentTarget.setPointerCapture(e.pointerId);
            paint();
            return;
          }

          if (!hit) {
            onSelect(null);
            if (drawing) {
              startDraw(math);
              e.currentTarget.setPointerCapture(e.pointerId);
              paint();
            }
            return;
          }

          if (hit.kind === "label") {
            dragRef.current = {
              t: "label",
              id: hit.id,
              x: p.x,
              y: p.y,
              moved: false,
            };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            const parsed = parseMeasureId(hit.id);
            if (parsed) {
              const segKey = segKeyFromMeasureKey(parsed.key);
              onSelect(parsed.chordId, segKey);
            }
            return;
          }

          if (hit.kind === "dimLine") {
            dragRef.current = {
              t: "dimLine",
              id: hit.id,
              x: p.x,
              y: p.y,
              moved: false,
            };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            const parsed = parseMeasureId(hit.id);
            if (parsed) {
              const segKey = segKeyFromMeasureKey(parsed.key);
              onSelect(parsed.chordId, segKey);
            }
            return;
          }

          if (hit.kind === "seg") {
            onSelect(hit.chordId, hit.segKey);
            setState(
              (prev) => toggleChordSegmentLength(prev, hit.chordId, hit.segKey),
              true,
            );
            return;
          }

          if (hit.kind === "point") {
            onSelect(hit.chordId);
            dragRef.current =
              hit.which === "mid"
                ? {
                    t: "distance",
                    chordId: hit.chordId,
                    startX: p.x,
                    startY: p.y,
                    moved: false,
                    fromChord: false,
                  }
                : {
                    t: "rotate",
                    chordId: hit.chordId,
                    which: hit.which,
                    startX: p.x,
                    startY: p.y,
                    moved: false,
                    fromChord: false,
                  };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          if (hit.kind === "chord") {
            onSelect(hit.chordId, "chord");
            dragRef.current =
              hit.t < 0.28
                ? {
                    t: "rotate",
                    chordId: hit.chordId,
                    which: "start",
                    startX: p.x,
                    startY: p.y,
                    moved: false,
                    fromChord: true,
                  }
                : hit.t > 0.72
                  ? {
                      t: "rotate",
                      chordId: hit.chordId,
                      which: "end",
                      startX: p.x,
                      startY: p.y,
                      moved: false,
                      fromChord: true,
                    }
                  : {
                      t: "distance",
                      chordId: hit.chordId,
                      startX: p.x,
                      startY: p.y,
                      moved: false,
                      fromChord: true,
                    };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          if (hit.kind === "intersectionPoint") {
            dragRef.current = {
              t: "intersectionPoint",
              id: hit.id,
              startX: p.x,
              startY: p.y,
              moved: false,
            };
            setCursor("pointer");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          if (hit.kind === "center") {
            dragRef.current = { t: "view", lastX: p.x, lastY: p.y, moved: false };
            setCursor("grabbing");
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          if (hit.kind === "circle") {
            startDraw(math);
            e.currentTarget.setPointerCapture(e.pointerId);
            paint();
          }
        }}
        onDoubleClick={(e) => {
          const hit = hitAt(e);
          if (hit?.kind !== "point") return;
          if (hit.which === "mid") {
            setState(
              (prev) =>
                mapChord(prev, hit.chordId, (chord) =>
                  cycleChordPointMode(chord, "mid"),
                ),
              true,
            );
            return;
          }
          const which = hit.which;
          setState(
            (prev) =>
              mapChord(prev, hit.chordId, (chord) => ({
                ...chord,
                ...toggleRadius(chord, which),
              })),
            true,
          );
        }}
        onPointerMove={(e) => {
          const scene = sceneRef.current;
          const p = scenePoint(e);
          const drag = dragRef.current;
          if (!drag) {
            const hit = hitAt(e);
            const changed = !sameHit(hoverRef.current, hit);
            hoverRef.current = hit;
            setCursor(cursorForHit(hit, toolRef.current));
            if (changed) paint();
            return;
          }

          const current = stateRef.current;
          if (drag.t === "label" || drag.t === "dimLine") {
            const dx = p.x - drag.x;
            const dy = p.y - drag.y;
            const moved = drag.moved || Math.hypot(dx, dy) > MOVE_PX;
            dragRef.current = { ...drag, x: p.x, y: p.y, moved };
            if (moved) {
              const parsed = parseMeasureId(drag.id);
              const frame =
                scene && parsed && isMeasureKey(parsed.key)
                  ? measureFrame(current, scene, drag.id)
                  : null;
              if (frame && parsed) {
                const nudge =
                  drag.t === "dimLine" ? nudgeMeasureLine : nudgeMeasureLabel;
                setState(
                  (prev) =>
                    mapChord(prev, parsed.chordId, (c) => ({
                      ...c,
                      [parsed.key]: nudge(
                        c[parsed.key as "chordLabel"],
                        dx,
                        dy,
                        frame.along,
                        frame.outward,
                        frame.halfSpan,
                      ),
                    })),
                  false,
                );
              } else {
                setState(
                  (prev) =>
                    nudgeById(prev, drag.id, dx, dy, drag.t === "dimLine"),
                  false,
                );
              }
            }
            return;
          }

          if (!scene) return;
          const math = canvasToMath(p, scene.layout);

          if (drag.t === "rotate") {
            if (
              !drag.moved &&
              Math.hypot(p.x - drag.startX, p.y - drag.startY) > MOVE_PX
            ) {
              drag.moved = true;
            }
            if (drag.moved) {
              setState(
                (prev) =>
                  mapChord(prev, drag.chordId, (chord) =>
                    rotateChordToPoint(chord, prev.radius, math, drag.which),
                  ),
                false,
              );
            }
            return;
          }

          if (drag.t === "distance") {
            if (
              !drag.moved &&
              Math.hypot(p.x - drag.startX, p.y - drag.startY) > MOVE_PX
            ) {
              drag.moved = true;
            }
            if (drag.moved) {
              setState(
                (prev) =>
                  mapChord(prev, drag.chordId, (chord) =>
                    moveChordDistance(chord, prev.radius, math),
                  ),
                false,
              );
            }
            return;
          }

          if (drag.t === "intersectionPoint") {
            if (
              !drag.moved &&
              Math.hypot(p.x - drag.startX, p.y - drag.startY) > MOVE_PX
            ) {
              drag.moved = true;
            }
            return;
          }

          if (drag.t === "view") {
            if (
              !drag.moved &&
              Math.hypot(p.x - drag.lastX, p.y - drag.lastY) > MOVE_PX
            ) {
              drag.moved = true;
            }
            const origin = scene.layout.origin;
            const a0 = Math.atan2(origin.y - drag.lastY, drag.lastX - origin.x);
            const a1 = Math.atan2(origin.y - p.y, p.x - origin.x);
            const delta = ((a1 - a0) * 180) / Math.PI;
            dragRef.current = { t: "view", lastX: p.x, lastY: p.y, moved: true };
            setState(
              (prev) => ({
                ...prev,
                viewRotationDeg: prev.viewRotationDeg + delta,
              }),
              false,
            );
            return;
          }

          if (drag.t === "draw") {
            dragRef.current = {
              t: "draw",
              a: drag.a,
              b: projectOnCircle(math, current.radius),
            };
            paint();
          }
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          dragRef.current = null;
          setCursor("default");
          persist();

          if (!drag) return;

          if (drag.t === "label" && !drag.moved) {
            const scene = sceneRef.current;
            const text = scene?.texts.find((item) => item.id === drag.id);
            if (text) {
              setEdit({
                id: drag.id,
                value: sceneTextPlain(text),
                x: text.x,
                y: text.y,
              });
            }
            return;
          }

          if (drag.t === "intersectionPoint" && !drag.moved) {
            setState((prev) => cycleIntersectionMode(prev, drag.id), true);
            return;
          }

          if (
            (drag.t === "rotate" || drag.t === "distance") &&
            !drag.moved &&
            !drag.fromChord
          ) {
            const which = drag.t === "distance" ? "mid" : drag.which;
            setState(
              (prev) =>
                mapChord(prev, drag.chordId, (c) =>
                  cycleChordPointMode(c, which),
                ),
              true,
            );
            return;
          }

          if (drag.t === "view" && !drag.moved) {
            setState((prev) => cycleCenterPointMode(prev), true);
            return;
          }

          if (
            (drag.t === "rotate" || drag.t === "distance") &&
            !drag.moved &&
            drag.fromChord
          ) {
            setState(
              (prev) => toggleChordSegmentLength(prev, drag.chordId, "chord"),
              true,
            );
            return;
          }

          if (drag.t === "rotate") {
            const scene = sceneRef.current;
            const p = scenePoint(e);
            if (scene) {
              const o = scene.layout.origin;
              if (Math.hypot(p.x - o.x, p.y - o.y) < 28) {
                setState(
                  (prev) =>
                    mapChord(prev, drag.chordId, (chord) => {
                      if (drag.which === "start") {
                        if (chord.showRadiusStart) return chord;
                        return { ...chord, ...toggleRadius(chord, "start") };
                      }
                      if (chord.showRadiusEnd) return chord;
                      return { ...chord, ...toggleRadius(chord, "end") };
                    }),
                  true,
                );
              }
            }
          }

          if (drag.t === "draw") {
            if (!finishChord(drag.a, drag.b)) {
              pendingDrawRef.current = drag.a;
            }
            paint();
          }

          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => {
          if (dragRef.current) return;
          hoverRef.current = null;
          setCursor("default");
          paint();
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          hoverRef.current = null;
          setCursor("default");
          persist();
          paint();
        }}
      />
      {edit ? (
        <input
          autoFocus
          value={edit.value}
          aria-label="그림 글자 수정"
          onChange={(e) => setEdit({ ...edit, value: e.target.value })}
          onBlur={() => commitEdit(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit(edit.value);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              editRef.current = null;
              setEdit(null);
            }
          }}
          className="absolute z-10 min-w-[4.5rem] rounded-lg border-2 border-wood bg-white px-2 py-0.5 text-center text-[15px] text-black shadow-md outline-none"
          style={{
            left: `${(edit.x / SCENE_WIDTH) * 100}%`,
            top: `${(edit.y / SCENE_HEIGHT) * 100}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: "Times New Roman, Noto Serif, Batang, serif",
          }}
        />
      ) : null}
    </div>
  );
}

function isKeepSelectHit(hit: FigureHit | null): boolean {
  return (
    hit?.kind === "label" ||
    hit?.kind === "dimLine" ||
    hit?.kind === "seg" ||
    hit?.kind === "point" ||
    hit?.kind === "intersectionPoint" ||
    hit?.kind === "chord" ||
    hit?.kind === "center"
  );
}

function sameHit(a: FigureHit | null, b: FigureHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "label" || a.kind === "dimLine") {
    return a.id === (b as { id: string }).id;
  }
  if (a.kind === "seg") {
    return (
      b.kind === "seg" &&
      a.chordId === b.chordId &&
      a.segKey === b.segKey
    );
  }
  if (a.kind === "point") {
    return (
      b.kind === "point" && a.chordId === b.chordId && a.which === b.which
    );
  }
  if (a.kind === "intersectionPoint") {
    return b.kind === "intersectionPoint" && a.id === b.id;
  }
  if (a.kind === "chord") {
    return b.kind === "chord" && a.chordId === b.chordId;
  }
  return true;
}

function chordIdFromLabel(id: string): string | null {
  return parseMeasureId(id)?.chordId ?? null;
}

function segKeyFromMeasureKey(key: string): ChordSegKey | undefined {
  if (key === "chordLabel") return "chord";
  if (key === "distLabel") return "dist";
  if (key === "halfLabel") return "half";
  if (key === "radiusStartLabel") return "radiusStart";
  if (key === "radiusEndLabel") return "radiusEnd";
  return undefined;
}

function cursorForHit(hit: FigureHit | null, tool: Tool): string {
  if (tool === "draw") return "crosshair";
  if (!hit) return "default";
  if (hit.kind === "circle") return "crosshair";
  if (hit.kind === "label") return "text";
  if (hit.kind === "seg" || hit.kind === "intersectionPoint") return "pointer";
  return "grab";
}

function paintHandle(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  selected: boolean,
  hovered: boolean,
) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, hovered ? 10 : selected ? 8.5 : 7, 0, Math.PI * 2);
  if (selected || hovered) {
    ctx.fillStyle = hovered
      ? "rgba(196, 130, 58, 0.28)"
      : "rgba(196, 130, 58, 0.18)";
    ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
    ctx.lineWidth = 2.2;
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.strokeStyle = "rgba(17, 17, 17, 0.38)";
    ctx.lineWidth = 1.4;
  }
  ctx.fill();
  ctx.stroke();
}

function paintDimHover(
  ctx: CanvasRenderingContext2D,
  scene: DiagramScene,
  id: string,
) {
  ctx.save();
  ctx.strokeStyle = "rgba(196, 130, 58, 0.9)";
  ctx.lineWidth = 3;
  ctx.lineCap = "butt";
  ctx.setLineDash([6, 4]);
  for (const cmd of scene.cmds) {
    if (!("id" in cmd) || !cmd.id) continue;
    const target = cmd.id.endsWith(":line") ? cmd.id.slice(0, -5) : cmd.id;
    if (target !== id) continue;
    if (cmd.t === "arc") {
      ctx.beginPath();
      ctx.arc(cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw);
      ctx.stroke();
    } else if (cmd.t === "line" && cmd.dashed) {
      ctx.beginPath();
      ctx.moveTo(cmd.x1, cmd.y1);
      ctx.lineTo(cmd.x2, cmd.y2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  scene: DiagramScene,
  state: CircleChordsState,
  selectedId: string | null,
  selectedSeg: ChordSegKey | null | undefined,
  hover: FigureHit | null,
  drag: Drag | null,
  pending: { x: number; y: number } | null,
) {
  ctx.save();
  for (const chord of state.chords) {
    const { A, B, M } = chordMath(chord, state.radius);
    const cA = mathToCanvas(A, scene.layout);
    const cB = mathToCanvas(B, scene.layout);
    const cM = mathToCanvas(M, scene.layout);
    const cO = scene.layout.origin;
    const isChordSelected = chord.id === selectedId;

    if (isChordSelected) {
      const isSegChord = !selectedSeg || selectedSeg === "chord";
      ctx.save();
      ctx.strokeStyle = isSegChord
        ? "rgba(196, 130, 58, 0.95)"
        : "rgba(196, 130, 58, 0.45)";
      ctx.lineWidth = isSegChord ? 2.8 : 1.8;
      ctx.beginPath();
      ctx.moveTo(cA.x, cA.y);
      ctx.lineTo(cB.x, cB.y);
      ctx.stroke();

      if (selectedSeg && selectedSeg !== "chord") {
        let p1: { x: number; y: number } | null = null;
        let p2: { x: number; y: number } | null = null;
        if (selectedSeg === "dist" && chord.showPerp) {
          p1 = cO;
          p2 = cM;
        } else if (selectedSeg === "radiusStart" && chord.showRadiusStart) {
          p1 = cO;
          p2 = cA;
        } else if (selectedSeg === "radiusEnd" && chord.showRadiusEnd) {
          p1 = cO;
          p2 = cB;
        } else if (selectedSeg === "half" && chord.showHalf) {
          p1 = cM;
          p2 = cB;
        }
        if (p1 && p2) {
          ctx.strokeStyle = "rgba(196, 130, 58, 0.95)";
          ctx.lineWidth = 3.2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    const handles: { p: { x: number; y: number }; which: "start" | "end" | "mid" }[] =
      [
        { p: cA, which: "start" },
        { p: cB, which: "end" },
      ];
    const mMode = chordMidpointMode(chord);
    if (mMode !== "none" || chord.showMidpoint || (isChordSelected && chord.showPerp)) {
      handles.push({ p: cM, which: "mid" });
    }
    for (const handle of handles) {
      const hovered =
        hover?.kind === "point" &&
        hover.chordId === chord.id &&
        hover.which === handle.which;
      paintHandle(ctx, handle.p, isChordSelected, hovered);
    }
  }

  if (hover?.kind === "seg") {
    const chord = state.chords.find((c) => c.id === hover.chordId);
    if (chord) {
      const { A, B, M } = chordMath(chord, state.radius);
      const cA = mathToCanvas(A, scene.layout);
      const cB = mathToCanvas(B, scene.layout);
      const cM = mathToCanvas(M, scene.layout);
      const cO = scene.layout.origin;
      let p1: { x: number; y: number } | null = null;
      let p2: { x: number; y: number } | null = null;
      if (hover.segKey === "dist") {
        p1 = cO;
        p2 = cM;
      } else if (hover.segKey === "radiusStart") {
        p1 = cO;
        p2 = cA;
      } else if (hover.segKey === "radiusEnd") {
        p1 = cO;
        p2 = cB;
      } else if (hover.segKey === "half") {
        p1 = cM;
        p2 = cB;
      }
      if (p1 && p2) {
        ctx.save();
        ctx.strokeStyle = "rgba(196, 130, 58, 0.75)";
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  if (hover?.kind === "chord" && !drag) {
    const chord = state.chords.find((c) => c.id === hover.chordId);
    if (chord) {
      const { A, B } = chordMath(chord, state.radius);
      const cA = mathToCanvas(A, scene.layout);
      const cB = mathToCanvas(B, scene.layout);
      ctx.save();
      ctx.strokeStyle = "rgba(196, 130, 58, 0.45)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cA.x, cA.y);
      ctx.lineTo(cB.x, cB.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  const intersections = findChordIntersections(state);
  for (const ix of intersections) {
    if (ix.mode !== "none") {
      const cP = mathToCanvas(ix.point, scene.layout);
      const hovered =
        hover?.kind === "intersectionPoint" && hover.id === ix.id;
      paintHandle(ctx, cP, false, hovered);
    }
  }

  if (hover?.kind === "center") {
    paintHandle(ctx, scene.layout.origin, false, true);
  }
  if (hover?.kind === "dimLine") {
    paintDimHover(ctx, scene, hover.id);
  }
  ctx.restore();

  const ghost =
    drag?.t === "draw" ? drag : pending ? { a: pending, b: pending } : null;
  if (ghost) {
    const a = mathToCanvas(ghost.a, scene.layout);
    const b = mathToCanvas(ghost.b, scene.layout);
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = "rgba(17, 17, 17, 0.55)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#111";
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
