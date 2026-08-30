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
  len,
  mul,
  norm,
  sub,
} from "@/lib/diagrams/polygon/geometry";
import { resolveAngleText, resolveLengthText, type MeasLabel, type Vec } from "@/lib/diagrams/polygon/model";
import {
  EDGE_FEET,
  VERTEX_IDS,
  type PointId,
  type TriangleCentersState,
} from "./model";
import {
  angleDegAt,
  derive,
  displayName,
  isRightDeg,
  lengthBetween,
  pointPos,
  showCircumFootName,
  showInFootName,
  type Derived,
} from "./geometry";

export type CentersScene = SharedDiagramScene & {
  layout: SceneLayout;
  canvasPts: Record<string, Vec>;
};

export type SceneLayout = {
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

function mathBBox(state: TriangleCentersState, d: Derived): { min: Vec; max: Vec } {
  const pts: Vec[] = [d.A, d.B, d.C];
  if (state.circum.on) {
    pts.push(d.O);
    if (state.circum.showCircle) {
      pts.push(
        { x: d.O.x - d.circumR, y: d.O.y },
        { x: d.O.x + d.circumR, y: d.O.y },
        { x: d.O.x, y: d.O.y - d.circumR },
        { x: d.O.x, y: d.O.y + d.circumR },
      );
    }
  }
  if (state.incenter.on) {
    pts.push(d.I);
    if (state.incenter.showCircle) {
      pts.push(
        { x: d.I.x - d.inR, y: d.I.y },
        { x: d.I.x + d.inR, y: d.I.y },
        { x: d.I.x, y: d.I.y - d.inR },
        { x: d.I.x, y: d.I.y + d.inR },
      );
    }
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
  const pad = 0.16 * Math.max(maxX - minX, maxY - minY, 1);
  return {
    min: { x: minX - pad, y: minY - pad },
    max: { x: maxX + pad, y: maxY + pad },
  };
}

export function getSceneLayout(
  state: TriangleCentersState,
  d: Derived,
): SceneLayout {
  const box = mathBBox(state, d);
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
  return { origin, mid, scale };
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

function mapAll(d: Derived, layout: SceneLayout): Record<string, Vec> {
  const ids: PointId[] = [
    "A",
    "B",
    "C",
    "O",
    "I",
    "c0",
    "c1",
    "c2",
    "i0",
    "i1",
    "i2",
  ];
  const out: Record<string, Vec> = {};
  for (const id of ids) {
    const p = pointPos(d, id);
    if (p) out[id] = mathToCanvas(p, layout);
  }
  return out;
}

function markNeeded(
  state: TriangleCentersState,
  at: PointId,
  from: PointId,
  to: PointId,
): boolean {
  const need = (a: PointId, b: PointId): boolean => {
    if ((VERTEX_IDS as string[]).includes(a) && (VERTEX_IDS as string[]).includes(b)) {
      return true;
    }
    if (a === "O" || b === "O") {
      const v = (a === "O" ? b : a) as PointId;
      const i = VERTEX_IDS.indexOf(v);
      return state.circum.on && i >= 0 && state.circum.rays[i] === true;
    }
    if (a === "I" || b === "I") {
      const v = (a === "I" ? b : a) as PointId;
      const i = VERTEX_IDS.indexOf(v);
      return state.incenter.on && i >= 0 && state.incenter.rays[i] === true;
    }
    return true;
  };
  if (at === "O" && !state.circum.on) return false;
  if (at === "I" && !state.incenter.on) return false;
  return need(at, from) && need(at, to);
}

export function buildCentersScene(state: TriangleCentersState): CentersScene {
  const d = derive(state);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  if (!d) {
    return {
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
      cmds,
      texts,
      layout: { origin: { x: 260, y: 260 }, mid: { x: 0, y: 0 }, scale: 40 },
      canvasPts: {},
    };
  }
  const layout = getSceneLayout(state, d);
  const pts = mapAll(d, layout);
  const { style } = state;
  const canvasC = mathToCanvas(centroid(state.points), layout);

  const A = pts.A!;
  const B = pts.B!;
  const C = pts.C!;

  if (state.circum.on && state.circum.showCircle && pts.O) {
    cmds.push({
      t: "circle",
      x: pts.O.x,
      y: pts.O.y,
      r: d.circumR * layout.scale,
      stroke: INK,
    });
  }
  if (state.incenter.on && state.incenter.showCircle && pts.I) {
    cmds.push({
      t: "circle",
      x: pts.I.x,
      y: pts.I.y,
      r: d.inR * layout.scale,
      stroke: INK,
    });
  }

  for (const mark of state.angles) {
    if (!mark.fill) continue;
    if (!markNeeded(state, mark.at, mark.from, mark.to)) continue;
    const at = pts[mark.at];
    const from = pts[mark.from];
    const to = pts[mark.to];
    if (!at || !from || !to) continue;
    const deg = angleDegAt(d, mark.at, mark.from, mark.to);
    if (mark.label.mode !== "x" && isRightDeg(deg)) continue;
    drawAngle(cmds, texts, at, from, to, null, mark.id, mark.label, style.fontSize, ANGLE_FILL);
  }

  cmds.push({
    t: "polyline",
    pts: [A, B, C, A],
    stroke: INK,
  });

  if (state.circum.on) {
    for (let i = 0; i < 3; i += 1) {
      if (!state.circum.rays[i] || !pts.O) continue;
      const v = pts[VERTEX_IDS[i]!];
      if (!v) continue;
      cmds.push({ t: "line", x1: pts.O.x, y1: pts.O.y, x2: v.x, y2: v.y, stroke: INK });
    }
    for (let i = 0; i < 3; i += 1) {
      if (!state.circum.perps[i] || !d.cOnSeg[i] || !pts.O) continue;
      const foot = pts[EDGE_FEET[i]!.circum];
      if (!foot) continue;
      cmds.push({ t: "line", x1: pts.O.x, y1: pts.O.y, x2: foot.x, y2: foot.y, stroke: INK });
    }
  }
  if (state.incenter.on) {
    for (let i = 0; i < 3; i += 1) {
      if (!state.incenter.rays[i] || !pts.I) continue;
      const v = pts[VERTEX_IDS[i]!];
      if (!v) continue;
      cmds.push({ t: "line", x1: pts.I.x, y1: pts.I.y, x2: v.x, y2: v.y, stroke: INK });
    }
    for (let i = 0; i < 3; i += 1) {
      if (!state.incenter.perps[i] || !d.iOnSeg[i] || !pts.I) continue;
      const foot = pts[EDGE_FEET[i]!.in];
      if (!foot) continue;
      cmds.push({ t: "line", x1: pts.I.x, y1: pts.I.y, x2: foot.x, y2: foot.y, stroke: INK });
    }
  }

  for (let i = 0; i < 3; i += 1) {
    if (!state.vertexRights[i]) continue;
    const p = pts[VERTEX_IDS[i]!];
    const prev = pts[VERTEX_IDS[(i + 2) % 3]!];
    const next = pts[VERTEX_IDS[(i + 1) % 3]!];
    if (!p || !prev || !next) continue;
    if (!isRightDeg(angleDegAt(d, VERTEX_IDS[i]!, VERTEX_IDS[(i + 1) % 3]!, VERTEX_IDS[(i + 2) % 3]!))) {
      continue;
    }
    drawRightAngle(cmds, p, prev, next);
  }

  if (state.circum.on) {
    for (let i = 0; i < 3; i += 1) {
      if (!state.circum.perps[i] || !d.cOnSeg[i] || !pts.O) continue;
      const foot = pts[EDGE_FEET[i]!.circum];
      const u = pts[VERTEX_IDS[i]!];
      if (!foot || !u) continue;
      drawRightAngle(cmds, foot, pts.O, u);
    }
  }
  if (state.incenter.on) {
    for (let i = 0; i < 3; i += 1) {
      if (!state.incenter.perps[i] || !d.iOnSeg[i] || !pts.I) continue;
      const foot = pts[EDGE_FEET[i]!.in];
      const u = pts[VERTEX_IDS[i]!];
      if (!foot || !u) continue;
      drawRightAngle(cmds, foot, pts.I, u);
    }
  }

  for (const mark of state.angles) {
    if (!markNeeded(state, mark.at, mark.from, mark.to)) continue;
    const at = pts[mark.at];
    const from = pts[mark.from];
    const to = pts[mark.to];
    if (!at || !from || !to) continue;
    const deg = angleDegAt(d, mark.at, mark.from, mark.to);
    const vi = VERTEX_IDS.indexOf(mark.at);
    if (vi >= 0 && state.vertexRights[vi] && isRightDeg(deg) && mark.label.mode !== "x") {
      continue;
    }
    if (mark.label.mode !== "x" && isRightDeg(deg)) {
      drawRightAngle(cmds, at, from, to);
      continue;
    }
    if (mark.fill) {
      const label = resolveAngleText(mark.label, deg, state.unknownLetter);
      if (!label) continue;
      const u = norm(sub(from, at));
      const w = norm(sub(to, at));
      const a0 = Math.atan2(u.y, u.x);
      const a1 = Math.atan2(w.y, w.x);
      const arc = smallerArc(a0, a1);
      const r = angleRadius(from, at, to);
      const sweep = arcSweep(arc.a0, arc.a1, arc.ccw);
      const midAng = arc.a0 + (arc.ccw ? -sweep : sweep) / 2;
      const labelR = r + style.fontSize * 0.72;
      pushText(texts, cmds, {
        id: mark.id,
        x: at.x + Math.cos(midAng) * labelR + mark.label.dx,
        y: at.y + Math.sin(midAng) * labelR + mark.label.dy,
        runs: parseMathRuns(label),
        size: style.fontSize,
        anchor: "middle",
      });
      continue;
    }
    const label = resolveAngleText(mark.label, deg, state.unknownLetter);
    drawAngle(
      cmds,
      texts,
      at,
      from,
      to,
      label,
      mark.id,
      mark.label,
      style.fontSize,
      null,
    );
  }

  for (const mark of state.lengths) {
    const a = pts[mark.a];
    const b = pts[mark.b];
    if (!a || !b) continue;
    const mid = mul(add(a, b), 0.5);
    let outward = sub(mid, canvasC);
    if (len(outward) < 4) outward = { x: -(b.y - a.y), y: b.x - a.x };
    const label = resolveLengthText(
      mark.label,
      lengthBetween(d, mark.a, mark.b),
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
      mark.id,
      mark.label,
      style.fontSize,
    );
  }

  const dots: { id: PointId; p: Vec }[] = [
    { id: "A", p: A },
    { id: "B", p: B },
    { id: "C", p: C },
  ];
  if (state.circum.on && pts.O) dots.push({ id: "O", p: pts.O });
  if (state.incenter.on && pts.I) dots.push({ id: "I", p: pts.I });
  for (let i = 0; i < 3; i += 1) {
    if (state.circum.on && state.circum.perps[i] && d.cOnSeg[i]) {
      const p = pts[EDGE_FEET[i]!.circum];
      if (p) dots.push({ id: EDGE_FEET[i]!.circum, p });
    }
    if (state.incenter.on && state.incenter.perps[i] && d.iOnSeg[i]) {
      const p = pts[EDGE_FEET[i]!.in];
      if (p) dots.push({ id: EDGE_FEET[i]!.in, p });
    }
  }

  for (const { id, p } of dots) {
    const isVertex = id === "A" || id === "B" || id === "C";
    const isCenter = id === "O" || id === "I";
    if (state.showDots || isCenter) {
      cmds.push({ t: "dot", x: p.x, y: p.y, r: style.pointRadius });
    }
    if (isVertex && !state.showVertexNames) continue;
    const name = displayName(state, id);
    if (!name.trim()) continue;
    if (id === "c0" || id === "c1" || id === "c2") {
      const edge = Number(id.slice(1));
      if (!showCircumFootName(state, edge)) continue;
    }
    if (id === "i0" || id === "i1" || id === "i2") {
      const edge = Number(id.slice(1));
      if (!showInFootName(state, edge)) continue;
    }
    let dx = 0;
    let dy = 0;
    if (id === "A" || id === "B" || id === "C") {
      const i = VERTEX_IDS.indexOf(id);
      dx = state.vertexNameDx[i] ?? 0;
      dy = state.vertexNameDy[i] ?? 0;
    } else if (id === "O") {
      dx = state.circum.nameDx;
      dy = state.circum.nameDy;
    } else if (id === "I") {
      dx = state.incenter.nameDx;
      dy = state.incenter.nameDy;
    }
    const away = norm(sub(p, canvasC));
    const lp = add(add(p, mul(away, 16)), { x: dx, y: dy });
    pushText(texts, cmds, {
      id: `name:${id}`,
      x: lp.x,
      y: lp.y,
      runs: parseNameRuns(name.trim()),
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
    canvasPts: pts,
  };
}
