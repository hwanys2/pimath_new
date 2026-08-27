import { parseMathRuns, type TextRun } from "@/lib/diagrams/math-label";
import {
  chordAngleDeg,
  resolveLabelText,
  type CircleChordsState,
  type ChordDraft,
  type MeasLabel,
} from "@/lib/diagrams/circle-chords/model";

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
};

export const SCENE_WIDTH = 720;
export const SCENE_HEIGHT = 780;

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

function dimArc(
  cmds: SceneCmd[],
  texts: SceneText[],
  a: Vec,
  b: Vec,
  outward: Vec,
  offset: number,
  label: string | null,
  labelId: string,
  nudge: Vec,
  fontSize: number,
): void {
  if (!label) return;
  const u = norm(outward);
  const start = add(a, mul(u, offset * 0.22));
  const end = add(b, mul(u, offset * 0.22));
  const mid = mul(add(a, b), 0.5);
  const ctrl = add(mid, mul(u, offset * 1.15));
  cmds.push({
    t: "quad",
    x1: start.x,
    y1: start.y,
    cx: ctrl.x,
    cy: ctrl.y,
    x2: end.x,
    y2: end.y,
    dashed: true,
  });
  const tp = add(add(ctrl, mul(u, fontSize * 0.55)), nudge);
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
  const captionBand = state.showCaption && state.caption.trim() ? 44 : 12;
  const origin: Vec = { x: width / 2, y: (height - captionBand) / 2 + 6 };
  const visualR = Math.min(width, height - captionBand) / 2 - style.padding;
  const scale = visualR / state.radius;
  const viewRot = state.viewRotationDeg;
  const map = (p: Vec) => toCanvas(p, origin, scale, viewRot);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];

  cmds.push({ t: "circle", x: origin.x, y: origin.y, r: visualR });

  if (state.showCenter) {
    cmds.push({
      t: "dot",
      x: origin.x,
      y: origin.y,
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
    const oPos = add(origin, mul(away, 18));
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

  return { width, height, cmds, texts };
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

  if (chord.equalTicks > 0) {
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
    const p = add(cA, mul(radialA, 16));
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
    const p = add(cB, mul(radialB, 16));
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
    const p = add(cM, mul(away, 16));
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
    { x: chord.chordLabel.dx, y: chord.chordLabel.dy },
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
      { x: chord.distLabel.dx, y: chord.distLabel.dy },
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
      { x: chord.halfLabel.dx, y: chord.halfLabel.dy },
      style.fontSize,
    );
  }

  const radiusTarget = showREnd ? cB : showRStart ? cA : null;
  const radiusMath = showREnd ? B : showRStart ? A : null;
  if (radiusTarget && radiusMath) {
    const rText = labelOf(chord.radiusLabel, state.radius, unit, unknownLetter);
    const side = norm(sub(cM, radiusTarget));
    dimArc(
      cmds,
      texts,
      cO,
      radiusTarget,
      side,
      style.dimOffset * 0.9,
      rText,
      `${chord.id}:radiusLabel`,
      { x: chord.radiusLabel.dx, y: chord.radiusLabel.dy },
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

export function hitTestText(
  scene: DiagramScene,
  x: number,
  y: number,
  radius = 22,
): SceneText | null {
  let best: SceneText | null = null;
  let bestD = radius;
  for (const text of scene.texts) {
    if (text.id === "caption") continue;
    const d = Math.hypot(text.x - x, text.y - y);
    if (d < bestD) {
      best = text;
      bestD = d;
    }
  }
  return best;
}
