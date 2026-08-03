import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_TILE_SCALE } from "./shape-defs";
import { matchSolidFromSelection } from "./solid-match";
import { applyMagnetSnap } from "./magnet";
import type { FoldTile, Join } from "./types";

function square(id: string, x: number, y: number): FoldTile {
  return {
    id,
    kind: "square",
    x,
    y,
    scale: DEFAULT_TILE_SCALE,
    rotation: 0,
  };
}

function eqTri(id: string, x: number, y: number): FoldTile {
  return {
    id,
    kind: "equilateralTriangle",
    x,
    y,
    scale: DEFAULT_TILE_SCALE,
    rotation: 0,
  };
}

describe("matchSolidFromSelection", () => {
  it("matches six equal squares as a cube", () => {
    const tiles = Array.from({ length: 6 }, (_, i) =>
      square(`s${i}`, i * 80, 100),
    );
    const joins: Join[] = [];
    for (let i = 0; i < 5; i++) {
      joins.push({
        id: `j${i}`,
        a: { tileId: `s${i}`, edgeIndex: 1 },
        b: { tileId: `s${i + 1}`, edgeIndex: 3 },
      });
    }
    const m = matchSolidFromSelection(tiles, joins, tiles.map((t) => t.id));
    assert.equal(m?.type, "cube");
  });

  it("matches four equilateral triangles as a tetrahedron", () => {
    const tiles = Array.from({ length: 4 }, (_, i) =>
      eqTri(`t${i}`, i * 70, 120),
    );
    const joins: Join[] = [
      { id: "j0", a: { tileId: "t0", edgeIndex: 0 }, b: { tileId: "t1", edgeIndex: 0 } },
      { id: "j1", a: { tileId: "t0", edgeIndex: 1 }, b: { tileId: "t2", edgeIndex: 0 } },
      { id: "j2", a: { tileId: "t0", edgeIndex: 2 }, b: { tileId: "t3", edgeIndex: 0 } },
    ];
    const m = matchSolidFromSelection(tiles, joins, []);
    assert.equal(m?.type, "tetrahedron");
  });

  it("returns null for a lone heptagon", () => {
    const tiles: FoldTile[] = [
      {
        id: "h1",
        kind: "regularHeptagon",
        x: 100,
        y: 100,
        scale: DEFAULT_TILE_SCALE,
        rotation: 0,
      },
    ];
    assert.equal(matchSolidFromSelection(tiles, [], ["h1"]), null);
  });
});

describe("applyMagnetSnap", () => {
  it("snaps equal-length nearby square edges", () => {
    const tiles = [
      square("a", 100, 100),
      square("b", 100 + DEFAULT_TILE_SCALE + 8, 100),
    ];
    const { join, tiles: next } = applyMagnetSnap(tiles, [], ["b"]);
    assert.ok(join);
    assert.ok(next.find((t) => t.id === "b"));
  });
});
