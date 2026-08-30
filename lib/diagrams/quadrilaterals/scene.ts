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
} from "@/lib/diagrams/polygon/geometry";
import {
  resolveAngleText,
  resolveLengthText,
  type MeasLabel,
  type Vec,
} from "@/lib/diagrams/polygon/model";
import {
  diagonalMeet,
  extensionPoints,
  isRightAngle,
  wedgeDeg,
} from "./geometry";
import {
  FACE_KEYS,
  type AngleFill,
  type ExtraArcs,
  type FaceFill,
  type FaceKey,
  type QuadState,
} from "./model";

export type QuadScene = SharedDiagramScene & {
  layout: SceneLayout;
};

export type SceneLayout = {
  canvas: Vec[];
  o: Vec | null;
  exts: Vec[];
  origin: Vec;
  mid: Vec;
  scale: number;
};

export const SCENE_WIDTH = 520;
export const SCENE_HEIGHT = 520;

const INK = "#111111";
const PINK = "#f7c8d2";
const BLUE = "#c5dcf0";
const GREEN = "#cfe8c4";
const YELLOW = "#f6e6b4";
const MARK = "#e0709a";

function fillFor(kind: AngleFill): string | null {
  if (kind === "pink") return PINK;
  if (kind === "blue") return BLUE;
  return null;
}

function faceColor(kind: FaceFill): string | null {
  if (kind === "green") return GREEN;
  if (kind === "yellow") return YELLOW;
  return null;
}

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
  const lineH = signedHeight(offset + (meas.lineDy ?? 0));
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

function mathBBox(state: QuadState): { min: Vec; max: Vec } {
  const pts = [...state.points];
  const O = diagonalMeet(state.points);
  if (state.showO || state.showDiagAC || state.showDiagBD) pts.push(O);
  for (const p of extensionPoints(state)) pts.push(p);
  if (state.showGuides) {
    const A = state.points[0]!;
    const B = state.points[1]!;
    const C = state.points[2]!;
    const D = state.points[3]!;
    const alongTop = norm(sub(D, A));
    const alongBot = norm(sub(C, B));
    const span = Math.max(len(sub(D, A)), len(sub(C, B)), 1) * 0.45;
    pts.push(add(A, mul(alongTop, -span)));
    pts.push(add(D, mul(alongTop, span)));
    pts.push(add(B, mul(alongBot, -span)));
    pts.push(add(C, mul(alongBot, span)));
  }
  let avg = 0;
  for (let i = 0; i < 4; i += 1) avg += edgeLength(state.points, i);
  avg /= 4;
  const extLen = avg * 0.42;
  for (let i = 0; i < 4; i += 1) {
    if (!state.vertices[i]?.showExterior) continue;
    pts.push(extensionEnd(state.points[prevIndex(i, 4)]!, state.points[i]!, extLen));
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

export function getSceneLayout(state: QuadState): SceneLayout {
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
  const O = diagonalMeet(state.points);
  const o =
    state.showO || state.showDiagAC || state.showDiagBD
      ? {
          x: origin.x + (O.x - mid.x) * scale,
          y: origin.y - (O.y - mid.y) * scale,
        }
      : null;
  const mathExts = extensionPoints(state);
  const exts = mathExts.map((E) => ({
    x: origin.x + (E.x - mid.x) * scale,
    y: origin.y - (E.y - mid.y) * scale,
  }));
  return { canvas, o, exts, origin, mid, scale };
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

export function isDisplayedRightAngle(label: MeasLabel, deg: number): boolean {
  return label.mode !== "x" && Number.isFinite(deg) && Math.abs(deg - 90) < 0.75;
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

function drawEqualTicks(
  cmds: SceneCmd[],
  a: Vec,
  b: Vec,
  count: 1 | 2 | 3,
  size: number,
): void {
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

function midAngle(from: Vec, vertex: Vec, to: Vec): number {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  const a0 = Math.atan2(u.y, u.x);
  const a1 = Math.atan2(w.y, w.x);
  const arc = smallerArc(a0, a1);
  const sweep = arcSweep(arc.a0, arc.a1, arc.ccw);
  return arc.a0 + (arc.ccw ? -sweep : sweep) / 2;
}

function drawAngleX(cmds: SceneCmd[], vertex: Vec, from: Vec, to: Vec, r: number): void {
  const ang = midAngle(from, vertex, to);
  const p = {
    x: vertex.x + Math.cos(ang) * r * 0.58,
    y: vertex.y + Math.sin(ang) * r * 0.58,
  };
  const s = 5.2;
  const c = Math.cos(ang + Math.PI / 4);
  const s2 = Math.sin(ang + Math.PI / 4);
  cmds.push({
    t: "line",
    x1: p.x - c * s,
    y1: p.y - s2 * s,
    x2: p.x + c * s,
    y2: p.y + s2 * s,
    stroke: MARK,
  });
  cmds.push({
    t: "line",
    x1: p.x + s2 * s,
    y1: p.y - c * s,
    x2: p.x - s2 * s,
    y2: p.y + c * s,
    stroke: MARK,
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
  extraArcs: ExtraArcs,
  showDot: boolean,
  showX: boolean,
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
  const radii = [r];
  if (extraArcs >= 1) radii.push(r - 5);
  if (extraArcs >= 2) radii.push(r - 10);
  for (const rad of radii) {
    if (rad < 8) continue;
    cmds.push({
      t: "arc",
      cx: vertex.x,
      cy: vertex.y,
      r: rad,
      a0: arc.a0,
      a1: arc.a1,
      ccw: arc.ccw,
      stroke: INK,
    });
  }
  const sweep = arcSweep(arc.a0, arc.a1, arc.ccw);
  const midAng = arc.a0 + (arc.ccw ? -sweep : sweep) / 2;
  if (showDot) {
    const dr = Math.max(r * 0.62, 10);
    cmds.push({
      t: "dot",
      x: vertex.x + Math.cos(midAng) * dr,
      y: vertex.y + Math.sin(midAng) * dr,
      r: 2.7,
      stroke: MARK,
    });
  }
  if (showX) drawAngleX(cmds, vertex, from, to, r);
  if (!label) return;
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

function facePoints(
  key: FaceKey,
  canvas: Vec[],
  o: Vec | null,
): Vec[] | null {
  const A = canvas[0]!;
  const B = canvas[1]!;
  const C = canvas[2]!;
  const D = canvas[3]!;
  if (key === "DBC") return [D, B, C];
  if (key === "ABC") return [A, B, C];
  if (!o) return null;
  if (key === "ODC") return [o, D, C];
  if (key === "AOB") return [A, o, B];
  if (key === "BOC") return [B, o, C];
  if (key === "OAD") return [o, A, D];
  return null;
}

export function buildQuadScene(state: QuadState): QuadScene {
  const { style } = state;
  const layout = getSceneLayout(state);
  const canvas = layout.canvas;
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const mathC = centroid(state.points);
  const canvasC = mathToCanvas(mathC, layout);
  const cO = layout.o;
  const cExts = layout.exts;
  const Omath = diagonalMeet(state.points);
  const showAC = state.showDiagAC || state.showO;
  const showBD = state.showDiagBD || state.showO;

  let avgSide = 0;
  for (let i = 0; i < 4; i += 1) avgSide += edgeLength(state.points, i);
  avgSide /= 4;
  const extMath = avgSide * 0.42;

  for (const key of FACE_KEYS) {
    const fill = faceColor(state.faces[key]);
    if (!fill) continue;
    const pts = facePoints(key, canvas, cO);
    if (!pts) continue;
    cmds.push({ t: "polygon", points: pts, fill });
  }

  if (state.showGuides) {
    const A = canvas[0]!;
    const B = canvas[1]!;
    const C = canvas[2]!;
    const D = canvas[3]!;
    const alongTop = norm(sub(D, A));
    const alongBot = norm(sub(C, B));
    const span = Math.max(len(sub(D, A)), len(sub(C, B))) * 0.42;
    const t0 = add(A, mul(alongTop, -span));
    const t1 = add(D, mul(alongTop, span));
    const b0 = add(B, mul(alongBot, -span));
    const b1 = add(C, mul(alongBot, span));
    cmds.push({ t: "line", x1: t0.x, y1: t0.y, x2: t1.x, y2: t1.y, stroke: INK });
    cmds.push({ t: "line", x1: b0.x, y1: b0.y, x2: b1.x, y2: b1.y, stroke: INK });
    pushText(texts, cmds, {
      id: "guide:top",
      x: t1.x + 10 + state.guideTopDx,
      y: t1.y + state.guideTopDy,
      runs: parseMathRuns(`$${state.guideTopName}$`),
      size: style.fontSize,
      anchor: "start",
    });
    pushText(texts, cmds, {
      id: "guide:bottom",
      x: b1.x + 10 + state.guideBottomDx,
      y: b1.y + state.guideBottomDy,
      runs: parseMathRuns(`$${state.guideBottomName}$`),
      size: style.fontSize,
      anchor: "start",
    });
  }

  for (let i = 0; i < 4; i += 1) {
    const v = state.vertices[i];
    if (!v?.showExterior || !v.fillExterior) continue;
    const p = canvas[i]!;
    const next = canvas[nextIndex(i, 4)]!;
    const ext = mathToCanvas(
      extensionEnd(state.points[prevIndex(i, 4)]!, state.points[i]!, extMath),
      layout,
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
      `v:${i}:exterior`,
      v.exterior,
      style.fontSize,
      PINK,
      v.extraArcs,
      v.angleMark === "dot",
      v.angleMark === "x",
    );
  }

  for (let i = 0; i < 4; i += 1) {
    const v = state.vertices[i];
    if (!v?.showInterior) continue;
    const fill = fillFor(v.fillInterior);
    if (!fill && v.angleMark === "none") continue;
    if (v.wedgePrev.show || v.wedgeNext.show) continue;
    const p = canvas[i]!;
    const prev = canvas[prevIndex(i, 4)]!;
    const next = canvas[nextIndex(i, 4)]!;
    const { interior } = vertexAngles(state.points, i);
    if (isDisplayedRightAngle(v.interior, interior)) continue;
    const label = resolveAngleText(v.interior, interior, state.unknownLetter);
    drawAngle(
      cmds,
      texts,
      p,
      prev,
      next,
      label,
      `v:${i}:interior`,
      v.interior,
      style.fontSize,
      fill,
      v.extraArcs,
      v.angleMark === "dot",
      v.angleMark === "x",
    );
  }

  cmds.push({
    t: "polyline",
    pts: [...canvas, canvas[0]!],
    stroke: INK,
  });

  for (let i = 0; i < cExts.length; i += 1) {
    const p = cExts[i]!;
    const vertex = state.extensions[i]!.vertex;
    cmds.push({
      t: "line",
      x1: canvas[vertex]!.x,
      y1: canvas[vertex]!.y,
      x2: p.x,
      y2: p.y,
      stroke: INK,
    });
  }

  if (showAC) {
    cmds.push({
      t: "line",
      x1: canvas[0]!.x,
      y1: canvas[0]!.y,
      x2: canvas[2]!.x,
      y2: canvas[2]!.y,
      stroke: INK,
    });
  }
  if (showBD) {
    cmds.push({
      t: "line",
      x1: canvas[1]!.x,
      y1: canvas[1]!.y,
      x2: canvas[3]!.x,
      y2: canvas[3]!.y,
      stroke: INK,
    });
  }

  if (cO && state.showRightAtO) {
    drawRightAngle(cmds, cO, canvas[0]!, canvas[1]!);
  }

  for (let i = 0; i < 4; i += 1) {
    const v = state.vertices[i];
    if (!v?.showExterior) continue;
    const p = canvas[i]!;
    const ext = mathToCanvas(
      extensionEnd(state.points[prevIndex(i, 4)]!, state.points[i]!, extMath),
      layout,
    );
    cmds.push({ t: "line", x1: p.x, y1: p.y, x2: ext.x, y2: ext.y, stroke: INK });
    if (v.fillExterior) continue;
    const next = canvas[nextIndex(i, 4)]!;
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
      `v:${i}:exterior`,
      v.exterior,
      style.fontSize,
      null,
      v.extraArcs,
      v.angleMark === "dot",
      v.angleMark === "x",
    );
  }

  for (let i = 0; i < 4; i += 1) {
    const v = state.vertices[i];
    if (!v?.showInterior) continue;
    if (v.fillInterior !== "none") continue;
    if (v.wedgePrev.show || v.wedgeNext.show) continue;
    const p = canvas[i]!;
    const prev = canvas[prevIndex(i, 4)]!;
    const next = canvas[nextIndex(i, 4)]!;
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
      `v:${i}:interior`,
      v.interior,
      style.fontSize,
      null,
      v.extraArcs,
      v.angleMark === "dot",
      v.angleMark === "x",
    );
  }

  if (cO) {
    for (let i = 0; i < 4; i += 1) {
      const v = state.vertices[i];
      if (!v) continue;
      const p = canvas[i]!;
      const prev = canvas[prevIndex(i, 4)]!;
      const next = canvas[nextIndex(i, 4)]!;
      const prevM = state.points[prevIndex(i, 4)]!;
      const nextM = state.points[nextIndex(i, 4)]!;
      const V = state.points[i]!;
      if (v.wedgePrev.show) {
        const deg = wedgeDeg(V, prevM, Omath);
        if (isDisplayedRightAngle(v.wedgePrev.label, deg)) {
          drawRightAngle(cmds, p, prev, cO);
        } else {
          const label = resolveAngleText(v.wedgePrev.label, deg, state.unknownLetter);
          drawAngle(
            cmds,
            texts,
            p,
            prev,
            cO,
            label,
            `w:${i}:prev`,
            v.wedgePrev.label,
            style.fontSize,
            fillFor(v.wedgePrev.fill),
            v.wedgePrev.extraArcs,
            v.wedgePrev.showDot,
            v.wedgePrev.showX,
          );
        }
      }
      if (v.wedgeNext.show) {
        const deg = wedgeDeg(V, nextM, Omath);
        if (isDisplayedRightAngle(v.wedgeNext.label, deg)) {
          drawRightAngle(cmds, p, next, cO);
        } else {
          const label = resolveAngleText(v.wedgeNext.label, deg, state.unknownLetter);
          drawAngle(
            cmds,
            texts,
            p,
            next,
            cO,
            label,
            `w:${i}:next`,
            v.wedgeNext.label,
            style.fontSize,
            fillFor(v.wedgeNext.fill),
            v.wedgeNext.extraArcs,
            v.wedgeNext.showDot,
            v.wedgeNext.showX,
          );
        }
      }
    }
  }

  for (let i = 0; i < 4; i += 1) {
    const e = state.edges[i];
    if (!e?.showLength) continue;
    const a = canvas[i]!;
    const b = canvas[nextIndex(i, 4)]!;
    const mid = mul(add(a, b), 0.5);
    const outward = sub(mid, canvasC);
    const label = resolveLengthText(
      e.length,
      edgeLength(state.points, i),
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
      `e:${i}:length`,
      e.length,
      style.fontSize,
    );
  }

  const segs: { id: "AO" | "OC" | "BO" | "OD" | "AC" | "BD"; a: Vec; b: Vec; ma: Vec; mb: Vec }[] = [];
  if (cO) {
    segs.push({ id: "AO", a: canvas[0]!, b: cO, ma: state.points[0]!, mb: Omath });
    segs.push({ id: "OC", a: cO, b: canvas[2]!, ma: Omath, mb: state.points[2]! });
    segs.push({ id: "BO", a: canvas[1]!, b: cO, ma: state.points[1]!, mb: Omath });
    segs.push({ id: "OD", a: cO, b: canvas[3]!, ma: Omath, mb: state.points[3]! });
  }
  segs.push({
    id: "AC",
    a: canvas[0]!,
    b: canvas[2]!,
    ma: state.points[0]!,
    mb: state.points[2]!,
  });
  segs.push({
    id: "BD",
    a: canvas[1]!,
    b: canvas[3]!,
    ma: state.points[1]!,
    mb: state.points[3]!,
  });
  for (const s of segs) {
    const mark = state.diagSegs[s.id];
    if (!mark?.show) continue;
    const mid = mul(add(s.a, s.b), 0.5);
    const label = resolveLengthText(
      mark.label,
      len(sub(s.mb, s.ma)),
      state.unit,
      state.unknownLetter,
    );
    dimArc(
      cmds,
      texts,
      s.a,
      s.b,
      sub(mid, canvasC),
      style.dimOffset,
      label,
      `d:${s.id}`,
      mark.label,
      style.fontSize,
    );
  }

  for (let i = 0; i < 4; i += 1) {
    const e = state.edges[i];
    if (!e) continue;
    if (e.ticks === 1 || e.ticks === 2 || e.ticks === 3) {
      drawEqualTicks(cmds, canvas[i]!, canvas[nextIndex(i, 4)]!, e.ticks, 7);
    }
    if (e.parallel) {
      drawParallelArrow(cmds, canvas[i]!, canvas[nextIndex(i, 4)]!);
    }
  }

  for (let i = 0; i < 4; i += 1) {
    const p = canvas[i]!;
    if (state.showDots) {
      cmds.push({ t: "dot", x: p.x, y: p.y, r: style.pointRadius });
    }
    const v = state.vertices[i];
    if (!state.showVertexNames || !v?.name.trim()) continue;
    const away = norm(sub(p, canvasC));
    const lp = add(add(p, mul(away, 16)), { x: v.nameDx, y: v.nameDy });
    pushText(texts, cmds, {
      id: `v:${i}:name`,
      x: lp.x,
      y: lp.y,
      runs: parseNameRuns(v.name.trim()),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }

  if (cO && state.showO) {
    if (state.showDots) {
      cmds.push({ t: "dot", x: cO.x, y: cO.y, r: style.pointRadius });
    }
    if (state.oName.trim()) {
      const away = norm(sub(cO, canvasC));
      const lp = add(add(cO, mul(away, 14)), { x: state.oDx, y: state.oDy });
      pushText(texts, cmds, {
        id: "o:name",
        x: lp.x,
        y: lp.y,
        runs: parseNameRuns(state.oName.trim()),
        size: style.pointLabelSize,
        anchor: "middle",
      });
    }
  }

  for (let i = 0; i < cExts.length; i += 1) {
    const p = cExts[i]!;
    const ext = state.extensions[i]!;
    if (state.showDots) {
      cmds.push({ t: "dot", x: p.x, y: p.y, r: style.pointRadius });
    }
    if (ext.name.trim()) {
      const away = norm(sub(p, canvasC));
      const lp = add(add(p, mul(away, 16)), {
        x: ext.nameDx,
        y: ext.nameDy,
      });
      pushText(texts, cmds, {
        id: `e:${i}:name`,
        x: lp.x,
        y: lp.y,
        runs: parseNameRuns(ext.name.trim()),
        size: style.pointLabelSize,
        anchor: "middle",
      });
    }
  }

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
  };
}

export { isRightAngle };
