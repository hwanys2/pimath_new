import type { PlotView } from "../lib/graph-plot";
import { DEFAULT_PLOT_VIEW } from "../lib/graph-plot";

export type GraphSeries = { text: string; color: string };

export type GraphSettings = {
  view: PlotView;
  subdivisions: number;
  /** @deprecated use showMajorGrid */
  showGrid?: boolean;
  showMajorGrid: boolean;
  showMinorGrid: boolean;
  /** @deprecated use showXAxis / showYAxis */
  showAxes?: boolean;
  showXAxis: boolean;
  showYAxis: boolean;
  showNumbers: boolean;
  showTicks: boolean;
  showArrows: boolean;
  showAxisNames: boolean;
  xAxisName: string;
  yAxisName: string;
  /** Major tick / grid step. `0` = auto (pixel-aware). */
  xScale: number;
  yScale: number;
  /** Keep 1 x-unit visually equal to 1 y-unit (Desmos “square”). */
  equalAxes: boolean;
  panZoom: boolean;
};

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  view: { ...DEFAULT_PLOT_VIEW },
  subdivisions: 4,
  showMajorGrid: true,
  showMinorGrid: false,
  showXAxis: true,
  showYAxis: true,
  showNumbers: true,
  showTicks: true,
  showArrows: true,
  showAxisNames: true,
  xAxisName: "x",
  yAxisName: "y",
  xScale: 1,
  yScale: 1,
  equalAxes: true,
  panZoom: true,
};

function bool(
  value: boolean | undefined,
  fallback: boolean,
): boolean {
  return value ?? fallback;
}

export function mergeGraphSettings(
  partial?: Partial<GraphSettings> & { view?: Partial<PlotView> },
  legacyView?: PlotView,
): GraphSettings {
  const base = { ...DEFAULT_GRAPH_SETTINGS };
  if (legacyView) {
    base.view = { ...legacyView };
  }
  if (!partial) return base;
  const legacyGrid = partial.showGrid;
  const showMajorGrid =
    partial.showMajorGrid ?? legacyGrid ?? base.showMajorGrid;
  const showMinorGrid =
    partial.showMinorGrid ??
    (legacyGrid !== undefined ? legacyGrid : base.showMinorGrid);
  const showXAxis = bool(
    partial.showXAxis,
    bool(partial.showAxes, base.showXAxis),
  );
  const showYAxis = bool(
    partial.showYAxis,
    bool(partial.showAxes, base.showYAxis),
  );
  return {
    ...base,
    ...partial,
    showMajorGrid,
    showMinorGrid,
    showXAxis,
    showYAxis,
    showNumbers: bool(partial.showNumbers, base.showNumbers),
    showTicks: bool(partial.showTicks, base.showTicks),
    showArrows: bool(partial.showArrows, base.showArrows),
    showAxisNames: bool(partial.showAxisNames, base.showAxisNames),
    xAxisName:
      typeof partial.xAxisName === "string"
        ? partial.xAxisName
        : base.xAxisName,
    yAxisName:
      typeof partial.yAxisName === "string"
        ? partial.yAxisName
        : base.yAxisName,
    xScale:
      typeof partial.xScale === "number" && Number.isFinite(partial.xScale)
        ? Math.max(0, partial.xScale)
        : base.xScale,
    yScale:
      typeof partial.yScale === "number" && Number.isFinite(partial.yScale)
        ? Math.max(0, partial.yScale)
        : base.yScale,
    equalAxes: bool(partial.equalAxes, base.equalAxes),
    view: {
      ...base.view,
      ...partial.view,
    },
  };
}

export type BoardGraphSeriesInput = {
  expr: string;
  color: string;
  kind?: "function" | "inequality";
};
