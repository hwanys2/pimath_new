import { worldEdges } from "./geometry";
import { pickFoldRoot } from "./net-fold-tree";
import type { FoldTile, Join, NetFoldState } from "./types";

/** Stable id for a connected component from sorted tile ids. */
export function componentKey(tileIds: string[]): string {
  return [...tileIds].sort().join("|");
}

/** Connected component tile ids via joins. */
export function connectedComponents(
  tiles: FoldTile[],
  joins: Join[],
): string[][] {
  const ids = new Set(tiles.map((t) => t.id));
  const adj = new Map<string, Set<string>>();
  for (const id of ids) adj.set(id, new Set());
  for (const j of joins) {
    if (!ids.has(j.a.tileId) || !ids.has(j.b.tileId)) continue;
    adj.get(j.a.tileId)!.add(j.b.tileId);
    adj.get(j.b.tileId)!.add(j.a.tileId);
  }
  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const stack = [id];
    const comp: string[] = [];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const n of adj.get(cur) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

/** Component ids for the current selection; empty when nothing is selected. */
export function selectedComponentIds(
  tiles: FoldTile[],
  joins: Join[],
  selectedIds: string[],
): string[][] {
  if (selectedIds.length === 0) return [];
  const set = new Set<string>();
  const out: string[][] = [];
  for (const id of selectedIds) {
    if (!tiles.some((t) => t.id === id)) continue;
    const comp = componentContaining(tiles, joins, id);
    const key = componentKey(comp);
    if (set.has(key)) continue;
    set.add(key);
    out.push(comp);
  }
  return out;
}

export function componentContaining(
  tiles: FoldTile[],
  joins: Join[],
  tileId: string,
): string[] {
  return (
    connectedComponents(tiles, joins).find((c) => c.includes(tileId)) ?? [
      tileId,
    ]
  );
}

/** All tile ids in the connected net(s) touched by the current selection. */
export function activeNetTileIds(
  tiles: FoldTile[],
  joins: Join[],
  selectedIds: string[],
): string[] {
  if (tiles.length === 0) return [];
  if (selectedIds.length > 0) {
    const set = new Set<string>();
    for (const id of selectedIds) {
      if (!tiles.some((t) => t.id === id)) continue;
      for (const cid of componentContaining(tiles, joins, id)) {
        set.add(cid);
      }
    }
    return [...set];
  }
  const comps = connectedComponents(tiles, joins);
  if (comps.length === 1) return comps[0];
  return [];
}

export function joinsTouching(
  joins: Join[],
  tileIds: Set<string>,
): Join[] {
  return joins.filter(
    (j) => tileIds.has(j.a.tileId) || tileIds.has(j.b.tileId),
  );
}

export function removeJoinsForTiles(
  joins: Join[],
  tileIds: Set<string>,
): Join[] {
  return joins.filter(
    (j) => !tileIds.has(j.a.tileId) && !tileIds.has(j.b.tileId),
  );
}

export function detachSelectedJoins(
  joins: Join[],
  selectedIds: string[],
): Join[] {
  const sel = new Set(selectedIds);
  return joins.filter(
    (j) => !(sel.has(j.a.tileId) || sel.has(j.b.tileId)),
  );
}

/** Edge alignment tolerance (px). */
export const JOIN_ALIGN_EPS = 8;

/** True when joined edges still coincide in world space. */
export function joinEdgesAligned(
  tiles: FoldTile[],
  join: Join,
  eps = JOIN_ALIGN_EPS,
): boolean {
  const ta = tiles.find((t) => t.id === join.a.tileId);
  const tb = tiles.find((t) => t.id === join.b.tileId);
  if (!ta || !tb) return false;
  const ea = worldEdges(ta)[join.a.edgeIndex];
  const eb = worldEdges(tb)[join.b.edgeIndex];
  if (!ea || !eb) return false;
  const midDist = Math.hypot(ea.mid.x - eb.mid.x, ea.mid.y - eb.mid.y);
  if (midDist > eps) return false;
  const aligned =
    Math.hypot(ea.a.x - eb.b.x, ea.a.y - eb.b.y) +
      Math.hypot(ea.b.x - eb.a.x, ea.b.y - eb.a.y);
  const reversed =
    Math.hypot(ea.a.x - eb.a.x, ea.a.y - eb.a.y) +
      Math.hypot(ea.b.x - eb.b.x, ea.b.y - eb.b.y);
  return Math.min(aligned, reversed) < eps * 2;
}

/** Drop joins whose tiles are no longer edge-aligned. */
export function pruneSeparatedJoins(
  tiles: FoldTile[],
  joins: Join[],
): Join[] {
  return joins.filter((j) => joinEdgesAligned(tiles, j));
}

/**
 * Break joins between moving tiles and stationary ones.
 * Joins fully inside the moving set are kept.
 */
export function detachMovingJoins(
  joins: Join[],
  movingIds: string[],
): Join[] {
  const moving = new Set(movingIds);
  return joins.filter((j) => {
    const a = moving.has(j.a.tileId);
    const b = moving.has(j.b.tileId);
    return a === b;
  });
}

/** Add joins for aligned adjacent edges not yet recorded. */
export function discoverAlignedJoins(
  tiles: FoldTile[],
  joins: Join[],
): Join[] {
  const busy = new Set<string>();
  for (const j of joins) {
    busy.add(`${j.a.tileId}:${j.a.edgeIndex}`);
    busy.add(`${j.b.tileId}:${j.b.edgeIndex}`);
  }

  const pairKeys = new Set(
    joins.map((j) => {
      const s1 = `${j.a.tileId}:${j.a.edgeIndex}`;
      const s2 = `${j.b.tileId}:${j.b.edgeIndex}`;
      return s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
    }),
  );

  const out = [...joins];
  let seq = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const ta = tiles[i];
      const tb = tiles[j];
      const edgesA = worldEdges(ta);
      const edgesB = worldEdges(tb);
      for (let ai = 0; ai < edgesA.length; ai++) {
        const refA = `${ta.id}:${ai}`;
        if (busy.has(refA)) continue;
        for (let bi = 0; bi < edgesB.length; bi++) {
          const refB = `${tb.id}:${bi}`;
          if (busy.has(refB)) continue;
          const a = { tileId: ta.id, edgeIndex: ai };
          const b = { tileId: tb.id, edgeIndex: bi };
          const pk =
            refA < refB ? `${refA}|${refB}` : `${refB}|${refA}`;
          if (pairKeys.has(pk)) continue;
          const candidate: Join = {
            id: `fj-${Date.now().toString(36)}-${seq++}`,
            a,
            b,
          };
          if (!joinEdgesAligned(tiles, candidate)) continue;
          out.push(candidate);
          pairKeys.add(pk);
          busy.add(refA);
          busy.add(refB);
        }
      }
    }
  }
  return out;
}

/** unfoldT for the connected component containing tileId (0 when flat). */
export function unfoldTForTile(
  tiles: FoldTile[],
  joins: Join[],
  netFolds: NetFoldState[],
  tileId: string,
): number {
  const comp = componentContaining(tiles, joins, tileId);
  const key = componentKey(comp);
  return netFolds.find((n) => n.key === key)?.unfoldT ?? 0;
}

/** Keep fold state in sync with the current join graph. */
export function syncNetFolds(
  tiles: FoldTile[],
  joins: Join[],
  netFolds: NetFoldState[],
): NetFoldState[] {
  const seen = new Set<string>();
  const out: NetFoldState[] = [];
  for (const nf of netFolds) {
    const anchor = nf.tileIds.find((id) => tiles.some((t) => t.id === id));
    if (!anchor) continue;
    const comp = componentContaining(tiles, joins, anchor);
    if (comp.length < 2) continue;
    const key = componentKey(comp);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...nf,
      key,
      tileIds: comp,
      foldRootId:
        nf.foldRootId && comp.includes(nf.foldRootId)
          ? nf.foldRootId
          : pickFoldRoot(tiles, comp) ?? comp[0],
    });
  }
  return out;
}
