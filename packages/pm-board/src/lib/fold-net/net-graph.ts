import { worldEdges } from "./geometry";
import type { FoldTile, Join } from "./types";

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

/** True when joined edges still coincide in world space. */
export function joinEdgesAligned(
  tiles: FoldTile[],
  join: Join,
  eps = 6,
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
