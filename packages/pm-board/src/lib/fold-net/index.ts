export type {
  ShapeKind,
  FoldTile,
  Join,
  FoldNetState,
  SolidMatch,
  SolidType,
  FoldTree,
  FaceNode,
  OrbitState,
  MagnetCandidate,
} from "./types";
export { DEFAULT_FOLD_NET_STATE } from "./types";
export {
  SHAPE_DEFS,
  SHAPE_PALETTE_ORDER,
  DEFAULT_TILE_SCALE,
} from "./shape-defs";
export {
  worldVertices,
  worldEdges,
  allWorldEdges,
  edgeLength,
  tileBounds,
  pointInPolygon,
  createTileId,
  createJoinId,
} from "./geometry";
export { findMagnetCandidates, applyMagnetSnap } from "./magnet";
export {
  connectedComponents,
  componentContaining,
  detachSelectedJoins,
  removeJoinsForTiles,
} from "./net-graph";
export {
  matchSolidFromSelection,
  describeWhyNoMatch,
} from "./solid-match";
export { buildFoldTreeFromMatch } from "./fold-tree";
export { buildBoxFaceKeyframes } from "./box-keyframes";
export { hingeAngleRad, lerpMat4 } from "./mat4";
