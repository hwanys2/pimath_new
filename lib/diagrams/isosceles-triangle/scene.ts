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
  footOf,
  isRightAngle,
  oppositeSide,
  wedgeDeg,
} from "./geometry";
import type { CevianFrom, CevianState, ExtraArcs, IsoscelesState, WedgeMark } from "./model";
import { CEVIAN_INDEX, emptyLabel } from "./model";

export type IsoScene = SharedDiagramScene & {
  layout: SceneLayout;
};

export type SceneLayout = {
  canvas: Vec[];
  feet: { from: CevianFrom; index: 0 | 1 | 2; canvas: Vec }[];
  foot: Vec | null;
  fromIndex: 0 | 1 | 2 | null;
  origin: Vec;
  mid: Vec;
  scale: number;
};

export const SCENE_WIDTH = 520;
export const SCENE_HEIGHT = 520;

const INK = "#111111";
const ANGLE_FILL = "#f7c8d2";

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
  const mid = mul(add(a, b), 0.5);
  const lineId = `${labelId}:line`;

  const lineH = signedHeight(offset + (meas.lineDy ?? 0), 10, 220);
  const textAlong = meas.dx;
  const textH = offset + meas.dy;
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

function mathBBox(state: IsoscelesState): { min: Vec; max: Vec } {
  const pts = [...state.points];
  for (const cv of state.cevians) pts.push(footOf(state, cv));
  let avg = 0;
  for (let i = 0; i < 3; i += 1) avg += edgeLength(state.points, i);
  avg /= 3;
  const extLen = avg * 0.42;
  for (let i = 0; i < 3; i += 1) {
    if (!state.vertices[i]?.showExterior) continue;
    pts.push(extensionEnd(state.points[prevIndex(i, 3)]!, state.points[i]!, extLen));
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

export function getSceneLayout(state: IsoscelesState): SceneLayout {
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
  const feet = state.cevians.map((cv) => {
    const D = footOf(state, cv);
    return {
      from: cv.from,
      index: CEVIAN_INDEX[cv.from],
      canvas: {
        x: origin.x + (D.x - mid.x) * scale,
        y: origin.y - (D.y - mid.y) * scale,
      },
    };
  });
  const first = feet[0];
  return {
    canvas,
    feet,
    foot: first?.canvas ?? null,
    fromIndex: first?.index ?? null,
    origin,
    mid,
    scale,
  };
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
      r: 2.6,
    });
  }
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

function drawWedge(
  cmds: SceneCmd[],
  texts: SceneText[],
  vertex: Vec,
  from: Vec,
  to: Vec,
  mark: WedgeMark,
  deg: number,
  labelId: string,
  unknownLetter: string,
  fontSize: number,
  forceRight: boolean,
): void {
  if (!mark.show && !forceRight) return;
  if (forceRight || (mark.show && isDisplayedRightAngle(mark.label, deg))) {
    drawRightAngle(cmds, vertex, from, to);
    const label = resolveAngleText(mark.label, deg, unknownLetter);
    if (label && mark.show && mark.label.mode !== "auto") {
      const away = norm(add(norm(sub(from, vertex)), norm(sub(to, vertex))));
      pushText(texts, cmds, {
        id: labelId,
        x: vertex.x + away.x * 28 + mark.label.dx,
        y: vertex.y + away.y * 28 + mark.label.dy,
        runs: parseMathRuns(label),
        size: fontSize,
        anchor: "middle",
      });
    }
    return;
  }
  if (!mark.show) return;
  const label = resolveAngleText(mark.label, deg, unknownLetter);
  drawAngle(
    cmds,
    texts,
    vertex,
    from,
    to,
    label,
    labelId,
    mark.label,
    fontSize,
    mark.fill ? ANGLE_FILL : null,
    mark.extraArcs,
    mark.showDot,
  );
}

const HIDDEN_WEDGE: WedgeMark = {
  show: true,
  fill: false,
  label: emptyLabel("hide"),
  extraArcs: 0,
  showDot: false,
};

function paintCevian(
  cmds: SceneCmd[],
  texts: SceneText[],
  state: IsoscelesState,
  cv: CevianState,
  canvas: Vec[],
  canvasC: Vec,
  layout: SceneLayout,
  style: IsoscelesState["style"],
  phase: "fills" | "lines" | "marks",
): void {
  const fromIdx = CEVIAN_INDEX[cv.from];
  const foot = layout.feet.find((f) => f.from === cv.from)?.canvas;
  if (!foot) return;
  const [li, ri] = oppositeSide(fromIdx);
  const apex = canvas[fromIdx]!;
  const left = canvas[li]!;
  const right = canvas[ri]!;
  const Dmath = footOf(state, cv);
  const letter = cv.from;

  if (phase === "fills") {
    const leftDeg = wedgeDeg(Dmath, state.points[fromIdx]!, state.points[li]!);
    const rightDeg = wedgeDeg(Dmath, state.points[fromIdx]!, state.points[ri]!);
    drawWedge(cmds, texts, foot, apex, left, cv.footLeft, leftDeg, `w:${letter}:footLeft`, state.unknownLetter, style.fontSize, false);
    drawWedge(cmds, texts, foot, apex, right, cv.footRight, rightDeg, `w:${letter}:footRight`, state.unknownLetter, style.fontSize, false);
    const apexLDeg = wedgeDeg(state.points[fromIdx]!, state.points[li]!, Dmath);
    const apexRDeg = wedgeDeg(state.points[fromIdx]!, state.points[ri]!, Dmath);
    drawWedge(cmds, texts, apex, left, foot, cv.apexLeft, apexLDeg, `w:${letter}:apexLeft`, state.unknownLetter, style.fontSize, false);
    drawWedge(cmds, texts, apex, right, foot, cv.apexRight, apexRDeg, `w:${letter}:apexRight`, state.unknownLetter, style.fontSize, false);
    if (cv.showBisectorMarks) {
      if (!cv.apexLeft.show) {
        drawWedge(cmds, texts, apex, left, foot, HIDDEN_WEDGE, apexLDeg, `w:${letter}:bisectorL`, state.unknownLetter, style.fontSize, false);
      }
      if (!cv.apexRight.show) {
        drawWedge(cmds, texts, apex, right, foot, HIDDEN_WEDGE, apexRDeg, `w:${letter}:bisectorR`, state.unknownLetter, style.fontSize, false);
      }
    }
    return;
  }

  if (phase === "lines") {
    cmds.push({
      t: "line",
      x1: apex.x,
      y1: apex.y,
      x2: foot.x,
      y2: foot.y,
      stroke: INK,
    });
    return;
  }

  if (cv.showRightAtD) {
    const leftDeg = wedgeDeg(Dmath, state.points[fromIdx]!, state.points[li]!);
    const rightDeg = wedgeDeg(Dmath, state.points[fromIdx]!, state.points[ri]!);
    if (isRightAngle(leftDeg)) drawRightAngle(cmds, foot, apex, left);
    else if (isRightAngle(rightDeg)) drawRightAngle(cmds, foot, apex, right);
  }
  if (cv.showMidpointTicks) {
    drawEqualTicks(cmds, left, foot, 1, 7);
    drawEqualTicks(cmds, right, foot, 1, 7);
  }
  if (cv.leftLen.show) {
    const a = left;
    const mid = mul(add(a, foot), 0.5);
    const label = resolveLengthText(
      cv.leftLen.label,
      len(sub(Dmath, state.points[li]!)),
      state.unit,
      state.unknownLetter,
    );
    dimArc(cmds, texts, a, foot, sub(mid, canvasC), style.dimOffset, label, `p:${letter}:left:length`, cv.leftLen.label, style.fontSize);
  }
  if (cv.rightLen.show) {
    const a = right;
    const mid = mul(add(a, foot), 0.5);
    const label = resolveLengthText(
      cv.rightLen.label,
      len(sub(Dmath, state.points[ri]!)),
      state.unit,
      state.unknownLetter,
    );
    dimArc(cmds, texts, a, foot, sub(mid, canvasC), style.dimOffset, label, `p:${letter}:right:length`, cv.rightLen.label, style.fontSize);
  }
  if (cv.length.show) {
    const a = apex;
    const mid = mul(add(a, foot), 0.5);
    const label = resolveLengthText(
      cv.length.label,
      len(sub(Dmath, state.points[fromIdx]!)),
      state.unit,
      state.unknownLetter,
    );
    dimArc(cmds, texts, a, foot, sub(mid, canvasC), style.dimOffset, label, `c:${letter}:length`, cv.length.label, style.fontSize);
  }
  if (state.showDots) {
    cmds.push({ t: "dot", x: foot.x, y: foot.y, r: style.pointRadius });
  }
  if (cv.showName && cv.name.trim()) {
    const away = norm(sub(foot, canvasC));
    const lp = add(add(foot, mul(away, 16)), { x: cv.nameDx, y: cv.nameDy });
    pushText(texts, cmds, {
      id: `d:${letter}:name`,
      x: lp.x,
      y: lp.y,
      runs: parseNameRuns(cv.name.trim()),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }
}

export function buildIsoscelesScene(state: IsoscelesState): IsoScene {
  const { style } = state;
  const layout = getSceneLayout(state);
  const canvas = layout.canvas;
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const mathC = centroid(state.points);
  const canvasC = mathToCanvas(mathC, layout);
  const originSet = new Set<number>(state.cevians.map((c) => CEVIAN_INDEX[c.from]));
  const splitLenSides = new Set(
    state.cevians
      .filter((c) => c.leftLen.show || c.rightLen.show)
      .map((c) => (CEVIAN_INDEX[c.from] + 1) % 3),
  );
  const midpointSides = new Set(
    state.cevians
      .filter((c) => c.showMidpointTicks)
      .map((c) => (CEVIAN_INDEX[c.from] + 1) % 3),
  );

  let avgSide = 0;
  for (let i = 0; i < 3; i += 1) avgSide += edgeLength(state.points, i);
  avgSide /= 3;
  const extMath = avgSide * 0.42;

  for (let i = 0; i < 3; i += 1) {
    const v = state.vertices[i];
    if (!v?.showExterior || !v.fillExterior) continue;
    const p = canvas[i]!;
    const next = canvas[nextIndex(i, 3)]!;
    const ext = mathToCanvas(
      extensionEnd(state.points[prevIndex(i, 3)]!, state.points[i]!, extMath),
      layout,
    );
    const { exterior } = vertexAngles(state.points, i);
    if (isDisplayedRightAngle(v.exterior, exterior)) {
      drawRightAngle(cmds, p, ext, next);
      continue;
    }
    const label = resolveAngleText(v.exterior, exterior, state.unknownLetter);
    drawAngle(
      cmds, texts, p, ext, next, label, `v:${i}:exterior`, v.exterior,
      style.fontSize, ANGLE_FILL, v.extraArcs, v.showDot,
    );
  }

  for (let i = 0; i < 3; i += 1) {
    const v = state.vertices[i];
    if (!v?.showInterior || !v.fillInterior) continue;
    if (originSet.has(i)) continue;
    const p = canvas[i]!;
    const prev = canvas[prevIndex(i, 3)]!;
    const next = canvas[nextIndex(i, 3)]!;
    const { interior } = vertexAngles(state.points, i);
    if (isDisplayedRightAngle(v.interior, interior)) continue;
    const label = resolveAngleText(v.interior, interior, state.unknownLetter);
    drawAngle(
      cmds, texts, p, prev, next, label, `v:${i}:interior`, v.interior,
      style.fontSize, ANGLE_FILL, v.extraArcs, v.showDot,
    );
  }

  for (const cv of state.cevians) {
    paintCevian(cmds, texts, state, cv, canvas, canvasC, layout, style, "fills");
  }

  cmds.push({
    t: "polyline",
    pts: [...canvas, canvas[0]!],
    stroke: INK,
  });

  for (const cv of state.cevians) {
    paintCevian(cmds, texts, state, cv, canvas, canvasC, layout, style, "lines");
  }

  for (let i = 0; i < 3; i += 1) {
    const v = state.vertices[i];
    if (!v?.showExterior) continue;
    const p = canvas[i]!;
    const ext = mathToCanvas(
      extensionEnd(state.points[prevIndex(i, 3)]!, state.points[i]!, extMath),
      layout,
    );
    cmds.push({ t: "line", x1: p.x, y1: p.y, x2: ext.x, y2: ext.y, stroke: INK });
    if (v.fillExterior) continue;
    const next = canvas[nextIndex(i, 3)]!;
    const { exterior } = vertexAngles(state.points, i);
    if (isDisplayedRightAngle(v.exterior, exterior)) {
      drawRightAngle(cmds, p, ext, next);
      continue;
    }
    const label = resolveAngleText(v.exterior, exterior, state.unknownLetter);
    drawAngle(
      cmds, texts, p, ext, next, label, `v:${i}:exterior`, v.exterior,
      style.fontSize, null, v.extraArcs, v.showDot,
    );
  }

  for (let i = 0; i < 3; i += 1) {
    const v = state.vertices[i];
    if (!v?.showInterior) continue;
    if (originSet.has(i)) continue;
    const p = canvas[i]!;
    const prev = canvas[prevIndex(i, 3)]!;
    const next = canvas[nextIndex(i, 3)]!;
    const { interior } = vertexAngles(state.points, i);
    if (isDisplayedRightAngle(v.interior, interior)) {
      drawRightAngle(cmds, p, prev, next);
      continue;
    }
    if (v.fillInterior) continue;
    const label = resolveAngleText(v.interior, interior, state.unknownLetter);
    drawAngle(
      cmds, texts, p, prev, next, label, `v:${i}:interior`, v.interior,
      style.fontSize, null, v.extraArcs, v.showDot,
    );
  }

  for (const cv of state.cevians) {
    paintCevian(cmds, texts, state, cv, canvas, canvasC, layout, style, "marks");
  }

  for (let i = 0; i < 3; i += 1) {
    const e = state.edges[i];
    if (!e?.showLength) continue;
    if (splitLenSides.has(i)) continue;
    const a = canvas[i]!;
    const b = canvas[nextIndex(i, 3)]!;
    const mid = mul(add(a, b), 0.5);
    const outward = sub(mid, canvasC);
    const label = resolveLengthText(
      e.length,
      edgeLength(state.points, i),
      state.unit,
      state.unknownLetter,
    );
    dimArc(
      cmds, texts, a, b, outward, style.dimOffset, label,
      `e:${i}:length`, e.length, style.fontSize,
    );
  }

  for (let i = 0; i < 3; i += 1) {
    const ticks = state.edges[i]?.ticks ?? 0;
    if (ticks === 0) continue;
    if (midpointSides.has(i)) continue;
    drawEqualTicks(cmds, canvas[i]!, canvas[nextIndex(i, 3)]!, ticks, 7);
  }

  for (let i = 0; i < 3; i += 1) {
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

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
  };
}

