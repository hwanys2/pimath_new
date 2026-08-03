import { worldVertices } from "./geometry";
import { hingeSpecFromJoin, suggestHingeAngle } from "./hinge-geometry";
import {
  buildNetFoldTree,
  flattenFoldTree,
  foldTreeEdges,
  type NetFoldNode,
} from "./net-fold-tree";
import type { FoldTile, HingeOverride, Join, Vec2 } from "./types";
import type { NetFoldEdge } from "./net-fold-tree";

export type Vec3 = { x: number; y: number; z: number };

export type TileTransform3D = {
  /** 4x4 column-major matrix (for compatibility) */
  matrix: number[];
  /** World-space vertices at current unfoldT */
  vertices: Vec3[];
};

const IDENTITY = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

export function vec2To3(v: Vec2): Vec3 {
  return { x: v.x, y: -v.y, z: 0 };
}

function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function rotatePointAroundAxis(
  p: Vec3,
  pivot: Vec3,
  axis: Vec3,
  angle: number,
): Vec3 {
  const k = normalize3(axis);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const px = p.x - pivot.x;
  const py = p.y - pivot.y;
  const pz = p.z - pivot.z;

  const dot = k.x * px + k.y * py + k.z * pz;
  const crossX = k.y * pz - k.z * py;
  const crossY = k.z * px - k.x * pz;
  const crossZ = k.x * py - k.y * px;

  return {
    x:
      pivot.x +
      px * cos +
      crossX * sin +
      k.x * dot * (1 - cos),
    y:
      pivot.y +
      py * cos +
      crossY * sin +
      k.y * dot * (1 - cos),
    z:
      pivot.z +
      pz * cos +
      crossZ * sin +
      k.z * dot * (1 - cos),
  };
}

function hingeAngleForEdge(
  tiles: FoldTile[],
  edge: NetFoldEdge,
  overrides: HingeOverride[],
): number {
  const override = overrides.find((o) => o.joinId === edge.joinId);
  if (override) return override.targetAngle;
  const parent = tiles.find((t) => t.id === edge.parentTileId);
  const child = tiles.find((t) => t.id === edge.childTileId);
  if (!parent || !child) return Math.PI / 2;
  return suggestHingeAngle(parent, child, edge);
}

function rotateSubtreeVertices(
  verts: Map<string, Vec3[]>,
  subtreeTileIds: string[],
  pivot: Vec3,
  axis: Vec3,
  angle: number,
): void {
  for (const tid of subtreeTileIds) {
    const v = verts.get(tid);
    if (!v) continue;
    verts.set(
      tid,
      v.map((p) => rotatePointAroundAxis(p, pivot, axis, angle)),
    );
  }
}

function walkAndFold(
  node: NetFoldNode,
  verts: Map<string, Vec3[]>,
  tiles: FoldTile[],
  hingeOverrides: HingeOverride[],
  unfoldT: number,
): void {
  for (const child of node.children) {
    if (!child.parentEdge) continue;
    const spec = hingeSpecFromJoin(tiles, child.parentEdge);
    if (!spec) continue;
    const angle = hingeAngleForEdge(tiles, child.parentEdge, hingeOverrides) * unfoldT;
    const pivot = vec2To3(spec.pivot);
    const axis = normalize3({
      x: spec.axisDir.x,
      y: -spec.axisDir.y,
      z: 0,
    });
    const subtreeIds = flattenFoldTree(child).map((n) => n.tileId);
    rotateSubtreeVertices(verts, subtreeIds, pivot, axis, angle);
    walkAndFold(child, verts, tiles, hingeOverrides, unfoldT);
  }
}

/**
 * Compute per-tile 3D vertex positions.
 * At unfoldT=0 vertices match worldVertices (via vec2To3).
 */
export function computeTileTransforms(
  tiles: FoldTile[],
  joins: Join[],
  rootTileId: string,
  unfoldT: number,
  hingeOverrides: HingeOverride[] = [],
  tileIds?: string[],
): Map<string, TileTransform3D> {
  const out = new Map<string, TileTransform3D>();
  const flatVerts = new Map<string, Vec3[]>();

  for (const t of tiles) {
    if (tileIds && !tileIds.includes(t.id)) continue;
    const vertices = worldVertices(t).map(vec2To3);
    flatVerts.set(t.id, vertices);
    out.set(t.id, { matrix: [...IDENTITY], vertices });
  }

  if (unfoldT < 1e-6) return out;

  const tree = buildNetFoldTree(joins, rootTileId, tileIds);
  if (!tree) return out;

  const folded = new Map(flatVerts);
  walkAndFold(tree, folded, tiles, hingeOverrides, unfoldT);

  for (const [id, vertices] of folded) {
    out.set(id, { matrix: [...IDENTITY], vertices });
  }
  return out;
}

export function transformedVertices(
  tile: FoldTile,
  transform: TileTransform3D,
): Vec3[] {
  return transform.vertices;
}

export function netBounds3D(
  transforms: Map<string, TileTransform3D>,
): { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const { vertices } of transforms.values()) {
    for (const v of vertices) {
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      minZ = Math.min(minZ, v.z);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
      maxZ = Math.max(maxZ, v.z);
    }
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

export function foldTreeEdgesForNet(
  tiles: FoldTile[],
  joins: Join[],
  rootTileId: string,
  tileIds?: string[],
) {
  const tree = buildNetFoldTree(joins, rootTileId, tileIds);
  if (!tree) return [];
  return foldTreeEdges(tree);
}
