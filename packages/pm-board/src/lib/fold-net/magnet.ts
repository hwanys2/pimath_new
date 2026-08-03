import {
  allWorldEdges,
  dist,
  edgeLength,
  positionForEdgeMatch,
  rotationToAlignEdge,
  worldEdges,
} from "./geometry";
import type {
  EdgeRef,
  FoldTile,
  Join,
  MagnetCandidate,
  Vec2,
} from "./types";

export const LENGTH_EPS = 4;
export const NEAR_EPS = 18;
export const VERTEX_EPS = 14;

function sameEdge(a: EdgeRef, b: EdgeRef): boolean {
  return a.tileId === b.tileId && a.edgeIndex === b.edgeIndex;
}

function edgeBusy(joins: Join[], ref: EdgeRef): boolean {
  return joins.some((j) => sameEdge(j.a, ref) || sameEdge(j.b, ref));
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

export function applyMagnetSnap(
  tiles: FoldTile[],
  joins: Join[],
  movingIds: string[],
): { tiles: FoldTile[]; join: Join | null; candidate: MagnetCandidate | null } {
  const movingSet = new Set(movingIds);
  const candidates = findMagnetCandidates(tiles, joins, {
    movingTileIds: movingSet,
  });
  if (candidates.length === 0) {
    return { tiles, join: null, candidate: null };
  }
  const best = candidates[0];
  const aMoving = movingSet.has(best.a.tileId);
  const movingRef = aMoving ? best.a : best.b;
  const fixedRef = aMoving ? best.b : best.a;

  const moving = tiles.find((t) => t.id === movingRef.tileId);
  const fixed = tiles.find((t) => t.id === fixedRef.tileId);
  if (!moving || !fixed) return { tiles, join: null, candidate: null };

  const fixedLen = edgeLength(fixed, fixedRef.edgeIndex);
  const movingLen = edgeLength(moving, movingRef.edgeIndex);
  let nextMoving = moving;
  if (Math.abs(movingLen - fixedLen) > 0.5) {
    const ratio = fixedLen / (movingLen || 1);
    nextMoving = { ...moving, scale: moving.scale * ratio };
  }

  const fe = worldEdges(fixed)[fixedRef.edgeIndex];
  const targetDir: Vec2 = { x: -fe.dir.x, y: -fe.dir.y };
  const rotation = rotationToAlignEdge(
    nextMoving,
    movingRef.edgeIndex,
    targetDir,
  );
  nextMoving = { ...nextMoving, rotation };
  const pos = positionForEdgeMatch(nextMoving, movingRef.edgeIndex, fe.mid);
  nextMoving = { ...nextMoving, x: pos.x, y: pos.y };

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
