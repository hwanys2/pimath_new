import {
  STAT_KEYS,
  setStat as setStatValue,
  type BoxPlotState,
  type StatKey,
} from "@/lib/diagrams/boxplot/model";
import {
  bandForSeries,
  canvasFromValue,
  fenceSegment,
  pillSize,
  valueFromCanvas,
  type BoxPlotScene,
} from "@/lib/diagrams/boxplot/scene";

export type BoxHit =
  | { kind: "label"; id: string; targetId: string }
  | { kind: "stat"; seriesId: string; key: StatKey }
  | { kind: "box"; seriesId: string };

type Candidate = { hit: BoxHit; weight: number };

function consider(
  best: Candidate | null,
  hit: BoxHit,
  d: number,
  max: number,
  bias: number,
): Candidate | null {
  if (d > max) return best;
  const weight = d + bias;
  if (best && weight >= best.weight) return best;
  return { hit, weight };
}

export function parseSeriesLabelId(id: string): string | null {
  const m = id.match(/^series:([^:]+):name$/);
  return m ? m[1]! : null;
}

function distToSegment(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(x - x1, y - y1);
  let t = ((x - x1) * dx + (y - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

export function hitTestBoxPlot(
  state: BoxPlotState,
  scene: BoxPlotScene,
  x: number,
  y: number,
  hitScale = 1,
): BoxHit | null {
  const s = Number.isFinite(hitScale) && hitScale > 0 ? hitScale : 1;
  const layout = scene.layout;
  let best: Candidate | null = null;

  for (const text of scene.texts) {
    if (text.id.startsWith("tick:")) continue;
    const seriesId = parseSeriesLabelId(text.id);
    if (text.id === "title") {
      const halfW = Math.max(36, state.title.trim().length * (text.size * 0.46));
      const halfH = text.size * 0.7 + 8;
      if (Math.abs(text.x - x) <= halfW * s && Math.abs(text.y - y) <= halfH * s) {
        best = consider(
          best,
          { kind: "label", id: "title", targetId: "title" },
          Math.abs(text.y - y),
          halfH * s,
          1,
        );
      }
      continue;
    }
    if (text.id === "axis") {
      const raw = state.axisLabel.trim();
      const w = Math.max(text.size * 1.8, raw.length * text.size * 0.5);
      const hitX = text.anchor === "end" ? text.x - w / 2 : text.x;
      best = consider(
        best,
        { kind: "label", id: "axis", targetId: "axis" },
        Math.hypot(hitX - x, text.y - y),
        Math.max(28, w * 0.55) * s,
        1,
      );
      continue;
    }
    if (seriesId) {
      const series = state.series.find((box) => box.id === seriesId);
      const name = series?.name.trim() ?? "";
      const pill = pillSize(name, text.size);
      best = consider(
        best,
        { kind: "label", id: text.id, targetId: seriesId },
        Math.hypot(text.x - x, text.y - y),
        Math.max(26, pill.w * 0.55) * s,
        2,
      );
    }
  }

  for (const series of state.series) {
    const band = bandForSeries(layout, series.id);
    if (!band) continue;
    for (const key of STAT_KEYS) {
      const seg = fenceSegment(layout, band, key, series.values[key]);
      const d = distToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
      best = consider(
        best,
        { kind: "stat", seriesId: series.id, key },
        d,
        11 * s,
        key === "median" ? 0 : 0.4,
      );
    }
    if (layout.orientation === "horizontal") {
      const q1 = canvasFromValue(series.values.q1, layout);
      const q3 = canvasFromValue(series.values.q3, layout);
      const minX = canvasFromValue(series.values.min, layout);
      const maxX = canvasFromValue(series.values.max, layout);
      const left = Math.min(minX, q1, q3, maxX);
      const right = Math.max(minX, q1, q3, maxX);
      const inside =
        x >= left - 4 &&
        x <= right + 4 &&
        y >= band.center - band.half - 4 &&
        y <= band.center + band.half + 4;
      if (inside) {
        best = consider(
          best,
          { kind: "box", seriesId: series.id },
          Math.abs(y - band.center),
          band.half + 10 * s,
          10,
        );
      }
    } else {
      const q1 = canvasFromValue(series.values.q1, layout);
      const q3 = canvasFromValue(series.values.q3, layout);
      const minY = canvasFromValue(series.values.min, layout);
      const maxY = canvasFromValue(series.values.max, layout);
      const top = Math.min(minY, q1, q3, maxY);
      const bottom = Math.max(minY, q1, q3, maxY);
      const inside =
        y >= top - 4 &&
        y <= bottom + 4 &&
        x >= band.center - band.half - 4 &&
        x <= band.center + band.half + 4;
      if (inside) {
        best = consider(
          best,
          { kind: "box", seriesId: series.id },
          Math.abs(x - band.center),
          band.half + 10 * s,
          10,
        );
      }
    }
  }

  return best?.hit ?? null;
}

export function setStatFromCanvas(
  state: BoxPlotState,
  seriesId: string,
  key: StatKey,
  canvasX: number,
  canvasY: number,
  layout: BoxPlotScene["layout"],
): BoxPlotState {
  const coord = layout.orientation === "horizontal" ? canvasX : canvasY;
  const value = valueFromCanvas(coord, layout);
  return setStatValue(state, seriesId, key, value, "clamp");
}

export function nudgeMovableLabel(
  state: BoxPlotState,
  id: string,
  dx: number,
  dy: number,
): BoxPlotState {
  if (id === "axis") {
    return {
      ...state,
      axisLabelDx: state.axisLabelDx + dx,
      axisLabelDy: state.axisLabelDy + dy,
    };
  }
  if (id === "title") {
    return {
      ...state,
      titleDx: state.titleDx + dx,
      titleDy: state.titleDy + dy,
    };
  }
  const seriesId = parseSeriesLabelId(id);
  if (seriesId) {
    return {
      ...state,
      series: state.series.map((s) =>
        s.id === seriesId
          ? { ...s, labelDx: s.labelDx + dx, labelDy: s.labelDy + dy }
          : s,
      ),
    };
  }
  return state;
}

export function applyEditedLabel(
  state: BoxPlotState,
  id: string,
  raw: string,
): BoxPlotState {
  if (id === "axis") return { ...state, axisLabel: raw };
  if (id === "title") return { ...state, title: raw, showTitle: true };
  const seriesId = parseSeriesLabelId(id);
  if (seriesId) {
    return {
      ...state,
      series: state.series.map((s) =>
        s.id === seriesId ? { ...s, name: raw } : s,
      ),
    };
  }
  return state;
}
