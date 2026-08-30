import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import type { DiagramScene, SceneCmd, SceneText, Vec } from "@/lib/diagrams/scene";
import {
  formatTick,
  hasChartTitle,
  tickValues,
  type ScatterState,
} from "@/lib/diagrams/scatter/model";

export const SCENE_WIDTH = 600;
export const SCENE_HEIGHT = 500;
export const QUAD_SCENE_HEIGHT = 560;
const CORNER_INSET = 56;

export type PlotFrame = {
  panel: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  dataLeft: number;
  dataRight: number;
  dataTop: number;
  dataBottom: number;
  originX: number;
  originY: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xBreak: boolean;
  yBreak: boolean;
  stubW: number;
  gapW: number;
  stubH: number;
  gapH: number;
};

export type ScatterLayout = {
  width: number;
  height: number;
  frames: PlotFrame[];
};

export type ScatterScene = DiagramScene & {
  layout: ScatterLayout;
};

function estimateLabelWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0x2ff ? size * 0.95 : size * 0.58;
  }
  return w;
}

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

function buildFrame(
  state: ScatterState,
  box: { left: number; right: number; top: number; bottom: number },
  panel: number,
): PlotFrame {
  const xBreak = state.xBreak && state.xMin > 1e-9;
  const yBreak = state.yBreak && state.yMin > 1e-9;
  const stubW = xBreak ? 16 : 0;
  const gapW = xBreak ? 22 : 0;
  const stubH = yBreak ? 16 : 0;
  const gapH = yBreak ? 22 : 0;
  const dataLeft = xBreak ? box.left + stubW + gapW : box.left;
  const dataBottom = yBreak ? box.bottom - stubH - gapH : box.bottom;
  return {
    panel,
    plotLeft: box.left,
    plotRight: box.right,
    plotTop: box.top,
    plotBottom: box.bottom,
    dataLeft,
    dataRight: box.right,
    dataTop: box.top,
    dataBottom,
    originX: box.left,
    originY: box.bottom,
    xMin: state.xMin,
    xMax: state.xMax,
    yMin: state.yMin,
    yMax: state.yMax,
    xBreak,
    yBreak,
    stubW,
    gapW,
    stubH,
    gapH,
  };
}

export function getScatterLayout(state: ScatterState): ScatterLayout {
  const pad = Math.max(40, state.style.padding);
  const nameSize = state.style.axisNameSize;
  const fontSize = state.style.fontSize;
  const titleSize = state.style.titleSize;
  const yName = state.yAxisLabel.trim();
  const xName = state.xAxisLabel.trim();
  const yNameW = yName
    ? state.yLabelVertical
      ? nameSize + 36
      : estimateLabelWidth(yName, nameSize) + 20
    : 20;
  const tickW = state.showTicks
    ? estimateLabelWidth(formatTick(state.yMax), fontSize) + 22
    : 0;
  const titleBand = hasChartTitle(state)
    ? Math.max(26, titleSize * 1.2 + 8)
    : 0;
  const tickDrop = state.showTicks ? 14 + fontSize * 0.85 : 12;
  const xNameDrop = xName
    ? tickDrop + nameSize + 16
    : tickDrop + 10;

  if (state.kind === "quad") {
    const width = SCENE_WIDTH;
    const height = QUAD_SCENE_HEIGHT;
    const outerLeft = Math.max(36, pad * 0.7, CORNER_INSET * 0.7);
    const outerRight = width - Math.max(28, pad * 0.5);
    const outerTop = Math.max(32, titleBand + 12, pad * 0.5);
    const outerBottom = height - Math.max(32, pad * 0.55);
    const gapX = 22;
    const gapY = 28;
    const cellW = (outerRight - outerLeft - gapX) / 2;
    const cellH = (outerBottom - outerTop - gapY) / 2;
    const frames: PlotFrame[] = [];
    for (let i = 0; i < 4; i += 1) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const left = outerLeft + col * (cellW + gapX) + 18;
      const right = outerLeft + col * (cellW + gapX) + cellW;
      const top = outerTop + row * (cellH + gapY) + 16;
      const bottom = outerTop + row * (cellH + gapY) + cellH - 10;
      frames.push(
        buildFrame(state, { left, right, top, bottom }, i),
      );
    }
    return { width, height, frames };
  }

  const width = SCENE_WIDTH;
  const height = SCENE_HEIGHT;
  const plotLeft = Math.max(pad, CORNER_INSET, yNameW, tickW);
  const plotRight = width - Math.max(CORNER_INSET, pad * 0.72, xName ? 44 : 28);
  const plotTop = hasChartTitle(state)
    ? titleBand + Math.max(22, nameSize * 0.7, pad * 0.45)
    : Math.max(CORNER_INSET, nameSize + 10, pad * 0.7);
  const bottomNeed = Math.max(40, xNameDrop, CORNER_INSET);
  const plotBottom = height - Math.max(CORNER_INSET, pad * 0.72, bottomNeed);
  return {
    width,
    height,
    frames: [
      buildFrame(
        state,
        { left: plotLeft, right: plotRight, top: plotTop, bottom: plotBottom },
        0,
      ),
    ],
  };
}

export function canvasXFromValue(x: number, frame: PlotFrame): number {
  const span = Math.max(frame.xMax - frame.xMin, 1e-9);
  const t = (x - frame.xMin) / span;
  return frame.dataLeft + t * (frame.dataRight - frame.dataLeft);
}

export function canvasYFromValue(y: number, frame: PlotFrame): number {
  const span = Math.max(frame.yMax - frame.yMin, 1e-9);
  const t = (y - frame.yMin) / span;
  return frame.dataBottom - t * (frame.dataBottom - frame.dataTop);
}

export function valueFromCanvasX(cx: number, frame: PlotFrame): number {
  const span = Math.max(frame.dataRight - frame.dataLeft, 1e-9);
  const t = (cx - frame.dataLeft) / span;
  return frame.xMin + t * (frame.xMax - frame.xMin);
}

export function valueFromCanvasY(cy: number, frame: PlotFrame): number {
  const span = Math.max(frame.dataBottom - frame.dataTop, 1e-9);
  const t = (frame.dataBottom - cy) / span;
  return frame.yMin + t * (frame.yMax - frame.yMin);
}

export function frameAtPoint(
  layout: ScatterLayout,
  x: number,
  y: number,
): PlotFrame | null {
  let best: PlotFrame | null = null;
  let bestD = Infinity;
  for (const frame of layout.frames) {
    const inside =
      x >= frame.plotLeft - 8 &&
      x <= frame.plotRight + 10 &&
      y >= frame.plotTop - 10 &&
      y <= frame.plotBottom + 10;
    if (!inside) continue;
    const cx = clamp(x, frame.dataLeft, frame.dataRight);
    const cy = clamp(y, frame.dataTop, frame.dataBottom);
    const d = Math.hypot(cx - x, cy - y);
    if (d < bestD) {
      best = frame;
      bestD = d;
    }
  }
  if (best) return best;
  return layout.frames[0] ?? null;
}

export function frameForPanel(
  layout: ScatterLayout,
  panel: number,
): PlotFrame | null {
  return layout.frames.find((f) => f.panel === panel) ?? layout.frames[0] ?? null;
}

function pushText(texts: SceneText[], cmds: SceneCmd[], text: SceneText) {
  texts.push(text);
  cmds.push({ t: "text", text });
}

function axisBreakWaves(cx: number, cy: number, vertical: boolean): SceneCmd[] {
  const size = 9;
  const ang = vertical ? -Math.PI / 4.2 : Math.PI / 4.2;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  function wave(offset: number): Vec[] {
    const n = 14;
    const pts: Vec[] = [];
    for (let i = 0; i < n; i += 1) {
      const t = (i / (n - 1) - 0.5) * 2;
      const u = t * size;
      const v = Math.sin(t * Math.PI * 1.7) * 2.4 + offset;
      pts.push({ x: cx + u * c - v * s, y: cy + u * s + v * c });
    }
    return pts;
  }
  return [
    { t: "polyline", pts: wave(-2.1), width: 1.45, id: "break" },
    { t: "polyline", pts: wave(2.1), width: 1.45, id: "break" },
  ];
}

function inDataRect(x: number, y: number, frame: PlotFrame): boolean {
  return (
    x + 1e-9 >= frame.xMin &&
    x - 1e-9 <= frame.xMax &&
    y + 1e-9 >= frame.yMin &&
    y - 1e-9 <= frame.yMax
  );
}

function paintAxes(
  state: ScatterState,
  frame: PlotFrame,
  cmds: SceneCmd[],
  texts: SceneText[],
  compact: boolean,
) {
  const lw = state.style.lineWidth;
  const grid = state.style.gridColor;
  const ox = frame.originX;
  const oy = frame.originY;
  const xTicks = tickValues(state.xMin, state.xMax, state.xTick);
  const yTicks = tickValues(state.yMin, state.yMax, state.yTick);
  const xGrid = tickValues(state.xMin, state.xMax, state.xGrid);
  const yGrid = tickValues(state.yMin, state.yMax, state.yGrid);

  if (state.showGrid) {
    for (const x of xGrid) {
      const cx = canvasXFromValue(x, frame);
      cmds.push({
        t: "line",
        x1: cx,
        y1: frame.dataTop,
        x2: cx,
        y2: frame.dataBottom,
        stroke: grid,
        width: 0.85,
        id: "grid",
      });
    }
    for (const y of yGrid) {
      const cy = canvasYFromValue(y, frame);
      cmds.push({
        t: "line",
        x1: frame.dataLeft,
        y1: cy,
        x2: frame.dataRight,
        y2: cy,
        stroke: grid,
        width: 0.85,
        id: "grid",
      });
    }
  }

  if (frame.xBreak) {
    cmds.push({
      t: "line",
      x1: ox,
      y1: oy,
      x2: ox + frame.stubW,
      y2: oy,
      width: lw,
    });
    cmds.push(
      ...axisBreakWaves(ox + frame.stubW + frame.gapW / 2, oy, false),
    );
    cmds.push({
      t: "line",
      x1: frame.dataLeft,
      y1: oy,
      x2: frame.plotRight,
      y2: oy,
      width: lw,
    });
  } else {
    cmds.push({
      t: "line",
      x1: frame.plotLeft,
      y1: oy,
      x2: frame.plotRight,
      y2: oy,
      width: lw,
    });
  }

  if (frame.yBreak) {
    cmds.push({
      t: "line",
      x1: ox,
      y1: oy,
      x2: ox,
      y2: oy - frame.stubH,
      width: lw,
    });
    cmds.push(
      ...axisBreakWaves(ox, oy - frame.stubH - frame.gapH / 2, true),
    );
    cmds.push({
      t: "line",
      x1: ox,
      y1: frame.dataBottom,
      x2: ox,
      y2: frame.plotTop,
      width: lw,
    });
  } else {
    cmds.push({
      t: "line",
      x1: ox,
      y1: oy,
      x2: ox,
      y2: frame.plotTop,
      width: lw,
    });
  }

  cmds.push({
    t: "arrowhead",
    x: frame.plotRight,
    y: oy,
    ux: 1,
    uy: 0,
    size: compact ? 7 : 8,
  });
  cmds.push({
    t: "arrowhead",
    x: ox,
    y: frame.plotTop,
    ux: 0,
    uy: -1,
    size: compact ? 7 : 8,
  });

  if (state.showTicks) {
    for (const x of xTicks) {
      const atOrigin = Math.abs(x) < 1e-9 && !frame.xBreak;
      if (atOrigin && state.showOrigin) continue;
      const cx = canvasXFromValue(x, frame);
      cmds.push({
        t: "line",
        x1: cx,
        y1: oy - 4,
        x2: cx,
        y2: oy + 4,
        width: lw,
        id: "tick",
      });
      pushText(texts, cmds, {
        id: `tick-x:${frame.panel}:${x}`,
        x: cx,
        y: oy + 14,
        runs: parseMathRuns(formatTick(x)),
        size: state.style.fontSize,
        anchor: "middle",
      });
    }
    for (const y of yTicks) {
      const atOrigin = Math.abs(y) < 1e-9 && !frame.yBreak;
      if (atOrigin && state.showOrigin) continue;
      const cy = canvasYFromValue(y, frame);
      cmds.push({
        t: "line",
        x1: ox - 4,
        y1: cy,
        x2: ox + 4,
        y2: cy,
        width: lw,
        id: "tick",
      });
      pushText(texts, cmds, {
        id: `tick-y:${frame.panel}:${y}`,
        x: ox - 8,
        y: cy,
        runs: parseMathRuns(formatTick(y)),
        size: state.style.fontSize,
        anchor: "end",
      });
    }
  }

  if (state.showOrigin && state.originLabel.trim()) {
    pushText(texts, cmds, {
      id: `origin:${frame.panel}`,
      x: ox - (compact ? 8 : 11),
      y: oy + (compact ? 11 : 14),
      runs: parseNameRuns(state.originLabel.trim()),
      size: compact ? Math.max(12, state.style.pointLabelSize * 0.85) : state.style.pointLabelSize,
      anchor: "middle",
    });
  }

  const suffix = compact ? `:${frame.panel}` : "";
  if (state.xAxisLabel.trim()) {
    const nameSize = compact
      ? Math.max(12, state.style.axisNameSize * 0.85)
      : state.style.axisNameSize;
    pushText(texts, cmds, {
      id: `axis-x${suffix}`,
      x: frame.plotRight - 2 + state.xAxisLabelDx,
      y: oy + 12 + (state.showTicks ? state.style.fontSize * 0.85 : 4) + state.xAxisLabelDy,
      runs: parseMathRuns(state.xAxisLabel.trim()),
      size: nameSize,
      anchor: "end",
    });
  }
  if (state.yAxisLabel.trim()) {
    const nameSize = compact
      ? Math.max(12, state.style.axisNameSize * 0.85)
      : state.style.axisNameSize;
    if (state.yLabelVertical) {
      pushText(texts, cmds, {
        id: `axis-y${suffix}`,
        x: ox - 10 + state.yAxisLabelDx,
        y: frame.plotTop + 6 + state.yAxisLabelDy,
        runs: parseMathRuns(state.yAxisLabel.trim()),
        size: nameSize,
        anchor: "end",
        rotate: -Math.PI / 2,
      });
    } else {
      pushText(texts, cmds, {
        id: `axis-y${suffix}`,
        x: ox - 6 + state.yAxisLabelDx,
        y: frame.plotTop + nameSize * 0.48 + state.yAxisLabelDy,
        runs: parseMathRuns(state.yAxisLabel.trim()),
        size: nameSize,
        anchor: "end",
      });
    }
  }
}

export function buildScatterScene(state: ScatterState): ScatterScene {
  const layout = getScatterLayout(state);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const compact = state.kind === "quad";

  if (hasChartTitle(state)) {
    const titleSize = state.style.titleSize;
    pushText(texts, cmds, {
      id: "title",
      x: layout.width / 2 + state.titleDx,
      y: Math.max(titleSize * 0.62, 14) + state.titleDy,
      runs: parseMathRuns(state.title.trim()),
      size: titleSize,
      anchor: "middle",
    });
  }

  for (const frame of layout.frames) {
    paintAxes(state, frame, cmds, texts, compact);
    if (compact && state.showPanelNumbers) {
      pushText(texts, cmds, {
        id: `panel:${frame.panel}`,
        x: frame.plotLeft - 6,
        y: frame.plotTop - 8,
        runs: parseMathRuns(`(${frame.panel + 1})`),
        size: Math.max(13, state.style.fontSize),
        anchor: "end",
      });
    }
  }

  const cloudPts = state.points.filter((p) => p.role === "cloud");
  const namedPts = state.points.filter((p) => p.role === "named");
  const markPts = state.points.filter((p) => p.role === "mark");

  for (const p of cloudPts) {
    const frame = frameForPanel(layout, p.panel);
    if (!frame || !inDataRect(p.x, p.y, frame)) continue;
    cmds.push({
      t: "dot",
      x: canvasXFromValue(p.x, frame),
      y: canvasYFromValue(p.y, frame),
      r: state.style.pointRadius,
      stroke: state.pointColor,
    });
  }

  for (const p of namedPts) {
    const frame = frameForPanel(layout, p.panel);
    if (!frame || !inDataRect(p.x, p.y, frame)) continue;
    const px = canvasXFromValue(p.x, frame);
    const py = canvasYFromValue(p.y, frame);
    cmds.push({
      t: "dot",
      x: px,
      y: py,
      r: state.style.pointRadius,
      stroke: state.pointColor,
    });
    if (p.label.trim()) {
      pushText(texts, cmds, {
        id: `point:${p.id}:label`,
        x: px + p.labelDx,
        y: py + p.labelDy,
        runs: parseNameRuns(p.label.trim()),
        size: state.style.pointLabelSize,
        anchor: "middle",
      });
    }
  }

  for (const p of markPts) {
    const frame = frameForPanel(layout, p.panel);
    if (!frame || !inDataRect(p.x, p.y, frame)) continue;
    const px = canvasXFromValue(p.x, frame);
    const py = canvasYFromValue(p.y, frame);
    cmds.push({
      t: "dot",
      x: px,
      y: py,
      r: state.style.markRadius,
      stroke: state.markColor,
    });
    if (p.label.trim()) {
      pushText(texts, cmds, {
        id: `point:${p.id}:label`,
        x: px + p.labelDx,
        y: py + p.labelDy,
        runs: parseNameRuns(p.label.trim()),
        size: state.style.pointLabelSize,
        anchor: "middle",
      });
    }
  }

  return {
    width: layout.width,
    height: layout.height,
    cmds,
    texts,
    layout,
  };
}

export function pointCanvasPos(
  state: ScatterState,
  layout: ScatterLayout,
  pointId: string,
): { x: number; y: number } | null {
  const p = state.points.find((pt) => pt.id === pointId);
  if (!p) return null;
  const frame = frameForPanel(layout, p.panel);
  if (!frame) return null;
  return {
    x: canvasXFromValue(p.x, frame),
    y: canvasYFromValue(p.y, frame),
  };
}
