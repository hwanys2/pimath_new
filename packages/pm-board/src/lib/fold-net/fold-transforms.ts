import { worldVertices } from "./geometry";
import {
  buildFoldRenderTree,
  computeTileWorldMatrices,
  transformVerticesWithMatrix,
  type HingeRenderNode,
} from "./fold-scene-graph";
import { buildNetFoldTree, foldTreeEdges } from "./net-fold-tree";
import type { FoldTile, HingeOverride, Join, Vec2 } from "./types";

export type Vec3 = { x: number; y: number; z: number };

export type TileTransform3D = {
  matrix: number[];
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

function hingeLocalVerts(h: HingeRenderNode): [number, number, number][] {
  return h.vertices.map(
    (v) =>
      [v[0] + h.pivot[0], v[1] + h.pivot[1], v[2] + h.pivot[2]] as [
        number,
        number,
        number,
      ],
  );
}

function walkHingeTransforms(
  hinges: HingeRenderNode[],
  matrices: Map<string, number[]>,
  out: Map<string, TileTransform3D>,
  tileIds?: string[],
): void {
  for (const h of hinges) {
    if (tileIds && !tileIds.includes(h.tileId)) continue;
    const matrix = matrices.get(h.tileId) ?? IDENTITY;
    const vertices = transformVerticesWithMatrix(hingeLocalVerts(h), matrix);
    out.set(h.tileId, { matrix: [...matrix], vertices });
    walkHingeTransforms(h.children, matrices, out, tileIds);
  }
}

/**
 * Compute per-tile 3D vertex positions via hinge scene graph.
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
  const renderTree = buildFoldRenderTree(
    tiles,
    joins,
    rootTileId,
    unfoldT,
    hingeOverrides,
    tileIds,
  );

  if (!renderTree) {
    for (const t of tiles) {
      if (tileIds && !tileIds.includes(t.id)) continue;
      out.set(t.id, {
        matrix: [...IDENTITY],
        vertices: worldVertices(t).map(vec2To3),
      });
    }
    return out;
  }

  const matrices = computeTileWorldMatrices(
    tiles,
    joins,
    rootTileId,
    unfoldT,
    hingeOverrides,
    tileIds,
  );

  if (!tileIds || tileIds.includes(renderTree.rootTileId)) {
    const rootMatrix = matrices.get(renderTree.rootTileId) ?? IDENTITY;
    out.set(renderTree.rootTileId, {
      matrix: [...rootMatrix],
      vertices: transformVerticesWithMatrix(renderTree.rootVertices, rootMatrix),
    });
  }

  walkHingeTransforms(renderTree.hinges, matrices, out, tileIds);

  for (const t of tiles) {
    if (tileIds && !tileIds.includes(t.id)) continue;
    if (out.has(t.id)) continue;
    out.set(t.id, {
      matrix: [...IDENTITY],
      vertices: worldVertices(t).map(vec2To3),
    });
  }

  return out;
}

export function transformedVertices(
  _tile: FoldTile,
  transform: TileTransform3D,
): Vec3[] {
  return transform.vertices;
}

export function netBounds3D(
  transforms: Map<string, TileTransform3D>,
): {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
} {
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

export function rotatePointAroundAxis(
  p: Vec3,
  pivot: Vec3,
  axis: Vec3,
  angle: number,
): Vec3 {
  const len = Math.hypot(axis.x, axis.y, axis.z) || 1;
  const k = { x: axis.x / len, y: axis.y / len, z: axis.z / len };
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
    x: pivot.x + px * cos + crossX * sin + k.x * dot * (1 - cos),
    y: pivot.y + py * cos + crossY * sin + k.y * dot * (1 - cos),
    z: pivot.z + pz * cos + crossZ * sin + k.z * dot * (1 - cos),
  };
}
