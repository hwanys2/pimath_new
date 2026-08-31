import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import type {
  DiagramScene as SharedDiagramScene,
  SceneCmd,
  SceneText,
} from "@/lib/diagrams/scene";
import { add, clamp, len, mul, norm, sub } from "@/lib/diagrams/polygon/geometry";
import type { MeasLabel, Vec } from "@/lib/diagrams/polygon/model";
import {
  resolveAngleText,
  resolveLengthText,
  type AngleDraft,
  type AngleFill,
  type ArcDraft,
  type InscribedState,
} from "@/lib/diagrams/inscribed-angles/model";
import {
  CENTER_ID,
  EXT_ID,
  T_PLUS,
  angleDegAt,
  armPos,
  ccwSpanDeg,
  extensionPoint,
  isRightDeg,
  namedPos,
  pointPos,
  polar,
  tangentDirs,
  tangentPoint,
} from "@/lib/diagrams/inscribed-angles/geometry";

export type { SceneCmd, SceneText } from "@/lib/diagrams/scene";
export { hitTestText, sceneTextPlain } from "@/lib/diagrams/scene";

export type DiagramScene = SharedDiagramScene & {
  layout: SceneLayout;
};

export const SCENE_WIDTH = 480;
export const SCENE_HEIGHT = 520;

export type SceneLayout = {
  origin: Vec;
  visualR: number;
  scale: number;
  viewRot: number;
};

const INK = "#111111";
const FILL_PINK = "#f7c8d2";
const FILL_BLUE = "#c5dff0";
const HIGHLIGHT = "#e879a8";

function fillColor(fill: AngleFill): string | null {
  if (fill === "pink") return FILL_PINK;
  if (fill === "blue") return FILL_BLUE;
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

function canvasCcwSpan(from: number, to: number): number {
  let d = normalizeAngle(from) - normalizeAngle(to);
  if (d < 0) d += Math.PI * 2;
  return d;
}

function smallerArc(a0: number, a1: number): { a0: number; a1: number; ccw: boolean } {
  let d = a1 - a0;
  while (d <= -Math.PI) d += Math.PI * 2;
  while (d > Math.PI) d -= Math.PI * 2;
  if (d >= 0) return { a0, a1, ccw: false };
  return { a0: a1, a1: a0, ccw: true };
}

function largerArc(a0: number, a1: number): { a0: number; a1: number; ccw: boolean } {
  const small = smallerArc(a0, a1);
  return { a0: small.a0, a1: small.a1, ccw: !small.ccw };
}

function arcSweep(a0: number, a1: number, ccw: boolean): number {
  if (ccw) return canvasCcwSpan(a0, a1);
  return ccwSpan(a0, a1);
}

function arcPoints(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  ccw: boolean,
  n = 16,
): Vec[] {
  const sweep = arcSweep(a0, a1, ccw);
  const pts: Vec[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const ang = ccw ? a0 - sweep * t : a0 + sweep * t;
    pts.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  return pts;
}

function canvasArcFromMath(
  cO: Vec,
  cA: Vec,
  cB: Vec,
  ccwMath: boolean,
): { a0: number; a1: number; ccw: boolean } {
  const a0 = Math.atan2(cA.y - cO.y, cA.x - cO.x);
  const a1 = Math.atan2(cB.y - cO.y, cB.x - cO.x);
  return { a0, a1, ccw: ccwMath };
}

function collectMathPoints(state: InscribedState): Vec[] {
  const r = state.radius;
  const pts: Vec[] = [{ x: 0, y: 0 }, { x: r, y: 0 }, { x: -r, y: 0 }, { x: 0, y: r }, { x: 0, y: -r }];
  for (const p of state.points) pts.push(polar(r, p.angleDeg));
  const t = tangentPoint(state);
  if (t) {
    pts.push(t);
    const at = pointPos(state, state.tangent!.at);
    if (at) {
      const { minus } = tangentDirs(at);
      pts.push(add(at, mul(minus, r * state.tangent!.span)));
    }
  }
  const e = extensionPoint(state);
  if (e) pts.push(e);
  for (const a of state.arcs) {
    if (!a.show && !a.highlight) continue;
    const extra = a.show ? 0.28 : 0.08;
    const from = findPointAngle(state, a.a);
    const to = findPointAngle(state, a.b);
    if (from == null || to == null) continue;
    const span = a.ccw ? ccwSpanDeg(from, to) : ccwSpanDeg(to, from);
    const steps = Math.max(4, Math.ceil(span / 18));
    for (let i = 0; i <= steps; i += 1) {
      const deg = a.ccw ? from + (span * i) / steps : from - (span * i) / steps;
      pts.push(polar(r * (1 + extra), deg));
    }
  }
  return pts;
}

function findPointAngle(state: InscribedState, id: string): number | null {
  if (id === CENTER_ID) return null;
  const p = state.points.find((x) => x.id === id);
  return p ? p.angleDeg : null;
}

export function getSceneLayout(state: InscribedState): SceneLayout {
  const pad = state.style.padding;
  const viewRot = state.viewRotationDeg;
  const pts = collectMathPoints(state).map((p) => rot(p, viewRot));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = Math.max(maxX - minX, state.radius * 0.4);
  const spanY = Math.max(maxY - minY, state.radius * 0.4);
  const availW = SCENE_WIDTH - pad * 2;
  const availH = SCENE_HEIGHT - pad * 2;
  const scale = Math.min(availW / spanX, availH / spanY);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  return {
    origin: {
      x: SCENE_WIDTH / 2 - midX * scale,
      y: SCENE_HEIGHT / 2 + midY * scale,
    },
    visualR: state.radius * scale,
    scale,
    viewRot,
  };
}

function tangentCcw(a: number): Vec {
  return { x: Math.sin(a), y: -Math.cos(a) };
}

function dimArcLength(
  cmds: SceneCmd[],
  texts: SceneText[],
  cO: Vec,
  visualR: number,
  a0: number,
  a1: number,
  ccw: boolean,
  offset: number,
  label: string | null,
  labelId: string,
  meas: MeasLabel,
  fontSize: number,
): void {
  if (!label) return;
  const lineId = `${labelId}:line`;
  const lineH = signedHeight(offset + (meas.lineDy ?? 0), 12, 80);
  const textH = signedHeight(offset + meas.dy, 12, 80);
  const lineR = visualR + lineH;
  const textR = visualR + textH + fontSize * 0.55;
  const tick = clamp(Math.abs(lineH) * 0.28, 6, 12);

  const p0 = { x: cO.x + visualR * Math.cos(a0), y: cO.y + visualR * Math.sin(a0) };
  const p1 = { x: cO.x + visualR * Math.cos(a1), y: cO.y + visualR * Math.sin(a1) };
  const f0 = { x: cO.x + lineR * Math.cos(a0), y: cO.y + lineR * Math.sin(a0) };
  const f1 = { x: cO.x + lineR * Math.cos(a1), y: cO.y + lineR * Math.sin(a1) };

  cmds.push({ t: "line", x1: p0.x, y1: p0.y, x2: f0.x, y2: f0.y, id: lineId });
  cmds.push({ t: "line", x1: p1.x, y1: p1.y, x2: f1.x, y2: f1.y, id: lineId });
  cmds.push({ t: "arc", cx: cO.x, cy: cO.y, r: lineR, a0, a1, ccw, id: lineId });

  const t0 = tangentCcw(a0);
  const t1 = tangentCcw(a1);
  cmds.push({
    t: "arrowhead",
    x: f0.x,
    y: f0.y,
    ux: ccw ? t0.x : -t0.x,
    uy: ccw ? t0.y : -t0.y,
    size: tick,
  });
  cmds.push({
    t: "arrowhead",
    x: f1.x,
    y: f1.y,
    ux: ccw ? -t1.x : t1.x,
    uy: ccw ? -t1.y : t1.y,
    size: tick,
  });

  const sweep = ccw ? canvasCcwSpan(a0, a1) : ccwSpan(a0, a1);
  const midA = ccw ? a0 - sweep / 2 : a0 + sweep / 2;
  const shifted = midA + meas.dx / Math.max(visualR, 1);
  pushText(texts, cmds, {
    id: labelId,
    x: cO.x + textR * Math.cos(shifted),
    y: cO.y + textR * Math.sin(shifted),
    runs: parseMathRuns(label),
    size: fontSize,
    anchor: "middle",
  });
}

function drawRightAngle(cmds: SceneCmd[], vertex: Vec, from: Vec, to: Vec, fill: string | null): void {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  if (len(u) < 0.5 || len(w) < 0.5) return;
  const size = clamp(Math.min(len(sub(from, vertex)), len(sub(to, vertex))) * 0.16, 10, 18);
  if (fill) {
    const p1 = add(vertex, mul(u, size));
    const p2 = add(p1, mul(w, size));
    const p3 = add(vertex, mul(w, size));
    cmds.push({ t: "polygon", points: [vertex, p1, p2, p3], fill });
  }
  cmds.push({
    t: "rightAngle",
    x: vertex.x,
    y: vertex.y,
    ux: u.x,
    uy: u.y,
    vx: w.x,
    vy: w.y,
    size,
  });
}

function drawAngleMark(
  cmds: SceneCmd[],
  texts: SceneText[],
  vertex: Vec,
  from: Vec,
  to: Vec,
  angle: AngleDraft,
  deg: number,
  label: string | null,
  fontSize: number,
): void {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  const a0 = Math.atan2(u.y, u.x);
  const a1 = Math.atan2(w.y, w.x);
  const fill = fillColor(angle.fill);
  const useRight = angle.right && (isRightDeg(deg) || angle.label.mode === "hide");
  if (useRight) {
    drawRightAngle(cmds, vertex, from, to, fill);
    if (label) {
      const mid = norm(add(u, w));
      pushText(texts, cmds, {
        id: angle.id,
        x: vertex.x + mid.x * 28 + angle.label.dx,
        y: vertex.y + mid.y * 28 + angle.label.dy,
        runs: parseMathRuns(label),
        size: fontSize,
        anchor: "middle",
      });
    }
    return;
  }
  const arc = angle.reflex ? largerArc(a0, a1) : smallerArc(a0, a1);
  const r = clamp(Math.min(len(sub(from, vertex)), len(sub(to, vertex))) * 0.18, 14, 28);
  if (fill) {
    cmds.push({
      t: "polygon",
      points: [vertex, ...arcPoints(vertex.x, vertex.y, r, arc.a0, arc.a1, arc.ccw, 22)],
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
    id: `${angle.id}:line`,
  });
  if (!label) return;
  const sweep = arcSweep(arc.a0, arc.a1, arc.ccw);
  const midAng = arc.ccw ? arc.a0 - sweep / 2 : arc.a0 + sweep / 2;
  const labelR = r + fontSize * 0.72;
  pushText(texts, cmds, {
    id: angle.id,
    x: vertex.x + Math.cos(midAng) * labelR + angle.label.dx,
    y: vertex.y + Math.sin(midAng) * labelR + angle.label.dy,
    runs: parseMathRuns(label),
    size: fontSize,
    anchor: "middle",
  });
}

function outwardFromCenter(cO: Vec, p: Vec): Vec {
  return norm(sub(p, cO));
}

export function buildInscribedScene(state: InscribedState): DiagramScene {
  const { style } = state;
  const layout = getSceneLayout(state);
  const map = (p: Vec) => mathToCanvas(p, layout);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const cO = layout.origin;

  for (const mark of state.arcs) {
    if (!mark.highlight) continue;
    const A = pointPos(state, mark.a);
    const B = pointPos(state, mark.b);
    if (!A || !B) continue;
    const { a0, a1, ccw } = canvasArcFromMath(cO, map(A), map(B), mark.ccw);
    cmds.push({
      t: "arc",
      cx: cO.x,
      cy: cO.y,
      r: layout.visualR,
      a0,
      a1,
      ccw,
      stroke: HIGHLIGHT,
      width: Math.max(style.lineWidth * 1.8, 2.4),
    });
  }

  if (state.showCircle) {
    cmds.push({ t: "circle", x: cO.x, y: cO.y, r: layout.visualR });
  }

  if (state.tangent?.show) {
    const at = pointPos(state, state.tangent.at);
    if (at) {
      const { plus, minus } = tangentDirs(at);
      const span = state.radius * state.tangent.span;
      const p0 = map(add(at, mul(minus, span)));
      const p1 = map(add(at, mul(plus, span)));
      cmds.push({ t: "line", x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, id: "tangent" });
    }
  }

  if (state.extension?.show) {
    const a = pointPos(state, state.extension.from);
    const b = pointPos(state, state.extension.through);
    const e = extensionPoint(state);
    if (a && b && e) {
      const cA = map(a);
      const cE = map(e);
      cmds.push({ t: "line", x1: cA.x, y1: cA.y, x2: cE.x, y2: cE.y, id: "extension" });
    }
  }

  for (const e of state.edges) {
    if (!e.show) continue;
    const a = namedPos(state, e.a);
    const b = namedPos(state, e.b);
    if (!a || !b) continue;
    const cA = map(a);
    const cB = map(b);
    cmds.push({ t: "line", x1: cA.x, y1: cA.y, x2: cB.x, y2: cB.y, id: e.id });
  }

  for (const angle of state.angles) {
    if (!angle.show) continue;
    const v = namedPos(state, angle.vertex);
    const from = armPos(state, angle.vertex, angle.from);
    const to = armPos(state, angle.vertex, angle.to);
    if (!v || !from || !to) continue;
    const deg = angleDegAt(v, from, to, angle.reflex);
    const label = resolveAngleText(angle.label, deg, state.unknownLetter);
    drawAngleMark(cmds, texts, map(v), map(from), map(to), angle, deg, label, style.fontSize);
  }

  for (const mark of state.arcs) {
    if (!mark.show) continue;
    const A = pointPos(state, mark.a);
    const B = pointPos(state, mark.b);
    if (!A || !B) continue;
    const { a0, a1, ccw } = canvasArcFromMath(cO, map(A), map(B), mark.ccw);
    const fromDeg = findPointAngle(state, mark.a) ?? 0;
    const toDeg = findPointAngle(state, mark.b) ?? 0;
    const span = mark.ccw ? ccwSpanDeg(fromDeg, toDeg) : ccwSpanDeg(toDeg, fromDeg);
    const autoLen = (span / 360) * 2 * Math.PI * state.radius;
    const text = resolveLengthText(mark.label, autoLen, state.unit, state.unknownLetter);
    dimArcLength(
      cmds,
      texts,
      cO,
      layout.visualR,
      a0,
      a1,
      ccw,
      style.dimOffset,
      text,
      mark.id,
      mark.label,
      style.fontSize,
    );
  }

  if (state.showDots) {
    for (const p of state.points) {
      const c = map(polar(state.radius, p.angleDeg));
      cmds.push({ t: "dot", x: c.x, y: c.y, r: style.pointRadius });
    }
  }

  for (const p of state.points) {
    if (!p.showName || !p.name.trim()) continue;
    const c = map(polar(state.radius, p.angleDeg));
    const radial = outwardFromCenter(cO, c);
    const pos = add(add(c, mul(radial, 16)), { x: p.dx, y: p.dy });
    pushText(texts, cmds, {
      id: `pt:${p.id}:name`,
      x: pos.x,
      y: pos.y,
      runs: parseNameRuns(p.name.trim()),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }

  if (state.tangent?.show && state.tangent.tName.trim()) {
    const t = tangentPoint(state);
    if (t) {
      const c = map(t);
      cmds.push({ t: "dot", x: c.x, y: c.y, r: style.pointRadius });
      pushText(texts, cmds, {
        id: "tangent-name",
        x: c.x + 14 + state.tangent.tDx,
        y: c.y + 4 + state.tangent.tDy,
        runs: parseNameRuns(state.tangent.tName.trim()),
        size: style.pointLabelSize,
        anchor: "middle",
      });
    }
  }

  if (state.extension?.show && state.extension.extraName.trim()) {
    const e = extensionPoint(state);
    if (e) {
      const c = map(e);
      cmds.push({ t: "dot", x: c.x, y: c.y, r: style.pointRadius });
      pushText(texts, cmds, {
        id: "ext-name",
        x: c.x + 14 + state.extension.extraDx,
        y: c.y + 4 + state.extension.extraDy,
        runs: parseNameRuns(state.extension.extraName.trim()),
        size: style.pointLabelSize,
        anchor: "middle",
      });
    }
  }

  if (state.showCenter) {
    cmds.push({ t: "dot", x: cO.x, y: cO.y, r: style.pointRadius });
    if (state.centerName.trim()) {
      pushText(texts, cmds, {
        id: "center-name",
        x: cO.x + 14 + state.centerDx,
        y: cO.y + 10 + state.centerDy,
        runs: parseNameRuns(state.centerName.trim()),
        size: style.pointLabelSize,
        anchor: "middle",
      });
    }
  }

  return { width: SCENE_WIDTH, height: SCENE_HEIGHT, cmds, texts, layout };
}

export type FigureHit =
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string }
  | { kind: "point"; id: string }
  | { kind: "center" }
  | { kind: "edge"; id: string }
  | { kind: "angle"; id: string }
  | { kind: "arc"; id: string }
  | { kind: "tangent" }
  | { kind: "extension" }
  | { kind: "circle" };

function measureTargetId(id: string): string {
  return id.endsWith(":line") ? id.slice(0, -5) : id;
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
  const on = ccw
    ? canvasCcwSpan(a0, ang) <= canvasCcwSpan(a0, a1) + 1e-6
    : ccwSpan(a0, ang) <= ccwSpan(a0, a1) + 1e-6;
  if (on) return Math.abs(Math.hypot(p.x - cx, p.y - cy) - r);
  const p0 = { x: cx + r * Math.cos(a0), y: cy + r * Math.sin(a0) };
  const p1 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
  return Math.min(Math.hypot(p.x - p0.x, p.y - p0.y), Math.hypot(p.x - p1.x, p.y - p1.y));
}

function distToSeg(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

type HitCandidate = { hit: FigureHit; d: number; weight: number };

function hitBias(kind: FigureHit["kind"]): number {
  switch (kind) {
    case "point":
    case "center":
      return 0;
    case "label":
      return 8;
    case "angle":
      return 12;
    case "dimLine":
    case "arc":
      return 16;
    case "edge":
    case "tangent":
    case "extension":
      return 20;
    case "circle":
      return 28;
  }
}

function considerHit(
  best: HitCandidate | null,
  hit: FigureHit,
  d: number,
  max: number,
): HitCandidate | null {
  if (d > max) return best;
  const weight = d + hitBias(hit.kind);
  if (best && weight >= best.weight) return best;
  return { hit, d, weight };
}

export function hitTestFigure(
  state: InscribedState,
  scene: DiagramScene,
  x: number,
  y: number,
  hitScale = 1,
): FigureHit | null {
  const s = Number.isFinite(hitScale) && hitScale > 0 ? hitScale : 1;
  const p = { x, y };
  const layout = scene.layout;
  const map = (q: Vec) => mathToCanvas(q, layout);
  let best: HitCandidate | null = null;

  for (const text of scene.texts) {
    best = considerHit(best, { kind: "label", id: text.id }, Math.hypot(text.x - x, text.y - y), 18 * s);
  }

  for (const cmd of scene.cmds) {
    if (cmd.t === "arc" && cmd.id) {
      const id = measureTargetId(cmd.id);
      const isAngle = state.angles.some((a) => a.id === id);
      best = considerHit(
        best,
        isAngle ? { kind: "angle", id } : { kind: "dimLine", id },
        distToArc(p, cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw),
        12 * s,
      );
    }
    if (cmd.t === "line" && cmd.id) {
      const d = distToSeg(p, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 });
      if (cmd.id === "tangent") {
        best = considerHit(best, { kind: "tangent" }, d, 12 * s);
      } else if (cmd.id === "extension") {
        best = considerHit(best, { kind: "extension" }, d, 12 * s);
      } else if (cmd.id.endsWith(":line")) {
        best = considerHit(best, { kind: "dimLine", id: measureTargetId(cmd.id) }, d, 12 * s);
      } else {
        best = considerHit(best, { kind: "edge", id: cmd.id }, d, 10 * s);
      }
    }
  }

  for (const pt of state.points) {
    const c = map(polar(state.radius, pt.angleDeg));
    best = considerHit(best, { kind: "point", id: pt.id }, Math.hypot(p.x - c.x, p.y - c.y), 26 * s);
  }

  best = considerHit(best, { kind: "center" }, Math.hypot(p.x - layout.origin.x, p.y - layout.origin.y), 20 * s);
  best = considerHit(
    best,
    { kind: "circle" },
    Math.abs(Math.hypot(p.x - layout.origin.x, p.y - layout.origin.y) - layout.visualR),
    14 * s,
  );

  return best?.hit ?? null;
}

export function measureFrame(
  state: InscribedState,
  scene: DiagramScene,
  id: string,
): { along: Vec; outward: Vec; halfSpan: number } | null {
  const layout = scene.layout;
  const map = (q: Vec) => mathToCanvas(q, layout);
  const arcMark = state.arcs.find((a) => a.id === id);
  if (arcMark) {
    const A = pointPos(state, arcMark.a);
    const B = pointPos(state, arcMark.b);
    if (!A || !B) return null;
    const midDeg = findPointAngle(state, arcMark.a)! +
      ((arcMark.ccw
        ? ccwSpanDeg(findPointAngle(state, arcMark.a)!, findPointAngle(state, arcMark.b)!)
        : -ccwSpanDeg(findPointAngle(state, arcMark.b)!, findPointAngle(state, arcMark.a)!)) /
        2);
    const mid = map(polar(state.radius, midDeg));
    const radial = norm(sub(mid, layout.origin));
    return { along: { x: -radial.y, y: radial.x }, outward: radial, halfSpan: layout.visualR * 0.6 };
  }
  const angle = state.angles.find((a) => a.id === id);
  if (angle) {
    const v = namedPos(state, angle.vertex);
    const from = armPos(state, angle.vertex, angle.from);
    const to = armPos(state, angle.vertex, angle.to);
    if (!v || !from || !to) return null;
    const cv = map(v);
    const u = norm(sub(map(from), cv));
    const w = norm(sub(map(to), cv));
    const mid = norm(add(u, w));
    return { along: { x: -mid.y, y: mid.x }, outward: mid, halfSpan: 28 };
  }
  return null;
}

export function pointCanvasPos(state: InscribedState, scene: DiagramScene, id: string): Vec | null {
  if (id === CENTER_ID) return scene.layout.origin;
  if (id === "T" || id === T_PLUS) {
    const t = tangentPoint(state);
    return t ? mathToCanvas(t, scene.layout) : null;
  }
  if (id === EXT_ID) {
    const e = extensionPoint(state);
    return e ? mathToCanvas(e, scene.layout) : null;
  }
  const p = pointPos(state, id);
  return p ? mathToCanvas(p, scene.layout) : null;
}
