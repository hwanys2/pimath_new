import type { CompiledExpr } from "./board-math";

export type PlotView = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export const DEFAULT_PLOT_VIEW: PlotView = {
  xMin: -8,
  xMax: 8,
  yMin: -6,
  yMax: 6,
};

export const STANDARD_PLOT_VIEW: PlotView = {
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
};

export function safePlotView(view: PlotView): PlotView {
  let { xMin, xMax, yMin, yMax } = view;
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || !(xMax > xMin)) {
    xMin = DEFAULT_PLOT_VIEW.xMin;
    xMax = DEFAULT_PLOT_VIEW.xMax;
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || !(yMax > yMin)) {
    yMin = DEFAULT_PLOT_VIEW.yMin;
    yMax = DEFAULT_PLOT_VIEW.yMax;
  }
  return { xMin, xMax, yMin, yMax };
}

/** Nice step that lands near `range / 8` (legacy plot helper). */
export function niceStep(range: number): number {
  if (!(range > 0) || !Number.isFinite(range)) return 1;
  const rough = range / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const base = rough / pow;
  if (base < 1.5) return pow;
  if (base < 3.5) return 2 * pow;
  if (base < 7.5) return 5 * pow;
  return 10 * pow;
}

/** Smallest 1-2-5×10^n step that is ≥ minStep. */
export function niceCeilStep(minStep: number): number {
  if (!(minStep > 0) || !Number.isFinite(minStep)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(minStep)));
  const base = minStep / pow;
  if (base <= 1) return pow;
  if (base <= 2) return 2 * pow;
  if (base <= 5) return 5 * pow;
  return 10 * pow;
}

export function plotTicks(min: number, max: number): number[] {
  const step = niceStep(max - min);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step / 2; v += step) {
    out.push(Math.abs(v) < step / 1e6 ? 0 : parseFloat(v.toPrecision(10)));
  }
  return out;
}

function snapTick(value: number, step: number): number {
  if (Math.abs(value) < step / 1e6) return 0;
  if (Math.abs(value - Math.round(value)) < Math.min(step, 1) * 1e-6) {
    return Math.round(value);
  }
  return parseFloat(value.toPrecision(10));
}

/**
 * Tick positions for one axis.
 * `scale` 0 / omitted → auto: unit steps on modest spans, otherwise a nice step.
 */
export function axisTicks(
  min: number,
  max: number,
  scale?: number,
  maxTicks = 120,
): number[] {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  let step =
    typeof scale === "number" && scale > 0
      ? scale
      : span <= 24
        ? 1
        : niceStep(span);
  if (span / step > maxTicks) {
    step = niceCeilStep(span / maxTicks);
  }
  const out: number[] = [];
  const start = Math.ceil(min / step - 1e-9) * step;
  for (let i = 0; ; i++) {
    const v = snapTick(start + i * step, step);
    if (v > max + step * 1e-6) break;
    out.push(v);
    if (out.length > maxTicks + 2) break;
  }
  return out;
}

/** How many ticks to skip between labels so digits do not collide. */
export function axisLabelStride(
  step: number,
  pxPerUnit: number,
  minGapPx = 16,
): number {
  const px = step * pxPerUnit;
  if (!(px > 0) || !Number.isFinite(px)) return 1;
  return Math.max(1, Math.ceil(minGapPx / px - 1e-9));
}

/**
 * Auto Xscl/Yscl from the visible pixel length.
 * Prefers 1 on classroom-scale windows.
 */
export function autoAxisScale(
  min: number,
  max: number,
  pixelLength: number,
  minGapPx = 22,
): number {
  const span = max - min;
  if (!(span > 0) || !(pixelLength > 0)) return 1;
  const minStep = (minGapPx / pixelLength) * span;
  if (minStep <= 1) return 1;
  return niceCeilStep(minStep);
}

export function resolveAxisScale(
  min: number,
  max: number,
  scale: number,
  pixelLength: number,
): number {
  if (Number.isFinite(scale) && scale > 0) return scale;
  return autoAxisScale(min, max, pixelLength);
}

export function formatAxisLabel(n: number): string {
  if (Math.abs(n) < 1e-9) return "0";
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  const abs = Math.abs(n);
  if (abs >= 1000 || (abs > 0 && abs < 0.01)) {
    return n.toExponential(1).replace(/e\+?/, "e");
  }
  return String(parseFloat(n.toFixed(4)));
}

export function buildFunctionPath(
  fn: CompiledExpr,
  view: PlotView,
  w: number,
  h: number,
): string {
  const sx = w / (view.xMax - view.xMin);
  const sy = h / (view.yMax - view.yMin);
  const toPx = {
    x: (x: number) => (x - view.xMin) * sx,
    y: (y: number) => h - (y - view.yMin) * sy,
  };

  let d = "";
  let penDown = false;
  const step = (view.xMax - view.xMin) / Math.max(w, 100);
  let prevY: number | null = null;
  for (let x = view.xMin; x <= view.xMax + step; x += step) {
    const y = fn(x);
    if (!Number.isFinite(y)) {
      penDown = false;
      prevY = null;
      continue;
    }
    if (prevY !== null && Math.abs(y - prevY) > (view.yMax - view.yMin) * 4) {
      penDown = false;
    }
    prevY = y;
    const px = toPx.x(x);
    const py = toPx.y(y);
    if (py < -h * 2 || py > h * 3) {
      penDown = false;
      continue;
    }
    d += penDown
      ? `L${px.toFixed(1)},${py.toFixed(1)}`
      : `M${px.toFixed(1)},${py.toFixed(1)}`;
    penDown = true;
  }
  return d;
}
