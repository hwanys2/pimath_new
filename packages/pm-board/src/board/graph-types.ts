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
  showAxes: boolean;
  showNumbers: boolean;
  panZoom: boolean;
};

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  view: { ...DEFAULT_PLOT_VIEW },
  subdivisions: 4,
  showMajorGrid: true,
  showMinorGrid: false,
  showAxes: true,
  showNumbers: true,
  panZoom: true,
};

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
    partial.showMajorGrid ??
    legacyGrid ??
    base.showMajorGrid;
  const showMinorGrid =
    partial.showMinorGrid ??
    (legacyGrid !== undefined ? legacyGrid : base.showMinorGrid);
  return {
    ...base,
    ...partial,
    showMajorGrid,
    showMinorGrid,
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
