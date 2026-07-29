import type { SolidType } from "../../board/geometry-types";

export type Hinge = {
  /** Pivot on parent face, parent local space (face in XZ, Y up, center at origin). */
  pivot: [number, number, number];
  /** Unit rotation axis (parent local). */
  axis: [number, number, number];
  /** Radians when fully folded (unfoldT=1). */
  angleFolded: number;
  /** Offset from pivot to child face center when unfoldT=0 (parent local). */
  childOffset: [number, number, number];
};

export type FaceNode = {
  id: string;
  shape: "rect" | "triangle";
  /** rect: width (X) × depth (Z) */
  size: [number, number];
  /** triangle: 3 vertices in face local XZ (Y=0), centered near origin */
  vertices?: [number, number, number][];
  hinge?: Hinge;
  children: FaceNode[];
};

export type SolidNetTree = {
  type: SolidType;
  label: string;
  root: FaceNode;
  /** Curved nets not supported in 3D hinge engine yet */
  hingeSupported: boolean;
};
