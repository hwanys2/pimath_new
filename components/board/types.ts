export type BackgroundId =
  | "chalkboard"
  | "whiteboard"
  | "grid"
  | "coordinate"
  | "dots"
  | "lined"
  | "numberline";

export type ToolId =
  | "cursor"
  | "pen"
  | "highlighter"
  | "eraser"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse";

export type DrawTool = Exclude<ToolId, "cursor">;

export type Stroke = {
  tool: DrawTool;
  color: string;
  size: number;
  /** flat [x0, y0, x1, y1, ...]; shapes use start/end pair */
  points: number[];
};

export type WidgetKind =
  | "timer"
  | "clock"
  | "picker"
  | "dice"
  | "random"
  | "traffic"
  | "noise"
  | "qr"
  | "note"
  | "graph"
  | "calculator";

export type WidgetInstance = {
  id: string;
  kind: WidgetKind;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  state: Record<string, unknown>;
};

export type OverlayPose = {
  x: number;
  y: number;
  angle: number;
};

export type OverlayId = "ruler" | "protractor";

export type ClassRoster = {
  id: string;
  name: string;
  students: string[];
};

export type BoardPersisted = {
  background: BackgroundId;
  color: string;
  size: number;
  strokes: Stroke[];
  widgets: WidgetInstance[];
  overlays: Partial<Record<OverlayId, OverlayPose | null>>;
};
