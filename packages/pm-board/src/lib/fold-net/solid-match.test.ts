import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_TILE_SCALE } from "./shape-defs";
import { matchSolidFromSelection } from "./solid-match";
import {
  applyMagnetSnap,
  computeSnapForCandidate,
  isOutwardSnap,
} from "./magnet";
import { worldEdges } from "./geometry";
import type { FoldTile, Join } from "./types";

function square(id: string, x: number, y: number, rotation = 0): FoldTile {
  return {
    id,
    kind: "square",
    x,
    y,
    scale: DEFAULT_TILE_SCALE,
    rotation,
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
  it("snaps equal-length nearby square edges outward (not overlapping)", () => {
    const fixed = square("a", 200, 200);
    // Place moving square just to the right (8px gap between edges)
    const moving = square("b", 200 + DEFAULT_TILE_SCALE + 8, 200);
    const tiles = [fixed, moving];
    const { join, tiles: next } = applyMagnetSnap(tiles, [], ["b"], {
      x: moving.x,
      y: moving.y,
    });
    assert.ok(join);
    const snapped = next.find((t) => t.id === "b")!;
    const fixedRef = join!.a.tileId === "a" ? join!.a : join!.b;
    const fixedEdge = worldEdges(fixed)[fixedRef.edgeIndex];
    assert.ok(
      isOutwardSnap(fixed, snapped, fixedEdge),
      "snapped tile should be on opposite side of shared edge",
    );
    // Centroids should not coincide
    const dist = Math.hypot(snapped.x - fixed.x, snapped.y - fixed.y);
    assert.ok(dist > DEFAULT_TILE_SCALE * 0.5, "tiles should not overlap");
  });

  it("snaps heptagon to heptagon outward when dragged nearby", () => {
    const fixed: FoldTile = {
      id: "h1",
      kind: "regularHeptagon",
      x: 250,
      y: 250,
      scale: DEFAULT_TILE_SCALE,
      rotation: 0,
    };
    const moving: FoldTile = {
      id: "h2",
      kind: "regularHeptagon",
      x: 250 + DEFAULT_TILE_SCALE * 1.5,
      y: 250,
      scale: DEFAULT_TILE_SCALE,
      rotation: 0.3,
    };
    const snap = computeSnapForCandidate(
      moving,
      fixed,
      { tileId: "h2", edgeIndex: 0 },
      { tileId: "h1", edgeIndex: 0 },
      { x: moving.x, y: moving.y },
    );
    assert.ok(snap.outward, "heptagon snap should be outward");
    assert.ok(!snap.overlap, "heptagon snap should not overlap");
  });
});
