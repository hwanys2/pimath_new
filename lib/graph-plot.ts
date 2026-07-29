import type { CompiledExpr } from "@/lib/board-math";

export type PlotView = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export const DEFAULT_PLOT_VIEW: PlotView = {
  xMin: -10,
  xMax: 10,
  yMin: -7,
  yMax: 7,
};

export function niceStep(range: number): number {
  const rough = range / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const base = rough / pow;
  if (base < 1.5) return pow;
  if (base < 3.5) return 2 * pow;
  if (base < 7.5) return 5 * pow;
  return 10 * pow;
}

export function plotTicks(min: number, max: number): number[] {
  const step = niceStep(max - min);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    out.push(Math.abs(v) < step / 1e6 ? 0 : parseFloat(v.toPrecision(10)));
  }
  return out;
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
