import {
  allWorldEdges,
  dist,
  edgeLength,
  pointInPolygon,
  positionForEdgeMatch,
  rotationToAlignEdge,
  worldEdges,
  worldVertices,
} from "./geometry";
import type {
  EdgeRef,
  FoldTile,
  Join,
  MagnetCandidate,
  Vec2,
  WorldEdge,
} from "./types";

export const LENGTH_EPS = 4;
export const NEAR_EPS = 28;
export const VERTEX_EPS = 14;

function sameEdge(a: EdgeRef, b: EdgeRef): boolean {
  return a.tileId === b.tileId && a.edgeIndex === b.edgeIndex;
}

function edgeBusy(joins: Join[], ref: EdgeRef): boolean {
  return joins.some((j) => sameEdge(j.a, ref) || sameEdge(j.b, ref));
}

/** Signed side of point relative to directed edge (positive = left of edge). */
export function sideOfEdge(edge: WorldEdge, p: Vec2): number {
  const vx = p.x - edge.a.x;
  const vy = p.y - edge.a.y;
  return edge.dir.x * vy - edge.dir.y * vx;
}

/** True when tile centroids lie on opposite sides of the shared edge (net unfolds outward). */
export function isOutwardSnap(
  fixed: FoldTile,
  moving: FoldTile,
  fixedEdge: WorldEdge,
): boolean {
  const fixedSide = sideOfEdge(fixedEdge, { x: fixed.x, y: fixed.y });
  const movingSide = sideOfEdge(fixedEdge, { x: moving.x, y: moving.y });
  return fixedSide * movingSide < -1e-3;
}

/** Rough overlap check: moving centroid inside fixed polygon or vice versa. */
function tilesOverlap(fixed: FoldTile, moving: FoldTile): boolean {
  const fixedVerts = worldVertices(fixed);
  const movingVerts = worldVertices(moving);
  if (pointInPolygon({ x: moving.x, y: moving.y }, fixedVerts)) return true;
  if (pointInPolygon({ x: fixed.x, y: fixed.y }, movingVerts)) return true;
  return false;
}

export type SnapResult = {
  tile: FoldTile;
  outward: boolean;
  overlap: boolean;
};

/**
 * Compute snapped position for moving tile against fixed edge.
 * Edges align anti-parallel (shared boundary) with tiles on opposite sides.
 */
export function computeSnapForCandidate(
  moving: FoldTile,
  fixed: FoldTile,
  movingRef: EdgeRef,
  fixedRef: EdgeRef,
  preferPosition?: Vec2,
): SnapResult {
  const fixedLen = edgeLength(fixed, fixedRef.edgeIndex);
  const movingLen = edgeLength(moving, movingRef.edgeIndex);
  let next = moving;
  if (Math.abs(movingLen - fixedLen) > 0.5) {
    const ratio = fixedLen / (movingLen || 1);
    next = { ...next, scale: next.scale * ratio };
  }

  const fe = worldEdges(fixed)[fixedRef.edgeIndex];
  const targetDir: Vec2 = { x: -fe.dir.x, y: -fe.dir.y };
  const rotation = rotationToAlignEdge(next, movingRef.edgeIndex, targetDir);
  next = { ...next, rotation };
  const pos = positionForEdgeMatch(next, movingRef.edgeIndex, fe.mid);
  next = { ...next, x: pos.x, y: pos.y };

  let outward = isOutwardSnap(fixed, next, fe);
  let overlap = tilesOverlap(fixed, next);

  // If inward or overlapping, flip 180° around the shared edge midpoint.
  if (!outward || overlap) {
    const flipped = {
      ...next,
      rotation: next.rotation + Math.PI,
    };
    const flippedPos = positionForEdgeMatch(
      flipped,
      movingRef.edgeIndex,
      fe.mid,
    );
    const flippedTile = { ...flipped, x: flippedPos.x, y: flippedPos.y };
    const flippedOutward = isOutwardSnap(fixed, flippedTile, fe);
    const flippedOverlap = tilesOverlap(fixed, flippedTile);

    if (flippedOutward && !flippedOverlap) {
      next = flippedTile;
      outward = true;
      overlap = false;
    } else if (preferPosition) {
      // Pick whichever is closer to where the user dragged.
      const d0 = dist(preferPosition, { x: next.x, y: next.y });
      const d1 = dist(preferPosition, {
        x: flippedTile.x,
        y: flippedTile.y,
      });
      if (d1 < d0) {
        next = flippedTile;
        outward = flippedOutward;
        overlap = flippedOverlap;
      }
    }
  }

  return { tile: next, outward, overlap };
}

export function findMagnetCandidates(
  tiles: FoldTile[],
  joins: Join[],
  opts?: { movingTileIds?: Set<string>; lengthEps?: number; nearEps?: number },
): MagnetCandidate[] {
  const lengthEps = opts?.lengthEps ?? LENGTH_EPS;
  const nearEps = opts?.nearEps ?? NEAR_EPS;
  const edges = allWorldEdges(tiles);
  const out: MagnetCandidate[] = [];

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const ea = edges[i];
      const eb = edges[j];
      if (ea.tileId === eb.tileId) continue;
      const refA = { tileId: ea.tileId, edgeIndex: ea.edgeIndex };
      const refB = { tileId: eb.tileId, edgeIndex: eb.edgeIndex };
      if (edgeBusy(joins, refA) || edgeBusy(joins, refB)) continue;

      if (opts?.movingTileIds) {
        const aMoving = opts.movingTileIds.has(ea.tileId);
        const bMoving = opts.movingTileIds.has(eb.tileId);
        if (!aMoving && !bMoving) continue;
        if (aMoving && bMoving) continue;
      }

      if (Math.abs(ea.length - eb.length) > lengthEps) continue;

      const midDist = dist(ea.mid, eb.mid);
      const vertClose =
        Math.min(
          dist(ea.a, eb.a) + dist(ea.b, eb.b),
          dist(ea.a, eb.b) + dist(ea.b, eb.a),
        ) <
        VERTEX_EPS * 2 + lengthEps;

      if (midDist > nearEps && !vertClose) continue;

      out.push({
        a: refA,
        b: refB,
        distance: midDist,
        length: (ea.length + eb.length) / 2,
      });
    }
  }

  out.sort((x, y) => x.distance - y.distance);
  return out;
}

/** Score candidate: prefer outward non-overlapping snaps closer to drag position. */
function scoreCandidate(
  tiles: FoldTile[],
  candidate: MagnetCandidate,
  movingSet: Set<string>,
  preferPosition?: Vec2,
): number {
  const aMoving = movingSet.has(candidate.a.tileId);
  const movingRef = aMoving ? candidate.a : candidate.b;
  const fixedRef = aMoving ? candidate.b : candidate.a;
  const moving = tiles.find((t) => t.id === movingRef.tileId);
  const fixed = tiles.find((t) => t.id === fixedRef.tileId);
  if (!moving || !fixed) return Infinity;

  const snap = computeSnapForCandidate(
    moving,
    fixed,
    movingRef,
    fixedRef,
    preferPosition,
  );
  let score = candidate.distance;
  if (!snap.outward) score += 500;
  if (snap.overlap) score += 1000;
  if (preferPosition) {
    score += dist(preferPosition, { x: snap.tile.x, y: snap.tile.y }) * 0.1;
  }
  return score;
}

function pickBestCandidate(
  tiles: FoldTile[],
  candidates: MagnetCandidate[],
  movingSet: Set<string>,
  preferPosition?: Vec2,
): MagnetCandidate | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let bestScore = scoreCandidate(tiles, best, movingSet, preferPosition);
  for (let i = 1; i < candidates.length; i++) {
    const s = scoreCandidate(tiles, candidates[i], movingSet, preferPosition);
    if (s < bestScore) {
      best = candidates[i];
      bestScore = s;
    }
  }
  return best;
}

/** Preview snapped tiles without creating a join (for live drag feedback). */
export function previewSnapTiles(
  tiles: FoldTile[],
  joins: Join[],
  movingIds: string[],
  preferPosition?: Vec2,
): { tiles: FoldTile[]; candidate: MagnetCandidate | null } {
  const movingSet = new Set(movingIds);
  const candidates = findMagnetCandidates(tiles, joins, {
    movingTileIds: movingSet,
  });
  const best = pickBestCandidate(tiles, candidates, movingSet, preferPosition);
  if (!best) return { tiles, candidate: null };

  const aMoving = movingSet.has(best.a.tileId);
  const movingRef = aMoving ? best.a : best.b;
  const fixedRef = aMoving ? best.b : best.a;
  const moving = tiles.find((t) => t.id === movingRef.tileId);
  const fixed = tiles.find((t) => t.id === fixedRef.tileId);
  if (!moving || !fixed) return { tiles, candidate: null };

  const snap = computeSnapForCandidate(
    moving,
    fixed,
    movingRef,
    fixedRef,
    preferPosition,
  );
  if (!snap.outward || snap.overlap) return { tiles, candidate: null };

  const nextMoving = snap.tile;
  const dx = nextMoving.x - moving.x;
  const dy = nextMoving.y - moving.y;
  const dRot = nextMoving.rotation - moving.rotation;

  const nextTiles = tiles.map((t) => {
    if (t.id === nextMoving.id) return nextMoving;
    if (!movingSet.has(t.id)) return t;
    if (Math.abs(dRot) < 1e-6) {
      return { ...t, x: t.x + dx, y: t.y + dy };
    }
    const ox = moving.x;
    const oy = moving.y;
    const cos = Math.cos(dRot);
    const sin = Math.sin(dRot);
    const rx = t.x - ox;
    const ry = t.y - oy;
    return {
      ...t,
      x: nextMoving.x + rx * cos - ry * sin,
      y: nextMoving.y + rx * sin + ry * cos,
      rotation: t.rotation + dRot,
    };
  });

  return { tiles: nextTiles, candidate: best };
}

export function applyMagnetSnap(
  tiles: FoldTile[],
  joins: Join[],
  movingIds: string[],
  preferPosition?: Vec2,
): { tiles: FoldTile[]; join: Join | null; candidate: MagnetCandidate | null } {
  const movingSet = new Set(movingIds);
  const candidates = findMagnetCandidates(tiles, joins, {
    movingTileIds: movingSet,
  });
  const best = pickBestCandidate(tiles, candidates, movingSet, preferPosition);
  if (!best) {
    return { tiles, join: null, candidate: null };
  }

  const aMoving = movingSet.has(best.a.tileId);
  const movingRef = aMoving ? best.a : best.b;
  const fixedRef = aMoving ? best.b : best.a;

  const moving = tiles.find((t) => t.id === movingRef.tileId);
  const fixed = tiles.find((t) => t.id === fixedRef.tileId);
  if (!moving || !fixed) return { tiles, join: null, candidate: null };

  const snap = computeSnapForCandidate(
    moving,
    fixed,
    movingRef,
    fixedRef,
    preferPosition,
  );
  if (!snap.outward || snap.overlap) {
    return { tiles, join: null, candidate: null };
  }

  const nextMoving = snap.tile;
  const dx = nextMoving.x - moving.x;
  const dy = nextMoving.y - moving.y;
  const dRot = nextMoving.rotation - moving.rotation;

  const nextTiles = tiles.map((t) => {
    if (t.id === nextMoving.id) return nextMoving;
    if (!movingSet.has(t.id)) return t;
    if (Math.abs(dRot) < 1e-6) {
      return { ...t, x: t.x + dx, y: t.y + dy };
    }
    const ox = moving.x;
    const oy = moving.y;
    const cos = Math.cos(dRot);
    const sin = Math.sin(dRot);
    const rx = t.x - ox;
    const ry = t.y - oy;
    return {
      ...t,
      x: nextMoving.x + rx * cos - ry * sin,
      y: nextMoving.y + rx * sin + ry * cos,
      rotation: t.rotation + dRot,
    };
  });

  const join: Join = {
    id: `fj-${Date.now().toString(36)}`,
    a: best.a,
    b: best.b,
  };

  return { tiles: nextTiles, join, candidate: best };
}
