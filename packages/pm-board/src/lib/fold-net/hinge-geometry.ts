import { edgeLength, worldEdges, worldVertices } from "./geometry";
import { unitEdgeLengths } from "./shape-defs";
import type { FoldTile, ShapeKind, Vec2 } from "./types";
import type { NetFoldEdge } from "./net-fold-tree";

const PRISM_CAP_SIDES: Partial<Record<ShapeKind, number>> = {
  equilateralTriangle: 3,
  scaleneTriangle: 3,
  rightTriangle: 3,
  regularPentagon: 5,
  regularHexagon: 6,
  regularHeptagon: 7,
  regularOctagon: 8,
};

function isEquilateralTriangleKind(kind: ShapeKind): boolean {
  return kind === "equilateralTriangle";
}

/**
 * Hinge rotation (radians) at unfoldT=1 from a flat net crease, given mean
 * interior face angles at the shared edge endpoints.
 */
export function hingeMagnitudeFromFaceAngles(
  angleP: number,
  angleC: number,
  parentKind?: ShapeKind,
  childKind?: ShapeKind,
): number {
  if (
    parentKind &&
    childKind &&
    isEquilateralTriangleKind(parentKind) &&
    isEquilateralTriangleKind(childKind)
  ) {
    return Math.PI - Math.acos(1 / 3);
  }

  const denom = Math.sin(angleP) * Math.sin(angleC);
  if (denom < 1e-9) return Math.PI / 2;

  const x = (Math.cos(angleP) + Math.cos(angleC)) / denom;
  if (x <= -1 + 1e-9) return Math.PI;
  if (x >= 1 - 1e-9) {
    const flat = Math.PI - angleP - angleC;
    return flat > 0.05 ? flat : Math.PI / 2;
  }

  return Math.PI - Math.acos(x);
}

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

function isQuadKind(kind: ShapeKind): boolean {
  return kind === "square" || kind === "rectangle" || kind === "rhombus";
}

function polygonPrismSides(kind: ShapeKind): number | null {
  return PRISM_CAP_SIDES[kind] ?? null;
}

/** Infer prism base side count from cap polygons in a connected net. */
export function prismSideCountFromTiles(tiles: FoldTile[]): number | null {
  let best: number | null = null;
  let bestCaps = 0;
  for (const tile of tiles) {
    const n = polygonPrismSides(tile.kind);
    if (!n) continue;
    const caps = tiles.filter((t) => polygonPrismSides(t.kind) === n).length;
    if (caps > bestCaps) {
      bestCaps = caps;
      best = n;
    }
  }
  return best;
}

function isPrismNet(netTiles?: FoldTile[]): boolean {
  if (!netTiles) return false;
  const n = prismSideCountFromTiles(netTiles);
  if (!n) return false;
  const lateralQuads = netTiles.filter((t) => isQuadKind(t.kind)).length;
  return lateralQuads >= 2;
}

function isPrismCapJoin(
  parent: FoldTile,
  child: FoldTile,
  netTiles?: FoldTile[],
): boolean {
  if (!isPrismNet(netTiles)) return false;
  const parentSides = polygonPrismSides(parent.kind);
  const childSides = polygonPrismSides(child.kind);
  return (
    (parentSides != null && isQuadKind(child.kind)) ||
    (childSides != null && isQuadKind(parent.kind))
  );
}

/** Prism caps and lateral bands use angles the generic dihedral formula mishandles. */
function prismHingeMagnitude(
  parent: FoldTile,
  child: FoldTile,
  netTiles?: FoldTile[],
): number | null {
  if (isPrismCapJoin(parent, child, netTiles)) return Math.PI / 2;

  if (!isPrismNet(netTiles) || !isQuadKind(parent.kind) || !isQuadKind(child.kind)) {
    return null;
  }

  const n = prismSideCountFromTiles(netTiles);
  if (!n || n < 3) return null;
  const interior = ((n - 2) * Math.PI) / n;
  const exterior = (2 * Math.PI) / n;
  return Math.max(interior, exterior);
}

/** Square frustum nets: lateral and cap faces fold perpendicular to neighbors. */
function squareTrapezoidHingeMagnitude(
  parent: FoldTile,
  child: FoldTile,
  edge: NetFoldEdge,
): number | null {
  const trap =
    parent.kind === "isoscelesTrapezoid"
      ? parent
      : child.kind === "isoscelesTrapezoid"
        ? child
        : null;
  if (!trap) return null;
  const quad = trap === parent ? child : parent;
  if (!isQuadKind(quad.kind)) return null;

  const trapEdgeIndex =
    parent === trap ? edge.parentEdge.edgeIndex : edge.childEdge.edgeIndex;
  const units = unitEdgeLengths("isoscelesTrapezoid");
  const len = edgeLength(trap, trapEdgeIndex);
  const longLen = units[0] * trap.scale * (trap.edgeScale?.[0] ?? 1);
  const shortLen = units[2] * trap.scale * (trap.edgeScale?.[2] ?? 1);
  if (Math.abs(len - longLen) < 3 || Math.abs(len - shortLen) < 3) {
    return Math.PI / 2;
  }
  return null;
}

/** Top-cap joins attach at the trapezoid's short base; sign must fold inward. */
function flipTrapezoidCapSign(
  parent: FoldTile,
  child: FoldTile,
  edge: NetFoldEdge,
): boolean {
  const trap =
    parent.kind === "isoscelesTrapezoid"
      ? parent
      : child.kind === "isoscelesTrapezoid"
        ? child
        : null;
  if (!trap) return false;
  const quad = trap === parent ? child : parent;
  if (!isQuadKind(quad.kind)) return false;
  const trapEdgeIndex =
    parent === trap ? edge.parentEdge.edgeIndex : edge.childEdge.edgeIndex;
  const units = unitEdgeLengths("isoscelesTrapezoid");
  const len = edgeLength(trap, trapEdgeIndex);
  const shortLen = units[2] * trap.scale * (trap.edgeScale?.[2] ?? 1);
  return Math.abs(len - shortLen) < 3;
}

/** Unsigned hinge rotation magnitude (radians) from local face angles. */
export function dihedralMagnitude(
  parent: FoldTile,
  child: FoldTile,
  edge: NetFoldEdge,
  netTiles?: FoldTile[],
): number {
  const frustumMag = squareTrapezoidHingeMagnitude(parent, child, edge);
  if (frustumMag != null) return frustumMag;

  const prismMag = prismHingeMagnitude(parent, child, netTiles);
  if (prismMag != null) return prismMag;

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

  return hingeMagnitudeFromFaceAngles(angleP, angleC, parent.kind, child.kind);
}

/**
 * Signed hinge angle: magnitude from face geometry, sign from which side of the
 * shared edge the child face lies (folds toward +Z in 3D canvas space).
 */
export function signedHingeAngle(
  parent: FoldTile,
  child: FoldTile,
  edge: NetFoldEdge,
  netTiles?: FoldTile[],
): number {
  const spec = hingeSpecFromJoin(parent, child, edge);
  if (!spec) return Math.PI / 2;

  const magnitude = dihedralMagnitude(parent, child, edge, netTiles);
  const cVerts = worldVertices(child);
  const cx =
    cVerts.reduce((s, v) => s + v.x, 0) / Math.max(1, cVerts.length);
  const cy =
    cVerts.reduce((s, v) => s + v.y, 0) / Math.max(1, cVerts.length);
  const toChild = { x: cx - spec.pivot.x, y: cy - spec.pivot.y };
  const cross = spec.axisDir.x * toChild.y - spec.axisDir.y * toChild.x;
  let sign = cross >= 0 ? -1 : 1;
  if (flipTrapezoidCapSign(parent, child, edge)) sign *= -1;
  return sign * magnitude;
}

/** Suggest folded dihedral angle (radians) for a join between two faces. */
export function suggestHingeAngle(
  parent: FoldTile,
  child: FoldTile,
  edge: NetFoldEdge,
  netTiles?: FoldTile[],
): number {
  return signedHingeAngle(parent, child, edge, netTiles);
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
