import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_TILE_SCALE } from "./shape-defs";
import { matchSolidFromSelection } from "./solid-match";
import {
  applyMagnetSnap,
  computeSnapForCandidate,
  findMagnetCandidates,
  isOutwardSnap,
} from "./magnet";
import { worldEdges, worldVertices } from "./geometry";
import { canFoldNet, solveClosureAngles } from "./closure-solver";
import { computeTileTransforms, vec2To3 } from "./fold-transforms";
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

function eqTri(id: string, x: number, y: number, rot = 0): FoldTile {
  return {
    id,
    kind: "equilateralTriangle",
    x,
    y,
    scale: DEFAULT_TILE_SCALE,
    rotation: rot,
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
});

describe("applyMagnetSnap", () => {
  it("snaps square edges outward", () => {
    const fixed = square("a", 200, 200);
    const moving = square("b", 200 + DEFAULT_TILE_SCALE + 8, 200);
    const { join, tiles: next } = applyMagnetSnap(
      [fixed, moving],
      [],
      ["b"],
      { x: moving.x, y: moving.y },
    );
    assert.ok(join);
    const snapped = next.find((t) => t.id === "b")!;
    const fixedRef = join!.a.tileId === "a" ? join!.a : join!.b;
    assert.ok(isOutwardSnap(fixed, snapped, worldEdges(fixed)[fixedRef.edgeIndex]));
  });

  it("snaps equilateral triangles from cardinal drag positions", () => {
    const center = eqTri("c", 300, 300);
    const right = eqTri("r", 355, 300);
    const { tiles: afterR, join: j1 } = applyMagnetSnap(
      [center, right],
      [],
      ["r"],
      { x: right.x, y: right.y },
    );
    assert.ok(j1);
    const left = eqTri("l", 240, 300);
    const withL = [...afterR.filter((t) => t.id !== "l"), left];
    const { join: j2 } = applyMagnetSnap(withL, [j1!], ["l"], {
      x: left.x,
      y: left.y,
    });
    assert.ok(j2);
    const top = eqTri("u", 300, 240);
    const withU = [...withL.filter((t) => t.id !== "u"), top];
    const candidates = findMagnetCandidates(withU, [j1!, j2!], {
      movingTileIds: new Set(["u"]),
      pointer: { x: top.x, y: top.y },
    });
    assert.ok(candidates.length > 0, "third triangle should find snap candidates");
  });

  it("snaps triangles with different scales via auto-scale", () => {
    const fixed = eqTri("a", 200, 200);
    const moving = { ...eqTri("b", 280, 200), scale: DEFAULT_TILE_SCALE * 1.2 };
    const candidates = findMagnetCandidates([fixed, moving], [], {
      movingTileIds: new Set(["b"]),
      pointer: { x: moving.x, y: moving.y },
    });
    assert.ok(candidates.length > 0);
    const snap = computeSnapForCandidate(
      moving,
      fixed,
      candidates[0].a.tileId === "b" ? candidates[0].a : candidates[0].b,
      candidates[0].a.tileId === "a" ? candidates[0].a : candidates[0].b,
      { x: moving.x, y: moving.y },
      [fixed, moving],
      new Set(["b"]),
    );
    assert.ok(snap.outward);
    assert.ok(!snap.overlap);
  });
});

describe("fold transforms", () => {
  it("preserves flat positions at unfoldT=0", () => {
    const tiles = [square("a", 100, 100), square("b", 200, 100)];
    const joins: Join[] = [
      {
        id: "j0",
        a: { tileId: "a", edgeIndex: 1 },
        b: { tileId: "b", edgeIndex: 3 },
      },
    ];
    const tr = computeTileTransforms(tiles, joins, "a", 0, [], ["a", "b"]);
    const flatA = worldVertices(tiles[0]).map(vec2To3);
    const gotA = tr.get("a")!.vertices;
    for (let i = 0; i < flatA.length; i++) {
      assert.ok(Math.abs(flatA[i].x - gotA[i].x) < 0.01);
      assert.ok(Math.abs(flatA[i].y - gotA[i].y) < 0.01);
    }
  });

  it("can fold a joined net", () => {
    const tiles = [
      square("a", 100, 100),
      square("b", 100 + DEFAULT_TILE_SCALE * 1.42, 100),
    ];
    const joins: Join[] = [
      {
        id: "j0",
        a: { tileId: "a", edgeIndex: 1 },
        b: { tileId: "b", edgeIndex: 3 },
      },
    ];
    assert.ok(canFoldNet(tiles, joins, ["a", "b"]));
    const closure = solveClosureAngles(tiles, joins, ["a", "b"]);
    assert.ok(closure.angles.length === 1);
    const tr = computeTileTransforms(
      tiles,
      joins,
      "a",
      1,
      closure.angles,
      ["a", "b"],
    );
    const bVerts = tr.get("b")!.vertices;
    assert.ok(bVerts.some((v) => Math.abs(v.z) > 1), "folded face should leave the plane");
  });
});
