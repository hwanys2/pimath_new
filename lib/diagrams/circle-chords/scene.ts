import { parseMeasureId } from "@/lib/diagrams/circle-chords/geometry";
import {
  chordAngleDeg,
  resolveLabelText,
  type CircleChordsState,
  type ChordDraft,
  type MeasLabel,
} from "@/lib/diagrams/circle-chords/model";
import { parseMathRuns, type TextRun } from "@/lib/diagrams/math-label";

export type Vec = { x: number; y: number };

export type TextAnchor = "start" | "middle" | "end";

export type SceneText = {
  id: string;
  x: number;
  y: number;
  runs: TextRun[];
  size: number;
  anchor: TextAnchor;
};

export type SceneCmd =
  | { t: "circle"; x: number; y: number; r: number }
  | {
      t: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      dashed?: boolean;
      id?: string;
    }
  | {
      t: "quad";
      x1: number;
      y1: number;
      cx: number;
      cy: number;
      x2: number;
      y2: number;
      dashed?: boolean;
      id?: string;
    }
  | {
      t: "arc";
      cx: number;
      cy: number;
      r: number;
      a0: number;
      a1: number;
      ccw: boolean;
      dashed?: boolean;
      id?: string;
    }
  | { t: "dot"; x: number; y: number; r: number }
  | {
      t: "rightAngle";
      x: number;
      y: number;
      ux: number;
      uy: number;
      vx: number;
      vy: number;
      size: number;
    }
  | { t: "text"; text: SceneText };

export type DiagramScene = {
  width: number;
  height: number;
  cmds: SceneCmd[];
  texts: SceneText[];
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

function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}
function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}
function mul(a: Vec, s: number): Vec {
  return { x: a.x * s, y: a.y * s };
}
function len(a: Vec): number {
  return Math.hypot(a.x, a.y);
}
function norm(a: Vec): Vec {
  const l = len(a);
  if (l < 1e-9) return { x: 1, y: 0 };
  return { x: a.x / l, y: a.y / l };
}
function rot(a: Vec, deg: number): Vec {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

export function getSceneLayout(state: CircleChordsState): SceneLayout {
  const captionBand = state.showCaption && state.caption.trim() ? 44 : 12;
  const origin: Vec = {
    x: SCENE_WIDTH / 2,
    y: (SCENE_HEIGHT - captionBand) / 2 + 6,
  };
  const visualR =
    Math.min(SCENE_WIDTH, SCENE_HEIGHT - captionBand) / 2 - state.style.padding;
  return {
    origin,
    visualR,
    scale: visualR / state.radius,
    viewRot: state.viewRotationDeg,
  };
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

export function mathToCanvas(p: Vec, layout: SceneLayout): Vec {
  return toCanvas(p, layout.origin, layout.scale, layout.viewRot);
}

function toCanvas(
  p: Vec,
  origin: Vec,
  scale: number,
  viewRot: number,
): Vec {
  const q = rot(p, viewRot);
  return { x: origin.x + q.x * scale, y: origin.y - q.y * scale };
}

function labelOf(
  label: MeasLabel,
  autoValue: number,
  unit: string,
  unknown: string,
): string | null {
  return resolveLabelText(label, autoValue, unit, unknown);
}

function pushText(
  texts: SceneText[],
  cmds: SceneCmd[],
  text: SceneText,
): void {
  texts.push(text);
  cmds.push({ t: "text", text });
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
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

function angleOnArc(ang: number, a0: number, a1: number, ccw: boolean): boolean {
  if (ccw) return ccwSpan(a0, ang) <= ccwSpan(a0, a1) + 1e-6;
  return ccwSpan(a1, ang) <= ccwSpan(a1, a0) + 1e-6;
}

/** Circular arc through A,B with signed sagitta along unit perpendicular u. */
function sagittaArc(
  a: Vec,
  b: Vec,
  u: Vec,
  sagitta: number,
): { C: Vec; r: number; a0: number; a1: number; ccw: boolean } | null {
  const span = len(sub(b, a));
  const s = sagitta;
  if (span < 2 || Math.abs(s) < 0.75) return null;
  const mid = mul(add(a, b), 0.5);
  const half = span / 2;
  const r = (half * half + s * s) / (2 * Math.abs(s));
  const C = add(mid, mul(u, s - Math.sign(s) * r));
  const a0 = Math.atan2(a.y - C.y, a.x - C.x);
  const a1 = Math.atan2(b.y - C.y, b.x - C.x);
  const peak = add(mid, mul(u, s));
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
  const u = norm(outward);
  const along = norm(sub(b, a));
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

export function buildCircleChordsScene(state: CircleChordsState): DiagramScene {
  const { style } = state;
  const width = SCENE_WIDTH;
  const height = SCENE_HEIGHT;
  const layout = getSceneLayout(state);
  const map = (p: Vec) => mathToCanvas(p, layout);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];

  cmds.push({ t: "circle", x: layout.origin.x, y: layout.origin.y, r: layout.visualR });

  if (state.showCenter) {
    cmds.push({
      t: "dot",
      x: layout.origin.x,
      y: layout.origin.y,
      r: style.pointRadius,
    });
  }

  for (const chord of state.chords) {
    drawChord({
      chord,
      state,
      map,
      cmds,
      texts,
    });
  }

  if (state.showCenter && state.centerName.trim()) {
    const away = averageOutward(state.chords);
    const oPos = add(
      add(layout.origin, mul(away, 18)),
      { x: state.centerDx ?? 0, y: state.centerDy ?? 0 },
    );
    pushText(texts, cmds, {
      id: "center-name",
      x: oPos.x,
      y: oPos.y,
      runs: parseMathRuns(state.centerName.trim()),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }

  if (state.showCaption && state.caption.trim()) {
    pushText(texts, cmds, {
      id: "caption",
      x: width - 28,
      y: height - 28,
      runs: parseMathRuns(state.caption.trim()),
      size: style.captionSize,
      anchor: "end",
    });
  }

  return { width, height, cmds, texts, layout };
}

function averageOutward(chords: ChordDraft[]): Vec {
  if (chords.length === 0) return { x: -1, y: 0.4 };
  let x = 0;
  let y = 0;
  for (const c of chords) {
    const a = (chordAngleDeg(c) * Math.PI) / 180;
    x -= Math.cos(a);
    y += Math.sin(a);
  }
  return norm({ x: x / chords.length, y: y / chords.length || 0.3 });
}

function drawChord(args: {
  chord: ChordDraft;
  state: CircleChordsState;
  map: (p: Vec) => Vec;
  cmds: SceneCmd[];
  texts: SceneText[];
}): void {
  const { chord, state, map, cmds, texts } = args;
  const { style, unit, unknownLetter } = state;
  const ang = (chordAngleDeg(chord) * Math.PI) / 180;
  const u: Vec = { x: Math.cos(ang), y: Math.sin(ang) };
  const v: Vec = { x: -u.y, y: u.x };
  const d = chord.distance;
  const half = chord.length / 2;
  const M: Vec = mul(u, d);
  const A: Vec = add(M, mul(v, -half));
  const B: Vec = add(M, mul(v, half));
  const O: Vec = { x: 0, y: 0 };
  const cA = map(A);
  const cB = map(B);
  const cM = map(M);
  const cO = map(O);

  cmds.push({ t: "line", x1: cA.x, y1: cA.y, x2: cB.x, y2: cB.y });

  if (chord.showPerp && d > state.radius * 0.02) {
    cmds.push({ t: "line", x1: cO.x, y1: cO.y, x2: cM.x, y2: cM.y });
  }

  const showRStart = chord.showRadiusStart;
  const showREnd = chord.showRadiusEnd;
  if (showRStart) cmds.push({ t: "line", x1: cO.x, y1: cO.y, x2: cA.x, y2: cA.y });
  if (showREnd) cmds.push({ t: "line", x1: cO.x, y1: cO.y, x2: cB.x, y2: cB.y });

  if (chord.showRightAngle && d > state.radius * 0.04) {
    const towardO = norm(sub(cO, cM));
    const along = norm(sub(cB, cA));
    cmds.push({
      t: "rightAngle",
      x: cM.x,
      y: cM.y,
      ux: along.x,
      uy: along.y,
      vx: towardO.x,
      vy: towardO.y,
      size: style.rightAngleSize,
    });
  }

  if (chord.equalTicks === 1 || chord.equalTicks === 2) {
    drawEqualTicks(cmds, cA, cB, chord.equalTicks, 7);
  }

  cmds.push({ t: "dot", x: cA.x, y: cA.y, r: style.pointRadius });
  cmds.push({ t: "dot", x: cB.x, y: cB.y, r: style.pointRadius });
  if (chord.showMidpoint) {
    cmds.push({ t: "dot", x: cM.x, y: cM.y, r: style.pointRadius });
  }

  const radialA = norm(sub(cA, cO));
  const radialB = norm(sub(cB, cO));
  if (chord.showPoints && chord.startName.trim()) {
    const p = add(add(cA, mul(radialA, 16)), {
      x: chord.startDx ?? 0,
      y: chord.startDy ?? 0,
    });
    pushText(texts, cmds, {
      id: `${chord.id}:startName`,
      x: p.x,
      y: p.y,
      runs: parseMathRuns(chord.startName.trim()),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }
  if (chord.showPoints && chord.endName.trim()) {
    const p = add(add(cB, mul(radialB, 16)), {
      x: chord.endDx ?? 0,
      y: chord.endDy ?? 0,
    });
    pushText(texts, cmds, {
      id: `${chord.id}:endName`,
      x: p.x,
      y: p.y,
      runs: parseMathRuns(chord.endName.trim()),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }
  if (chord.showMidpoint && chord.midName.trim()) {
    const away = norm(sub(cM, cO));
    const p = add(add(cM, mul(away, 16)), {
      x: chord.midDx ?? 0,
      y: chord.midDy ?? 0,
    });
    pushText(texts, cmds, {
      id: `${chord.id}:midName`,
      x: p.x,
      y: p.y,
      runs: parseMathRuns(chord.midName.trim()),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }

  const chordOut = norm(sub(cM, cO));
  const chordText = labelOf(chord.chordLabel, chord.length, unit, unknownLetter);
  dimArc(
    cmds,
    texts,
    cA,
    cB,
    chordOut,
    style.dimOffset,
    chordText,
    `${chord.id}:chordLabel`,
    chord.chordLabel,
    style.fontSize,
  );

  if (chord.showPerp && d > state.radius * 0.02) {
    const distText = labelOf(chord.distLabel, chord.distance, unit, unknownLetter);
    const along = norm(sub(cB, cA));
    const distOut =
      chord.cardinal === "down" || chord.cardinal === "left"
        ? mul(along, -1)
        : along;
    dimArc(
      cmds,
      texts,
      cO,
      cM,
      distOut,
      style.dimOffset * 0.85,
      distText,
      `${chord.id}:distLabel`,
      chord.distLabel,
      style.fontSize,
    );
  }

  if (chord.showHalf) {
    const halfText = labelOf(chord.halfLabel, half, unit, unknownLetter);
    const halfOut = mul(chordOut, -1);
    dimArc(
      cmds,
      texts,
      cM,
      cB,
      halfOut,
      style.dimOffset * 0.7,
      halfText,
      `${chord.id}:halfLabel`,
      chord.halfLabel,
      style.fontSize,
    );
  }

  if (showRStart) {
    const startLabel = chord.radiusStartLabel ?? { mode: "auto" as const, custom: "", dx: 0, dy: 0 };
    const rText = labelOf(startLabel, state.radius, unit, unknownLetter);
    dimArc(
      cmds,
      texts,
      cO,
      cA,
      norm(sub(cM, cA)),
      style.dimOffset * 0.9,
      rText,
      `${chord.id}:radiusStartLabel`,
      startLabel,
      style.fontSize,
    );
  }
  if (showREnd) {
    const endLabel = chord.radiusEndLabel ?? { mode: "auto" as const, custom: "", dx: 0, dy: 0 };
    const rText = labelOf(endLabel, state.radius, unit, unknownLetter);
    dimArc(
      cmds,
      texts,
      cO,
      cB,
      norm(sub(cM, cB)),
      style.dimOffset * 0.9,
      rText,
      `${chord.id}:radiusEndLabel`,
      endLabel,
      style.fontSize,
    );
  }
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

export function sceneTextPlain(text: SceneText): string {
  return text.runs.map((run) => run.text).join("");
}

export function hitTestText(
  scene: DiagramScene,
  x: number,
  y: number,
  radius = 22,
): SceneText | null {
  let best: SceneText | null = null;
  let bestD = radius;
  for (const text of scene.texts) {
    const d = Math.hypot(text.x - x, text.y - y);
    if (d < bestD) {
      best = text;
      bestD = d;
    }
  }
  return best;
}

export type FigureHit =
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string }
  | { kind: "point"; chordId: string; which: "start" | "end" | "mid" }
  | { kind: "center" }
  | { kind: "chord"; chordId: string; t: number }
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

function distToSeg(p: Vec, a: Vec, b: Vec): { d: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return { d: Math.hypot(p.x - a.x, p.y - a.y), t: 0 };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)), t };
}

export function hitTestFigure(
  state: CircleChordsState,
  scene: DiagramScene,
  x: number,
  y: number,
): FigureHit | null {
  const p = { x, y };
  const layout = scene.layout;
  const best: { hit: FigureHit; d: number } = { hit: { kind: "circle" }, d: Infinity };

  function consider(hit: FigureHit, d: number, max: number) {
    if (d > max || d >= best.d) return;
    best.hit = hit;
    best.d = d;
  }

  for (const text of scene.texts) {
    consider(
      { kind: "label", id: text.id },
      Math.hypot(text.x - x, text.y - y),
      28,
    );
  }

  for (const cmd of scene.cmds) {
    if (cmd.t === "arc" && cmd.id) {
      consider(
        { kind: "dimLine", id: measureTargetId(cmd.id) },
        distToArc(p, cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw),
        14,
      );
    }
    if (cmd.t === "line" && cmd.id) {
      consider(
        { kind: "dimLine", id: measureTargetId(cmd.id) },
        distToSeg(p, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }).d,
        12,
      );
    }
  }

  for (const chord of state.chords) {
    const ang = (chordAngleDeg(chord) * Math.PI) / 180;
    const u = { x: Math.cos(ang), y: Math.sin(ang) };
    const v = { x: -u.y, y: u.x };
    const M = { x: u.x * chord.distance, y: u.y * chord.distance };
    const half = chord.length / 2;
    const A = { x: M.x + v.x * -half, y: M.y + v.y * -half };
    const B = { x: M.x + v.x * half, y: M.y + v.y * half };
    const cA = mathToCanvas(A, layout);
    const cB = mathToCanvas(B, layout);
    const cM = mathToCanvas(M, layout);
    consider(
      { kind: "point", chordId: chord.id, which: "start" },
      Math.hypot(p.x - cA.x, p.y - cA.y),
      26,
    );
    consider(
      { kind: "point", chordId: chord.id, which: "end" },
      Math.hypot(p.x - cB.x, p.y - cB.y),
      26,
    );
    if (chord.showMidpoint) {
      consider(
        { kind: "point", chordId: chord.id, which: "mid" },
        Math.hypot(p.x - cM.x, p.y - cM.y),
        16,
      );
    }
    const seg = distToSeg(p, cA, cB);
    consider({ kind: "chord", chordId: chord.id, t: seg.t }, seg.d, 14);
  }

  const cO = layout.origin;
  consider({ kind: "center" }, Math.hypot(p.x - cO.x, p.y - cO.y), 16);

  if (best.d > 22) {
    consider(
      { kind: "circle" },
      Math.abs(Math.hypot(p.x - cO.x, p.y - cO.y) - layout.visualR),
      16,
    );
  }

  return best.d === Infinity ? null : best.hit;
}

export function measureFrame(
  state: CircleChordsState,
  scene: DiagramScene,
  id: string,
): { along: Vec; outward: Vec; halfSpan: number } | null {
  const parsed = parseMeasureId(measureTargetId(id));
  if (!parsed) return null;
  const chord = state.chords.find((c) => c.id === parsed.chordId);
  const key = parsed.key;
  if (!chord) return null;
  const layout = scene.layout;
  const ang = (chordAngleDeg(chord) * Math.PI) / 180;
  const u = { x: Math.cos(ang), y: Math.sin(ang) };
  const v = { x: -u.y, y: u.x };
  const M = { x: u.x * chord.distance, y: u.y * chord.distance };
  const half = chord.length / 2;
  const A = { x: M.x + v.x * -half, y: M.y + v.y * -half };
  const B = { x: M.x + v.x * half, y: M.y + v.y * half };
  const O = { x: 0, y: 0 };
  const map = (q: Vec) => mathToCanvas(q, layout);
  const cA = map(A);
  const cB = map(B);
  const cM = map(M);
  const cO = map(O);
  function frame(a: Vec, b: Vec, out: Vec) {
    const along = norm(sub(b, a));
    return {
      along,
      outward: norm(out),
      halfSpan: len(sub(b, a)) / 2,
    };
  }
  if (key === "chordLabel") return frame(cA, cB, sub(cM, cO));
  if (key === "distLabel") {
    const along = norm(sub(cB, cA));
    const out =
      chord.cardinal === "down" || chord.cardinal === "left"
        ? mul(along, -1)
        : along;
    return frame(cO, cM, out);
  }
  if (key === "halfLabel") return frame(cM, cB, mul(norm(sub(cM, cO)), -1));
  if (key === "radiusStartLabel" || key === "radiusLabel") {
    return frame(cO, cA, sub(cM, cA));
  }
  if (key === "radiusEndLabel") {
    return frame(cO, cB, sub(cM, cB));
  }
  return null;
}
