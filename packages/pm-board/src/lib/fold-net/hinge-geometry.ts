import { worldEdges, worldVertices } from "./geometry";
import type { FoldTile, Vec2 } from "./types";
import type { NetFoldEdge } from "./net-fold-tree";

export type HingeSpec = {
  joinId: string;
  pivot: Vec2;
  /** Unit direction along shared edge in 2D world space. */
  axisDir: Vec2;
  parentTileId: string;
  childTileId: string;
};

/** Interior angle (radians) at vertex `vertexIndex` of a convex polygon. */
export function interiorAngleAt(verts: Vec2[], vertexIndex: number): number {
  const n = verts.length;
  const prev = verts[(vertexIndex - 1 + n) % n];
  const cur = verts[vertexIndex];
  const next = verts[(vertexIndex + 1) % n];
  const v1x = prev.x - cur.x;
  const v1y = prev.y - cur.y;
  const v2x = next.x - cur.x;
  const v2y = next.y - cur.y;
  const dot = v1x * v2x + v1y * v2y;
  const cross = v1x * v2y - v1y * v2x;
  return Math.atan2(Math.abs(cross), dot);
}

function findVertexIndex(verts: Vec2[], target: Vec2): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const d = Math.hypot(verts[i].x - target.x, verts[i].y - target.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Unsigned dihedral magnitude (radians) from local face angles. */
export function dihedralMagnitude(
  parent: FoldTile,
  child: FoldTile,
  edge: NetFoldEdge,
): number {
  const pVerts = worldVertices(parent);
  const cVerts = worldVertices(child);
  const pe = worldEdges(parent)[edge.parentEdge.edgeIndex];
  const ce = worldEdges(child)[edge.childEdge.edgeIndex];

  const pA = findVertexIndex(pVerts, pe.a);
  const pB = findVertexIndex(pVerts, pe.b);
  const cA = findVertexIndex(cVerts, ce.a);
  const cB = findVertexIndex(cVerts, ce.b);

  const angleP = (interiorAngleAt(pVerts, pA) + interiorAngleAt(pVerts, pB)) / 2;
  const angleC = (interiorAngleAt(cVerts, cA) + interiorAngleAt(cVerts, cB)) / 2;

  if (parent.kind === "equilateralTriangle" && child.kind === "equilateralTriangle") {
    return Math.PI - Math.acos(1 / 3);
  }

  const suggested = Math.PI - angleP - angleC;
  if (suggested > 0.05 && suggested < Math.PI - 0.05) return suggested;
  return Math.PI / 2;
}

/**
 * Signed hinge angle: magnitude from face geometry, sign from which side of the
 * shared edge the child face lies (folds toward +Z in 3D canvas space).
 */
export function signedHingeAngle(
  parent: FoldTile,
  child: FoldTile,
  edge: NetFoldEdge,
): number {
  const spec = hingeSpecFromJoin(parent, child, edge);
  if (!spec) return Math.PI / 2;

  const magnitude = dihedralMagnitude(parent, child, edge);
  const cVerts = worldVertices(child);
  const cx =
    cVerts.reduce((s, v) => s + v.x, 0) / Math.max(1, cVerts.length);
  const cy =
    cVerts.reduce((s, v) => s + v.y, 0) / Math.max(1, cVerts.length);
  const toChild = { x: cx - spec.pivot.x, y: cy - spec.pivot.y };
  const cross = spec.axisDir.x * toChild.y - spec.axisDir.y * toChild.x;
  const sign = cross >= 0 ? 1 : -1;
  return sign * magnitude;
}

/** Suggest folded dihedral angle (radians) for a join between two faces. */
export function suggestHingeAngle(
  parent: FoldTile,
  child: FoldTile,
  edge: NetFoldEdge,
): number {
  return signedHingeAngle(parent, child, edge);
}

export function hingeSpecFromJoin(
  parentOrTiles: FoldTile | FoldTile[],
  childOrEdge: FoldTile | NetFoldEdge,
  edgeMaybe?: NetFoldEdge,
): HingeSpec | null {
  let parent: FoldTile | undefined;
  let child: FoldTile | undefined;
  let edge: NetFoldEdge;

  if (Array.isArray(parentOrTiles)) {
    edge = childOrEdge as NetFoldEdge;
    parent = parentOrTiles.find((t) => t.id === edge.parentTileId);
    child = parentOrTiles.find((t) => t.id === edge.childTileId);
  } else {
    parent = parentOrTiles;
    child = childOrEdge as FoldTile;
    edge = edgeMaybe!;
  }

  if (!parent || !child) return null;

  const pe = worldEdges(parent)[edge.parentEdge.edgeIndex];
  const ce = worldEdges(child)[edge.childEdge.edgeIndex];
  if (!pe || !ce) return null;

  const pivot = {
    x: (pe.a.x + pe.b.x) / 2,
    y: (pe.a.y + pe.b.y) / 2,
  };
  const axisDir = { x: pe.dir.x, y: pe.dir.y };
  return {
    joinId: edge.joinId,
    pivot,
    axisDir,
    parentTileId: edge.parentTileId,
    childTileId: edge.childTileId,
  };
}
