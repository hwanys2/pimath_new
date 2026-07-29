import type { SolidType } from "../../board/geometry-types";

export type NetFace = {
  id: string;
  /** Unfolded 2D position (px) */
  ux: number;
  uy: number;
  w: number;
  h: number;
  /** Fold axis relative to face center when t→1 */
  foldAxis: "x" | "y";
  foldAngle: number;
  parentId?: string;
};

export type SolidNetDef = {
  type: SolidType;
  label: string;
  faces: NetFace[];
};
