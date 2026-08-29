import {
  classBound,
  classMid,
  setFrequency as setFrequencyValue,
  type HistogramState,
} from "@/lib/diagrams/histogram/model";
import {
  canvasXFromValue,
  canvasYFromValue,
  classIndexAtX,
  valueFromCanvasX,
  valueFromCanvasY,
  type HistogramScene,
} from "@/lib/diagrams/histogram/scene";

export type HistHit =
  | { kind: "label"; id: string; targetId: string }
  | { kind: "bar"; seriesId: string; index: number }
  | { kind: "point"; seriesId: string; index: number };

type Candidate = { hit: HistHit; weight: number };

function consider(
  best: Candidate | null,
  hit: HistHit,
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

export function hitTestHistogram(
  state: HistogramState,
  scene: HistogramScene,
  x: number,
  y: number,
  hitScale = 1,
  selectedSeriesId: string | null = null,
): HistHit | null {
  const s = Number.isFinite(hitScale) && hitScale > 0 ? hitScale : 1;
  const layout = scene.layout;
  let best: Candidate | null = null;

  for (const text of scene.texts) {
    if (text.id.startsWith("tick-")) continue;
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
    if (text.id === "axis-x" || text.id === "axis-y") {
      const raw =
        text.id === "axis-x" ? state.xAxisLabel.trim() : state.yAxisLabel.trim();
      const w = Math.max(text.size * 1.8, raw.length * text.size * 0.5);
      const hitX = text.anchor === "end" ? text.x - w / 2 : text.x;
      best = consider(
        best,
        { kind: "label", id: text.id, targetId: text.id },
        Math.hypot(hitX - x, text.y - y),
        Math.max(28, w * 0.55) * s,
        1,
      );
      continue;
    }
    if (seriesId) {
      best = consider(
        best,
        { kind: "label", id: text.id, targetId: seriesId },
        Math.hypot(text.x - x, text.y - y),
        26 * s,
        2,
      );
    }
  }

  if (state.kind === "polygon") {
    for (const series of state.series) {
      for (let i = 0; i < state.classCount; i += 1) {
        const px = canvasXFromValue(classMid(state, i), layout);
        const py = canvasYFromValue(series.frequencies[i] ?? 0, layout);
        best = consider(
          best,
          { kind: "point", seriesId: series.id, index: i },
          Math.hypot(px - x, py - y),
          14 * s,
          0,
        );
      }
    }
  } else {
    for (const series of state.series) {
      for (let i = 0; i < state.classCount; i += 1) {
        const x0 = canvasXFromValue(classBound(state, i), layout);
        const x1 = canvasXFromValue(classBound(state, i + 1), layout);
        const top = canvasYFromValue(series.frequencies[i] ?? 0, layout);
        const bottom = layout.plotBottom;
        const midX = (x0 + x1) / 2;
        const onTop = Math.abs(y - top) <= 10 * s && x >= x0 - 2 && x <= x1 + 2;
        const inside =
          x >= Math.min(x0, x1) &&
          x <= Math.max(x0, x1) &&
          y >= Math.min(top, bottom) &&
          y <= Math.max(top, bottom);
        if (onTop) {
          best = consider(
            best,
            { kind: "bar", seriesId: series.id, index: i },
            Math.abs(y - top),
            12 * s,
            0,
          );
        } else if (inside) {
          best = consider(
            best,
            { kind: "bar", seriesId: series.id, index: i },
            Math.hypot(x - midX, y - top),
            80 * s,
            8,
          );
        }
      }
    }
  }

  if (best) return best.hit;

  const dataX = valueFromCanvasX(x, layout);
  const index = classIndexAtX(dataX, state);
  if (
    index != null &&
    x >= layout.dataLeft - 6 &&
    x <= layout.dataRight + 8 &&
    y >= layout.plotTopInner - 8 &&
    y <= layout.plotBottom + 8
  ) {
    const seriesId =
      (selectedSeriesId && state.series.some((s) => s.id === selectedSeriesId)
        ? selectedSeriesId
        : state.series[0]?.id) ?? null;
    if (!seriesId) return null;
    if (state.kind === "polygon") {
      return { kind: "point", seriesId, index };
    }
    return { kind: "bar", seriesId, index };
  }
  return null;
}

export function setFrequencyFromCanvas(
  state: HistogramState,
  seriesId: string,
  index: number,
  canvasY: number,
  layout: HistogramScene["layout"],
): HistogramState {
  const y = valueFromCanvasY(canvasY, layout);
  return setFrequencyValue(state, seriesId, index, y);
}

export function nudgeSeriesLabel(
  state: HistogramState,
  seriesId: string,
  dx: number,
  dy: number,
): HistogramState {
  return {
    ...state,
    series: state.series.map((s) =>
      s.id === seriesId
        ? { ...s, labelDx: s.labelDx + dx, labelDy: s.labelDy + dy }
        : s,
    ),
  };
}

export function nudgeMovableLabel(
  state: HistogramState,
  id: string,
  dx: number,
  dy: number,
): HistogramState {
  if (id === "axis-x") {
    return {
      ...state,
      xAxisLabelDx: state.xAxisLabelDx + dx,
      xAxisLabelDy: state.xAxisLabelDy + dy,
    };
  }
  if (id === "axis-y") {
    return {
      ...state,
      yAxisLabelDx: state.yAxisLabelDx + dx,
      yAxisLabelDy: state.yAxisLabelDy + dy,
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
  if (seriesId) return nudgeSeriesLabel(state, seriesId, dx, dy);
  return state;
}

export function applyEditedLabel(
  state: HistogramState,
  id: string,
  raw: string,
): HistogramState {
  if (id === "axis-x") return { ...state, xAxisLabel: raw };
  if (id === "axis-y") return { ...state, yAxisLabel: raw };
  if (id === "title") return { ...state, title: raw };
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
