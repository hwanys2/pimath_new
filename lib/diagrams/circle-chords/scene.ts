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
  layout: SceneLayout;
};

export const SCENE_WIDTH = 720;
export const SCENE_HEIGHT = 780;

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
  | { kind: "point"; chordId: string; which: "start" | "end" | "mid" }
  | { kind: "center" }
  | { kind: "chord"; chordId: string }
  | { kind: "circle" };

function distToSeg(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
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
      26,
    );
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
      22,
    );
    consider(
      { kind: "point", chordId: chord.id, which: "end" },
      Math.hypot(p.x - cB.x, p.y - cB.y),
      22,
    );
    consider(
      { kind: "point", chordId: chord.id, which: "mid" },
      Math.hypot(p.x - cM.x, p.y - cM.y),
      16,
    );
    consider(
      { kind: "chord", chordId: chord.id },
      distToSeg(p, cA, cB),
      12,
    );
  }

  const cO = layout.origin;
  consider({ kind: "center" }, Math.hypot(p.x - cO.x, p.y - cO.y), 16);

  if (best.d > 20) {
    consider(
      { kind: "circle" },
      Math.abs(Math.hypot(p.x - cO.x, p.y - cO.y) - layout.visualR),
      16,
    );
  }

  return best.d === Infinity ? null : best.hit;
}
