export type SolidType =
  | "cube"
  | "cuboid"
  | "triangular_prism"
  | "square_pyramid"
  | "cylinder"
  | "cone";

export type PlaneFigureType =
  | "segment"
  | "line"
  | "circle"
  | "rectangle"
  | "triangle"
  | "polygon";

export type PlaneFigure =
  | {
      type: "segment";
      from: [number, number];
      to: [number, number];
    }
  | {
      type: "line";
      from: [number, number];
      to: [number, number];
    }
  | {
      type: "circle";
      center: [number, number];
      radius: number;
    }
  | {
      type: "rectangle";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      type: "triangle";
      vertices: [[number, number], [number, number], [number, number]];
    }
  | {
      type: "polygon";
      vertices: [number, number][];
    };

export type SolidParams = {
  a?: number;
  b?: number;
  c?: number;
  height?: number;
  radius?: number;
};

export type SolidSpec = {
  type: SolidType;
  anchor: { x: number; y: number };
  params: SolidParams;
  rotationDeg?: number;
};

export type GeometryRecognizeResult = {
  figures: PlaneFigure[];
  solid?: SolidSpec;
  confidence?: number;
};

export type SolidWidgetState = {
  type: SolidType;
  unfoldT: number;
  params: SolidParams;
  /** Orbit angles (radians) for drag rotation */
  orbit?: { azimuth: number; polar: number };
  /** @deprecated migrated to orbit.azimuth */
  rotationDeg?: number;
};

export type GeometryApplyPayload = {
  result: GeometryRecognizeResult;
};
