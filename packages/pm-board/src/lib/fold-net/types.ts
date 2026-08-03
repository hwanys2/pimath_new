export type ShapeKind =
  | "equilateralTriangle"
  | "square"
  | "regularPentagon"
  | "regularHexagon"
  | "regularHeptagon"
  | "regularOctagon"
  | "isoscelesTrapezoid"
  | "parallelogram"
  | "rhombus"
  | "rectangle"
  | "rightTriangle"
  | "scaleneTriangle";

export type Vec2 = { x: number; y: number };

export type FoldTile = {
  id: string;
  kind: ShapeKind;
  /** Center in canvas space (px). */
  x: number;
  y: number;
  /** Uniform scale relative to unit local verts (default ~56). */
  scale: number;
  /** Radians, CCW. */
  rotation: number;
  /**
   * Optional per-edge length multipliers (edge i = unitEdge[i] * scale * edgeScale[i]).
   * Length usually equals edge count; missing → 1.
   */
  edgeScale?: number[];
};

export type EdgeRef = { tileId: string; edgeIndex: number };

export type Join = {
  id: string;
  a: EdgeRef;
  b: EdgeRef;
};

export type SolidType =
  | "cube"
  | "cuboid"
  | "tetrahedron"
  | "squarePyramid"
  | "triangularPrism";

export type FoldNetMode = "edit" | "solid";

export type OrbitState = { azimuth: number; polar: number };

export type FoldNetState = {
  tiles: FoldTile[];
  joins: Join[];
  selectedIds: string[];
  mode: FoldNetMode;
  solidType?: SolidType;
  solidTileIds?: string[];
  unfoldT: number;
  orbit: OrbitState;
};

export type WorldEdge = {
  tileId: string;
  edgeIndex: number;
  a: Vec2;
  b: Vec2;
  length: number;
  mid: Vec2;
  dir: Vec2;
};

export type MagnetCandidate = {
  a: EdgeRef;
  b: EdgeRef;
  distance: number;
  length: number;
};

export type SolidMatch = {
  type: SolidType;
  label: string;
  tileIds: string[];
  /** Characteristic sizes used by the 3D fold (full edge lengths). */
  dims: { a: number; b?: number; c?: number; height?: number };
};

export type FaceShape = "rect" | "polygon";

export type Hinge = {
  pivot: [number, number, number];
  axis: [number, number, number];
  angleFolded: number;
  childOffset: [number, number, number];
};

export type FaceNode = {
  id: string;
  shape: FaceShape;
  /** rect: width (X) × depth (Z) */
  size: [number, number];
  /** polygon verts in local XZ (Y=0) */
  vertices?: [number, number, number][];
  color?: string;
  hinge?: Hinge;
  children: FaceNode[];
};

export type FoldTree = {
  type: SolidType;
  label: string;
  root: FaceNode;
  /** Prefer keyframe path for boxes */
  useBoxKeyframes?: boolean;
  boxSize?: [number, number, number];
};

export const DEFAULT_FOLD_NET_STATE: FoldNetState = {
  tiles: [],
  joins: [],
  selectedIds: [],
  mode: "edit",
  unfoldT: 0,
  orbit: { azimuth: 0.55, polar: 1.05 },
};
