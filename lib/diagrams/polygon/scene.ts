import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import type {
  DiagramScene as SharedDiagramScene,
  SceneCmd,
  SceneText,
} from "@/lib/diagrams/scene";
import {
  add,
  centroid,
  clamp,
  edgeLength,
  extensionEnd,
  len,
  mul,
  nextIndex,
  norm,
  prevIndex,
  sub,
  vertexAngles,
} from "./geometry";
import {
  resolveAngleText,
  resolveLengthText,
  type MeasLabel,
  type PolygonState,
  type Vec,
} from "./model";

export type PolygonScene = SharedDiagramScene & {
  layout: SceneLayout;
};

export type SceneLayout = {
  canvas: Vec[];
  origin: Vec;
  mid: Vec;
  scale: number;
};

export const SCENE_WIDTH = 520;
export const SCENE_HEIGHT = 520;

const INK = "#111111";
const EXTERIOR_FILL = "#f7c8d2";

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

  cmds.push({
    t: "line",
    x1: a.x,
    y1: a.y,
    x2: aFoot.x,
    y2: aFoot.y,
    id: lineId,
  });
  cmds.push({
    t: "line",
    x1: b.x,
    y1: b.y,
    x2: bFoot.x,
    y2: bFoot.y,
    id: lineId,
  });

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

function mathBBox(state: PolygonState): { min: Vec; max: Vec } {
  const pts = [...state.points];
  const n = pts.length;
  let avg = 0;
  for (let i = 0; i < n; i += 1) avg += edgeLength(pts, i);
  avg /= Math.max(n, 1);
  const extLen = avg * 0.42;
  for (let i = 0; i < n; i += 1) {
    if (!state.vertices[i]?.showExterior) continue;
    pts.push(extensionEnd(pts[prevIndex(i, n)]!, pts[i]!, extLen));
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
  const pad = 0.18 * Math.max(maxX - minX, maxY - minY, 1);
  return {
    min: { x: minX - pad, y: minY - pad },
    max: { x: maxX + pad, y: maxY + pad },
  };
}

export function getSceneLayout(state: PolygonState): SceneLayout {
  const box = mathBBox(state);
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
  const canvas = state.points.map((p) => ({
    x: origin.x + (p.x - mid.x) * scale,
    y: origin.y - (p.y - mid.y) * scale,
  }));
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

function angleRadius(a: Vec, b: Vec, c: Vec): number {
  const la = len(sub(a, b));
  const lc = len(sub(c, b));
  return clamp(Math.min(la, lc) * 0.22, 16, 36);
}

const RIGHT_ANGLE_EPS = 0.75;

/** 90°는 작은 네모. 미지수(x)로 두면 답을 숨기므로 직각 표시를 쓰지 않는다. */
export function isDisplayedRightAngle(label: MeasLabel, deg: number): boolean {
  return label.mode !== "x" && Number.isFinite(deg) && Math.abs(deg - 90) < RIGHT_ANGLE_EPS;
}

function rightAngleSize(vertex: Vec, from: Vec, to: Vec): number {
  return clamp(Math.min(len(sub(from, vertex)), len(sub(to, vertex))) * 0.18, 10, 16);
}

function drawRightAngle(
  cmds: SceneCmd[],
  vertex: Vec,
  from: Vec,
  to: Vec,
): void {
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

export type PolygonDrawOptions = {
  idPrefix?: string;
  /** Override auto edge length (math units) used for labels. */
  lengthAt?: (i: number) => number;
};

/** Draw one polygon onto an existing scene. Used by 다각형 and 닮은 평면도형. */
export function appendPolygonFigure(
  state: PolygonState,
  canvas: Vec[],
  toCanvas: (p: Vec) => Vec,
  cmds: SceneCmd[],
  texts: SceneText[],
  options: PolygonDrawOptions = {},
): void {
  const prefix = options.idPrefix ?? "";
  const { style } = state;
  const n = canvas.length;
  if (n < 3) return;
  const mathC = centroid(state.points);
  const canvasC = toCanvas(mathC);

  let avgSide = 0;
  for (let i = 0; i < n; i += 1) avgSide += edgeLength(state.points, i);
  avgSide /= Math.max(n, 1);
  const extMath = avgSide * 0.42;

  for (let i = 0; i < n; i += 1) {
    const v = state.vertices[i];
    if (!v?.showExterior || !v.fillExterior) continue;
    const p = canvas[i]!;
    const next = canvas[nextIndex(i, n)]!;
    const ext = toCanvas(
      extensionEnd(state.points[prevIndex(i, n)]!, state.points[i]!, extMath),
    );
    const { exterior } = vertexAngles(state.points, i);
    if (isDisplayedRightAngle(v.exterior, exterior)) {
      drawRightAngle(cmds, p, ext, next);
      continue;
    }
    const label = resolveAngleText(v.exterior, exterior, state.unknownLetter);
    drawAngle(
      cmds,
      texts,
      p,
      ext,
      next,
      label,
      `${prefix}v:${i}:exterior`,
      v.exterior,
      style.fontSize,
      EXTERIOR_FILL,
    );
  }

  cmds.push({
    t: "polyline",
    pts: [...canvas, canvas[0]!],
    stroke: INK,
  });

  for (const [a, b] of state.diagonals) {
    const pa = canvas[a];
    const pb = canvas[b];
    if (!pa || !pb) continue;
    cmds.push({
      t: "line",
      x1: pa.x,
      y1: pa.y,
      x2: pb.x,
      y2: pb.y,
      stroke: INK,
      dashed: state.dashedDiagonals || undefined,
      id: `${prefix}d:${a}-${b}`,
    });
  }

  for (let i = 0; i < n; i += 1) {
    const v = state.vertices[i];
    if (!v?.showExterior) continue;
    const p = canvas[i]!;
    const ext = toCanvas(
      extensionEnd(state.points[prevIndex(i, n)]!, state.points[i]!, extMath),
    );
    cmds.push({
      t: "line",
      x1: p.x,
      y1: p.y,
      x2: ext.x,
      y2: ext.y,
      stroke: INK,
    });
    if (v.fillExterior) continue;
    const next = canvas[nextIndex(i, n)]!;
    const { exterior } = vertexAngles(state.points, i);
    if (isDisplayedRightAngle(v.exterior, exterior)) {
      drawRightAngle(cmds, p, ext, next);
      continue;
    }
    const label = resolveAngleText(v.exterior, exterior, state.unknownLetter);
    drawAngle(
      cmds,
      texts,
      p,
      ext,
      next,
      label,
      `${prefix}v:${i}:exterior`,
      v.exterior,
      style.fontSize,
      null,
    );
  }

  for (let i = 0; i < n; i += 1) {
    const v = state.vertices[i];
    if (!v?.showInterior) continue;
    const p = canvas[i]!;
    const prev = canvas[prevIndex(i, n)]!;
    const next = canvas[nextIndex(i, n)]!;
    const { interior } = vertexAngles(state.points, i);
    if (isDisplayedRightAngle(v.interior, interior)) {
      drawRightAngle(cmds, p, prev, next);
      continue;
    }
    const label = resolveAngleText(v.interior, interior, state.unknownLetter);
    drawAngle(
      cmds,
      texts,
      p,
      prev,
      next,
      label,
      `${prefix}v:${i}:interior`,
      v.interior,
      style.fontSize,
      null,
    );
  }

  for (let i = 0; i < n; i += 1) {
    const e = state.edges[i];
    if (!e?.showLength) continue;
    const a = canvas[i]!;
    const b = canvas[nextIndex(i, n)]!;
    const mid = mul(add(a, b), 0.5);
    const outward = sub(mid, canvasC);
    const autoLen = options.lengthAt?.(i) ?? edgeLength(state.points, i);
    const label = resolveLengthText(
      e.length,
      autoLen,
      state.unit,
      state.unknownLetter,
    );
    dimArc(
      cmds,
      texts,
      a,
      b,
      outward,
      style.dimOffset,
      label,
      `${prefix}e:${i}:length`,
      e.length,
      style.fontSize,
    );
  }

  for (let i = 0; i < n; i += 1) {
    const p = canvas[i]!;
    if (state.showDots) {
      cmds.push({ t: "dot", x: p.x, y: p.y, r: style.pointRadius });
    }
    const v = state.vertices[i];
    if (!state.showVertexNames || !v?.name.trim()) continue;
    const away = norm(sub(p, canvasC));
    const lp = add(add(p, mul(away, 16)), { x: v.nameDx, y: v.nameDy });
    pushText(texts, cmds, {
      id: `${prefix}v:${i}:name`,
      x: lp.x,
      y: lp.y,
      runs: parseNameRuns(v.name.trim()),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }
}

export function buildPolygonScene(state: PolygonState): PolygonScene {
  const layout = getSceneLayout(state);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  appendPolygonFigure(
    state,
    layout.canvas,
    (p) => mathToCanvas(p, layout),
    cmds,
    texts,
  );
  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
  };
}
