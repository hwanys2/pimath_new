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
  HingeOverride,
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
export { findMagnetCandidates, applyMagnetSnap, previewSnapTiles } from "./magnet";
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
export {
  buildNetFoldTree,
  pickFoldRoot,
  foldTreeEdges,
} from "./net-fold-tree";
export { suggestHingeAngle, hingeSpecFromJoin } from "./hinge-geometry";
export {
  computeTileTransforms,
  transformedVertices,
  netBounds3D,
  foldTreeEdgesForNet,
  vec2To3,
} from "./fold-transforms";
export { solveClosureAngles, canFoldNet } from "./closure-solver";
export { edgeCount } from "./shape-defs";
