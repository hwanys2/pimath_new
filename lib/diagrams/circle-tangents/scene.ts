import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import { add, clamp, len, mul, norm, sub } from "@/lib/diagrams/polygon/geometry";
import type {
  DiagramScene as SharedDiagramScene,
  SceneCmd,
  SceneText,
} from "@/lib/diagrams/scene";
import { hitTestText, sceneTextPlain } from "@/lib/diagrams/scene";
import {
  angleText,
  deriveQuad,
  deriveThree,
  deriveTri,
  deriveTwo,
  lengthEndpoints,
  lengthText,
  pointPos,
  type DerivedQuad,
  type DerivedThree,
  type DerivedTri,
  type DerivedTwo,
} from "@/lib/diagrams/circle-tangents/geometry";
import type {
  AngleFill,
  CircleTangentsState,
  MeasLabel,
  NamedPoint,
  Vec,
} from "@/lib/diagrams/circle-tangents/model";

export type { SceneCmd, SceneText };
export { hitTestText, sceneTextPlain };

export type DiagramScene = SharedDiagramScene & {
  layout: SceneLayout;
  pointIds: string[];
};

export const SCENE_WIDTH = 520;
export const SCENE_HEIGHT = 540;

export type SceneLayout = {
  origin: Vec;
  scale: number;
  viewRot: number;
};

const INK = "#111111";
const FILL_PINK = "#f7c8d2";
const FILL_BLUE = "#c5dff0";
const FILL_GREEN = "#d4edda";
const FILL_GRAY = "#d9dde3";

function fillColor(fill: AngleFill): string | null {
  if (fill === "pink") return FILL_PINK;
  if (fill === "blue") return FILL_BLUE;
  if (fill === "green") return FILL_GREEN;
  if (fill === "gray") return FILL_GRAY;
  return null;
}

function rot(a: Vec, deg: number): Vec {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

function toCanvas(p: Vec, origin: Vec, scale: number, viewRot: number): Vec {
  const q = rot(p, viewRot);
  return { x: origin.x + q.x * scale, y: origin.y - q.y * scale };
}

export function mathToCanvas(p: Vec, layout: SceneLayout): Vec {
  return toCanvas(p, layout.origin, layout.scale, layout.viewRot);
}

export function canvasToMath(p: Vec, layout: SceneLayout): Vec {
  const dx = p.x - layout.origin.x;
  const dy = layout.origin.y - p.y;
  const rad = (-layout.viewRot * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const xr = dx * c - dy * s;
  const yr = dx * s + dy * c;
  return { x: xr / layout.scale, y: yr / layout.scale };
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

function sagittaArc(
  a: Vec,
  b: Vec,
  u: Vec,
  sagitta: number,
): { C: Vec; r: number; a0: number; a1: number; ccw: boolean } | null {
  const span = len(sub(b, a));
  const s = sagitta;
  if (span < 2 || Math.abs(s) < 0.75) return null;
  const n = perpToward(sub(b, a), u);
  const mid = mul(add(a, b), 0.5);
  const half = span / 2;
  const r = (half * half + s * s) / (2 * Math.abs(s));
  const C = add(mid, mul(n, s - Math.sign(s) * r));
  const a0 = Math.atan2(a.y - C.y, a.x - C.x);
  const a1 = Math.atan2(b.y - C.y, b.x - C.x);
  const peak = add(mid, mul(n, s));
  const aS = Math.atan2(peak.y - C.y, peak.x - C.x);
  const sOnIncreasing = ccwSpan(a0, aS) <= ccwSpan(a0, a1) + 1e-6;
  return { C, r, a0, a1, ccw: !sOnIncreasing };
}

function angleOnArc(ang: number, a0: number, a1: number, ccw: boolean): boolean {
  if (ccw) return ccwSpan(a0, ang) <= ccwSpan(a0, a1) + 1e-6;
  return ccwSpan(a1, ang) <= ccwSpan(a1, a0) + 1e-6;
}

function distToArc(
  p: Vec,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  ccw: boolean,
): number {
  const ang = Math.atan2(p.y - cy, p.x - cx);
  if (angleOnArc(ang, a0, a1, ccw)) {
    return Math.abs(Math.hypot(p.x - cx, p.y - cy) - r);
  }
  const p0 = { x: cx + r * Math.cos(a0), y: cy + r * Math.sin(a0) };
  const p1 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
  return Math.min(
    Math.hypot(p.x - p0.x, p.y - p0.y),
    Math.hypot(p.x - p1.x, p.y - p1.y),
  );
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

  const mid = mul(add(a, b), 0.5);
  const labelPos = add(mid, add(mul(u, textH), mul(along, textAlong)));
  pushText(texts, cmds, {
    id: labelId,
    x: labelPos.x,
    y: labelPos.y,
    runs: parseMathRuns(label),
    size: fontSize,
    anchor: "middle",
  });
}

function drawEqualTicks(
  cmds: SceneCmd[],
  a: Vec,
  b: Vec,
  count: 1 | 2,
  size: number,
): void {
  const dir = norm(sub(b, a));
  const n = { x: -dir.y, y: dir.x };
  const mid = mul(add(a, b), 0.5);
  const span = 5;
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

function extendBeyond(from: Vec, through: Vec, extra: number): Vec {
  const d = sub(through, from);
  const L = len(d);
  if (L < 1e-9) return through;
  return add(through, mul(d, extra / L));
}

function pushPoint(
  cmds: SceneCmd[],
  texts: SceneText[],
  c: Vec,
  mark: NamedPoint,
  id: string,
  style: CircleTangentsState["style"],
  outward: Vec,
): void {
  const showDot = mark.mode === "both" || mark.mode === "dot";
  const showName = mark.mode === "both" || mark.mode === "name";
  if (showDot) {
    cmds.push({ t: "dot", x: c.x, y: c.y, r: style.pointRadius });
  }
  if (showName && mark.name.trim()) {
    const off = mul(norm(outward), style.pointLabelSize * 0.55 + 6);
    pushText(texts, cmds, {
      id: `pt:${id}`,
      x: c.x + off.x + mark.dx,
      y: c.y + off.y + mark.dy,
      runs: parseNameRuns(mark.name),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }
}

function pushAngleMark(
  cmds: SceneCmd[],
  texts: SceneText[],
  vertex: Vec,
  from: Vec,
  to: Vec,
  fill: AngleFill,
  label: string | null,
  id: string,
  meas: MeasLabel,
  fontSize: number,
): void {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  const a0 = Math.atan2(u.y, u.x);
  const a1 = Math.atan2(w.y, w.x);
  let sweep = a1 - a0;
  while (sweep <= -Math.PI) sweep += Math.PI * 2;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  const ccw = sweep < 0;
  const r = clamp(Math.min(len(sub(from, vertex)), len(sub(to, vertex))) * 0.22, 14, 30);
  const color = fillColor(fill);
  if (color) {
    const pts: Vec[] = [vertex];
    const steps = 18;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const ang = ccw ? a0 - Math.abs(sweep) * t : a0 + Math.abs(sweep) * t;
      pts.push({
        x: vertex.x + Math.cos(ang) * r,
        y: vertex.y + Math.sin(ang) * r,
      });
    }
    cmds.push({ t: "polygon", points: pts, fill: color });
  }
  cmds.push({
    t: "arc",
    cx: vertex.x,
    cy: vertex.y,
    r,
    a0,
    a1,
    ccw,
    stroke: INK,
    id: `${id}:line`,
  });
  if (!label) return;
  const midAng = ccw ? a0 - Math.abs(sweep) / 2 : a0 + Math.abs(sweep) / 2;
  const labelR = r + fontSize * 0.7;
  pushText(texts, cmds, {
    id,
    x: vertex.x + Math.cos(midAng) * labelR + meas.dx,
    y: vertex.y + Math.sin(midAng) * labelR + meas.dy,
    runs: parseMathRuns(label),
    size: fontSize,
    anchor: "middle",
  });
}

function boundsOf(points: Vec[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

function expandBounds(
  b: { minX: number; maxX: number; minY: number; maxY: number },
  p: Vec,
  margin = 0,
): void {
  b.minX = Math.min(b.minX, p.x - margin);
  b.maxX = Math.max(b.maxX, p.x + margin);
  b.minY = Math.min(b.minY, p.y - margin);
  b.maxY = Math.max(b.maxY, p.y + margin);
}

/**
 * Fit all geometry (points + circles) inside the canvas with padding.
 * Bounds are measured after view rotation so the rotated figure stays unclipped.
 */
function layoutForPoints(
  state: CircleTangentsState,
  pts: Vec[],
  circles: { c: Vec; r: number }[] = [],
): SceneLayout {
  const pad = state.style.padding;
  const viewRot = state.viewRotationDeg;
  const b = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };
  for (const p of pts) {
    expandBounds(b, rot(p, viewRot));
  }
  for (const circle of circles) {
    const c = rot(circle.c, viewRot);
    // Circle is rotation-invariant: AABB is ±r around the rotated center.
    expandBounds(b, c, Math.max(0, circle.r));
  }
  if (!Number.isFinite(b.minX)) {
    return {
      origin: { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2 },
      scale: 20,
      viewRot,
    };
  }
  const w = Math.max(b.maxX - b.minX, 1);
  const h = Math.max(b.maxY - b.minY, 1);
  const scale = Math.min(
    (SCENE_WIDTH - pad * 2) / w,
    (SCENE_HEIGHT - pad * 2) / h,
  );
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return {
    origin: {
      x: SCENE_WIDTH / 2 - cx * scale,
      y: SCENE_HEIGHT / 2 + cy * scale,
    },
    scale,
    viewRot,
  };
}

function pushLength(
  state: CircleTangentsState,
  cmds: SceneCmd[],
  texts: SceneText[],
  id: string,
  canvasOutward: Vec,
  map: (p: Vec) => Vec,
): void {
  const ends = lengthEndpoints(state, id);
  const mark =
    state.kind === "two-tangents"
      ? state.two.lengths[id as keyof typeof state.two.lengths]
      : state.kind === "incircle-triangle"
        ? state.tri.sides[id as keyof typeof state.tri.sides] ??
          state.tri.segs[id as keyof typeof state.tri.segs]
        : state.kind === "tangential-quad"
          ? state.quad.segs[id as keyof typeof state.quad.segs]
          : state.three.lengths[id as keyof typeof state.three.lengths];
  if (!ends || !mark?.show) return;
  const label = lengthText(state, id);
  dimArc(
    cmds,
    texts,
    map(ends[0]),
    map(ends[1]),
    canvasOutward,
    state.style.dimOffset,
    label,
    id,
    mark.label,
    state.style.fontSize,
  );
}

function buildTwo(state: CircleTangentsState, d: DerivedTwo): DiagramScene {
  const t = state.two;
  const pts = [d.O, d.P, d.A, d.B];
  const layout = layoutForPoints(
    state,
    [
      ...pts,
      extendBeyond(d.P, d.A, t.extendPast * d.r),
      extendBeyond(d.P, d.B, t.extendPast * d.r),
    ],
    [{ c: d.O, r: d.r }],
  );
  const map = (p: Vec) => mathToCanvas(p, layout);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const cO = map(d.O);
  const cP = map(d.P);
  const cA = map(d.A);
  const cB = map(d.B);
  const visualR = layout.scale * d.r;

  cmds.push({ t: "circle", x: cO.x, y: cO.y, r: visualR });

  const aExt = map(extendBeyond(d.P, d.A, t.extendPast * d.r));
  const bExt = map(extendBeyond(d.P, d.B, t.extendPast * d.r));
  cmds.push({ t: "line", x1: cP.x, y1: cP.y, x2: aExt.x, y2: aExt.y, id: "PA" });
  cmds.push({ t: "line", x1: cP.x, y1: cP.y, x2: bExt.x, y2: bExt.y, id: "PB" });

  if (t.showChordAB) {
    cmds.push({ t: "line", x1: cA.x, y1: cA.y, x2: cB.x, y2: cB.y, id: "AB" });
  }
  if (t.showOA) cmds.push({ t: "line", x1: cO.x, y1: cO.y, x2: cA.x, y2: cA.y, id: "OA" });
  if (t.showOB) cmds.push({ t: "line", x1: cO.x, y1: cO.y, x2: cB.x, y2: cB.y, id: "OB" });
  if (t.showOP) cmds.push({ t: "line", x1: cO.x, y1: cO.y, x2: cP.x, y2: cP.y, id: "OP" });

  if (t.showRightAngles) {
    const size = state.style.rightAngleSize;
    if (t.showOA || true) {
      const uA = norm(sub(cP, cA));
      const vA = norm(sub(cO, cA));
      cmds.push({
        t: "rightAngle",
        x: cA.x,
        y: cA.y,
        ux: uA.x,
        uy: uA.y,
        vx: vA.x,
        vy: vA.y,
        size,
      });
    }
    if (t.showOB || true) {
      const uB = norm(sub(cP, cB));
      const vB = norm(sub(cO, cB));
      cmds.push({
        t: "rightAngle",
        x: cB.x,
        y: cB.y,
        ux: uB.x,
        uy: uB.y,
        vx: vB.x,
        vy: vB.y,
        size,
      });
    }
  }

  if (t.equalRadiusTicks === 1 || t.equalRadiusTicks === 2) {
    if (t.showOA) drawEqualTicks(cmds, cO, cA, t.equalRadiusTicks, 7);
    if (t.showOB) drawEqualTicks(cmds, cO, cB, t.equalRadiusTicks, 7);
  }
  if (t.equalTangentTicks === 1 || t.equalTangentTicks === 2) {
    drawEqualTicks(cmds, cP, cA, t.equalTangentTicks, 7);
    drawEqualTicks(cmds, cP, cB, t.equalTangentTicks, 7);
  }

  if (t.showAngleP) {
    pushAngleMark(
      cmds,
      texts,
      cP,
      cA,
      cB,
      t.angles.P.fill,
      angleText(state, "P"),
      "angP",
      t.angles.P.label,
      state.style.fontSize,
    );
  }
  if (t.showAngleA) {
    pushAngleMark(
      cmds,
      texts,
      cA,
      cP,
      cB,
      t.angles.A.fill,
      angleText(state, "A"),
      "angA",
      t.angles.A.label,
      state.style.fontSize,
    );
  }

  for (const id of Object.keys(t.lengths)) {
    const ends = lengthEndpoints(state, id);
    if (!ends) continue;
    const cMid = mul(add(map(ends[0]), map(ends[1])), 0.5);
    const canvasOutward = sub(cMid, cO);
    pushLength(state, cmds, texts, id, canvasOutward, map);
  }

  if (state.showCenter) {
    pushPoint(cmds, texts, cO, t.points.O, "O", state.style, { x: -1, y: 1 });
  }
  pushPoint(cmds, texts, cP, t.points.P, "P", state.style, sub(d.P, d.O));
  pushPoint(cmds, texts, cA, t.points.A, "A", state.style, sub(d.A, d.O));
  pushPoint(cmds, texts, cB, t.points.B, "B", state.style, sub(d.B, d.O));

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
    pointIds: ["O", "P", "A", "B"],
  };
}

function buildTri(state: CircleTangentsState, d: DerivedTri): DiagramScene {
  const layout = layoutForPoints(state, [d.A, d.B, d.C, d.O], [{ c: d.O, r: d.r }]);
  const map = (p: Vec) => mathToCanvas(p, layout);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const cA = map(d.A);
  const cB = map(d.B);
  const cC = map(d.C);
  const cO = map(d.O);
  const visualR = layout.scale * d.r;

  cmds.push({ t: "line", x1: cA.x, y1: cA.y, x2: cB.x, y2: cB.y, id: "AB" });
  cmds.push({ t: "line", x1: cB.x, y1: cB.y, x2: cC.x, y2: cC.y, id: "BC" });
  cmds.push({ t: "line", x1: cC.x, y1: cC.y, x2: cA.x, y2: cA.y, id: "CA" });
  cmds.push({ t: "circle", x: cO.x, y: cO.y, r: visualR });

  const centroid = mul(add(add(d.A, d.B), d.C), 1 / 3);
  const cCentroid = map(centroid);
  for (const id of ["AB", "BC", "CA", "AP", "BP", "BQ", "CQ", "CR", "AR"]) {
    const ends = lengthEndpoints(state, id);
    if (!ends) continue;
    const cMid = mul(add(map(ends[0]), map(ends[1])), 0.5);
    pushLength(state, cmds, texts, id, sub(cMid, cCentroid), map);
  }

  if (state.showCenter) {
    pushPoint(cmds, texts, cO, state.tri.points.O, "O", state.style, { x: 0, y: 1 });
  }
  pushPoint(cmds, texts, cA, state.tri.points.A, "A", state.style, sub(d.A, centroid));
  pushPoint(cmds, texts, cB, state.tri.points.B, "B", state.style, sub(d.B, centroid));
  pushPoint(cmds, texts, cC, state.tri.points.C, "C", state.style, sub(d.C, centroid));
  if (state.tri.showTouchPoints) {
    pushPoint(cmds, texts, map(d.P), state.tri.points.P, "P", state.style, sub(d.P, d.O));
    pushPoint(cmds, texts, map(d.Q), state.tri.points.Q, "Q", state.style, sub(d.Q, d.O));
    pushPoint(cmds, texts, map(d.R), state.tri.points.R, "R", state.style, sub(d.R, d.O));
  }

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
    pointIds: ["A", "B", "C", "O", "P", "Q", "R"],
  };
}

function buildQuad(state: CircleTangentsState, d: DerivedQuad): DiagramScene {
  const layout = layoutForPoints(state, [d.A, d.B, d.C, d.D, d.O], [
    { c: d.O, r: d.r },
  ]);
  const map = (p: Vec) => mathToCanvas(p, layout);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const cA = map(d.A);
  const cB = map(d.B);
  const cC = map(d.C);
  const cD = map(d.D);
  const cO = map(d.O);
  const visualR = layout.scale * d.r;

  cmds.push({ t: "line", x1: cA.x, y1: cA.y, x2: cB.x, y2: cB.y });
  cmds.push({ t: "line", x1: cB.x, y1: cB.y, x2: cC.x, y2: cC.y });
  cmds.push({ t: "line", x1: cC.x, y1: cC.y, x2: cD.x, y2: cD.y });
  cmds.push({ t: "line", x1: cD.x, y1: cD.y, x2: cA.x, y2: cA.y });
  cmds.push({ t: "circle", x: cO.x, y: cO.y, r: visualR });

  const mid = mul(add(add(d.A, d.B), add(d.C, d.D)), 0.25);
  const cMidCenter = map(mid);
  for (const id of Object.keys(state.quad.segs)) {
    const ends = lengthEndpoints(state, id);
    if (!ends) continue;
    const cm = mul(add(map(ends[0]), map(ends[1])), 0.5);
    pushLength(state, cmds, texts, id, sub(cm, cMidCenter), map);
  }

  if (state.showCenter) {
    pushPoint(cmds, texts, cO, state.quad.points.O, "O", state.style, { x: 0, y: 1 });
  }
  pushPoint(cmds, texts, cA, state.quad.points.A, "A", state.style, sub(d.A, mid));
  pushPoint(cmds, texts, cB, state.quad.points.B, "B", state.style, sub(d.B, mid));
  pushPoint(cmds, texts, cC, state.quad.points.C, "C", state.style, sub(d.C, mid));
  pushPoint(cmds, texts, cD, state.quad.points.D, "D", state.style, sub(d.D, mid));
  if (state.quad.showTouchPoints) {
    pushPoint(cmds, texts, map(d.P), state.quad.points.P, "P", state.style, sub(d.P, d.O));
    pushPoint(cmds, texts, map(d.Q), state.quad.points.Q, "Q", state.style, sub(d.Q, d.O));
    pushPoint(cmds, texts, map(d.R), state.quad.points.R, "R", state.style, sub(d.R, d.O));
    pushPoint(cmds, texts, map(d.S), state.quad.points.S, "S", state.style, sub(d.S, d.O));
  }

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
    pointIds: ["A", "B", "C", "D", "O", "P", "Q", "R", "S"],
  };
}

function buildThree(state: CircleTangentsState, d: DerivedThree): DiagramScene {
  const layout = layoutForPoints(state, [d.A, d.B, d.C, d.O, d.D, d.F], [
    { c: d.O, r: d.r },
  ]);
  const map = (p: Vec) => mathToCanvas(p, layout);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const cA = map(d.A);
  const cB = map(d.B);
  const cC = map(d.C);
  const cO = map(d.O);
  const cD = map(d.D);
  const cF = map(d.F);
  const visualR = layout.scale * d.r;

  cmds.push({ t: "line", x1: cA.x, y1: cA.y, x2: cD.x, y2: cD.y, id: "AD" });
  cmds.push({ t: "line", x1: cA.x, y1: cA.y, x2: cF.x, y2: cF.y, id: "AF" });
  cmds.push({ t: "line", x1: cB.x, y1: cB.y, x2: cC.x, y2: cC.y, id: "BC" });
  cmds.push({ t: "circle", x: cO.x, y: cO.y, r: visualR });

  const mid = mul(add(add(d.A, d.B), d.C), 1 / 3);
  const cMidCenter = map(mid);
  for (const id of Object.keys(state.three.lengths)) {
    const ends = lengthEndpoints(state, id);
    if (!ends) continue;
    const cm = mul(add(map(ends[0]), map(ends[1])), 0.5);
    pushLength(state, cmds, texts, id, sub(cm, cMidCenter), map);
  }

  if (state.showCenter) {
    pushPoint(cmds, texts, cO, state.three.points.O, "O", state.style, { x: 1, y: 0 });
  }
  pushPoint(cmds, texts, cA, state.three.points.A, "A", state.style, sub(d.A, mid));
  pushPoint(cmds, texts, cB, state.three.points.B, "B", state.style, sub(d.B, mid));
  pushPoint(cmds, texts, cC, state.three.points.C, "C", state.style, sub(d.C, mid));
  if (state.three.showTouchPoints) {
    pushPoint(cmds, texts, cD, state.three.points.D, "D", state.style, sub(d.D, d.O));
    pushPoint(cmds, texts, map(d.E), state.three.points.E, "E", state.style, sub(d.E, d.O));
    pushPoint(cmds, texts, cF, state.three.points.F, "F", state.style, sub(d.F, d.O));
  }

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
    pointIds: ["A", "B", "C", "O", "D", "E", "F"],
  };
}

export function buildTangentsScene(state: CircleTangentsState): DiagramScene {
  if (state.kind === "two-tangents") {
    const d = deriveTwo(state);
    if (d) return buildTwo(state, d);
  } else if (state.kind === "incircle-triangle") {
    const d = deriveTri(state);
    if (d) return buildTri(state, d);
  } else if (state.kind === "tangential-quad") {
    const d = deriveQuad(state);
    if (d) return buildQuad(state, d);
  } else {
    const d = deriveThree(state);
    if (d) return buildThree(state, d);
  }
  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds: [],
    texts: [],
    layout: { origin: { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2 }, scale: 20, viewRot: 0 },
    pointIds: [],
  };
}

export type FigureHit =
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string }
  | { kind: "point"; id: string }
  | { kind: "seg"; id: string };

function distToSeg(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < 1e-9) return len(sub(p, a));
  let t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
  t = clamp(t, 0, 1);
  return len(sub(p, add(a, mul(ab, t))));
}

function measureTargetId(id: string): string {
  return id.endsWith(":line") ? id.slice(0, -5) : id;
}

export function hitTestFigure(
  state: CircleTangentsState,
  scene: DiagramScene,
  x: number,
  y: number,
  hitScale = 1,
): FigureHit | null {
  const s = Number.isFinite(hitScale) && hitScale > 0 ? hitScale : 1;
  const p = { x, y };

  const textHit = hitTestText(scene, x, y, 14 * s);
  if (textHit) {
    return { kind: "label", id: textHit.id };
  }

  for (const cmd of scene.cmds) {
    if (cmd.t === "arc" && cmd.id?.endsWith(":line") && cmd.dashed) {
      const d = distToArc(p, cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw);
      if (d < 10 * s) return { kind: "dimLine", id: measureTargetId(cmd.id) };
    }
    if (cmd.t === "line" && cmd.id?.endsWith(":line") && cmd.dashed) {
      const d = distToSeg(p, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 });
      if (d < 10 * s) return { kind: "dimLine", id: measureTargetId(cmd.id) };
    }
  }

  for (const id of scene.pointIds) {
    const math = pointPos(state, id);
    if (!math) continue;
    const c = mathToCanvas(math, scene.layout);
    if (len(sub(p, c)) < 14 * s) return { kind: "point", id };
  }

  for (const cmd of scene.cmds) {
    if (cmd.t === "line" && cmd.id && !cmd.id.endsWith(":line")) {
      const d = distToSeg(p, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 });
      if (d < 10 * s) return { kind: "seg", id: cmd.id };
    }
  }

  return null;
}

export function pointCanvasPos(
  state: CircleTangentsState,
  scene: DiagramScene,
  id: string,
): Vec | null {
  const math = pointPos(state, id);
  if (!math) return null;
  return mathToCanvas(math, scene.layout);
}

export function measureFrame(
  state: CircleTangentsState,
  scene: DiagramScene,
  id: string,
): { along: Vec; outward: Vec; halfSpan: number } | null {
  const cleanId = id.endsWith(":line") ? id.slice(0, -5) : id;
  const layout = scene.layout;
  const map = (q: Vec) => mathToCanvas(q, layout);

  // Angle mark
  if (cleanId === "angP" || cleanId === "P" || cleanId === "angA" || cleanId === "A") {
    return { along: { x: 1, y: 0 }, outward: { x: 0, y: 1 }, halfSpan: 40 };
  }

  // Length mark
  const ends = lengthEndpoints(state, cleanId);
  if (!ends) return null;

  const cA = map(ends[0]);
  const cB = map(ends[1]);
  const cMid = mul(add(cA, cB), 0.5);

  let cCenter: Vec | null = null;
  if (state.kind === "two-tangents") {
    const d = deriveTwo(state);
    if (d) cCenter = map(d.O);
  } else if (state.kind === "incircle-triangle") {
    const d = deriveTri(state);
    if (d) {
      const centroid = mul(add(add(d.A, d.B), d.C), 1 / 3);
      cCenter = map(centroid);
    }
  } else if (state.kind === "tangential-quad") {
    const d = deriveQuad(state);
    if (d) {
      const mid = mul(add(add(d.A, d.B), add(d.C, d.D)), 0.25);
      cCenter = map(mid);
    }
  } else if (state.kind === "three-tangents") {
    const d = deriveThree(state);
    if (d) {
      const mid = mul(add(add(d.A, d.B), d.C), 1 / 3);
      cCenter = map(mid);
    }
  }

  const canvasOutward = cCenter ? sub(cMid, cCenter) : { x: 0, y: -1 };
  const along = norm(sub(cB, cA));
  const u = perpToward(along, canvasOutward);
  const halfSpan = len(sub(cB, cA)) / 2;

  return { along, outward: u, halfSpan };
}
