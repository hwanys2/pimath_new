import { hingeSpecFromJoin, suggestHingeAngle } from "./hinge-geometry";
import {
  buildNetFoldTree,
  foldTreeEdges,
  pickFoldRoot,
} from "./net-fold-tree";
import type { FoldTile, HingeOverride, Join } from "./types";

export type ClosureResult = {
  angles: HingeOverride[];
  confidence: "high" | "medium" | "low";
  message: string;
};

/**
 * Auto-suggest hinge target angles for a connected net.
 * Uses local face geometry; manual overrides can refine ambiguous nets.
 */
export function solveClosureAngles(
  tiles: FoldTile[],
  joins: Join[],
  tileIds: string[],
  existingOverrides: HingeOverride[] = [],
): ClosureResult {
  const rootId = pickFoldRoot(tiles, tileIds);
  if (!rootId) {
    return { angles: [], confidence: "low", message: "접을 면이 없습니다." };
  }

  const tree = buildNetFoldTree(joins, rootId, tileIds);
  if (!tree) {
    return { angles: [], confidence: "low", message: "전개도 트리를 만들 수 없습니다." };
  }

  const edges = foldTreeEdges(tree);
  if (edges.length === 0) {
    return {
      angles: [],
      confidence: "low",
      message: "접합된 변이 없습니다. 면을 맞닿게 붙여 주세요.",
    };
  }

  const overrideMap = new Map(existingOverrides.map((o) => [o.joinId, o.targetAngle]));
  const angles: HingeOverride[] = [];

  for (const edge of edges) {
    const spec = hingeSpecFromJoin(tiles, edge);
    if (!spec) continue;
    const existing = overrideMap.get(edge.joinId);
    const parent = tiles.find((t) => t.id === edge.parentTileId);
    const child = tiles.find((t) => t.id === edge.childTileId);
    if (!parent || !child) continue;
    const target =
      existing ?? suggestHingeAngle(parent, child, edge);
    angles.push({ joinId: edge.joinId, targetAngle: target });
  }

  const visited = new Set(tileIds);
  const joinedTiles = new Set<string>();
  for (const j of joins) {
    if (visited.has(j.a.tileId) && visited.has(j.b.tileId)) {
      joinedTiles.add(j.a.tileId);
      joinedTiles.add(j.b.tileId);
    }
  }

  let confidence: ClosureResult["confidence"] = "high";
  let message = `${angles.length}개의 접힘축 각도를 계산했습니다.`;

  if (joinedTiles.size < tileIds.length) {
    confidence = "medium";
    message = "일부 면이 접합되지 않았습니다. 자유 변이 남아 있을 수 있습니다.";
  }

  const uniqueAngles = new Set(angles.map((a) => Math.round(a.targetAngle * 100)));
  if (uniqueAngles.size > 3 && edges.length >= 4) {
    confidence = "medium";
    message = "복잡한 전개도입니다. 슬라이더로 확인하고 필요하면 각도를 조절하세요.";
  }

  return { angles, confidence, message };
}

export function canFoldNet(
  tiles: FoldTile[],
  joins: Join[],
  tileIds: string[],
): boolean {
  if (tileIds.length < 2) return false;
  const rootId = pickFoldRoot(tiles, tileIds);
  if (!rootId) return false;
  const tree = buildNetFoldTree(joins, rootId, tileIds);
  if (!tree) return false;
  return foldTreeEdges(tree).length > 0;
}
