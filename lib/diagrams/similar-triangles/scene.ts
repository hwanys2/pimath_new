import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import type {
  DiagramScene as SharedDiagramScene,
  SceneCmd,
  SceneText,
} from "@/lib/diagrams/scene";
import {
  add,
  clamp,
  len,
  mul,
  norm,
  sub,
} from "@/lib/diagrams/polygon/geometry";
import { isDisplayedRightAngle } from "@/lib/diagrams/polygon/scene";
import {
  resolveAngleText,
  resolveLengthText,
  type MeasLabel,
  type SimilarTrianglesState,
  type Vec,
} from "./model";
import {
  angleValue,
  derivedPoints,
  displayName,
  figureStrokes,
  segLength,
} from "./geometry";

export type SceneLayout = {
  canvas: Record<string, Vec>;
  origin: Vec;
  mid: Vec;
  scale: number;
};

export type SimilarScene = SharedDiagramScene & {
  layout: SceneLayout;
};

export const SCENE_WIDTH = 520;
export const SCENE_HEIGHT = 520;

const INK = "#111111";
const ANGLE_FILL = "#f7c8d2";
const FACE_FILL = "#f8d4dc";

function pushText(texts: SceneText[], cmds: SceneCmd[], text: SceneText): void {
  texts.push(text);
  cmds.push({ t: "text", text });
}

function signedHeight(h: number, minAbs = 10, maxAbs = 140): number {
  if (!Number.isFinite(h)) return minAbs;
  const sign = h < 0 ? -1 : 1;
  return sign * clamp(Math.abs(h), minAbs, maxAbs);
}

function perpToward(along: Vec, toward: Vec): Vec {
  const dir = norm(along);
  let p: Vec = { x: -dir.y, y: dir.x };
  if (p.x * toward.x + p.y * toward.y < 0) p = { x: -p.x, y: -p.y };
  return p;
}

function normalizeAngle(a: number): number {
  let t = a % (Math.PI * 2);
  if (t < 0) t += Math.PI * 2;
  return t;
}

function ccwSpan(from: number, to: number): number {
  let d = normalizeAngle(to) - normalizeAngle(from);
  if (d < 0) d += Math.PI * 2;
  return d;
}

function smallerArc(
  a0: number,
  a1: number,
): { a0: number; a1: number; ccw: boolean } {
  if (ccwSpan(a0, a1) <= Math.PI) return { a0, a1, ccw: false };
  return { a0, a1, ccw: true };
}

function arcSweep(a0: number, a1: number, ccw: boolean): number {
  if (ccw) return ccwSpan(a1, a0);
  return ccwSpan(a0, a1);
}

function arcPoints(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  ccw: boolean,
  n = 14,
): Vec[] {
  const sweep = arcSweep(a0, a1, ccw);
  const pts: Vec[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const ang = a0 + (ccw ? -sweep : sweep) * t;
    pts.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  return pts;
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
  const aS = Math.atan2(peak.y - C.y, peak.x - C.x);
  const sOnIncreasing = ccwSpan(a0, aS) <= ccwSpan(a0, a1) + 1e-6;
  const ccw = !sOnIncreasing;
  return { C, r, a0, a1, ccw };
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
  meas: { dx: number; dy: number; lineDx?: number; lineDy?: number },
  fontSize: number,
): void {
  if (!label) return;
  const along = norm(sub(b, a));
  const u = perpToward(along, outward);
  const span = len(sub(b, a));
  const mid = mul(add(a, b), 0.5);
  const margin = Math.min(span * 0.14, 26);
  const maxAlong = Math.max(span / 2 - margin, 0);
  const lineId = `${labelId}:line`;

  const textH = signedHeight(offset + meas.dy);
  const lineH = signedHeight(offset + meas.dy + (meas.lineDy ?? 0));
  const textAlong = clamp(meas.dx, -maxAlong, maxAlong);
  const lineSign = lineH < 0 ? -1 : 1;
  const tick = clamp(Math.abs(lineH) * 0.22, 4.5, 8);
  const aFoot = add(a, mul(u, lineSign * tick));
  const bFoot = add(b, mul(u, lineSign * tick));
  const sag = lineH - lineSign * tick;

  cmds.push({ t: "line", x1: a.x, y1: a.y, x2: aFoot.x, y2: aFoot.y, id: lineId });
  cmds.push({ t: "line", x1: b.x, y1: b.y, x2: bFoot.x, y2: bFoot.y, id: lineId });

  const arc = sagittaArc(aFoot, bFoot, u, sag);
  if (arc) {
    cmds.push({
      t: "arc",
      cx: arc.C.x,
      cy: arc.C.y,
      r: arc.r,
      a0: arc.a0,
      a1: arc.a1,
      ccw: arc.ccw,
      dashed: true,
      id: lineId,
    });
  } else {
    cmds.push({
      t: "line",
      x1: aFoot.x,
      y1: aFoot.y,
      x2: bFoot.x,
      y2: bFoot.y,
      dashed: true,
      id: lineId,
    });
  }

  const textSign = textH < 0 ? -1 : 1;
  const onSeg = add(mid, mul(along, textAlong));
  const tp = add(onSeg, mul(u, textH + textSign * fontSize * 0.52));
  pushText(texts, cmds, {
    id: labelId,
    x: tp.x,
    y: tp.y,
    runs: parseMathRuns(label),
    size: fontSize,
    anchor: "middle",
  });
}

function drawEqualTicks(cmds: SceneCmd[], a: Vec, b: Vec, count: 1 | 2 | 3, size: number): void {
  const dir = norm(sub(b, a));
  const n = { x: -dir.y, y: dir.x };
  const mid = mul(add(a, b), 0.5);
  const span = 6.5;
  const start = -((count - 1) * span) / 2;
  for (let i = 0; i < count; i += 1) {
    const c = add(mid, mul(dir, start + i * span));
    cmds.push({
      t: "line",
      x1: c.x + n.x * size,
      y1: c.y + n.y * size,
      x2: c.x - n.x * size,
      y2: c.y - n.y * size,
    });
  }
}

function drawParallelArrow(cmds: SceneCmd[], a: Vec, b: Vec): void {
  const dir = norm(sub(b, a));
  const mid = mul(add(a, b), 0.5);
  cmds.push({
    t: "arrowhead",
    x: mid.x,
    y: mid.y,
    ux: dir.x,
    uy: dir.y,
    size: 9,
  });
}

function angleRadius(a: Vec, b: Vec, c: Vec): number {
  const la = len(sub(a, b));
  const lc = len(sub(c, b));
  return clamp(Math.min(la, lc) * 0.22, 16, 36);
}

function rightAngleSize(vertex: Vec, from: Vec, to: Vec): number {
  return clamp(Math.min(len(sub(from, vertex)), len(sub(to, vertex))) * 0.18, 10, 16);
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
  const r = angleRadius(from, vertex, to);
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

function mathBBox(state: SimilarTrianglesState, pts: Record<string, Vec>): { min: Vec; max: Vec } {
  const list = Object.values(pts);
  if (state.kind === "parallels") {
    const p = state.parallels;
    list.push({ x: p.xMin, y: p.yL }, { x: p.xMax, y: p.yN });
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of list) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 0.18 * Math.max(maxX - minX, maxY - minY, 1);
  return {
    min: { x: minX - pad, y: minY - pad },
    max: { x: maxX + pad, y: maxY + pad },
  };
}

export function getSceneLayout(state: SimilarTrianglesState): SceneLayout {
  const pts = derivedPoints(state);
  const box = mathBBox(state, pts);
  const mid = {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
  };
  const spanX = Math.max(box.max.x - box.min.x, 0.8);
  const spanY = Math.max(box.max.y - box.min.y, 0.8);
  const pad = state.style.padding;
  const scale = Math.min(
    (SCENE_WIDTH - pad * 2) / spanX,
    (SCENE_HEIGHT - pad * 2) / spanY,
  );
  const origin = { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2 };
  const canvas: Record<string, Vec> = {};
  for (const [id, p] of Object.entries(pts)) {
    canvas[id] = {
      x: origin.x + (p.x - mid.x) * scale,
      y: origin.y - (p.y - mid.y) * scale,
    };
  }
  return { canvas, origin, mid, scale };
}

export function canvasToMath(p: Vec, layout: SceneLayout): Vec {
  return {
    x: layout.mid.x + (p.x - layout.origin.x) / layout.scale,
    y: layout.mid.y - (p.y - layout.origin.y) / layout.scale,
  };
}

export function mathToCanvas(p: Vec, layout: SceneLayout): Vec {
  return {
    x: layout.origin.x + (p.x - layout.mid.x) * layout.scale,
    y: layout.origin.y - (p.y - layout.mid.y) * layout.scale,
  };
}

function centroidOf(ids: string[], canvas: Record<string, Vec>): Vec {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const id of ids) {
    const p = canvas[id];
    if (!p) continue;
    x += p.x;
    y += p.y;
    n += 1;
  }
  if (n === 0) return { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2 };
  return { x: x / n, y: y / n };
}

export function buildSimilarTrianglesScene(state: SimilarTrianglesState): SimilarScene {
  const layout = getSceneLayout(state);
  const { canvas } = layout;
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const { style } = state;

  if (state.kind === "centroid" && state.fillFace) {
    const A = canvas.A;
    const B = canvas.B;
    const C = canvas.C;
    if (A && B && C) {
      cmds.push({ t: "polygon", points: [A, B, C], fill: FACE_FILL });
    }
  }

  if (state.kind === "parallels") {
    const p = state.parallels;
    const left = mathToCanvas({ x: p.xMin, y: p.yL }, layout);
    const rightL = mathToCanvas({ x: p.xMax, y: p.yL }, layout);
    const leftM = mathToCanvas({ x: p.xMin, y: p.yM }, layout);
    const rightM = mathToCanvas({ x: p.xMax, y: p.yM }, layout);
    const leftN = mathToCanvas({ x: p.xMin, y: p.yN }, layout);
    const rightN = mathToCanvas({ x: p.xMax, y: p.yN }, layout);
    cmds.push({ t: "line", x1: left.x, y1: left.y, x2: rightL.x, y2: rightL.y, stroke: INK });
    cmds.push({ t: "line", x1: leftM.x, y1: leftM.y, x2: rightM.x, y2: rightM.y, stroke: INK });
    cmds.push({ t: "line", x1: leftN.x, y1: leftN.y, x2: rightN.x, y2: rightN.y, stroke: INK });
    const labels: [string, Vec][] = [
      [p.lineNames[0] ?? "l", { x: rightL.x + 14, y: rightL.y }],
      [p.lineNames[1] ?? "m", { x: rightM.x + 14, y: rightM.y }],
      [p.lineNames[2] ?? "n", { x: rightN.x + 14, y: rightN.y }],
    ];
    for (const [nm, pos] of labels) {
      pushText(texts, cmds, {
        id: `n:${nm}`,
        x: pos.x,
        y: pos.y,
        runs: parseMathRuns(`$${nm}$`),
        size: style.pointLabelSize,
        anchor: "start",
      });
    }
  }

  for (const [a, b] of figureStrokes(state)) {
    const pa = canvas[a];
    const pb = canvas[b];
    if (!pa || !pb) continue;
    cmds.push({ t: "line", x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, stroke: INK });
  }

  const faceCenter = centroidOf(
    state.kind === "parallels" ? ["T0L", "T0N", "T1L", "T1N"] : ["A", "B", "C"],
    canvas,
  );

  for (const mark of state.angles) {
    if (!mark.show) continue;
    const v = canvas[mark.vertex];
    const f = canvas[mark.from];
    const t = canvas[mark.to];
    if (!v || !f || !t) continue;
    const deg = angleValue(state, mark);
    const labelId = `a:${mark.id}`;
    if (isDisplayedRightAngle(mark.label, deg)) {
      drawRightAngle(cmds, v, f, t);
      continue;
    }
    const label = resolveAngleText(mark.label, deg, state.unknownLetter);
    drawAngle(
      cmds,
      texts,
      v,
      f,
      t,
      label,
      labelId,
      mark.label,
      style.fontSize,
      mark.fill ? ANGLE_FILL : null,
    );
  }

  for (const seg of state.segs) {
    const a = canvas[seg.a];
    const b = canvas[seg.b];
    if (!a || !b) continue;
    if (seg.ticks === 1 || seg.ticks === 2 || seg.ticks === 3) {
      drawEqualTicks(cmds, a, b, seg.ticks, 7);
    }
    if (seg.parallel) drawParallelArrow(cmds, a, b);
    if (!seg.show) continue;
    const mid = mul(add(a, b), 0.5);
    const outward = sub(mid, faceCenter);
    const autoLen = segLength(state, seg);
    const label = resolveLengthText(seg.label, autoLen, state.unit, state.unknownLetter);
    dimArc(
      cmds,
      texts,
      a,
      b,
      outward,
      style.dimOffset,
      label,
      `s:${seg.id}`,
      seg.label,
      style.fontSize,
    );
  }

  for (const id of Object.keys(canvas)) {
    if (id.startsWith("_")) continue;
    if (state.kind === "parallels") continue;
    if (state.kind === "centroid" && id === "D" && !state.medianAD) continue;
    if (state.kind === "centroid" && id === "E" && !state.medianBE) continue;
    if (state.kind === "centroid" && id === "F" && !state.medianCF) continue;
    const p = canvas[id]!;
    const showDot = state.showDots || (state.kind === "centroid" && id === "G");
    if (showDot) {
      cmds.push({ t: "dot", x: p.x, y: p.y, r: style.pointRadius });
    }
    if (!state.showVertexNames) continue;
    const nm = displayName(state, id);
    if (!nm) continue;
    const mark = state.names[id];
    const away = norm(sub(p, faceCenter));
    const lp = add(add(p, mul(away, 16)), { x: mark?.dx ?? 0, y: mark?.dy ?? 0 });
    pushText(texts, cmds, {
      id: `n:${id}`,
      x: lp.x,
      y: lp.y,
      runs: parseNameRuns(nm),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
  };
}
