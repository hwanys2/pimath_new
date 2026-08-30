import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import {
  graphEquationText,
  graphStrokeWidth,
  tickValues,
  type CoordPlaneState,
  type InverseGraph,
  type PlaneGraph,
} from "@/lib/diagrams/coordinate-plane/model";
import type {
  DiagramScene,
  SceneCmd,
  SceneText,
  Vec,
} from "@/lib/diagrams/scene";

export const SCENE_WIDTH = 560;
export const SCENE_HEIGHT = 560;

export type PlaneLayout = {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  yBreak: boolean;
  yBreakTo: number;
  stubH: number;
  gapH: number;
  dataTop: number;
  dataBottom: number;
  originX: number;
  originY: number;
};

export type CoordPlaneScene = DiagramScene & {
  layout: PlaneLayout;
};

export function getPlaneLayout(state: CoordPlaneState): PlaneLayout {
  const pad = Math.max(40, state.style.padding);
  let plotLeft = pad;
  let plotRight = SCENE_WIDTH - pad;
  let plotTop = pad;
  let plotBottom = SCENE_HEIGHT - pad;
  const yBreak = state.yBreak && state.yBreakTo > state.yMin + 1e-6;
  if (state.equalScale && !yBreak) {
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;
    const xSpan = state.xMax - state.xMin;
    const ySpan = state.yMax - state.yMin;
    if (xSpan > 1e-9 && ySpan > 1e-9) {
      const unit = Math.min(plotW / xSpan, plotH / ySpan);
      const usedW = xSpan * unit;
      const usedH = ySpan * unit;
      plotLeft += (plotW - usedW) / 2;
      plotRight = plotLeft + usedW;
      plotTop += (plotH - usedH) / 2;
      plotBottom = plotTop + usedH;
    }
  }
  const stubH = yBreak ? 16 : 0;
  const gapH = yBreak ? 22 : 0;
  const dataBottom = yBreak ? plotBottom - stubH - gapH : plotBottom;
  const dataTop = plotTop;
  const originX = canvasX(0, {
    plotLeft,
    plotRight,
    xMin: state.xMin,
    xMax: state.xMax,
  });
  const originY = yBreak ? plotBottom : canvasYNoBreak(0, {
    plotTop,
    plotBottom,
    yMin: state.yMin,
    yMax: state.yMax,
  });
  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    xMin: state.xMin,
    xMax: state.xMax,
    yMin: state.yMin,
    yMax: state.yMax,
    yBreak,
    yBreakTo: state.yBreakTo,
    stubH,
    gapH,
    dataTop,
    dataBottom,
    originX: clamp(originX, plotLeft, plotRight),
    originY: clamp(originY, plotTop, plotBottom),
  };
}

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

function canvasX(
  x: number,
  layout: Pick<PlaneLayout, "plotLeft" | "plotRight" | "xMin" | "xMax">,
): number {
  const span = layout.xMax - layout.xMin;
  if (span <= 1e-9) return (layout.plotLeft + layout.plotRight) / 2;
  const t = (x - layout.xMin) / span;
  return layout.plotLeft + t * (layout.plotRight - layout.plotLeft);
}

function canvasYNoBreak(
  y: number,
  layout: Pick<PlaneLayout, "plotTop" | "plotBottom" | "yMin" | "yMax">,
): number {
  const span = layout.yMax - layout.yMin;
  if (span <= 1e-9) return (layout.plotTop + layout.plotBottom) / 2;
  const t = (y - layout.yMin) / span;
  return layout.plotBottom - t * (layout.plotBottom - layout.plotTop);
}

export function canvasXFromValue(x: number, layout: PlaneLayout): number {
  return canvasX(x, layout);
}

export function canvasYFromValue(y: number, layout: PlaneLayout): number {
  if (!layout.yBreak) return canvasYNoBreak(y, layout);
  if (y + 1e-9 < layout.yBreakTo) {
    // Only the origin stub represents values below the break.
    const t = (y - layout.yMin) / Math.max(layout.yBreakTo - layout.yMin, 1e-9);
    return layout.plotBottom - t * layout.stubH;
  }
  const span = layout.yMax - layout.yBreakTo;
  if (span <= 1e-9) return layout.dataBottom;
  const t = (y - layout.yBreakTo) / span;
  return layout.dataBottom - t * (layout.dataBottom - layout.dataTop);
}

export function valueFromCanvasX(x: number, layout: PlaneLayout): number {
  const span = layout.plotRight - layout.plotLeft;
  if (span <= 1e-9) return layout.xMin;
  const t = (x - layout.plotLeft) / span;
  return layout.xMin + t * (layout.xMax - layout.xMin);
}

export function valueFromCanvasY(y: number, layout: PlaneLayout): number {
  if (!layout.yBreak) {
    const span = layout.plotBottom - layout.plotTop;
    if (span <= 1e-9) return layout.yMin;
    const t = (layout.plotBottom - y) / span;
    return layout.yMin + t * (layout.yMax - layout.yMin);
  }
  if (y > layout.dataBottom + 1e-9) {
    if (layout.stubH < 1e-6) return layout.yMin;
    const t = (layout.plotBottom - y) / layout.stubH;
    return layout.yMin + t * (layout.yBreakTo - layout.yMin);
  }
  const span = layout.dataBottom - layout.dataTop;
  if (span <= 1e-9) return layout.yBreakTo;
  const t = (layout.dataBottom - y) / span;
  return layout.yBreakTo + t * (layout.yMax - layout.yBreakTo);
}

export function dataYMin(layout: PlaneLayout): number {
  return layout.yBreak ? layout.yBreakTo : layout.yMin;
}

function pushText(
  texts: SceneText[],
  cmds: SceneCmd[],
  text: SceneText,
): void {
  texts.push(text);
  cmds.push({ t: "text", text });
}

export function sampleInverse(
  graph: InverseGraph,
  layout: PlaneLayout,
): Vec[][] {
  const a = graph.a;
  if (!Number.isFinite(a) || Math.abs(a) < 1e-12) return [];
  const yLo = dataYMin(layout);
  const yHi = layout.yMax;
  const xLo = graph.bothBranches ? layout.xMin : Math.max(layout.xMin, 0.02);
  const xHi = layout.xMax;
  const skip = Math.max(Math.abs(a) / Math.max(yHi - yLo, 1) * 0.04, 0.08);
  const n = 280;
  const branches: Vec[][] = [];
  let current: Vec[] = [];

  function flush() {
    if (current.length >= 2) branches.push(current);
    current = [];
  }

  for (let i = 0; i <= n; i += 1) {
    const x = xLo + ((xHi - xLo) * i) / n;
    if (Math.abs(x) < skip) {
      flush();
      continue;
    }
    const y = a / x;
    if (!Number.isFinite(y) || y < yLo - (yHi - yLo) || y > yHi + (yHi - yLo)) {
      flush();
      continue;
    }
    const cy = clampYForDraw(y, layout);
    if (cy == null) {
      flush();
      continue;
    }
    current.push({ x: canvasXFromValue(x, layout), y: cy });
  }
  flush();
  return branches;
}

function clampYForDraw(y: number, layout: PlaneLayout): number | null {
  if (layout.yBreak && y + 1e-9 < layout.yBreakTo) return null;
  if (y < layout.yMin - 1e-6 || y > layout.yMax + 1e-6) return null;
  return canvasYFromValue(y, layout);
}

function clipDirect(a: number, layout: PlaneLayout): Vec[] | null {
  const yLo = dataYMin(layout);
  const yHi = layout.yMax;
  const xLo = layout.xMin;
  const xHi = layout.xMax;
  const pts: { x: number; y: number }[] = [];

  function consider(x: number, y: number) {
    if (x < xLo - 1e-8 || x > xHi + 1e-8) return;
    if (y < yLo - 1e-8 || y > yHi + 1e-8) return;
    if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < 1e-6)) return;
    pts.push({ x, y });
  }

  consider(xLo, a * xLo);
  consider(xHi, a * xHi);
  if (Math.abs(a) > 1e-12) {
    consider(yLo / a, yLo);
    consider(yHi / a, yHi);
  } else {
    consider(xLo, 0);
    consider(xHi, 0);
  }

  if (pts.length < 2) return null;
  pts.sort((p, q) => p.x - q.x || p.y - q.y);
  return [
    { x: canvasXFromValue(pts[0]!.x, layout), y: canvasYFromValue(pts[0]!.y, layout) },
    {
      x: canvasXFromValue(pts[pts.length - 1]!.x, layout),
      y: canvasYFromValue(pts[pts.length - 1]!.y, layout),
    },
  ];
}

function defaultGraphLabelPos(
  graph: PlaneGraph,
  layout: PlaneLayout,
): Vec {
  if (graph.t === "direct") {
    const x = layout.xMax * 0.62;
    const y = graph.a * x;
    const clampedY = Math.min(layout.yMax * 0.85, Math.max(dataYMin(layout) + 0.4, y));
    const useX = Math.abs(graph.a) > 1e-9 ? clampedY / graph.a : x;
    return {
      x: canvasXFromValue(Math.min(layout.xMax * 0.78, Math.max(layout.xMin * 0.2, useX)), layout),
      y: canvasYFromValue(clampedY, layout),
    };
  }
  if (graph.t === "inverse") {
    const x = Math.max(Math.sqrt(Math.abs(graph.a)) * 1.15, layout.xMax * 0.28);
    const y = graph.a / x;
    return {
      x: canvasXFromValue(Math.min(x, layout.xMax * 0.72), layout),
      y: canvasYFromValue(Math.min(Math.max(y, dataYMin(layout) + 0.3), layout.yMax * 0.82), layout),
    };
  }
  const last = graph.vertices[graph.vertices.length - 1];
  if (!last) {
    return { x: (layout.plotLeft + layout.plotRight) / 2, y: layout.plotTop + 20 };
  }
  return {
    x: canvasXFromValue(last.x, layout),
    y: canvasYFromValue(last.y, layout),
  };
}

function roundedPolylineCmds(
  vertices: Vec[],
  color: string,
  width: number,
): SceneCmd[] {
  if (vertices.length < 2) return [];
  if (vertices.length === 2) {
    return [{ t: "polyline", pts: vertices, stroke: color, width }];
  }
  const cmds: SceneCmd[] = [];
  const radius = 18;
  let prev = vertices[0]!;
  for (let i = 1; i < vertices.length - 1; i += 1) {
    const curr = vertices[i]!;
    const next = vertices[i + 1]!;
    const inDx = curr.x - prev.x;
    const inDy = curr.y - prev.y;
    const outDx = next.x - curr.x;
    const outDy = next.y - curr.y;
    const inLen = Math.hypot(inDx, inDy) || 1;
    const outLen = Math.hypot(outDx, outDy) || 1;
    const r = Math.min(radius, inLen * 0.42, outLen * 0.42);
    const p1 = {
      x: curr.x - (inDx / inLen) * r,
      y: curr.y - (inDy / inLen) * r,
    };
    const p2 = {
      x: curr.x + (outDx / outLen) * r,
      y: curr.y + (outDy / outLen) * r,
    };
    cmds.push({
      t: "line",
      x1: prev.x,
      y1: prev.y,
      x2: p1.x,
      y2: p1.y,
      stroke: color,
      width,
    });
    cmds.push({
      t: "quad",
      x1: p1.x,
      y1: p1.y,
      cx: curr.x,
      cy: curr.y,
      x2: p2.x,
      y2: p2.y,
      stroke: color,
      width,
    });
    prev = p2;
  }
  const last = vertices[vertices.length - 1]!;
  cmds.push({
    t: "line",
    x1: prev.x,
    y1: prev.y,
    x2: last.x,
    y2: last.y,
    stroke: color,
    width,
  });
  return cmds;
}

function axisBreakWaves(cx: number, cy: number): SceneCmd[] {
  const size = 9;
  const ang = -Math.PI / 4.2;
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

export function buildCoordPlaneScene(state: CoordPlaneState): CoordPlaneScene {
  const layout = getPlaneLayout(state);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const grid = state.style.gridColor;
  const lw = state.style.lineWidth;
  const xTicks = tickValues(state.xMin, state.xMax, state.xTick);
  const yTicks = tickValues(
    layout.yBreak ? state.yBreakTo : state.yMin,
    state.yMax,
    state.yTick,
  );

  if (state.showGrid) {
    for (const x of xTicks) {
      const cx = canvasXFromValue(x, layout);
      cmds.push({
        t: "line",
        x1: cx,
        y1: layout.dataTop,
        x2: cx,
        y2: layout.yBreak ? layout.dataBottom : layout.plotBottom,
        stroke: grid,
        width: 0.85,
        id: "grid",
      });
    }
    for (const y of yTicks) {
      const cy = canvasYFromValue(y, layout);
      cmds.push({
        t: "line",
        x1: layout.plotLeft,
        y1: cy,
        x2: layout.plotRight,
        y2: cy,
        stroke: grid,
        width: 0.85,
        id: "grid",
      });
    }
  }

  const ox = layout.originX;
  const oy = layout.originY;
  const xEnd = layout.plotRight;
  const yEnd = layout.plotTop;
  const xStart = Math.min(layout.plotLeft, ox);
  const yStart = Math.max(layout.plotBottom, oy);

  cmds.push({
    t: "line",
    x1: xStart,
    y1: oy,
    x2: xEnd,
    y2: oy,
    width: lw,
  });
  if (layout.yBreak) {
    cmds.push({
      t: "line",
      x1: ox,
      y1: yStart,
      x2: ox,
      y2: layout.plotBottom - layout.stubH,
      width: lw,
    });
    cmds.push(...axisBreakWaves(ox, layout.plotBottom - layout.stubH - layout.gapH / 2));
    cmds.push({
      t: "line",
      x1: ox,
      y1: layout.dataBottom,
      x2: ox,
      y2: yEnd,
      width: lw,
    });
  } else {
    cmds.push({
      t: "line",
      x1: ox,
      y1: yStart,
      x2: ox,
      y2: yEnd,
      width: lw,
    });
  }

  if (state.showArrows) {
    cmds.push({
      t: "arrowhead",
      x: xEnd,
      y: oy,
      ux: 1,
      uy: 0,
      size: 9,
    });
    cmds.push({
      t: "arrowhead",
      x: ox,
      y: yEnd,
      ux: 0,
      uy: -1,
      size: 9,
    });
  }

  if (state.showTicks || state.showTickLabels) {
    for (const x of xTicks) {
      if (Math.abs(x) < 1e-9) continue;
      const cx = canvasXFromValue(x, layout);
      if (state.showTicks) {
        cmds.push({
          t: "line",
          x1: cx,
          y1: oy - 4,
          x2: cx,
          y2: oy + 4,
          width: lw,
          id: "tick",
        });
      }
      const every = state.xLabelEvery;
      const k = Math.round(x / state.xTick);
      if (state.showTickLabels && k % every === 0) {
        pushText(texts, cmds, {
          id: `tick-x:${x}`,
          x: cx,
          y: oy + 14,
          runs: parseMathRuns(String(x)),
          size: state.style.fontSize,
          anchor: "middle",
        });
      }
    }
    for (const y of yTicks) {
      if (Math.abs(y) < 1e-9) continue;
      const cy = canvasYFromValue(y, layout);
      if (state.showTicks) {
        cmds.push({
          t: "line",
          x1: ox - 4,
          y1: cy,
          x2: ox + 4,
          y2: cy,
          width: lw,
          id: "tick",
        });
      }
      const every = state.yLabelEvery;
      const k = Math.round(y / state.yTick);
      if (state.showTickLabels && k % every === 0) {
        pushText(texts, cmds, {
          id: `tick-y:${y}`,
          x: ox - 10,
          y: cy,
          runs: parseMathRuns(String(y)),
          size: state.style.fontSize,
          anchor: "end",
        });
      }
    }
  }

  const dash = "#888888";
  for (const point of state.points) {
    const px = canvasXFromValue(point.x, layout);
    const py = canvasYFromValue(point.y, layout);
    if (point.dropX) {
      cmds.push({
        t: "line",
        x1: px,
        y1: py,
        x2: px,
        y2: oy,
        dashed: true,
        stroke: dash,
        width: 1.15,
      });
    }
    if (point.dropY) {
      cmds.push({
        t: "line",
        x1: px,
        y1: py,
        x2: ox,
        y2: py,
        dashed: true,
        stroke: dash,
        width: 1.15,
      });
    }
  }

  for (const graph of state.graphs) {
    const width = graphStrokeWidth(graph, state.style.graphWidth);
    if (graph.t === "direct") {
      const seg = clipDirect(graph.a, layout);
      if (seg) cmds.push({ t: "polyline", pts: seg, stroke: graph.color, width });
    } else if (graph.t === "inverse") {
      for (const branch of sampleInverse(graph, layout)) {
        cmds.push({ t: "polyline", pts: branch, stroke: graph.color, width });
      }
    } else {
      const pts = graph.vertices.map((v) => ({
        x: canvasXFromValue(v.x, layout),
        y: canvasYFromValue(v.y, layout),
      }));
      if (graph.rounded) cmds.push(...roundedPolylineCmds(pts, graph.color, width));
      else cmds.push({ t: "polyline", pts, stroke: graph.color, width });
    }
  }

  for (const point of state.points) {
    const px = canvasXFromValue(point.x, layout);
    const py = canvasYFromValue(point.y, layout);
    if (point.showDot) {
      cmds.push({ t: "dot", x: px, y: py, r: state.style.pointRadius });
    }
    if (point.showName && point.name.trim()) {
      pushText(texts, cmds, {
        id: `point:${point.id}:name`,
        x: px + point.labelDx,
        y: py + point.labelDy,
        runs: parseNameRuns(point.name.trim()),
        size: state.style.pointLabelSize,
        anchor: "middle",
      });
    }
    if (point.axisMarkX) {
      const already =
        state.showTickLabels &&
        Math.abs(Math.round(point.x / state.xTick) % state.xLabelEvery) < 1e-9 &&
        Math.abs(point.x) > 1e-9;
      if (!already) {
        pushText(texts, cmds, {
          id: `point:${point.id}:axisX`,
          x: px,
          y: oy + 14,
          runs: parseMathRuns(String(point.x)),
          size: state.style.fontSize,
          anchor: "middle",
        });
      }
    }
    if (point.axisMarkY) {
      const already =
        state.showTickLabels &&
        Math.abs(Math.round(point.y / state.yTick) % state.yLabelEvery) < 1e-9 &&
        Math.abs(point.y) > 1e-9;
      if (!already) {
        pushText(texts, cmds, {
          id: `point:${point.id}:axisY`,
          x: ox - 10,
          y: py,
          runs: parseMathRuns(String(point.y)),
          size: state.style.fontSize,
          anchor: "end",
        });
      }
    }
  }

  for (const graph of state.graphs) {
    const eq = graphEquationText(graph);
    if (!eq) continue;
    const pos = defaultGraphLabelPos(graph, layout);
    pushText(texts, cmds, {
      id: `graph:${graph.id}:eq`,
      x: pos.x + graph.labelDx,
      y: pos.y + graph.labelDy,
      runs: parseMathRuns(eq),
      size: state.style.equationSize,
      anchor: "middle",
    });
  }

  if (state.showOrigin && state.originLabel.trim()) {
    pushText(texts, cmds, {
      id: "origin",
      x: ox - 12,
      y: oy + 14,
      runs: parseNameRuns(state.originLabel.trim()),
      size: state.style.pointLabelSize,
      anchor: "middle",
    });
  }

  if (state.xAxisLabel.trim()) {
    const nameSize = state.style.axisNameSize;
    pushText(texts, cmds, {
      id: "axis-x",
      x: xEnd - 2 + state.xAxisLabelDx,
      y: oy + 12 + state.style.fontSize * 0.95 + state.xAxisLabelDy,
      runs: parseMathRuns(state.xAxisLabel.trim()),
      size: nameSize,
      anchor: "end",
    });
  }
  if (state.yAxisLabel.trim()) {
    const nameSize = state.style.axisNameSize;
    if (state.yLabelVertical) {
      pushText(texts, cmds, {
        id: "axis-y",
        x: ox - 10 + state.yAxisLabelDx,
        y: yEnd + 6 + state.yAxisLabelDy,
        runs: parseMathRuns(state.yAxisLabel.trim()),
        size: nameSize,
        anchor: "end",
        rotate: -Math.PI / 2,
      });
    } else {
      pushText(texts, cmds, {
        id: "axis-y",
        x: ox - 8 + state.yAxisLabelDx,
        y: yEnd + nameSize * 0.48 + state.yAxisLabelDy,
        runs: parseMathRuns(state.yAxisLabel.trim()),
        size: nameSize,
        anchor: "end",
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

export function snapCoord(
  value: number,
  step: number,
): number {
  if (step <= 1e-9) return value;
  return Math.round(value / step) * step;
}
