import { SHAPE_DEFS, unitEdgeLengths } from "./shape-defs";
import type { FoldTile, Vec2, WorldEdge } from "./types";

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function worldVertices(tile: FoldTile): Vec2[] {
  const local = SHAPE_DEFS[tile.kind].local;
  const n = local.length;
  const cos = Math.cos(tile.rotation);
  const sin = Math.sin(tile.rotation);
  const edgeScale = tile.edgeScale;

  // Apply non-uniform edge scaling by radially adjusting vertices from centroid.
  // For uniform scale (no edgeScale / all 1), this equals scale * rotated local.
  if (!edgeScale || edgeScale.every((s) => Math.abs(s - 1) < 1e-6)) {
    return local.map((p) => ({
      x: tile.x + tile.scale * (p.x * cos - p.y * sin),
      y: tile.y + tile.scale * (p.x * sin + p.y * cos),
    }));
  }

  // Build target edge lengths, then use iterative vertex placement along a
  // similarity transform: keep angles from unit shape, stretch edges.
  // Practical approach: scale whole shape by mean edgeScale, then nudge.
  const units = unitEdgeLengths(tile.kind);
  const targets = units.map((u, i) => u * tile.scale * (edgeScale[i] ?? 1));
  const meanTarget =
    targets.reduce((s, v) => s + v, 0) / Math.max(1, targets.length);
  const meanUnit = units.reduce((s, v) => s + v, 0) / Math.max(1, units.length);
  const s = meanTarget / (meanUnit || 1);
  return local.map((p) => ({
    x: tile.x + s * (p.x * cos - p.y * sin),
    y: tile.y + s * (p.x * sin + p.y * cos),
  }));
}

export function worldEdges(tile: FoldTile): WorldEdge[] {
  const verts = worldVertices(tile);
  const n = verts.length;
  const units = unitEdgeLengths(tile.kind);
  const out: WorldEdge[] = [];
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const length =
      units[i] * tile.scale * (tile.edgeScale?.[i] ?? 1);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    out.push({
      tileId: tile.id,
      edgeIndex: i,
      a,
      b,
      length,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      dir: { x: dx / len, y: dy / len },
    });
  }
  return out;
}

export function allWorldEdges(tiles: FoldTile[]): WorldEdge[] {
  return tiles.flatMap(worldEdges);
}

export function edgeLength(tile: FoldTile, edgeIndex: number): number {
  const units = unitEdgeLengths(tile.kind);
  return units[edgeIndex] * tile.scale * (tile.edgeScale?.[edgeIndex] ?? 1);
}

export function tileBounds(tile: FoldTile): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const verts = worldVertices(tile);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const v of verts) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }
  return { minX, minY, maxX, maxY };
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Rotate tile so edge `edgeIndex` points along `targetDir` in world space.
 * For net snapping, targetDir is the anti-parallel of the fixed edge so
 * shared vertices coincide and tiles sit on opposite sides of the boundary.
 */
export function rotationToAlignEdge(
  tile: FoldTile,
  edgeIndex: number,
  targetDir: Vec2,
): number {
  const local = SHAPE_DEFS[tile.kind].local;
  const a = local[edgeIndex];
  const b = local[(edgeIndex + 1) % local.length];
  const edgeAngle = Math.atan2(b.y - a.y, b.x - a.x);
  const targetAngle = Math.atan2(targetDir.y, targetDir.x);
  return targetAngle - edgeAngle;
}

/** Translate tile so edge midpoint matches target mid, after rotation set. */
export function positionForEdgeMatch(
  tile: FoldTile,
  edgeIndex: number,
  targetMid: Vec2,
): { x: number; y: number } {
  const edges = worldEdges(tile);
  const e = edges[edgeIndex];
  return {
    x: tile.x + (targetMid.x - e.mid.x),
    y: tile.y + (targetMid.y - e.mid.y),
  };
}

export function createTileId(): string {
  return `ft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createJoinId(): string {
  return `fj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
