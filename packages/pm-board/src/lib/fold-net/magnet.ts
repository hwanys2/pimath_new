import {
  allWorldEdges,
  dist,
  edgeLength,
  positionForEdgeMatch,
  rotationToAlignEdge,
  worldEdges,
  worldVertices,
} from "./geometry";
import {
  pointToSegmentDistance,
  polygonsHaveAreaOverlap,
} from "./polygon-collision";
import type {
  EdgeRef,
  FoldTile,
  Join,
  MagnetCandidate,
  Vec2,
  WorldEdge,
} from "./types";

export const LENGTH_RATIO_EPS = 0.22;
export const PARALLEL_EPS = 0.35;
/** Same-shape edge proximity threshold (fraction of mean edge length). */
export const NEAR_RATIO = 0.38;
/** Tighter threshold when snapping different shapes (e.g. triangle near a cube net). */
export const MIXED_SHAPE_NEAR_RATIO = 0.18;
/** Max tile-center jump allowed when committing a snap (fraction of matched edge length). */
export const SNAP_COMMIT_JUMP_RATIO = 0.3;

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

export function isOutwardSnap(
  fixed: FoldTile,
  moving: FoldTile,
  fixedEdge: WorldEdge,
): boolean {
  const fixedSide = sideOfEdge(fixedEdge, { x: fixed.x, y: fixed.y });
  const movingSide = sideOfEdge(fixedEdge, { x: moving.x, y: moving.y });
  return fixedSide * movingSide < -1e-3;
}

function nearRatioForTiles(
  tiles: FoldTile[],
  tileIdA: string,
  tileIdB: string,
  defaultRatio: number,
): number {
  const a = tiles.find((t) => t.id === tileIdA);
  const b = tiles.find((t) => t.id === tileIdB);
  if (a && b && a.kind !== b.kind) return MIXED_SHAPE_NEAR_RATIO;
  return defaultRatio;
}

function snapWithinReach(
  preferPosition: Vec2 | undefined,
  snapTile: FoldTile,
  refLength: number,
  moving: FoldTile,
  fixed: FoldTile,
): boolean {
  if (!preferPosition) return true;
  if (moving.kind === fixed.kind) return true;
  const jump = dist(preferPosition, { x: snapTile.x, y: snapTile.y });
  return jump <= SNAP_COMMIT_JUMP_RATIO * refLength;
}

function edgeProximity(
  ea: WorldEdge,
  eb: WorldEdge,
  pointer?: Vec2,
): number {
  const dMid = dist(ea.mid, eb.mid);
  const dA = pointToSegmentDistance(ea.mid, eb.a, eb.b);
  const dB = pointToSegmentDistance(eb.mid, ea.a, ea.b);
  const dPtr = pointer
    ? Math.min(
        pointToSegmentDistance(pointer, ea.a, ea.b),
        pointToSegmentDistance(pointer, eb.a, eb.b),
      )
    : Infinity;
  return Math.min(dMid, dA, dB, dPtr);
}

function lengthRatioOk(lenA: number, lenB: number): boolean {
  const maxLen = Math.max(lenA, lenB, 1);
  return Math.abs(lenA - lenB) / maxLen <= LENGTH_RATIO_EPS;
}

function overlapsAny(
  tiles: FoldTile[],
  movingSet: Set<string>,
  candidateTile: FoldTile,
): boolean {
  const movingVerts = worldVertices(candidateTile);
  for (const t of tiles) {
    if (movingSet.has(t.id) || t.id === candidateTile.id) continue;
    if (polygonsHaveAreaOverlap(movingVerts, worldVertices(t))) return true;
  }
  return false;
}

export type SnapResult = {
  tile: FoldTile;
  outward: boolean;
  overlap: boolean;
};

export function computeSnapForCandidate(
  moving: FoldTile,
  fixed: FoldTile,
  movingRef: EdgeRef,
  fixedRef: EdgeRef,
  preferPosition?: Vec2,
  allTiles?: FoldTile[],
  movingSet?: Set<string>,
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
  let overlap =
    allTiles && movingSet
      ? overlapsAny(allTiles, movingSet, next)
      : false;

  if (!outward || overlap) {
    const flipped = { ...next, rotation: next.rotation + Math.PI };
    const flippedPos = positionForEdgeMatch(
      flipped,
      movingRef.edgeIndex,
      fe.mid,
    );
    const flippedTile = { ...flipped, x: flippedPos.x, y: flippedPos.y };
    const flippedOutward = isOutwardSnap(fixed, flippedTile, fe);
    const flippedOverlap =
      allTiles && movingSet
        ? overlapsAny(allTiles, movingSet, flippedTile)
        : false;

    if (flippedOutward && !flippedOverlap) {
      next = flippedTile;
      outward = true;
      overlap = false;
    } else if (preferPosition) {
      const d0 = dist(preferPosition, { x: next.x, y: next.y });
      const d1 = dist(preferPosition, { x: flippedTile.x, y: flippedTile.y });
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
  opts?: {
    movingTileIds?: Set<string>;
    pointer?: Vec2;
    lengthRatioEps?: number;
    nearRatio?: number;
  },
): MagnetCandidate[] {
  const lengthRatioEps = opts?.lengthRatioEps ?? LENGTH_RATIO_EPS;
  const nearRatio = opts?.nearRatio ?? NEAR_RATIO;
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

      const maxLen = Math.max(ea.length, eb.length, 1);
      if (Math.abs(ea.length - eb.length) / maxLen > lengthRatioEps) continue;

      const proximity = edgeProximity(ea, eb, opts?.pointer);
      const pairNearRatio = nearRatioForTiles(
        tiles,
        ea.tileId,
        eb.tileId,
        nearRatio,
      );
      const threshold = pairNearRatio * ((ea.length + eb.length) / 2);
      if (proximity > threshold) continue;

      out.push({
        a: refA,
        b: refB,
        distance: proximity,
        length: (ea.length + eb.length) / 2,
      });
    }
  }

  out.sort((x, y) => x.distance - y.distance);
  return out;
}

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
    tiles,
    movingSet,
  );
  let score = candidate.distance;
  if (!snap.outward) score += 500;
  if (snap.overlap) score += 1000;
  if (preferPosition) {
    score += dist(preferPosition, { x: snap.tile.x, y: snap.tile.y }) * 0.05;
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

function applyRigidSnap(
  tiles: FoldTile[],
  movingSet: Set<string>,
  moving: FoldTile,
  nextMoving: FoldTile,
): FoldTile[] {
  const dx = nextMoving.x - moving.x;
  const dy = nextMoving.y - moving.y;
  const dRot = nextMoving.rotation - moving.rotation;
  return tiles.map((t) => {
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
}

export function previewSnapTiles(
  tiles: FoldTile[],
  joins: Join[],
  movingIds: string[],
  preferPosition?: Vec2,
): { tiles: FoldTile[]; candidate: MagnetCandidate | null } {
  const movingSet = new Set(movingIds);
  const candidates = findMagnetCandidates(tiles, joins, {
    movingTileIds: movingSet,
    pointer: preferPosition,
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
    tiles,
    movingSet,
  );
  if (!snap.outward || snap.overlap) return { tiles, candidate: null };
  if (!snapWithinReach(preferPosition, snap.tile, best.length, moving, fixed)) {
    return { tiles, candidate: null };
  }

  return {
    tiles: applyRigidSnap(tiles, movingSet, moving, snap.tile),
    candidate: best,
  };
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
    pointer: preferPosition,
  });
  const best = pickBestCandidate(tiles, candidates, movingSet, preferPosition);
  if (!best) return { tiles, join: null, candidate: null };

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
    tiles,
    movingSet,
  );
  if (!snap.outward || snap.overlap) {
    return { tiles, join: null, candidate: null };
  }
  if (!snapWithinReach(preferPosition, snap.tile, best.length, moving, fixed)) {
    return { tiles, join: null, candidate: null };
  }

  const join: Join = {
    id: `fj-${Date.now().toString(36)}`,
    a: best.a,
    b: best.b,
  };

  return {
    tiles: applyRigidSnap(tiles, movingSet, moving, snap.tile),
    join,
    candidate: best,
  };
}
