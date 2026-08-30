import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import type { DiagramScene, SceneCmd, SceneText, Vec } from "@/lib/diagrams/scene";
import { add, clamp, len, mul, norm, sub } from "@/lib/diagrams/polygon/geometry";
import { emptyLabel, type MeasLabel } from "@/lib/diagrams/polygon/model";
import {
  derivedPoints,
  displayName,
  extensionPoint,
  figureStrokes,
  interiorAngleDeg,
  isObtuseAtA,
  resolveAngleLabel,
  resolveSegText,
  segLength,
  trianglePoints,
  unitCirclePoints,
  worldQuadPoints,
  worldRightTriangle,
} from "./geometry";
import type { AngleFill, TrigRatiosState } from "./model";

export type SceneLayout = {
  canvas: Record<string, Vec>;
  origin: Vec;
  mid: Vec;
  scale: number;
};

export type TrigScene = DiagramScene & { layout: SceneLayout };

export const SCENE_WIDTH = 520;
export const SCENE_HEIGHT = 520;

const INK = "#111111";
const FILL_PINK = "#f7c8d2";
const FILL_BLUE = "#c5dff0";
const FILL_GREEN = "#d4edda";
const FILL_YELLOW = "#fce88a";
const ALTITUDE = "#e879a8";
const DIAGONAL = "#e879a8";
const GRID = "#c5dff0";

function fillColor(fill: AngleFill): string | null {
  if (fill === "pink") return FILL_PINK;
  if (fill === "blue") return FILL_BLUE;
  if (fill === "green") return FILL_GREEN;
  return null;
}

function triFillColor(state: TrigRatiosState): string {
  return state.triFill === "pink" ? FILL_PINK : FILL_GREEN;
}

function quadFillColor(state: TrigRatiosState): string {
  return state.quadFill === "yellow" ? FILL_YELLOW : FILL_PINK;
}

function pushText(texts: SceneText[], cmds: SceneCmd[], text: SceneText): void {
  texts.push(text);
  cmds.push({ t: "text", text });
}

function perpToward(along: Vec, toward: Vec): Vec {
  const dir = norm(along);
  let p: Vec = { x: -dir.y, y: dir.x };
  if (p.x * toward.x + p.y * toward.y < 0) p = { x: -p.x, y: -p.y };
  return p;
}

function signedHeight(h: number, minAbs = 10, maxAbs = 140): number {
  if (!Number.isFinite(h)) return minAbs;
  const sign = h < 0 ? -1 : 1;
  return sign * clamp(Math.abs(h), minAbs, maxAbs);
}

function smallerArc(a0: number, a1: number): { a0: number; a1: number; ccw: boolean } {
  let d = a1 - a0;
  while (d <= -Math.PI) d += Math.PI * 2;
  while (d > Math.PI) d -= Math.PI * 2;
  if (d >= 0) return { a0, a1, ccw: false };
  return { a0: a1, a1: a0, ccw: true };
}

function arcSweep(a0: number, a1: number, ccw: boolean): number {
  let d = a1 - a0;
  if (ccw) {
    while (d >= 0) d -= Math.PI * 2;
    return -d;
  }
  while (d < 0) d += Math.PI * 2;
  return d;
}

function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, ccw: boolean): Vec[] {
  const sweep = arcSweep(a0, a1, ccw);
  const steps = Math.max(4, Math.ceil((Math.abs(sweep) / Math.PI) * 16));
  const pts: Vec[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const ang = ccw ? a0 - sweep * t : a0 + sweep * t;
    pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
  }
  return pts;
}

function rightAngleSize(vertex: Vec, from: Vec, to: Vec): number {
  return clamp(Math.min(len(sub(from, vertex)), len(sub(to, vertex))) * 0.18, 10, 18);
}

function drawRightAngle(cmds: SceneCmd[], vertex: Vec, from: Vec, to: Vec): void {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  if (len(u) < 0.5 || len(w) < 0.5) return;
  cmds.push({
    t: "rightAngle",
    x: vertex.x,
    y: vertex.y,
    ux: u.x,
    uy: u.y,
    vx: w.x,
    vy: w.y,
    size: rightAngleSize(vertex, from, to),
  });
}

function drawAngle(
  cmds: SceneCmd[],
  texts: SceneText[],
  vertex: Vec,
  from: Vec,
  to: Vec,
  label: string | null,
  labelId: string,
  meas: MeasLabel,
  fontSize: number,
  fill: string | null,
): void {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  const a0 = Math.atan2(u.y, u.x);
  const a1 = Math.atan2(w.y, w.x);
  const arc = smallerArc(a0, a1);
  const r = clamp(Math.min(len(sub(from, vertex)), len(sub(to, vertex))) * 0.22, 16, 34);
  if (fill) {
    cmds.push({
      t: "polygon",
      points: [vertex, ...arcPoints(vertex.x, vertex.y, r, arc.a0, arc.a1, arc.ccw)],
      fill,
    });
  }
  cmds.push({
    t: "arc",
    cx: vertex.x,
    cy: vertex.y,
    r,
    a0: arc.a0,
    a1: arc.a1,
    ccw: arc.ccw,
    stroke: INK,
  });
  if (!label) return;
  const sweep = arcSweep(arc.a0, arc.a1, arc.ccw);
  const midAng = arc.a0 + (arc.ccw ? -sweep : sweep) / 2;
  const labelR = r + fontSize * 0.72;
  pushText(texts, cmds, {
    id: labelId,
    x: vertex.x + Math.cos(midAng) * labelR + meas.dx,
    y: vertex.y + Math.sin(midAng) * labelR + meas.dy,
    runs: parseMathRuns(label),
    size: fontSize,
    anchor: "middle",
  });
}

function sagittaArc(
  a: Vec,
  b: Vec,
  u: Vec,
  sagitta: number,
): { C: Vec; r: number; a0: number; a1: number; ccw: boolean } | null {
  const span = len(sub(b, a));
  const s = sagitta;
  if (span < 2 || Math.abs(s) < 0.75) return null;
  let n: Vec = { x: -norm(sub(b, a)).y, y: norm(sub(b, a)).x };
  if (n.x * u.x + n.y * u.y < 0) n = { x: -n.x, y: -n.y };
  const mid = mul(add(a, b), 0.5);
  const half = span / 2;
  const r = (half * half + s * s) / (2 * Math.abs(s));
  const C = add(mid, mul(n, s - Math.sign(s) * r));
  const a0 = Math.atan2(a.y - C.y, a.x - C.x);
  const a1 = Math.atan2(b.y - C.y, b.x - C.x);
  const peak = add(mid, mul(n, s));
  const ccwSpan = (from: number, to: number) => {
    let d = to - from;
    while (d < 0) d += Math.PI * 2;
    while (d >= Math.PI * 2) d -= Math.PI * 2;
    return d;
  };
  const sOnIncreasing =
    ccwSpan(a0, Math.atan2(peak.y - C.y, peak.x - C.x)) <= ccwSpan(a0, a1) + 1e-6;
  return { C, r, a0, a1, ccw: !sOnIncreasing };
}

function dimArc(
  cmds: SceneCmd[],
  texts: SceneText[],
  a: Vec,
  b: Vec,
  outward: Vec,
  offset: number,
  label: string | null,
  labelId: string,
  meas: MeasLabel,
  fontSize: number,
): void {
  if (!label) return;
  const along = norm(sub(b, a));
  const u = perpToward(along, outward);
  const span = len(sub(b, a));
  const mid = mul(add(a, b), 0.5);
  const margin = Math.min(span * 0.14, 26);
  const maxAlong = Math.max(span / 2 - margin, 0);
  const textH = signedHeight(offset + meas.dy);
  const lineH = signedHeight(offset + (meas.lineDy ?? 0));
  const textAlong = clamp(meas.dx, -maxAlong, maxAlong);
  const lineAlong = clamp(meas.lineDx ?? 0, -maxAlong, maxAlong);
  const textPt = add(add(mid, mul(along, textAlong)), mul(u, textH));
  const arcMid = add(add(mid, mul(along, lineAlong)), mul(u, lineH));
  const arc = sagittaArc(
    add(a, mul(along, margin)),
    add(b, mul(along, -margin)),
    u,
    lineH * 0.55,
  );
  if (arc) {
    cmds.push({
      t: "arc",
      cx: arc.C.x,
      cy: arc.C.y,
      r: arc.r,
      a0: arc.a0,
      a1: arc.a1,
      ccw: arc.ccw,
      stroke: INK,
      dashed: true,
      width: 1.1,
      id: `${labelId}:dim`,
    });
  }
  pushText(texts, cmds, {
    id: labelId,
    x: textPt.x,
    y: textPt.y,
    runs: parseMathRuns(label),
    size: fontSize,
    anchor: "middle",
  });
}

function mathBBox(state: TrigRatiosState): { min: Vec; max: Vec } {
  let pts: Vec[] = [];
  if (state.kind === "right") {
    const t = worldRightTriangle(state);
    pts = [t.A, t.B, t.C];
  } else if (state.kind === "unit-circle") {
    const u = unitCirclePoints(state);
    pts = [u.O!, u.A!, u.B!, u.C!, u.D!];
    return { min: { x: -0.35, y: -0.35 }, max: { x: 1.35, y: Math.max(1.35, u.D!.y + 0.2) } };
  } else if (state.kind === "triangle-area") {
    const t = trianglePoints(state);
    pts = [t.A!, t.B!, t.C!, t.H!];
  } else {
    pts = worldQuadPoints(state);
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 0.22 * Math.max(maxX - minX, maxY - minY, 1);
  return { min: { x: minX - pad, y: minY - pad }, max: { x: maxX + pad, y: maxY + pad } };
}

export function getSceneLayout(state: TrigRatiosState): SceneLayout {
  const box = mathBBox(state);
  const mid = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 };
  const spanX = Math.max(box.max.x - box.min.x, 0.8);
  const spanY = Math.max(box.max.y - box.min.y, 0.8);
  const pad = state.style.padding;
  const scale = Math.min(
    (SCENE_WIDTH - pad * 2) / spanX,
    (SCENE_HEIGHT - pad * 2) / spanY,
  );
  const origin = { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2 };
  const toCanvas = (p: Vec): Vec => ({
    x: origin.x + (p.x - mid.x) * scale,
    y: origin.y - (p.y - mid.y) * scale,
  });
  const canvas: Record<string, Vec> = {};
  for (const [id, p] of Object.entries(derivedPoints(state))) {
    canvas[id] = toCanvas(p);
  }
  return { canvas, origin, mid, scale };
}

export function mathToCanvas(p: Vec, layout: SceneLayout): Vec {
  return {
    x: layout.origin.x + (p.x - layout.mid.x) * layout.scale,
    y: layout.origin.y - (p.y - layout.mid.y) * layout.scale,
  };
}

export function canvasToMath(p: Vec, layout: SceneLayout): Vec {
  return {
    x: layout.mid.x + (p.x - layout.origin.x) / layout.scale,
    y: layout.mid.y - (p.y - layout.origin.y) / layout.scale,
  };
}

function paintNames(
  state: TrigRatiosState,
  canvas: Record<string, Vec>,
  cmds: SceneCmd[],
  texts: SceneText[],
): void {
  if (!state.showVertexNames) return;
  const fs = state.style.pointLabelSize;
  const ids = Object.keys(canvas);
  for (const id of ids) {
    const p = canvas[id]!;
    let name = displayName(state, id);
    let dx = 0;
    let dy = 0;
    if (state.kind === "right" || state.kind === "unit-circle") {
      const mark = state.names[id];
      if (mark) {
        name = mark.name;
        dx = mark.dx;
        dy = mark.dy;
      }
    } else if (state.kind === "triangle-area") {
      const mark = state.triNames[id];
      if (mark) {
        name = mark.name;
        dx = mark.dx;
        dy = mark.dy;
      }
    } else if (state.kind === "quad-area") {
      const i = "ABCD".indexOf(id);
      const v = state.quadVertices[i];
      if (v) {
        name = v.name;
        dx = v.nameDx;
        dy = v.nameDy;
      }
    }
    pushText(texts, cmds, {
      id: `n:${id}`,
      x: p.x + dx,
      y: p.y + dy,
      runs: parseNameRuns(name),
      size: fs,
      anchor: "middle",
    });
    if (state.showDots) {
      cmds.push({ t: "dot", x: p.x, y: p.y, r: state.style.pointRadius, stroke: INK });
    }
  }
}

function paintRightFigure(
  state: TrigRatiosState,
  layout: SceneLayout,
  cmds: SceneCmd[],
  texts: SceneText[],
): void {
  const { canvas } = layout;
  const { style } = state;
  for (const [a, b] of figureStrokes(state)) {
    const pa = canvas[a];
    const pb = canvas[b];
    if (!pa || !pb) continue;
    cmds.push({ t: "line", x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, stroke: INK, width: style.lineWidth });
  }
  if (state.showRightAngle) {
    const rv = state.rightVertex;
    if (rv === "C" && canvas.C && canvas.B && canvas.A) drawRightAngle(cmds, canvas.C, canvas.B, canvas.A);
    else if (rv === "A" && canvas.A && canvas.B && canvas.C) drawRightAngle(cmds, canvas.A, canvas.B, canvas.C);
    else if (rv === "B" && canvas.B && canvas.A && canvas.C) drawRightAngle(cmds, canvas.B, canvas.A, canvas.C);
  }
  const mathPts = worldRightTriangle(state);
  for (const mark of state.angles) {
    if (!mark.show) continue;
    const v = canvas[mark.vertex];
    const f = canvas[mark.from];
    const t = canvas[mark.to];
    if (!v || !f || !t) continue;
    const deg =
      mark.vertex === "A"
        ? interiorAngleDeg([mathPts.A, mathPts.B, mathPts.C], 0)
        : mark.vertex === "B"
          ? interiorAngleDeg([mathPts.A, mathPts.B, mathPts.C], 1)
          : interiorAngleDeg([mathPts.A, mathPts.B, mathPts.C], 2);
    if (Math.abs(deg - 90) < 0.75) continue;
    const label = resolveAngleLabel(state, mark, deg);
    drawAngle(
      cmds,
      texts,
      v,
      f,
      t,
      label,
      `a:${mark.id}`,
      mark.label,
      style.fontSize,
      fillColor(mark.fill),
    );
  }
  const c = mul(add(add(canvas.A!, canvas.B!), canvas.C!), 1 / 3);
  for (const seg of state.segs) {
    if (!seg.show) continue;
    const pa = canvas[seg.a];
    const pb = canvas[seg.b];
    if (!pa || !pb) continue;
    const outward = norm(sub(c, mul(add(pa, pb), 0.5)));
    dimArc(
      cmds,
      texts,
      pa,
      pb,
      outward,
      style.dimOffset,
      resolveSegText(state, seg),
      `s:${seg.id}`,
      seg.label,
      style.fontSize,
    );
  }
}

function paintUnitCircle(
  state: TrigRatiosState,
  layout: SceneLayout,
  cmds: SceneCmd[],
  texts: SceneText[],
): void {
  const { canvas } = layout;
  const { style } = state;
  const toC = (p: Vec) => mathToCanvas(p, layout);
  const u = unitCirclePoints(state);
  const O = toC(u.O!);
  const A = toC(u.A!);
  const B = toC(u.B!);
  const C = toC(u.C!);
  const D = toC(u.D!);

  if (state.showAxes) {
    const xEnd = toC({ x: 1.25, y: 0 });
    const yEnd = toC({ x: 0, y: Math.max(1.25, u.D!.y + 0.15) });
    cmds.push({ t: "line", x1: O.x, y1: O.y, x2: xEnd.x, y2: xEnd.y, stroke: INK, width: style.lineWidth });
    cmds.push({ t: "line", x1: O.x, y1: O.y, x2: yEnd.x, y2: yEnd.y, stroke: INK, width: style.lineWidth });
    cmds.push({
      t: "arrowhead",
      x: xEnd.x,
      y: xEnd.y,
      ux: 1,
      uy: 0,
      size: 10,
      stroke: INK,
    });
    cmds.push({
      t: "arrowhead",
      x: yEnd.x,
      y: yEnd.y,
      ux: 0,
      uy: -1,
      size: 10,
      stroke: INK,
    });
    if (state.showAxisLabels) {
      pushText(texts, cmds, {
        id: "axis:x",
        x: xEnd.x + 8,
        y: xEnd.y + 4,
        runs: parseMathRuns("$x$"),
        size: style.fontSize,
        anchor: "start",
      });
      pushText(texts, cmds, {
        id: "axis:y",
        x: yEnd.x - 6,
        y: yEnd.y - 8,
        runs: parseMathRuns("$y$"),
        size: style.fontSize,
        anchor: "end",
      });
    }
  }

  cmds.push({
    t: "arc",
    cx: O.x,
    cy: O.y,
    r: len(sub(A, O)),
    a0: Math.PI / 2,
    a1: 0,
    ccw: true,
    stroke: INK,
    width: style.lineWidth,
  });

  cmds.push({ t: "line", x1: O.x, y1: O.y, x2: D.x, y2: D.y, stroke: INK, width: style.lineWidth });
  cmds.push({ t: "line", x1: O.x, y1: O.y, x2: B.x, y2: B.y, stroke: INK, width: style.lineWidth });
  cmds.push({ t: "line", x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: INK, width: style.lineWidth });
  cmds.push({ t: "line", x1: C.x, y1: C.y, x2: D.x, y2: D.y, stroke: INK, width: style.lineWidth });

  if (state.showYProjections) {
    cmds.push({
      t: "line",
      x1: B.x,
      y1: B.y,
      x2: toC({ x: 0, y: u.B!.y }).x,
      y2: toC({ x: 0, y: u.B!.y }).y,
      stroke: INK,
      dashed: true,
      width: 1.1,
    });
    cmds.push({
      t: "line",
      x1: D.x,
      y1: D.y,
      x2: toC({ x: 0, y: u.D!.y }).x,
      y2: toC({ x: 0, y: u.D!.y }).y,
      stroke: INK,
      dashed: true,
      width: 1.1,
    });
  }

  if (state.showUnitRightAngles) {
    drawRightAngle(cmds, A, O, B);
    drawRightAngle(cmds, C, O, D);
  }

  if (state.showRadiusLabel) {
    const midR = mul(add(O, toC({ x: 0, y: 1 })), 0.5);
    dimArc(cmds, texts, O, toC({ x: 0, y: 1 }), { x: -1, y: 0 }, style.dimOffset, "1", "s:radius", emptyLabel("custom"), style.fontSize);
  }

  if (state.showAngleX) {
    drawAngle(
      cmds,
      texts,
      O,
      toC({ x: 1, y: 0 }),
      B,
      `${state.thetaDeg}°`,
      "a:theta",
      emptyLabel("custom"),
      style.fontSize,
      null,
    );
  }

  if (state.showAnglesYZ) {
    const yDeg = 90 - state.thetaDeg;
    drawAngle(cmds, texts, B, O, A, `${yDeg}°`, "a:y", emptyLabel("custom"), style.fontSize * 0.92, null);
    drawAngle(cmds, texts, D, C, O, `${yDeg}°`, "a:z", emptyLabel("custom"), style.fontSize * 0.92, null);
  }

  const p = state.axisPrecision;
  if (state.showAxisValues) {
    pushText(texts, cmds, {
      id: "axis:Ax",
      x: A.x,
      y: A.y + 18,
      runs: parseMathRuns(u.A!.x.toFixed(p)),
      size: style.fontSize * 0.88,
      anchor: "middle",
    });
    pushText(texts, cmds, {
      id: "axis:Cx",
      x: C.x,
      y: C.y + 18,
      runs: parseMathRuns("1"),
      size: style.fontSize * 0.88,
      anchor: "middle",
    });
    pushText(texts, cmds, {
      id: "axis:By",
      x: toC({ x: 0, y: u.B!.y }).x - 12,
      y: B.y,
      runs: parseMathRuns(u.B!.y.toFixed(p)),
      size: style.fontSize * 0.88,
      anchor: "end",
    });
    pushText(texts, cmds, {
      id: "axis:Dy",
      x: toC({ x: 0, y: u.D!.y }).x - 12,
      y: D.y,
      runs: parseMathRuns(u.D!.y.toFixed(p)),
      size: style.fontSize * 0.88,
      anchor: "end",
    });
    pushText(texts, cmds, {
      id: "axis:Oy",
      x: toC({ x: 0, y: 1 }).x - 12,
      y: toC({ x: 0, y: 1 }).y,
      runs: parseMathRuns("1"),
      size: style.fontSize * 0.88,
      anchor: "end",
    });
  }

  pushText(texts, cmds, {
    id: "theta",
    x: O.x + 28,
    y: O.y - 12,
    runs: parseMathRuns(`${state.thetaDeg}°`),
    size: style.fontSize,
    anchor: "start",
  });
}

function paintTriangleArea(
  state: TrigRatiosState,
  layout: SceneLayout,
  cmds: SceneCmd[],
  texts: SceneText[],
): void {
  const { canvas } = layout;
  const { style } = state;
  const math = trianglePoints(state);
  const pts = [canvas.A!, canvas.B!, canvas.C!];
  if (state.showTriFill) {
    cmds.push({ t: "polygon", points: pts, fill: triFillColor(state) });
  }

  const from = state.altitudeFrom;
  const H = canvas.H!;
  const baseA = from === "A" ? canvas.B! : from === "B" ? canvas.A! : canvas.A!;
  const baseB = from === "A" ? canvas.C! : from === "B" ? canvas.C! : canvas.B!;
  const apex = canvas[from]!;

  if (state.showBaseExtension && isObtuseAtA(state) && state.altitudeFrom === "C") {
    const ext = mathToCanvas(extensionPoint(math.B!, math.A!, 1.2), layout);
    cmds.push({
      t: "line",
      x1: baseA.x,
      y1: baseA.y,
      x2: ext.x,
      y2: ext.y,
      stroke: INK,
      dashed: true,
      width: 1.1,
    });
  }

  for (const [a, b] of figureStrokes(state)) {
    const pa = canvas[a];
    const pb = canvas[b];
    if (!pa || !pb) continue;
    const highlight =
      state.showAltitudeHighlight &&
      ((a === from && b === "H") || (b === from && a === "H"));
    cmds.push({
      t: "line",
      x1: pa.x,
      y1: pa.y,
      x2: pb.x,
      y2: pb.y,
      stroke: highlight ? ALTITUDE : INK,
      width: highlight ? style.lineWidth + 0.8 : style.lineWidth,
    });
  }

  if (state.showAltitudeRight) {
    drawRightAngle(cmds, H, baseA, apex);
  }

  const triPts = [math.A!, math.B!, math.C!];
  for (const mark of state.triAngles) {
    if (!mark.show) continue;
    const v = canvas[mark.vertex];
    let f = canvas[mark.from];
    let t = canvas[mark.to];
    if (mark.id === "extA" && isObtuseAtA(state)) {
      f = canvas.C!;
      t = canvas.H!;
    }
    if (!v || !f || !t) continue;
    const idx = { A: 0, B: 1, C: 2 }[mark.vertex as "A" | "B" | "C"];
    const deg = idx != null ? interiorAngleDeg(triPts, idx) : 0;
    const label = resolveAngleLabel(state, mark, deg);
    drawAngle(
      cmds,
      texts,
      v,
      f,
      t,
      label,
      `a:${mark.id}`,
      mark.label,
      style.fontSize,
      fillColor(mark.fill),
    );
  }

  const c = mul(add(add(canvas.A!, canvas.B!), canvas.C!), 1 / 3);
  for (const seg of state.triSegs) {
    if (!seg.show) continue;
    const pa = canvas[seg.a];
    const pb = canvas[seg.b];
    if (!pa || !pb) continue;
    const outward = norm(sub(c, mul(add(pa, pb), 0.5)));
    dimArc(
      cmds,
      texts,
      pa,
      pb,
      outward,
      style.dimOffset,
      resolveSegText(state, seg),
      `s:${seg.id}`,
      seg.label,
      style.fontSize,
    );
  }
}

function paintQuadArea(
  state: TrigRatiosState,
  layout: SceneLayout,
  cmds: SceneCmd[],
  texts: SceneText[],
): void {
  const { canvas } = layout;
  const { style } = state;
  const mathPts = worldQuadPoints(state);
  const pts = ["A", "B", "C", "D"].map((id) => canvas[id]!);
  if (state.showQuadFill) {
    cmds.push({ t: "polygon", points: pts, fill: quadFillColor(state) });
  }
  for (const [a, b] of figureStrokes(state)) {
    const pa = canvas[a];
    const pb = canvas[b];
    if (!pa || !pb) continue;
    cmds.push({ t: "line", x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, stroke: INK, width: style.lineWidth });
  }
  if (state.showQuadDiagonal && canvas.B && canvas.D) {
    cmds.push({
      t: "line",
      x1: canvas.B.x,
      y1: canvas.B.y,
      x2: canvas.D.x,
      y2: canvas.D.y,
      stroke: DIAGONAL,
      width: style.lineWidth + 0.4,
    });
  }
  for (let i = 0; i < 4; i += 1) {
    const v = state.quadVertices[i];
    if (!v?.showInterior) continue;
    const id = String.fromCharCode(65 + i);
    const prev = canvas[String.fromCharCode(65 + ((i + 3) % 4))]!;
    const cur = canvas[id]!;
    const next = canvas[String.fromCharCode(65 + ((i + 1) % 4))]!;
    const deg = interiorAngleDeg(mathPts, i);
    const label =
      v.interior.mode === "custom"
        ? v.interior.custom
        : v.interior.mode === "x"
          ? `$${state.unknownLetter}$`
          : `${Math.round(deg)}°`;
    drawAngle(
      cmds,
      texts,
      cur,
      prev,
      next,
      label,
      `v:${i}:interior`,
      v.interior,
      style.fontSize,
      fillColor(v.fillInterior),
    );
  }
  const c = mul(add(add(pts[0]!, pts[2]!), add(pts[1]!, pts[3]!)), 0.25);
  const edgeIds = ["AB", "BC", "CD", "DA"];
  for (let i = 0; i < 4; i += 1) {
    const e = state.quadEdges[i];
    if (!e?.showLength) continue;
    const a = canvas[String.fromCharCode(65 + i)]!;
    const b = canvas[String.fromCharCode(65 + ((i + 1) % 4))]!;
    const outward = norm(sub(c, mul(add(a, b), 0.5)));
    const label =
      e.length.mode === "custom"
        ? e.length.custom
        : e.length.mode === "x"
          ? `$${state.unknownLetter}$`
          : `${Math.round(edgeLength(mathPts, i) * 10) / 10} ${state.unit}`.trim();
    dimArc(
      cmds,
      texts,
      a,
      b,
      outward,
      style.dimOffset,
      label,
      `s:${edgeIds[i]}`,
      e.length,
      style.fontSize,
    );
  }
}

function edgeLength(points: Vec[], i: number): number {
  const a = points[i]!;
  const b = points[(i + 1) % points.length]!;
  return len(sub(b, a));
}

export function buildTrigScene(state: TrigRatiosState): TrigScene {
  const layout = getSceneLayout(state);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];

  switch (state.kind) {
    case "right":
      paintRightFigure(state, layout, cmds, texts);
      break;
    case "unit-circle":
      paintUnitCircle(state, layout, cmds, texts);
      break;
    case "triangle-area":
      paintTriangleArea(state, layout, cmds, texts);
      break;
    case "quad-area":
      paintQuadArea(state, layout, cmds, texts);
      break;
  }

  paintNames(state, layout.canvas, cmds, texts);

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
  };
}
