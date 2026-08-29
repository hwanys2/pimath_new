import { parseMathRuns } from "@/lib/diagrams/math-label";
import {
  resolveBands,
  tickValues,
  type NumberLineState,
  type ResolvedBand,
} from "@/lib/diagrams/number-line/model";
import {
  formatPointValue,
  formatTickLabel,
} from "@/lib/diagrams/number-line/parse";
import type {
  DiagramScene,
  SceneCmd,
  SceneText,
} from "@/lib/diagrams/scene";

export const SCENE_WIDTH = 760;
export const SCENE_HEIGHT = 240;

export type NumberLineLayout = {
  axisY: number;
  left: number;
  right: number;
  min: number;
  max: number;
};

export type NumberLineScene = DiagramScene & {
  layout: NumberLineLayout;
};

export function getNumberLineLayout(state: NumberLineState): NumberLineLayout {
  const left = state.style.paddingX;
  const right = SCENE_WIDTH - state.style.paddingX;
  const axisY = Math.round(SCENE_HEIGHT * 0.58);
  return {
    axisY,
    left,
    right,
    min: state.min,
    max: state.max,
  };
}

export function canvasXFromValue(
  value: number,
  layout: NumberLineLayout,
): number {
  const span = layout.max - layout.min;
  if (span <= 1e-9) return (layout.left + layout.right) / 2;
  const t = (value - layout.min) / span;
  return layout.left + t * (layout.right - layout.left);
}

export function valueFromCanvasX(
  x: number,
  layout: NumberLineLayout,
): number {
  const span = layout.right - layout.left;
  if (span <= 1e-9) return layout.min;
  const t = (x - layout.left) / span;
  return layout.min + t * (layout.max - layout.min);
}

function pushText(
  texts: SceneText[],
  cmds: SceneCmd[],
  text: SceneText,
): void {
  texts.push(text);
  cmds.push({ t: "text", text });
}

function sagittaArc(
  x1: number,
  y: number,
  x2: number,
  sag: number,
): { cx: number; cy: number; r: number; a0: number; a1: number; ccw: boolean } | null {
  const span = x2 - x1;
  if (Math.abs(span) < 2 || Math.abs(sag) < 0.75) return null;
  const midX = (x1 + x2) / 2;
  const half = span / 2;
  const r = (half * half + sag * sag) / (2 * Math.abs(sag));
  const nY = sag > 0 ? -1 : 1;
  const cx = midX;
  const cy = y + nY * (sag - r);
  const a0 = Math.atan2(y - cy, x1 - cx);
  const a1 = Math.atan2(y - cy, x2 - cx);
  const peakY = y + nY * sag;
  const aS = Math.atan2(peakY - cy, midX - cx);
  const two = Math.PI * 2;
  const norm = (a: number) => ((a % two) + two) % two;
  const ccwSpan = (from: number, to: number) => {
    let d = norm(to) - norm(from);
    if (d < 0) d += two;
    return d;
  };
  const sOnIncreasing = ccwSpan(a0, aS) <= ccwSpan(a0, a1) + 1e-6;
  return { cx, cy, r, a0, a1, ccw: !sOnIncreasing };
}

function drawEqualMarks(
  cmds: SceneCmd[],
  x: number,
  y: number,
  count: 1 | 2 | 3,
  size: number,
): void {
  const span = 3.4;
  const start = -((count - 1) * span) / 2;
  for (let i = 0; i < count; i += 1) {
    const cx = x + start + i * span;
    cmds.push({
      t: "line",
      x1: cx,
      y1: y - size,
      x2: cx,
      y2: y + size,
    });
  }
}

function drawBand(
  cmds: SceneCmd[],
  layout: NumberLineLayout,
  band: ResolvedBand,
  axisY: number,
): void {
  const x0 = canvasXFromValue(band.start, layout);
  const x1 = canvasXFromValue(band.start + 1, layout);
  if (x1 - x0 < 8) return;
  const tickH = 7;
  for (let i = 1; i < band.n; i += 1) {
    const x = x0 + ((x1 - x0) * i) / band.n;
    cmds.push({
      t: "line",
      x1: x,
      y1: axisY - tickH,
      x2: x,
      y2: axisY + tickH,
    });
  }
  const sag = Math.min(11, Math.max(7, (x1 - x0) / band.n * 0.42));
  for (let i = 0; i < band.n; i += 1) {
    const a = x0 + ((x1 - x0) * i) / band.n;
    const b = x0 + ((x1 - x0) * (i + 1)) / band.n;
    const arc = sagittaArc(a, axisY - 1.5, b, sag);
    if (!arc) continue;
    cmds.push({
      t: "arc",
      cx: arc.cx,
      cy: arc.cy,
      r: arc.r,
      a0: arc.a0,
      a1: arc.a1,
      ccw: arc.ccw,
      dashed: true,
      id: `band:${band.start}:${i}`,
    });
    const midX = (a + b) / 2;
    const midY = axisY - 1.5 - sag;
    drawEqualMarks(cmds, midX, midY, band.equalMarks, 3.6);
  }
}

export function buildNumberLineScene(state: NumberLineState): NumberLineScene {
  const { style } = state;
  const layout = getNumberLineLayout(state);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const axisY = layout.axisY;
  const arrowSize = 12;
  const overshoot = 20;

  const lineLeft = layout.left - (state.leftArrow ? overshoot : 0);
  const lineRight = layout.right + (state.rightArrow ? overshoot : 0);

  cmds.push({
    t: "line",
    x1: state.leftArrow ? lineLeft + arrowSize : lineLeft,
    y1: axisY,
    x2: state.rightArrow ? lineRight - arrowSize : lineRight,
    y2: axisY,
  });
  if (state.leftArrow) {
    cmds.push({
      t: "arrowhead",
      x: lineLeft,
      y: axisY,
      ux: -1,
      uy: 0,
      size: arrowSize,
    });
  }
  if (state.rightArrow) {
    cmds.push({
      t: "arrowhead",
      x: lineRight,
      y: axisY,
      ux: 1,
      uy: 0,
      size: arrowSize,
    });
  }

  const ticks = tickValues(state.min, state.max, state.tickStep);
  const majorH = 12;
  ticks.forEach((v, i) => {
    const x = canvasXFromValue(v, layout);
    cmds.push({
      t: "line",
      x1: x,
      y1: axisY - majorH,
      x2: x,
      y2: axisY + majorH,
    });
    if (!state.showTickLabels) return;
    const labeled =
      state.labelEvery <= 1 ||
      i % state.labelEvery === 0 ||
      Math.abs(v) < 1e-9;
    if (!labeled) return;
    pushText(texts, cmds, {
      id: `tick:${v}`,
      x,
      y: axisY + majorH + style.fontSize * 0.85,
      runs: parseMathRuns(formatTickLabel(v, state.plusOnPositive)),
      size: style.fontSize,
      anchor: "middle",
    });
  });

  for (const band of resolveBands(state)) {
    drawBand(cmds, layout, band, axisY);
  }

  for (const point of state.points) {
    const x = canvasXFromValue(point.value, layout);
    cmds.push({
      t: "dot",
      x,
      y: axisY,
      r: style.pointRadius,
    });
    if (point.showName && point.name.trim()) {
      pushText(texts, cmds, {
        id: `point:${point.id}:name`,
        x: x + point.labelDx,
        y: axisY - 28 + point.labelDy,
        runs: parseMathRuns(point.name.trim()),
        size: style.pointLabelSize,
        anchor: "middle",
      });
    }
    if (point.showValue) {
      pushText(texts, cmds, {
        id: `point:${point.id}:value`,
        x: x + point.labelDx,
        y: axisY + 40 + (point.showName ? 0 : -8),
        runs: parseMathRuns(formatPointValue(point.value, "math")),
        size: style.fontSize,
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
