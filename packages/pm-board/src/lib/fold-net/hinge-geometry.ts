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

/** Suggest folded dihedral angle (radians) for a join between two faces. */
export function suggestHingeAngle(
  parent: FoldTile,
  child: FoldTile,
  edge: NetFoldEdge,
): number {
  const pVerts = worldVertices(parent);
  const cVerts = worldVertices(child);
  const pe = worldEdges(parent)[edge.parentEdge.edgeIndex];
  const ce = worldEdges(child)[edge.childEdge.edgeIndex];

  const findVertexIndex = (verts: Vec2[], target: Vec2) => {
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
  };

  const pA = findVertexIndex(pVerts, pe.a);
  const pB = findVertexIndex(pVerts, pe.b);
  const cA = findVertexIndex(cVerts, ce.a);
  const cB = findVertexIndex(cVerts, ce.b);

  const angleP = (interiorAngleAt(pVerts, pA) + interiorAngleAt(pVerts, pB)) / 2;
  const angleC = (interiorAngleAt(cVerts, cA) + interiorAngleAt(cVerts, cB)) / 2;

  const suggested = Math.PI - angleP - angleC;
  if (suggested > 0.05 && suggested < Math.PI - 0.05) return suggested;
  return Math.PI / 2;
}

export function hingeSpecFromJoin(
  tiles: FoldTile[],
  edge: NetFoldEdge,
): HingeSpec | null {
  const parent = tiles.find((t) => t.id === edge.parentTileId);
  const child = tiles.find((t) => t.id === edge.childTileId);
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
