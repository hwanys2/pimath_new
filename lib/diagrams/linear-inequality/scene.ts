import { parseMathRuns } from "@/lib/diagrams/math-label";
import {
  boundKeys,
  fillRgba,
  type BoundKey,
  type InequalityBound,
  type InequalityState,
  type RayDirection,
} from "@/lib/diagrams/linear-inequality/model";
import { tickValues } from "@/lib/diagrams/number-line/model";
import {
  formatPointLabel,
  formatTickLabel,
} from "@/lib/diagrams/number-line/parse";
import type { DiagramScene, SceneCmd, SceneText } from "@/lib/diagrams/scene";

export const SCENE_WIDTH = 760;
export const SCENE_HEIGHT = 240;

export type InequalityLayout = {
  axisY: number;
  shelfY: number;
  left: number;
  right: number;
  min: number;
  max: number;
};

export type InequalityScene = DiagramScene & {
  layout: InequalityLayout;
};

export function getInequalityLayout(state: InequalityState): InequalityLayout {
  const left = state.style.paddingX;
  const right = SCENE_WIDTH - state.style.paddingX;
  const axisY = Math.round(SCENE_HEIGHT * 0.62);
  return {
    axisY,
    shelfY: axisY - state.style.shelfHeight,
    left,
    right,
    min: state.min,
    max: state.max,
  };
}

export function canvasXFromValue(
  value: number,
  layout: InequalityLayout,
): number {
  const span = layout.max - layout.min;
  if (span <= 1e-9) return (layout.left + layout.right) / 2;
  const t = (value - layout.min) / span;
  return layout.left + t * (layout.right - layout.left);
}

export function valueFromCanvasX(
  x: number,
  layout: InequalityLayout,
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

function drawAxis(
  cmds: SceneCmd[],
  texts: SceneText[],
  state: InequalityState,
  layout: InequalityLayout,
): void {
  const { style } = state;
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
  const tickLabelY = axisY + majorH + style.fontSize * 0.85;
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
      y: tickLabelY,
      runs: parseMathRuns(formatTickLabel(v, state.plusOnPositive)),
      size: style.fontSize,
      anchor: "middle",
    });
  });
}

function rayTip(layout: InequalityLayout, direction: RayDirection): {
  tip: number;
  lineEnd: number;
  ux: number;
} {
  const extra = 14;
  const arrowSize = 12;
  if (direction === "right") {
    const tip = layout.right + extra;
    return { tip, lineEnd: tip - arrowSize, ux: 1 };
  }
  const tip = layout.left - extra;
  return { tip, lineEnd: tip + arrowSize, ux: -1 };
}

function drawFillRect(
  cmds: SceneCmd[],
  x0: number,
  x1: number,
  yTop: number,
  yBot: number,
  fill: string,
): void {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  if (right - left < 1.5) return;
  cmds.push({
    t: "polygon",
    points: [
      { x: left, y: yBot },
      { x: right, y: yBot },
      { x: right, y: yTop },
      { x: left, y: yTop },
    ],
    fill,
  });
}

function rayFill(
  cmds: SceneCmd[],
  layout: InequalityLayout,
  boundX: number,
  direction: RayDirection,
  fill: string,
): void {
  const { lineEnd } = rayTip(layout, direction);
  drawFillRect(cmds, boundX, lineEnd, layout.shelfY, layout.axisY, fill);
}

function rayStroke(
  cmds: SceneCmd[],
  layout: InequalityLayout,
  boundX: number,
  direction: RayDirection,
  radius: number,
  id: string,
): void {
  const { tip, lineEnd, ux } = rayTip(layout, direction);
  cmds.push({
    t: "line",
    x1: boundX,
    y1: layout.axisY - radius,
    x2: boundX,
    y2: layout.shelfY,
    id,
  });
  cmds.push({
    t: "line",
    x1: boundX,
    y1: layout.shelfY,
    x2: lineEnd,
    y2: layout.shelfY,
  });
  cmds.push({
    t: "arrowhead",
    x: tip,
    y: layout.shelfY,
    ux,
    uy: 0,
    size: 12,
  });
}

function segmentFill(
  cmds: SceneCmd[],
  layout: InequalityLayout,
  x0: number,
  x1: number,
  fill: string,
): void {
  drawFillRect(cmds, x0, x1, layout.shelfY, layout.axisY, fill);
}

function segmentStroke(
  cmds: SceneCmd[],
  layout: InequalityLayout,
  x0: number,
  x1: number,
  radius: number,
): void {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  cmds.push({
    t: "line",
    x1: left,
    y1: layout.axisY - radius,
    x2: left,
    y2: layout.shelfY,
    id: "riser:start",
  });
  cmds.push({
    t: "line",
    x1: right,
    y1: layout.axisY - radius,
    x2: right,
    y2: layout.shelfY,
    id: "riser:end",
  });
  cmds.push({
    t: "line",
    x1: left,
    y1: layout.shelfY,
    x2: right,
    y2: layout.shelfY,
  });
}

function drawFills(
  cmds: SceneCmd[],
  state: InequalityState,
  layout: InequalityLayout,
  startX: number,
  endX: number,
): void {
  if (state.kind === "blank" || !state.showFill) return;
  const fill = fillRgba(state.fillHex, state.fillAlpha);
  if (state.kind === "ray") {
    rayFill(cmds, layout, startX, state.direction, fill);
    return;
  }
  if (state.kind === "segment") {
    segmentFill(cmds, layout, startX, endX, fill);
    return;
  }
  rayFill(cmds, layout, startX, "left", fill);
  rayFill(cmds, layout, endX, "right", fill);
}

function drawOverlayStrokes(
  cmds: SceneCmd[],
  state: InequalityState,
  layout: InequalityLayout,
  startX: number,
  endX: number,
): void {
  if (state.kind === "blank") return;
  const radius = state.style.pointRadius;
  if (state.kind === "ray") {
    rayStroke(cmds, layout, startX, state.direction, radius, "riser:start");
    return;
  }
  if (state.kind === "segment") {
    segmentStroke(cmds, layout, startX, endX, radius);
    return;
  }
  rayStroke(cmds, layout, startX, "left", radius, "riser:start");
  rayStroke(cmds, layout, endX, "right", radius, "riser:end");
}

function drawEndpoint(
  cmds: SceneCmd[],
  x: number,
  y: number,
  r: number,
  inclusive: boolean,
): void {
  if (inclusive) {
    cmds.push({ t: "dot", x, y, r });
    return;
  }
  cmds.push({ t: "dot", x, y, r, stroke: "#ffffff" });
  cmds.push({ t: "circle", x, y, r });
}

function drawBoundValue(
  texts: SceneText[],
  cmds: SceneCmd[],
  bound: InequalityBound,
  which: BoundKey,
  x: number,
  y: number,
  size: number,
): void {
  if (!bound.showValue) return;
  pushText(texts, cmds, {
    id: `bound:${which}:value`,
    x: x + bound.labelDx,
    y: y + bound.labelDy,
    runs: parseMathRuns(formatPointLabel(bound.inputRaw, bound.value, "math")),
    size,
    anchor: "middle",
  });
}

export function buildInequalityScene(state: InequalityState): InequalityScene {
  const layout = getInequalityLayout(state);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const startX = canvasXFromValue(state.start.value, layout);
  const endX = canvasXFromValue(state.end.value, layout);

  drawFills(cmds, state, layout, startX, endX);
  drawAxis(cmds, texts, state, layout);
  drawOverlayStrokes(cmds, state, layout, startX, endX);

  for (const which of boundKeys(state.kind)) {
    const bound = state[which];
    const x = which === "start" ? startX : endX;
    drawEndpoint(cmds, x, layout.axisY, state.style.pointRadius, bound.inclusive);
    drawBoundValue(
      texts,
      cmds,
      bound,
      which,
      x,
      layout.axisY + 12 + state.style.fontSize * 0.85 + state.style.pointLabelSize * 0.9,
      state.style.pointLabelSize,
    );
  }

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
  };
}
