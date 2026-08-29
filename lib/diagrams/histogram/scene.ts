import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import type { DiagramScene, SceneCmd, SceneText, Vec } from "@/lib/diagrams/scene";
import {
  classBound,
  classBounds,
  classEnd,
  classMid,
  formatTick,
  polygonVertices,
  seriesPeakIndex,
  tickValues,
  type HistogramState,
} from "@/lib/diagrams/histogram/model";

export const SCENE_WIDTH = 560;
export const SCENE_HEIGHT = 420;

export type HistLayout = {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotTopInner: number;
  plotBottom: number;
  originX: number;
  originY: number;
  dataLeft: number;
  dataRight: number;
  xMin: number;
  xMax: number;
  yMax: number;
  xBreak: boolean;
  stubW: number;
  gapW: number;
};

export type HistogramScene = DiagramScene & {
  layout: HistLayout;
};

export function dataXRange(state: HistogramState): { xMin: number; xMax: number } {
  return { xMin: state.classStart, xMax: classEnd(state) };
}

export function getHistLayout(state: HistogramState): HistLayout {
  const pad = Math.max(40, state.style.padding);
  const plotLeft = pad;
  const plotRight = SCENE_WIDTH - Math.max(36, pad * 0.55);
  const plotTop = Math.max(28, pad * 0.55);
  const plotTopInner = plotTop + 10;
  const plotBottom = SCENE_HEIGHT - Math.max(28, pad * 0.48);
  const range = dataXRange(state);
  const xBreak = state.xBreak && range.xMin > 1e-9;
  const stubW = xBreak ? 16 : 0;
  const gapW = xBreak ? 22 : 0;
  const originX = plotLeft;
  const dataLeft = xBreak ? plotLeft + stubW + gapW : plotLeft;
  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    plotLeft,
    plotRight,
    plotTop,
    plotTopInner,
    plotBottom,
    originX,
    originY: plotBottom,
    dataLeft,
    dataRight: plotRight,
    xMin: range.xMin,
    xMax: range.xMax,
    yMax: state.yMax,
    xBreak,
    stubW,
    gapW,
  };
}

function clampCanvasX(x: number): number {
  return Math.max(6, Math.min(SCENE_WIDTH - 8, x));
}

export function canvasXFromValue(x: number, layout: HistLayout): number {
  const span = Math.max(layout.xMax - layout.xMin, 1e-9);
  const t = (x - layout.xMin) / span;
  return layout.dataLeft + t * (layout.dataRight - layout.dataLeft);
}

export function canvasYFromValue(y: number, layout: HistLayout): number {
  const t = Math.max(0, Math.min(1, y / Math.max(layout.yMax, 1e-9)));
  return layout.plotBottom - t * (layout.plotBottom - layout.plotTopInner);
}

export function valueFromCanvasX(cx: number, layout: HistLayout): number {
  const span = Math.max(layout.dataRight - layout.dataLeft, 1e-9);
  const t = (cx - layout.dataLeft) / span;
  return layout.xMin + t * (layout.xMax - layout.xMin);
}

export function valueFromCanvasY(cy: number, layout: HistLayout): number {
  const span = Math.max(layout.plotBottom - layout.plotTopInner, 1e-9);
  const t = (layout.plotBottom - cy) / span;
  return t * layout.yMax;
}

function pushText(texts: SceneText[], cmds: SceneCmd[], text: SceneText) {
  texts.push(text);
  cmds.push({ t: "text", text });
}

function axisBreakWaves(cx: number, cy: number): SceneCmd[] {
  const size = 9;
  const ang = Math.PI / 4.2;
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

function minorTick(step: number): number {
  return step > 1e-9 ? step / 2 : step;
}

export function buildHistogramScene(state: HistogramState): HistogramScene {
  const layout = getHistLayout(state);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const grid = state.style.gridColor;
  const minor = "#e6e4e0";
  const lw = state.style.lineWidth;
  const bounds = classBounds(state);
  const yMajor = tickValues(0, state.yMax, state.yTick);
  const yMinor = tickValues(0, state.yMax, minorTick(state.yTick));

  if (state.showGrid) {
    for (const y of yMinor) {
      if (Math.abs(y) < 1e-9) continue;
      const cy = canvasYFromValue(y, layout);
      const isMajor = yMajor.some((m) => Math.abs(m - y) < 1e-8);
      cmds.push({
        t: "line",
        x1: layout.dataLeft,
        y1: cy,
        x2: layout.plotRight,
        y2: cy,
        stroke: isMajor ? grid : minor,
        width: 0.85,
        id: "grid",
      });
    }
    for (const x of bounds) {
      const cx = canvasXFromValue(x, layout);
      cmds.push({
        t: "line",
        x1: cx,
        y1: layout.plotTopInner,
        x2: cx,
        y2: layout.plotBottom,
        stroke: grid,
        width: 0.85,
        id: "grid",
      });
    }
    if (state.kind === "polygon") {
      for (let i = 0; i < state.classCount; i += 1) {
        const cx = canvasXFromValue(classMid(state, i), layout);
        cmds.push({
          t: "line",
          x1: cx,
          y1: layout.plotTopInner,
          x2: cx,
          y2: layout.plotBottom,
          stroke: minor,
          width: 0.7,
          id: "grid",
        });
      }
    }
  }

  const ox = layout.originX;
  const oy = layout.originY;
  const dummyLeftX = clampCanvasX(
    canvasXFromValue(state.classStart - state.classWidth / 2, layout),
  );
  const dummyRightX = clampCanvasX(
    canvasXFromValue(classEnd(state) + state.classWidth / 2, layout),
  );
  const axisLeft =
    state.kind === "polygon" && !layout.xBreak
      ? Math.min(layout.plotLeft, dummyLeftX)
      : layout.plotLeft;
  const axisRight =
    state.kind === "polygon"
      ? Math.min(SCENE_WIDTH - 10, Math.max(layout.plotRight, dummyRightX))
      : layout.plotRight;

  if (layout.xBreak) {
    cmds.push({
      t: "line",
      x1: ox,
      y1: oy,
      x2: ox + layout.stubW,
      y2: oy,
      width: lw,
    });
    cmds.push(
      ...axisBreakWaves(
        ox + layout.stubW + layout.gapW / 2,
        oy,
      ),
    );
    cmds.push({
      t: "line",
      x1:
        state.kind === "polygon"
          ? Math.min(layout.dataLeft, dummyLeftX)
          : layout.dataLeft,
      y1: oy,
      x2: axisRight,
      y2: oy,
      width: lw,
    });
  } else {
    cmds.push({
      t: "line",
      x1: axisLeft,
      y1: oy,
      x2: axisRight,
      y2: oy,
      width: lw,
    });
  }

  cmds.push({
    t: "line",
    x1: ox,
    y1: oy,
    x2: ox,
    y2: layout.plotTop,
    width: lw,
  });

  cmds.push({
    t: "arrowhead",
    x: layout.plotRight,
    y: oy,
    ux: 1,
    uy: 0,
    size: 8,
  });
  cmds.push({
    t: "arrowhead",
    x: ox,
    y: layout.plotTop,
    ux: 0,
    uy: -1,
    size: 8,
  });

  for (const y of yMajor) {
    if (Math.abs(y) < 1e-9) continue;
    const cy = canvasYFromValue(y, layout);
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
      id: `tick-y:${y}`,
      x: ox - 8,
      y: cy,
      runs: parseMathRuns(formatTick(y)),
      size: state.style.fontSize,
      anchor: "end",
    });
  }

  if (layout.xBreak) {
    pushText(texts, cmds, {
      id: "tick-x:0",
      x: ox,
      y: oy + 14,
      runs: parseMathRuns("0"),
      size: state.style.fontSize,
      anchor: "middle",
    });
  }

  for (const x of bounds) {
    if (layout.xBreak && Math.abs(x) < 1e-9) continue;
    const cx = canvasXFromValue(x, layout);
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
      id: `tick-x:${x}`,
      x: cx,
      y: oy + 14,
      runs: parseMathRuns(formatTick(x)),
      size: state.style.fontSize,
      anchor: "middle",
    });
  }

  if (state.kind === "histogram") {
    for (const series of [...state.series].reverse()) {
      for (let i = 0; i < state.classCount; i += 1) {
        const freq = series.frequencies[i] ?? 0;
        const x0 = canvasXFromValue(classBound(state, i), layout);
        const x1 = canvasXFromValue(classBound(state, i + 1), layout);
        const y0 = oy;
        const y1 = canvasYFromValue(freq, layout);
        const pts = [
          { x: x0, y: y0 },
          { x: x0, y: y1 },
          { x: x1, y: y1 },
          { x: x1, y: y0 },
        ];
        cmds.push({ t: "polygon", points: pts, fill: series.fill });
        cmds.push({
          t: "polyline",
          pts: [
            { x: x0, y: y0 },
            { x: x0, y: y1 },
            { x: x1, y: y1 },
            { x: x1, y: y0 },
          ],
          stroke: series.color,
          width: lw,
          id: "bar",
        });
      }
    }
  } else {
    for (const series of [...state.series].reverse()) {
      const verts = polygonVertices(state, series.frequencies);
      const pts = verts.map((v, i) => {
        const x = canvasXFromValue(v.x, layout);
        const isDummy = i === 0 || i === verts.length - 1;
        return {
          x: isDummy ? clampCanvasX(x) : x,
          y: canvasYFromValue(v.y, layout),
        };
      });
      cmds.push({
        t: "polyline",
        pts,
        stroke: series.color,
        width: state.style.graphWidth,
      });
      if (state.showPoints) {
        for (const p of pts) {
          cmds.push({
            t: "dot",
            x: p.x,
            y: p.y,
            r: state.style.pointRadius,
            stroke: "#111111",
          });
        }
      }
    }
  }

  for (const series of state.series) {
    const name = series.name.trim();
    if (!name) continue;
    const idx = seriesPeakIndex(series.frequencies);
    const px = canvasXFromValue(classMid(state, idx), layout);
    const py = canvasYFromValue(series.frequencies[idx] ?? 0, layout);
    pushText(texts, cmds, {
      id: `series:${series.id}:name`,
      x: px + series.labelDx,
      y: py + series.labelDy,
      runs: parseNameRuns(name),
      size: state.style.pointLabelSize,
      anchor: "middle",
    });
  }

  if (state.xAxisLabel.trim()) {
    pushText(texts, cmds, {
      id: "axis-x",
      x: Math.min(layout.plotRight + 6, SCENE_WIDTH - 8),
      y: oy + 1,
      runs: parseMathRuns(state.xAxisLabel.trim()),
      size: state.style.pointLabelSize,
      anchor: "start",
    });
  }
  if (state.yAxisLabel.trim()) {
    pushText(texts, cmds, {
      id: "axis-y",
      x: ox + 2,
      y: Math.max(layout.plotTop - 4, 14),
      runs: parseMathRuns(state.yAxisLabel.trim()),
      size: state.style.pointLabelSize,
      anchor: "middle",
    });
  }

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
  };
}

export function classIndexAtX(x: number, state: HistogramState): number | null {
  if (x + 1e-9 < state.classStart) return null;
  if (x >= classEnd(state) - 1e-12) {
    if (Math.abs(x - classEnd(state)) < 1e-9) return state.classCount - 1;
    return null;
  }
  const i = Math.floor((x - state.classStart) / state.classWidth);
  if (i < 0 || i >= state.classCount) return null;
  return i;
}
