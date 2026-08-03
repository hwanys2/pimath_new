import type { EdgeRef, FoldTile, Join } from "./types";

export type NetFoldEdge = {
  joinId: string;
  parentTileId: string;
  childTileId: string;
  parentEdge: EdgeRef;
  childEdge: EdgeRef;
};

export type NetFoldNode = {
  tileId: string;
  parentEdge?: NetFoldEdge;
  children: NetFoldNode[];
};

export function pickFoldRoot(
  tiles: FoldTile[],
  tileIds: string[],
  joins: Join[] = [],
): string | null {
  if (tileIds.length === 0) return null;
  const set = new Set(tileIds);
  const candidates = tiles.filter((t) => set.has(t.id));
  if (candidates.length === 0) return null;

  const degree = new Map<string, number>();
  for (const id of tileIds) degree.set(id, 0);
  for (const j of joins) {
    if (!set.has(j.a.tileId) || !set.has(j.b.tileId)) continue;
    degree.set(j.a.tileId, (degree.get(j.a.tileId) ?? 0) + 1);
    degree.set(j.b.tileId, (degree.get(j.b.tileId) ?? 0) + 1);
  }

  candidates.sort((a, b) => {
    const byDegree = (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0);
    if (byDegree !== 0) return byDegree;
    return b.scale - a.scale;
  });
  return candidates[0].id;
}

/** Build a spanning tree over the join graph rooted at rootTileId. */
export function buildNetFoldTree(
  joins: Join[],
  rootTileId: string,
  tileIds?: string[],
): NetFoldNode | null {
  const allowed = tileIds ? new Set(tileIds) : null;
  const adj = new Map<string, { join: Join; other: string; selfEdge: EdgeRef; otherEdge: EdgeRef }[]>();

  const add = (from: string, join: Join, selfEdge: EdgeRef, other: string, otherEdge: EdgeRef) => {
    if (allowed && (!allowed.has(from) || !allowed.has(other))) return;
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push({ join, other, selfEdge, otherEdge });
  };

  for (const j of joins) {
    add(j.a.tileId, j, j.a, j.b.tileId, j.b);
    add(j.b.tileId, j, j.b, j.a.tileId, j.a);
  }

  if (!adj.has(rootTileId)) {
    return { tileId: rootTileId, children: [] };
  }

  const visited = new Set<string>([rootTileId]);
  const build = (tileId: string): NetFoldNode => {
    const children: NetFoldNode[] = [];
    for (const { join, other, selfEdge, otherEdge } of adj.get(tileId) ?? []) {
      if (visited.has(other)) continue;
      visited.add(other);
      const parentEdge: NetFoldEdge = {
        joinId: join.id,
        parentTileId: tileId,
        childTileId: other,
        parentEdge: selfEdge,
        childEdge: otherEdge,
      };
      const sub = build(other);
      children.push({
        tileId: other,
        parentEdge,
        children: sub.children,
      });
    }
    return { tileId, children };
  };

  return build(rootTileId);
}

export function flattenFoldTree(node: NetFoldNode): NetFoldNode[] {
  const out: NetFoldNode[] = [node];
  for (const c of node.children) out.push(...flattenFoldTree(c));
  return out;
}

export function foldTreeEdges(node: NetFoldNode): NetFoldEdge[] {
  const out: NetFoldEdge[] = [];
  const walk = (n: NetFoldNode) => {
    for (const c of n.children) {
      if (c.parentEdge) out.push(c.parentEdge);
      walk(c);
    }
  };
  walk(node);
  return out;
}
