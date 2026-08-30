import { parseMathRuns, parseNameRuns, type TextRun } from "@/lib/diagrams/math-label";
import { tickValues } from "@/lib/diagrams/number-line/model";
import { formatTickLabel } from "@/lib/diagrams/number-line/parse";
import type { DiagramScene, SceneCmd, SceneText, Vec } from "@/lib/diagrams/scene";
import {
  axisPointValues,
  figureVertices,
  negValueNumber,
  posValueNumber,
} from "./geometry";
import {
  normalizeState,
  sqrtLength,
  type SqrtNumberLineState,
} from "./model";

export const SCENE_WIDTH = 760;
export const SCENE_HEIGHT = 400;

const INK = "#111111";
const ARC_STROKE = "#d44a8c";
const SQ_FILL = "#c5dff0";
const TRI_FILL = "#f5c6d6";

export type SqrtLayout = {
  axisY: number;
  left: number;
  right: number;
  min: number;
  max: number;
  unitPx: number;
  gridTop: number;
  axisX: (value: number) => number;
};

export type SqrtNumberLineScene = DiagramScene & {
  layout: SqrtLayout;
};

export function getSqrtLayout(state: SqrtNumberLineState): SqrtLayout {
  const left = state.style.paddingX;
  const right = SCENE_WIDTH - state.style.paddingX;
  const axisY = SCENE_HEIGHT - state.style.paddingBottom;
  const gridTop = state.style.paddingTop;
  const span = state.max - state.min;
  const unitPx = span > 1e-9 ? (right - left) / span : 1;
  return {
    axisY,
    left,
    right,
    min: state.min,
    max: state.max,
    unitPx,
    gridTop,
    axisX: (value: number) => left + ((value - state.min) / span) * (right - left),
  };
}

export function canvasXFromValue(value: number, layout: SqrtLayout): number {
  return layout.axisX(value);
}

export function valueFromCanvasX(x: number, layout: SqrtLayout): number {
  const span = layout.right - layout.left;
  if (span <= 1e-9) return layout.min;
  const t = (x - layout.left) / span;
  return layout.min + t * (layout.max - layout.min);
}

/** 로컬(math) 좌표: O=(0,0), x는 축 방향, y는 위쪽 */
export function canvasFromLocal(
  layout: SqrtLayout,
  origin: number,
  local: Vec,
): Vec {
  return {
    x: layout.axisX(origin + local.x),
    y: layout.axisY - local.y * layout.unitPx,
  };
}

export function localFromCanvas(
  layout: SqrtLayout,
  origin: number,
  canvasX: number,
  canvasY: number,
): Vec {
  const x = (canvasX - layout.axisX(origin)) / layout.unitPx;
  const y = (layout.axisY - canvasY) / layout.unitPx;
  return { x, y };
}

function pushText(
  texts: SceneText[],
  cmds: SceneCmd[],
  text: SceneText,
): void {
  texts.push(text);
  cmds.push({ t: "text", text });
}

function drawGrid(
  cmds: SceneCmd[],
  state: SqrtNumberLineState,
  layout: SqrtLayout,
  maxRow: number,
): void {
  if (!state.showGrid) return;
  const grid = state.style.gridColor;
  const xTicks = tickValues(state.min, state.max, 1);
  for (const x of xTicks) {
    const cx = layout.axisX(x);
    cmds.push({
      t: "line",
      x1: cx,
      y1: layout.gridTop,
      x2: cx,
      y2: layout.axisY,
      stroke: grid,
      width: 0.85,
      id: "grid",
    });
  }
  for (let y = 1; y <= maxRow; y += 1) {
    const cy = layout.axisY - y * layout.unitPx;
    if (cy < layout.gridTop) break;
    cmds.push({
      t: "line",
      x1: layout.left,
      y1: cy,
      x2: layout.right,
      y2: cy,
      stroke: grid,
      width: 0.85,
      id: "grid",
    });
  }
}

function drawAxis(
  cmds: SceneCmd[],
  texts: SceneText[],
  state: SqrtNumberLineState,
  layout: SqrtLayout,
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
  ticks.forEach((v, i) => {
    const x = layout.axisX(v);
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
}

function drawRightAngle(
  cmds: SceneCmd[],
  vertex: Vec,
  from: Vec,
  to: Vec,
): void {
  const ux = from.x - vertex.x;
  const uy = from.y - vertex.y;
  const vx = to.x - vertex.x;
  const vy = to.y - vertex.y;
  const ul = Math.hypot(ux, uy);
  const vl = Math.hypot(vx, vy);
  if (ul < 0.5 || vl < 0.5) return;
  const size = Math.min(14, Math.min(ul, vl) * 0.22);
  cmds.push({
    t: "rightAngle",
    x: vertex.x,
    y: vertex.y,
    ux: ux / ul,
    uy: uy / ul,
    vx: vx / vl,
    vy: vy / vl,
    size,
  });
}

function angularSpan(a0: number, a1: number, ccw: boolean): number {
  const two = Math.PI * 2;
  const norm = (a: number) => ((a % two) + two) % two;
  if (ccw) {
    let span = norm(a1) - norm(a0);
    if (span < 0) span += two;
    return span;
  }
  let span = norm(a0) - norm(a1);
  if (span < 0) span += two;
  return span;
}

/** Pick sweep so the arc drops toward the axis without bulging above the start vertex. */
function chooseArcCcw(
  a0: number,
  a1: number,
  fromLocal: Vec,
  layout: SqrtLayout,
  origin: number,
  O: Vec,
  r: number,
): boolean {
  const ceiling = fromLocal.y + 1e-6;
  let fallback: boolean | null = null;
  for (const ccw of [true, false] as const) {
    const span = angularSpan(a0, a1, ccw);
    let maxY = -Infinity;
    const steps = Math.max(8, Math.ceil(span / (Math.PI / 18)));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const ang = ccw ? a0 + span * t : a0 - span * t;
      const mx = O.x + r * Math.cos(ang);
      const my = O.y + r * Math.sin(ang);
      const local = localFromCanvas(layout, origin, mx, my);
      maxY = Math.max(maxY, local.y);
    }
    if (maxY <= ceiling) {
      if (span <= Math.PI + 1e-6) return ccw;
      fallback = ccw;
    }
  }
  return fallback ?? false;
}

function endpointTangent(a1: number, ccw: boolean): Vec {
  if (ccw) return { x: -Math.sin(a1), y: Math.cos(a1) };
  return { x: Math.sin(a1), y: -Math.cos(a1) };
}

function arcToAxis(
  cmds: SceneCmd[],
  layout: SqrtLayout,
  origin: number,
  fromLocal: Vec,
  targetAxisValue: number,
  id: string,
): void {
  const O = canvasFromLocal(layout, origin, { x: 0, y: 0 });
  const A = canvasFromLocal(layout, origin, fromLocal);
  const P = { x: layout.axisX(targetAxisValue), y: layout.axisY };
  const r = Math.hypot(A.x - O.x, A.y - O.y);
  if (r < 4) return;
  const a0 = Math.atan2(A.y - O.y, A.x - O.x);
  const a1 = Math.atan2(P.y - O.y, P.x - O.x);
  const ccw = chooseArcCcw(a0, a1, fromLocal, layout, origin, O, r);
  cmds.push({
    t: "arc",
    cx: O.x,
    cy: O.y,
    r,
    a0,
    a1,
    ccw,
    stroke: ARC_STROKE,
    width: 1.8,
    id,
  });
  const tan = endpointTangent(a1, ccw);
  const tl = Math.hypot(tan.x, tan.y) || 1;
  cmds.push({
    t: "arrowhead",
    x: P.x,
    y: P.y,
    ux: tan.x / tl,
    uy: tan.y / tl,
    size: 9,
    stroke: ARC_STROKE,
  });
}


function drawShape(
  cmds: SceneCmd[],
  state: SqrtNumberLineState,
  layout: SqrtLayout,
  verts: ReturnType<typeof figureVertices>,
): void {
  if (!state.showShape) return;
  const O = canvasFromLocal(layout, state.origin, verts.O);
  const A = canvasFromLocal(layout, state.origin, verts.A);

  if (state.kind === "triangle" && verts.B) {
    const B = canvasFromLocal(layout, state.origin, verts.B);
    if (state.showFill) {
      cmds.push({
        t: "polygon",
        points: [O, B, A],
        fill: TRI_FILL,
      });
    }
    cmds.push({ t: "line", x1: O.x, y1: O.y, x2: B.x, y2: B.y });
    cmds.push({ t: "line", x1: B.x, y1: B.y, x2: A.x, y2: A.y });
    cmds.push({ t: "line", x1: O.x, y1: O.y, x2: A.x, y2: A.y });
    if (state.showRightAngle) {
      drawRightAngle(cmds, B, O, A);
    }
    return;
  }

  if (verts.B && verts.C) {
    const B = canvasFromLocal(layout, state.origin, verts.B);
    const C = canvasFromLocal(layout, state.origin, verts.C);
    if (state.showFill) {
      cmds.push({
        t: "polygon",
        points: [O, A, B, C],
        fill: SQ_FILL,
      });
    }
    cmds.push({ t: "line", x1: O.x, y1: O.y, x2: A.x, y2: A.y });
    cmds.push({ t: "line", x1: A.x, y1: A.y, x2: B.x, y2: B.y });
    cmds.push({ t: "line", x1: B.x, y1: B.y, x2: C.x, y2: C.y });
    cmds.push({ t: "line", x1: C.x, y1: C.y, x2: O.x, y2: O.y });
  }
}

function drawArcs(
  cmds: SceneCmd[],
  state: SqrtNumberLineState,
  layout: SqrtLayout,
  verts: ReturnType<typeof figureVertices>,
): void {
  if (!state.showArc) return;
  const { P: pVal, Q: qVal } = axisPointValues(state);
  if (state.kind === "triangle") {
    arcToAxis(cmds, layout, state.origin, verts.A, pVal, "arc:pos");
    arcToAxis(cmds, layout, state.origin, verts.A, qVal, "arc:neg");
    return;
  }
  if (verts.C) {
    arcToAxis(cmds, layout, state.origin, verts.A, pVal, "arc:pos");
    arcToAxis(cmds, layout, state.origin, verts.C, qVal, "arc:neg");
  }
}

function combinedPointRuns(name: string, valueRaw: string): TextRun[] {
  const inner = valueRaw.trim().replace(/^\$|\$$/g, "");
  return [
    ...parseNameRuns(name),
    ...parseMathRuns(`($${inner}$)`),
  ];
}

function axisValueLabelY(layout: SqrtLayout, fontSize: number): number {
  const tickH = 12;
  return layout.axisY + tickH + fontSize * 2.35;
}

function drawDotsAndLabels(
  cmds: SceneCmd[],
  texts: SceneText[],
  state: SqrtNumberLineState,
  layout: SqrtLayout,
  verts: ReturnType<typeof figureVertices>,
): void {
  const { style } = state;
  const O = canvasFromLocal(layout, state.origin, verts.O);
  cmds.push({ t: "dot", x: O.x, y: O.y, r: style.pointRadius });

  const vertexKeys: ("O" | "A" | "B" | "C")[] = ["O", "A"];
  if (verts.B) vertexKeys.push("B");
  if (verts.C) vertexKeys.push("C");

  for (const key of vertexKeys) {
    const local = verts[key as keyof typeof verts];
    if (!local) continue;
    const c = canvasFromLocal(layout, state.origin, local);
    if (key !== "O" && state.showShape) {
      cmds.push({ t: "dot", x: c.x, y: c.y, r: style.pointRadius * 0.85 });
    }
    if (!state.showVertexNames) continue;
    const mark = state.names[key];
    pushText(texts, cmds, {
      id: `name:${key}`,
      x: c.x + mark.dx,
      y: c.y + mark.dy,
      runs: parseNameRuns(mark.name),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }

  const pVal = posValueNumber(state);
  const qVal = negValueNumber(state);

  if (state.showPosPoint) {
    const px = layout.axisX(pVal);
    cmds.push({ t: "dot", x: px, y: layout.axisY, r: style.pointRadius });
    const pm = state.names.P;
    const valueY = axisValueLabelY(layout, style.fontSize);
    if (state.combinePointLabels && state.showPosValue) {
      const combined = defaultCombinedPointLabel(state.posPointName, state.posValueRaw);
      pushText(texts, cmds, {
        id: "label:pos",
        x: px + pm.dx,
        y: valueY + pm.dy,
        runs: combinedPointRuns(state.posPointName, state.posValueRaw),
        size: style.fontSize,
        anchor: "middle",
      });
    } else {
      pushText(texts, cmds, {
        id: "name:P",
        x: px + pm.dx,
        y: layout.axisY + pm.dy,
        runs: parseNameRuns(state.posPointName),
        size: style.pointLabelSize,
        anchor: "middle",
      });
      if (state.showPosValue) {
        pushText(texts, cmds, {
          id: "value:pos",
          x: px,
          y: valueY,
          runs: parseMathRuns(state.posValueRaw),
          size: style.fontSize,
          anchor: "middle",
        });
      }
    }
  }

  if (state.showNegPoint) {
    const qx = layout.axisX(qVal);
    cmds.push({ t: "dot", x: qx, y: layout.axisY, r: style.pointRadius });
    const qm = state.names.Q;
    const valueY = axisValueLabelY(layout, style.fontSize);
    if (state.combinePointLabels && state.showNegValue) {
      pushText(texts, cmds, {
        id: "label:neg",
        x: qx + qm.dx,
        y: valueY + qm.dy,
        runs: combinedPointRuns(state.negPointName, state.negValueRaw),
        size: style.fontSize,
        anchor: "middle",
      });
    } else {
      pushText(texts, cmds, {
        id: "name:Q",
        x: qx + qm.dx,
        y: layout.axisY + qm.dy,
        runs: parseNameRuns(state.negPointName),
        size: style.pointLabelSize,
        anchor: "middle",
      });
      if (state.showNegValue) {
        pushText(texts, cmds, {
          id: "value:neg",
          x: qx,
          y: valueY,
          runs: parseMathRuns(state.negValueRaw),
          size: style.fontSize,
          anchor: "middle",
        });
      }
    }
  }
}

export function buildSqrtNumberLineScene(
  raw: SqrtNumberLineState,
): SqrtNumberLineScene {
  const state = normalizeState(raw);
  const layout = getSqrtLayout(state);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const verts = figureVertices(state);

  let maxRow = state.legB;
  if (verts.B) maxRow = Math.max(maxRow, verts.B.y);
  if (verts.C) maxRow = Math.max(maxRow, verts.C.y, Math.abs(verts.C.x));
  maxRow = Math.max(maxRow, Math.ceil(sqrtLength(state)));

  drawGrid(cmds, state, layout, maxRow);
  drawShape(cmds, state, layout, verts);
  drawArcs(cmds, state, layout, verts);
  drawAxis(cmds, texts, state, layout);
  drawDotsAndLabels(cmds, texts, state, layout, verts);

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
  };
}
