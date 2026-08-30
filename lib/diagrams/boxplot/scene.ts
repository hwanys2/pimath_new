import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import type { DiagramScene, SceneCmd, SceneText } from "@/lib/diagrams/scene";
import {
  formatTick,
  GRAPH_PINK,
  hasChartTitle,
  namedSeries,
  STAT_KEYS,
  tickValues,
  type BoxPlotState,
  type BoxSeries,
  type StatKey,
} from "@/lib/diagrams/boxplot/model";

export const SCENE_WIDTH = 560;
export const SCENE_HEIGHT = 456;
const CORNER_INSET = 40;

export type BoxBand = {
  seriesId: string;
  center: number;
  half: number;
  cap: number;
};

export type BoxLayout = {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  axisMin: number;
  axisMax: number;
  orientation: BoxPlotState["orientation"];
  bands: BoxBand[];
};

export type BoxPlotScene = DiagramScene & {
  layout: BoxLayout;
};

export function estimateLabelWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0x2ff ? size * 0.95 : size * 0.58;
  }
  return w;
}

export function pillSize(name: string, size: number): { w: number; h: number } {
  const h = Math.max(22, size * 1.55);
  const w = Math.max(h, estimateLabelWidth(name, size) + size * 1.15);
  return { w, h };
}

export function getBoxLayout(state: BoxPlotState): BoxLayout {
  const pad = Math.max(36, state.style.padding);
  const nameSize = state.style.axisNameSize;
  const fontSize = state.style.fontSize;
  const titleSize = state.style.titleSize;
  const named = namedSeries(state);
  const maxPill = named.reduce(
    (acc, s) => {
      const p = pillSize(s.name.trim(), state.style.pointLabelSize);
      return { w: Math.max(acc.w, p.w), h: Math.max(acc.h, p.h) };
    },
    { w: 0, h: 0 },
  );
  const titleBand = hasChartTitle(state)
    ? Math.max(26, titleSize * 1.2 + 8)
    : 0;
  const arrowBand = state.showValueArrows ? 12 : 0;
  const unit = state.axisLabel.trim();
  const unitW = unit ? estimateLabelWidth(unit, nameSize) : 0;
  const tickW = estimateLabelWidth(formatTick(state.axisMax), fontSize);

  let plotLeft: number;
  let plotRight: number;
  let plotTop: number;
  let plotBottom: number;

  if (state.orientation === "horizontal") {
    const leftNeed =
      named.length > 0 ? maxPill.w + 14 : Math.max(8, pad * 0.2);
    plotLeft = Math.max(CORNER_INSET, pad * 0.55, leftNeed);
    plotRight = SCENE_WIDTH - Math.max(CORNER_INSET, pad * 0.38, unitW + 18);
    plotTop =
      (hasChartTitle(state) ? titleBand : Math.max(16, CORNER_INSET * 0.45)) +
      arrowBand +
      6;
    const tickDrop = 12 + fontSize * 0.75;
    plotBottom = SCENE_HEIGHT - Math.max(CORNER_INSET, pad * 0.42, tickDrop + 10);
  } else {
    plotLeft = Math.max(CORNER_INSET, pad * 0.55, tickW + 16);
    plotRight = SCENE_WIDTH - Math.max(CORNER_INSET, pad * 0.38);
    const topUnit = unit ? nameSize + 8 : 0;
    plotTop =
      (hasChartTitle(state) ? titleBand : Math.max(14, CORNER_INSET * 0.35)) +
      Math.max(topUnit, arrowBand) +
      8;
    const pillDrop = named.length > 0 ? maxPill.h + 16 : 0;
    plotBottom =
      SCENE_HEIGHT - Math.max(CORNER_INSET, pad * 0.38, pillDrop + 12);
  }

  const n = Math.max(1, state.series.length);
  const bands: BoxBand[] = [];
  if (state.orientation === "horizontal") {
    const span = Math.max(40, plotBottom - plotTop);
    const band = span / n;
    const half = Math.min(band * 0.3, n === 1 ? 42 : 34);
    const cap = half * 0.52;
    state.series.forEach((s, i) => {
      bands.push({
        seriesId: s.id,
        center: plotTop + (i + 0.5) * band,
        half,
        cap,
      });
    });
  } else {
    const span = Math.max(40, plotRight - plotLeft);
    const band = span / n;
    const half = Math.min(band * 0.3, n === 1 ? 42 : 34);
    const cap = half * 0.52;
    state.series.forEach((s, i) => {
      bands.push({
        seriesId: s.id,
        center: plotLeft + (i + 0.5) * band,
        half,
        cap,
      });
    });
  }

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    axisMin: state.axisMin,
    axisMax: state.axisMax,
    orientation: state.orientation,
    bands,
  };
}

export function canvasFromValue(value: number, layout: BoxLayout): number {
  const span = Math.max(layout.axisMax - layout.axisMin, 1e-9);
  const t = (value - layout.axisMin) / span;
  if (layout.orientation === "horizontal") {
    return layout.plotLeft + t * (layout.plotRight - layout.plotLeft);
  }
  return layout.plotBottom - t * (layout.plotBottom - layout.plotTop);
}

export function valueFromCanvas(coord: number, layout: BoxLayout): number {
  const span = Math.max(layout.axisMax - layout.axisMin, 1e-9);
  if (layout.orientation === "horizontal") {
    const t =
      (coord - layout.plotLeft) / Math.max(layout.plotRight - layout.plotLeft, 1e-9);
    return layout.axisMin + t * span;
  }
  const t =
    (layout.plotBottom - coord) / Math.max(layout.plotBottom - layout.plotTop, 1e-9);
  return layout.axisMin + t * span;
}

export function bandForSeries(layout: BoxLayout, seriesId: string): BoxBand | null {
  return layout.bands.find((b) => b.seriesId === seriesId) ?? null;
}

function pushText(texts: SceneText[], cmds: SceneCmd[], text: SceneText) {
  texts.push(text);
  cmds.push({ t: "text", text });
}

function uniqueStatValues(series: BoxSeries[]): number[] {
  const seen: number[] = [];
  for (const s of series) {
    for (const key of STAT_KEYS) {
      const v = s.values[key];
      if (!seen.some((x) => Math.abs(x - v) < 1e-9)) seen.push(v);
    }
  }
  return seen;
}

function drawBox(
  cmds: SceneCmd[],
  series: BoxSeries,
  band: BoxBand,
  layout: BoxLayout,
  lw: number,
) {
  const v = series.values;
  const a = canvasFromValue(v.min, layout);
  const b = canvasFromValue(v.q1, layout);
  const m = canvasFromValue(v.median, layout);
  const c = canvasFromValue(v.q3, layout);
  const d = canvasFromValue(v.max, layout);
  const half = band.half;
  const cap = band.cap;
  const mid = band.center;

  if (layout.orientation === "horizontal") {
    cmds.push({
      t: "polygon",
      points: [
        { x: b, y: mid - half },
        { x: c, y: mid - half },
        { x: c, y: mid + half },
        { x: b, y: mid + half },
      ],
      fill: series.fill,
    });
    cmds.push(
      { t: "line", x1: b, y1: mid - half, x2: c, y2: mid - half, width: lw, id: "box" },
      { t: "line", x1: c, y1: mid - half, x2: c, y2: mid + half, width: lw, id: "box" },
      { t: "line", x1: c, y1: mid + half, x2: b, y2: mid + half, width: lw, id: "box" },
      { t: "line", x1: b, y1: mid + half, x2: b, y2: mid - half, width: lw, id: "box" },
      { t: "line", x1: m, y1: mid - half, x2: m, y2: mid + half, width: lw, id: "box" },
    );
    if (Math.abs(a - b) > 0.6) {
      cmds.push({ t: "line", x1: a, y1: mid, x2: b, y2: mid, width: lw, id: "box" });
    }
    if (Math.abs(d - c) > 0.6) {
      cmds.push({ t: "line", x1: c, y1: mid, x2: d, y2: mid, width: lw, id: "box" });
    }
    cmds.push(
      { t: "line", x1: a, y1: mid - cap, x2: a, y2: mid + cap, width: lw, id: "box" },
      { t: "line", x1: d, y1: mid - cap, x2: d, y2: mid + cap, width: lw, id: "box" },
    );
    return;
  }

  cmds.push({
    t: "polygon",
    points: [
      { x: mid - half, y: b },
      { x: mid + half, y: b },
      { x: mid + half, y: c },
      { x: mid - half, y: c },
    ],
    fill: series.fill,
  });
  cmds.push(
    { t: "line", x1: mid - half, y1: b, x2: mid + half, y2: b, width: lw, id: "box" },
    { t: "line", x1: mid + half, y1: b, x2: mid + half, y2: c, width: lw, id: "box" },
    { t: "line", x1: mid + half, y1: c, x2: mid - half, y2: c, width: lw, id: "box" },
    { t: "line", x1: mid - half, y1: c, x2: mid - half, y2: b, width: lw, id: "box" },
    { t: "line", x1: mid - half, y1: m, x2: mid + half, y2: m, width: lw, id: "box" },
  );
  if (Math.abs(a - b) > 0.6) {
    cmds.push({ t: "line", x1: mid, y1: a, x2: mid, y2: b, width: lw, id: "box" });
  }
  if (Math.abs(d - c) > 0.6) {
    cmds.push({ t: "line", x1: mid, y1: c, x2: mid, y2: d, width: lw, id: "box" });
  }
  cmds.push(
    { t: "line", x1: mid - cap, y1: a, x2: mid + cap, y2: a, width: lw, id: "box" },
    { t: "line", x1: mid - cap, y1: d, x2: mid + cap, y2: d, width: lw, id: "box" },
  );
}

export function fenceSegment(
  layout: BoxLayout,
  band: BoxBand,
  key: StatKey,
  value: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const p = canvasFromValue(value, layout);
  const half = key === "min" || key === "max" ? band.cap : band.half;
  if (layout.orientation === "horizontal") {
    return { x1: p, y1: band.center - half, x2: p, y2: band.center + half };
  }
  return { x1: band.center - half, y1: p, x2: band.center + half, y2: p };
}

export function buildBoxPlotScene(state: BoxPlotState): BoxPlotScene {
  const layout = getBoxLayout(state);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const grid = state.style.gridColor;
  const lw = state.style.lineWidth;
  const majors = tickValues(state.axisMin, state.axisMax, state.majorTick);
  const grids = tickValues(state.axisMin, state.axisMax, state.gridStep);

  if (state.showGrid) {
    for (const g of grids) {
      const p = canvasFromValue(g, layout);
      if (layout.orientation === "horizontal") {
        cmds.push({
          t: "line",
          x1: p,
          y1: layout.plotTop,
          x2: p,
          y2: layout.plotBottom,
          stroke: grid,
          width: 0.85,
          id: "grid",
        });
      } else {
        cmds.push({
          t: "line",
          x1: layout.plotLeft,
          y1: p,
          x2: layout.plotRight,
          y2: p,
          stroke: grid,
          width: 0.85,
          id: "grid",
        });
      }
    }
  }

  if (state.showFrame) {
    cmds.push(
      {
        t: "line",
        x1: layout.plotLeft,
        y1: layout.plotTop,
        x2: layout.plotRight,
        y2: layout.plotTop,
        width: lw,
        id: "frame",
      },
      {
        t: "line",
        x1: layout.plotRight,
        y1: layout.plotTop,
        x2: layout.plotRight,
        y2: layout.plotBottom,
        width: lw,
        id: "frame",
      },
      {
        t: "line",
        x1: layout.plotRight,
        y1: layout.plotBottom,
        x2: layout.plotLeft,
        y2: layout.plotBottom,
        width: lw,
        id: "frame",
      },
      {
        t: "line",
        x1: layout.plotLeft,
        y1: layout.plotBottom,
        x2: layout.plotLeft,
        y2: layout.plotTop,
        width: lw,
        id: "frame",
      },
    );
  }

  for (const series of state.series) {
    const band = bandForSeries(layout, series.id);
    if (band) drawBox(cmds, series, band, layout, lw);
  }

  if (state.showValueArrows) {
    for (const v of uniqueStatValues(state.series)) {
      const p = canvasFromValue(v, layout);
      if (layout.orientation === "horizontal") {
        cmds.push({
          t: "arrowhead",
          x: p,
          y: layout.plotTop + 1,
          ux: 0,
          uy: 1,
          size: 9,
          stroke: GRAPH_PINK,
        });
      } else {
        cmds.push({
          t: "arrowhead",
          x: layout.plotLeft + 1,
          y: p,
          ux: 1,
          uy: 0,
          size: 9,
          stroke: GRAPH_PINK,
        });
      }
    }
  }

  for (const t of majors) {
    const p = canvasFromValue(t, layout);
    if (layout.orientation === "horizontal") {
      pushText(texts, cmds, {
        id: `tick:${t}`,
        x: p,
        y: layout.plotBottom + 14,
        runs: parseMathRuns(formatTick(t)),
        size: state.style.fontSize,
        anchor: "middle",
      });
    } else {
      pushText(texts, cmds, {
        id: `tick:${t}`,
        x: layout.plotLeft - 8,
        y: p,
        runs: parseMathRuns(formatTick(t)),
        size: state.style.fontSize,
        anchor: "end",
      });
    }
  }

  for (const series of namedSeries(state)) {
    const band = bandForSeries(layout, series.id);
    if (!band) continue;
    const name = series.name.trim();
    const size = state.style.pointLabelSize;
    const pill = pillSize(name, size);
    if (layout.orientation === "horizontal") {
      const cx = layout.plotLeft - 8 - pill.w / 2 + series.labelDx;
      const cy = band.center + series.labelDy;
      cmds.push({
        t: "roundRect",
        x: cx - pill.w / 2,
        y: cy - pill.h / 2,
        w: pill.w,
        h: pill.h,
        r: pill.h / 2,
        fill: series.pillFill,
      });
      pushText(texts, cmds, {
        id: `series:${series.id}:name`,
        x: cx,
        y: cy,
        runs: parseNameRuns(name),
        size,
        anchor: "middle",
      });
    } else {
      const cx = band.center + series.labelDx;
      const cy = layout.plotBottom + 10 + pill.h / 2 + series.labelDy;
      cmds.push({
        t: "roundRect",
        x: cx - pill.w / 2,
        y: cy - pill.h / 2,
        w: pill.w,
        h: pill.h,
        r: pill.h / 2,
        fill: series.pillFill,
      });
      pushText(texts, cmds, {
        id: `series:${series.id}:name`,
        x: cx,
        y: cy,
        runs: parseNameRuns(name),
        size,
        anchor: "middle",
      });
    }
  }

  if (state.axisLabel.trim()) {
    const nameSize = state.style.axisNameSize;
    if (state.orientation === "horizontal") {
      pushText(texts, cmds, {
        id: "axis",
        x: layout.plotRight + 6 + state.axisLabelDx,
        y: layout.plotBottom + 14 + state.axisLabelDy,
        runs: parseMathRuns(state.axisLabel.trim()),
        size: nameSize,
        anchor: "start",
      });
    } else {
      pushText(texts, cmds, {
        id: "axis",
        x: layout.plotLeft + state.axisLabelDx,
        y: layout.plotTop - nameSize * 0.45 + state.axisLabelDy,
        runs: parseMathRuns(state.axisLabel.trim()),
        size: nameSize,
        anchor: "start",
      });
    }
  }

  if (hasChartTitle(state)) {
    const titleSize = state.style.titleSize;
    pushText(texts, cmds, {
      id: "title",
      x: SCENE_WIDTH / 2 + state.titleDx,
      y: Math.max(titleSize * 0.62, 14) + state.titleDy,
      runs: parseMathRuns(state.title.trim()),
      size: titleSize,
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
