import { worldVertices } from "./geometry";
import {
  hingeSpecFromJoin,
  signedHingeAngle,
} from "./hinge-geometry";
import {
  type Mat4,
  type Vec3,
  mat4FromAxisAngle,
  mat4FromTranslation,
  mat4HingePivotRotation,
  mat4Identity,
  mat4Invert,
  mat4Multiply,
  mat4TransformDirection,
  mat4TransformPoint,
} from "./mat4";
import {
  buildNetFoldTree,
  type NetFoldEdge,
  type NetFoldNode,
} from "./net-fold-tree";
import type { FoldTile, HingeOverride, Join } from "./types";

export type HingeRenderNode = {
  joinId: string;
  pivot: Vec3;
  axis: Vec3;
  angle: number;
  tileId: string;
  vertices: Vec3[];
  children: HingeRenderNode[];
};

export type FoldRenderTree = {
  rootTileId: string;
  rootVertices: Vec3[];
  hinges: HingeRenderNode[];
};

function vec2To3Arr(v: { x: number; y: number }): Vec3 {
  return [v.x, -v.y, 0];
}

function normalize3(d: Vec3): Vec3 {
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  return [d[0] / len, d[1] / len, d[2] / len];
}

function hingeAngleForEdge(
  tiles: FoldTile[],
  edge: NetFoldEdge,
  overrides: HingeOverride[],
  unfoldT: number,
): number {
  const override = overrides.find((o) => o.joinId === edge.joinId);
  const parent = tiles.find((t) => t.id === edge.parentTileId);
  const child = tiles.find((t) => t.id === edge.childTileId);
  if (!parent || !child) return (Math.PI / 2) * unfoldT;
  const target =
    override?.targetAngle ?? signedHingeAngle(parent, child, edge);
  return target * unfoldT;
}

function buildHingeNode(
  node: NetFoldNode,
  tiles: FoldTile[],
  hingeOverrides: HingeOverride[],
  unfoldT: number,
  parentFlat: Mat4,
): HingeRenderNode {
  const edge = node.parentEdge!;
  const spec = hingeSpecFromJoin(tiles, edge);
  if (!spec) {
    return {
      joinId: edge.joinId,
      pivot: [0, 0, 0],
      axis: [1, 0, 0],
      angle: 0,
      tileId: node.tileId,
      vertices: worldVertices(
        tiles.find((t) => t.id === node.tileId)!,
      ).map(vec2To3Arr),
      children: [],
    };
  }

  const angle = hingeAngleForEdge(tiles, edge, hingeOverrides, unfoldT);
  const pivotWorld = vec2To3Arr(spec.pivot);
  const axisWorld = normalize3(vec2To3Arr(spec.axisDir));

  const parentInv = mat4Invert(parentFlat);
  const pivotLocal = mat4TransformPoint(parentInv, pivotWorld);
  const axisLocal = normalize3(mat4TransformDirection(parentInv, axisWorld));

  const tile = tiles.find((t) => t.id === node.tileId)!;
  const childWorldVerts = worldVertices(tile).map(vec2To3Arr);
  const relVerts = childWorldVerts.map((v) => {
    const inParent = mat4TransformPoint(parentInv, v);
    return [
      inParent[0] - pivotLocal[0],
      inParent[1] - pivotLocal[1],
      inParent[2] - pivotLocal[2],
    ] as Vec3;
  });

  const childFlat = mat4Multiply(
    parentFlat,
    mat4FromTranslation(pivotLocal[0], pivotLocal[1], pivotLocal[2]),
  );

  const children = node.children.map((c) =>
    buildHingeNode(c, tiles, hingeOverrides, unfoldT, childFlat),
  );

  return {
    joinId: edge.joinId,
    pivot: pivotLocal,
    axis: axisLocal,
    angle,
    tileId: node.tileId,
    vertices: relVerts,
    children,
  };
}

/** Build a hinge tree for R3F rendering. */
export function buildFoldRenderTree(
  tiles: FoldTile[],
  joins: Join[],
  rootTileId: string,
  unfoldT: number,
  hingeOverrides: HingeOverride[] = [],
  tileIds?: string[],
): FoldRenderTree | null {
  const tree = buildNetFoldTree(joins, rootTileId, tileIds);
  if (!tree) return null;

  const rootTile = tiles.find((t) => t.id === tree.tileId);
  if (!rootTile) return null;

  return {
    rootTileId: tree.tileId,
    rootVertices: worldVertices(rootTile).map(vec2To3Arr),
    hinges: tree.children.map((c) =>
      buildHingeNode(c, tiles, hingeOverrides, unfoldT, mat4Identity()),
    ),
  };
}

function walkHingeMatrices(
  hinges: HingeRenderNode[],
  parentMatrix: Mat4,
  out: Map<string, Mat4>,
): void {
  for (const h of hinges) {
    const hingeMat = mat4HingePivotRotation(h.pivot, h.axis, h.angle);
    const tileMatrix = mat4Multiply(parentMatrix, hingeMat);
    out.set(h.tileId, tileMatrix);
    walkHingeMatrices(h.children, tileMatrix, out);
  }
}

/** Flat world matrices per tile (for tests / bounds). */
export function computeTileWorldMatrices(
  tiles: FoldTile[],
  joins: Join[],
  rootTileId: string,
  unfoldT: number,
  hingeOverrides: HingeOverride[] = [],
  tileIds?: string[],
): Map<string, Mat4> {
  const out = new Map<string, Mat4>();
  const tree = buildFoldRenderTree(
    tiles,
    joins,
    rootTileId,
    unfoldT,
    hingeOverrides,
    tileIds,
  );
  if (!tree) return out;

  out.set(tree.rootTileId, mat4Identity());
  walkHingeMatrices(tree.hinges, mat4Identity(), out);
  return out;
}

export function transformVerticesWithMatrix(
  vertices: Vec3[],
  matrix: Mat4,
): { x: number; y: number; z: number }[] {
  return vertices.map((v) => {
    const p = mat4TransformPoint(matrix, v);
    return { x: p[0], y: p[1], z: p[2] };
  });
}

function evaluateHingeSubtree(
  hinge: HingeRenderNode,
  parentMatrix: Mat4,
  out: Map<string, { x: number; y: number; z: number }[]>,
): void {
  const local = mat4Multiply(
    mat4FromTranslation(hinge.pivot[0], hinge.pivot[1], hinge.pivot[2]),
    mat4FromAxisAngle(hinge.axis[0], hinge.axis[1], hinge.axis[2], hinge.angle),
  );
  const tileMatrix = mat4Multiply(parentMatrix, local);
  out.set(
    hinge.tileId,
    transformVerticesWithMatrix(hinge.vertices, tileMatrix),
  );
  for (const child of hinge.children) {
    evaluateHingeSubtree(child, tileMatrix, out);
  }
}

/** World vertices per tile matching nested R3F hinge groups. */
export function evaluateRenderTreeVertices(
  renderTree: FoldRenderTree,
): Map<string, { x: number; y: number; z: number }[]> {
  const out = new Map<string, { x: number; y: number; z: number }[]>();
  const rootMat = mat4Identity();
  out.set(
    renderTree.rootTileId,
    transformVerticesWithMatrix(renderTree.rootVertices, rootMat),
  );
  for (const h of renderTree.hinges) {
    evaluateHingeSubtree(h, rootMat, out);
  }
  return out;
}

export function flatNetBounds2D(
  tiles: FoldTile[],
  tileIds?: string[],
): { minX: number; minY: number; maxX: number; maxY: number } {
  const allowed = tileIds ? new Set(tileIds) : null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of tiles) {
    if (allowed && !allowed.has(t.id)) continue;
    for (const v of worldVertices(t)) {
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
    }
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 400, maxY: 300 };
  }
  return { minX, minY, maxX, maxY };
}
