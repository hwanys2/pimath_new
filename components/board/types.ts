export type BoardMode = "draw" | "math-select";

export type MathKind = "function" | "equation" | "inequality" | "display";

export type MathCard = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  latex: string;
  expr: string;
  paramValues: Record<string, number>;
  kind: MathKind;
  showGraph: boolean;
  showSolution: boolean;
  solutionSteps?: string[];
  answerLatex?: string;
  zIndex: number;
};

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

/** Freehand/shape tools plus compass-committed arcs. */
export type DrawTool = Exclude<ToolId, "cursor"> | "arc";

export type Stroke = {
  tool: DrawTool;
  color: string;
  size: number;
  /**
   * Freehand: flat [x0, y0, x1, y1, ...].
   * Shapes: start/end pair.
   * Arc: [cx, cy, radius, startRad, endRad] (direction via end vs start).
   */
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

/** Needle tip = center (cx, cy); angle = pencil direction in degrees. */
export type CompassPose = {
  cx: number;
  cy: number;
  radius: number;
  angle: number;
};

export type OverlayId = "ruler" | "protractor" | "compass";

export type ClassRoster = {
  id: string;
  name: string;
  students: string[];
};

export type BoardOverlays = {
  ruler: OverlayPose | null;
  protractor: OverlayPose | null;
  compass: CompassPose | null;
};

export type BoardPersisted = {
  background: BackgroundId;
  color: string;
  size: number;
  strokes: Stroke[];
  widgets: WidgetInstance[];
  overlays: Partial<BoardOverlays>;
  mathCards?: MathCard[];
};
