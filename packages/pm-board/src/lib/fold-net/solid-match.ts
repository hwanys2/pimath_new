import { edgeLength } from "./geometry";
import { SHAPE_DEFS } from "./shape-defs";
import { connectedComponents } from "./net-graph";
import type { FoldTile, Join, ShapeKind, SolidMatch, SolidType } from "./types";

const EPS = 3;

function nearlyEqual(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) <= eps;
}

function allEdgeLengths(tile: FoldTile): number[] {
  const n = SHAPE_DEFS[tile.kind].local.length;
  return Array.from({ length: n }, (_, i) => edgeLength(tile, i));
}

function isRegularN(tile: FoldTile, n: number): boolean {
  if (SHAPE_DEFS[tile.kind].local.length !== n) return false;
  const lens = allEdgeLengths(tile);
  const mean = lens.reduce((s, v) => s + v, 0) / lens.length;
  return lens.every((l) => nearlyEqual(l, mean));
}

function isSquareTile(tile: FoldTile): boolean {
  return (
    (tile.kind === "square" || tile.kind === "rhombus" || tile.kind === "rectangle") &&
    isRegularN(tile, 4)
  );
}

function isRectangleTile(tile: FoldTile): boolean {
  if (SHAPE_DEFS[tile.kind].local.length !== 4) return false;
  const [a, b, c, d] = allEdgeLengths(tile);
  return nearlyEqual(a, c) && nearlyEqual(b, d);
}

function isEquilateralTriangle(tile: FoldTile): boolean {
  return (
    (tile.kind === "equilateralTriangle" ||
      tile.kind === "scaleneTriangle" ||
      tile.kind === "rightTriangle") &&
    isRegularN(tile, 3)
  );
}

function isAnyTriangle(tile: FoldTile): boolean {
  return SHAPE_DEFS[tile.kind].local.length === 3;
}

function meanSide(tile: FoldTile): number {
  const lens = allEdgeLengths(tile);
  return lens.reduce((s, v) => s + v, 0) / lens.length;
}

function rectDims(tile: FoldTile): { w: number; h: number } {
  const [a, b] = allEdgeLengths(tile);
  return { w: Math.max(a, b), h: Math.min(a, b) };
}

const LABELS: Record<SolidType, string> = {
  cube: "정육면체",
  cuboid: "직육면체",
  tetrahedron: "정사면체",
  squarePyramid: "사각뿔",
  triangularPrism: "삼각기둥",
};

function tryMatchComponent(tiles: FoldTile[]): SolidMatch | null {
  if (tiles.length === 0) return null;

  // Cube: 6 equal squares
  if (tiles.length === 6 && tiles.every(isSquareTile)) {
    const side = meanSide(tiles[0]);
    if (tiles.every((t) => nearlyEqual(meanSide(t), side))) {
      return {
        type: "cube",
        label: LABELS.cube,
        tileIds: tiles.map((t) => t.id),
        dims: { a: side / 56 }, // normalize to scene units (~side length)
      };
    }
  }

  // Cuboid: 6 rectangles with three pair dims
  if (tiles.length === 6 && tiles.every(isRectangleTile)) {
    const dims = tiles.map(rectDims);
    const sides = dims.flatMap((d) => [d.w, d.h]);
    // Cluster unique lengths
    const unique: number[] = [];
    for (const s of sides) {
      if (!unique.some((u) => nearlyEqual(u, s))) unique.push(s);
    }
    if (unique.length >= 2 && unique.length <= 3) {
      unique.sort((a, b) => b - a);
      const [W, D, H] = [
        unique[0],
        unique[1] ?? unique[0],
        unique[2] ?? unique[1] ?? unique[0],
      ];
      // Count faces that should exist: 2 of WxD, 2 of WxH, 2 of DxH
      const countPair = (a: number, b: number) =>
        dims.filter(
          (d) =>
            (nearlyEqual(d.w, a) && nearlyEqual(d.h, b)) ||
            (nearlyEqual(d.w, b) && nearlyEqual(d.h, a)),
        ).length;
      if (
        countPair(W, D) === 2 &&
        countPair(W, H) === 2 &&
        countPair(D, H) === 2
      ) {
        return {
          type: nearlyEqual(W, D) && nearlyEqual(D, H) ? "cube" : "cuboid",
          label:
            nearlyEqual(W, D) && nearlyEqual(D, H)
              ? LABELS.cube
              : LABELS.cuboid,
          tileIds: tiles.map((t) => t.id),
          dims: { a: W / 56, b: D / 56, c: H / 56 },
        };
      }
    }
  }

  // Tetrahedron: 4 equilateral triangles
  if (tiles.length === 4 && tiles.every(isEquilateralTriangle)) {
    const side = meanSide(tiles[0]);
    if (tiles.every((t) => nearlyEqual(meanSide(t), side))) {
      return {
        type: "tetrahedron",
        label: LABELS.tetrahedron,
        tileIds: tiles.map((t) => t.id),
        dims: { a: side / 56 },
      };
    }
  }

  // Square pyramid: 1 square base + 4 triangles
  if (tiles.length === 5) {
    const squares = tiles.filter(isSquareTile);
    const tris = tiles.filter(isAnyTriangle);
    if (squares.length === 1 && tris.length === 4) {
      const base = meanSide(squares[0]);
      return {
        type: "squarePyramid",
        label: LABELS.squarePyramid,
        tileIds: tiles.map((t) => t.id),
        dims: { a: base / 56, height: (base / 56) * 0.9 },
      };
    }
  }

  // Triangular prism: 2 triangles + 3 rectangles/squares
  if (tiles.length === 5) {
    const tris = tiles.filter(isAnyTriangle);
    const quads = tiles.filter(
      (t) => SHAPE_DEFS[t.kind].local.length === 4,
    );
    if (tris.length === 2 && quads.length === 3) {
      const side = meanSide(tris[0]);
      const height = Math.max(...quads.map((q) => rectDims(q).w));
      return {
        type: "triangularPrism",
        label: LABELS.triangularPrism,
        tileIds: tiles.map((t) => t.id),
        dims: { a: side / 56, height: height / 56 },
      };
    }
  }

  return null;
}

/** Prefer component covering selection; else largest matchable component. */
export function matchSolidFromSelection(
  tiles: FoldTile[],
  joins: Join[],
  selectedIds: string[],
): SolidMatch | null {
  const comps = connectedComponents(tiles, joins);
  const sel = new Set(selectedIds);

  const ordered =
    selectedIds.length > 0
      ? [
          ...comps.filter((c) => c.some((id) => sel.has(id))),
          ...comps.filter((c) => !c.some((id) => sel.has(id))),
        ]
      : [...comps].sort((a, b) => b.length - a.length);

  for (const comp of ordered) {
    const subset = tiles.filter((t) => comp.includes(t.id));
    // If selection is partial, require selection ⊆ comp and size match intent
    if (selectedIds.length > 0) {
      const selectedInComp = selectedIds.filter((id) => comp.includes(id));
      if (selectedInComp.length === 0) continue;
      // Match on full component containing selection (joined net)
      const m = tryMatchComponent(subset);
      if (m) return m;
    } else {
      const m = tryMatchComponent(subset);
      if (m) return m;
    }
  }
  return null;
}

export function describeWhyNoMatch(
  tiles: FoldTile[],
  joins: Join[],
  selectedIds: string[],
): string {
  const comps = connectedComponents(tiles, joins);
  if (tiles.length === 0) return "도형을 먼저 배치해 주세요.";
  if (comps.every((c) => c.length < 4)) {
    return "같은 길이 변끼리 붙여 전개도를 만든 뒤 선택해 주세요.";
  }
  void selectedIds;
  return "이 전개도는 아직 접을 수 없어요. (정육면체·직육면체·정사면체·사각뿔·삼각기둥)";
}

export type { ShapeKind };
