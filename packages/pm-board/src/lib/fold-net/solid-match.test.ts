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
import { worldEdges, worldVertices, positionForEdgeMatch, rotationToAlignEdge } from "./geometry";
import { canFoldNet, solveClosureAngles } from "./closure-solver";
import { computeTileTransforms, vec2To3 } from "./fold-transforms";
import { signedHingeAngle, dihedralMagnitude } from "./hinge-geometry";
import { buildNetFoldTree, foldTreeEdges, pickFoldRoot } from "./net-fold-tree";
import { activeNetTileIds, componentKey, syncNetFolds, unfoldTForTile } from "./net-graph";
import {
  buildFoldRenderTree,
  evaluateRenderTreeVertices,
} from "./fold-scene-graph";
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

function placeOnEdge(
  tile: FoldTile,
  edgeIndex: number,
  fixed: FoldTile,
  fixedEdgeIndex: number,
): FoldTile {
  const fe = worldEdges(fixed)[fixedEdgeIndex];
  const rot = rotationToAlignEdge(tile, edgeIndex, {
    x: -fe.dir.x,
    y: -fe.dir.y,
  });
  const placed = { ...tile, rotation: rot };
  return { ...placed, ...positionForEdgeMatch(placed, edgeIndex, fe.mid) };
}

function countVertexClusters(
  verts: { x: number; y: number; z: number }[],
  eps = 10,
): number {
  const clusters: typeof verts = [];
  for (const v of verts) {
    if (
      !clusters.find(
        (c) => Math.hypot(c.x - v.x, c.y - v.y, c.z - v.z) < eps,
      )
    ) {
      clusters.push(v);
    }
  }
  return clusters.length;
}

describe("activeNetTileIds", () => {
  it("includes full component when multiple tiles are selected", () => {
    const tiles = [
      square("a", 100, 100),
      square("b", 200, 100),
      square("c", 300, 100),
    ];
    const joins: Join[] = [
      { id: "j0", a: { tileId: "a", edgeIndex: 1 }, b: { tileId: "b", edgeIndex: 3 } },
      { id: "j1", a: { tileId: "b", edgeIndex: 1 }, b: { tileId: "c", edgeIndex: 3 } },
    ];
    const ids = activeNetTileIds(tiles, joins, ["a", "b"]);
    assert.deepEqual(new Set(ids), new Set(["a", "b", "c"]));
  });

  it("returns empty when nothing is selected and multiple components exist", () => {
    const tiles = [square("a", 100, 100), square("b", 400, 100)];
    const ids = activeNetTileIds(tiles, [], []);
    assert.deepEqual(ids, []);
  });
});

describe("componentKey", () => {
  it("is stable regardless of tile id order", () => {
    assert.equal(componentKey(["b", "a", "c"]), componentKey(["a", "b", "c"]));
  });
});

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

  it("does not snap triangle to distant square net", () => {
    const cube = square("a", 200, 200);
    const triangle = eqTri("t", 520, 320);
    const { join } = applyMagnetSnap(
      [cube, triangle],
      [],
      ["t"],
      { x: triangle.x, y: triangle.y },
    );
    assert.equal(join, null);
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

  it("folds tetrahedron net with scene graph at t=1", () => {
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
    const { tiles: afterL, join: j2 } = applyMagnetSnap(withL, [j1!], ["l"], {
      x: left.x,
      y: left.y,
    });
    assert.ok(j2);
    const top = eqTri("u", 300, 240);
    const withU = [...afterL.filter((t) => t.id !== "u"), top];
    const { tiles: finalTiles, join: j3 } = applyMagnetSnap(
      withU,
      [j1!, j2!],
      ["u"],
      { x: top.x, y: top.y },
    );
    assert.ok(j3);
    const joins = [j1!, j2!, j3!];
    const ids = finalTiles.map((t) => t.id);
    assert.ok(canFoldNet(finalTiles, joins, ids));

    const closure = solveClosureAngles(finalTiles, joins, ids);
    assert.equal(closure.angles.length, 3);

    const tr = computeTileTransforms(
      finalTiles,
      joins,
      "c",
      1,
      closure.angles,
      ids,
    );
    const zs = [...tr.values()].flatMap((t) => t.vertices.map((v) => v.z));
    assert.ok(zs.some((z) => Math.abs(z) > 5), "tetrahedron faces should lift off the plane");

    const tree = buildNetFoldTree(joins, "c", ids);
    assert.ok(tree);
    const edges = foldTreeEdges(tree!);
    const edge = edges[0];
    const parent = finalTiles.find((t) => t.id === edge.parentTileId)!;
    const child = finalTiles.find((t) => t.id === edge.childTileId)!;
    const angle = signedHingeAngle(parent, child, edge);
    assert.ok(Math.abs(angle) > 0.5 && Math.abs(angle) < 2.5, "hinge angle in plausible range");
  });

  it("signed hinge angle magnitude matches dihedral geometry", () => {
    const parent = eqTri("p", 200, 200);
    const child = eqTri("c", 260, 200);
    const join: Join = {
      id: "j",
      a: { tileId: "p", edgeIndex: 0 },
      b: { tileId: "c", edgeIndex: 0 },
    };
    const tree = buildNetFoldTree([join], "p", ["p", "c"]);
    const edge = foldTreeEdges(tree!)[0];
    const angle = signedHingeAngle(parent, child, edge);
    const mag = dihedralMagnitude(parent, child, edge);
    assert.ok(Math.abs(Math.abs(angle) - mag) < 0.02);
    assert.ok(angle !== 0);
  });

  it("tetrahedron apex vertices converge at t=1", () => {
    const center = eqTri("c", 300, 300);
    const right = eqTri("r", 355, 300);
    const { tiles: afterR, join: j1 } = applyMagnetSnap(
      [center, right],
      [],
      ["r"],
      { x: right.x, y: right.y },
    );
    const left = eqTri("l", 240, 300);
    const withL = [...afterR.filter((t) => t.id !== "l"), left];
    const { tiles: afterL, join: j2 } = applyMagnetSnap(withL, [j1!], ["l"], {
      x: left.x,
      y: left.y,
    });
    const top = eqTri("u", 300, 240);
    const withU = [...afterL.filter((t) => t.id !== "u"), top];
    const { tiles: finalTiles, join: j3 } = applyMagnetSnap(
      withU,
      [j1!, j2!],
      ["u"],
      { x: top.x, y: top.y },
    );
    const joins = [j1!, j2!, j3!];
    const ids = finalTiles.map((t) => t.id);
    const closure = solveClosureAngles(finalTiles, joins, ids);
    const tree = buildFoldRenderTree(
      finalTiles,
      joins,
      "c",
      1,
      closure.angles,
      ids,
    );
    assert.ok(tree);
    const tr = evaluateRenderTreeVertices(tree);

    const allVerts = [...tr.values()].flatMap((t) => t);
    const clusters: { x: number; y: number; z: number }[] = [];
    const eps = 3;
    for (const v of allVerts) {
      const hit = clusters.find(
        (c) => Math.hypot(c.x - v.x, c.y - v.y, c.z - v.z) < eps,
      );
      if (!hit) clusters.push(v);
    }
    assert.equal(clusters.length, 4, "folded tetrahedron should have 4 unique vertices");

    const flatTree = buildFoldRenderTree(
      finalTiles,
      joins,
      "c",
      0.5,
      closure.angles,
      ids,
    );
    const foldedTree = buildFoldRenderTree(
      finalTiles,
      joins,
      "c",
      0.5,
      closure.angles,
      ids,
    );
    assert.ok(flatTree && foldedTree);
    assert.deepEqual(foldedTree!.hinges[0].pivot, flatTree!.hinges[0].pivot);
  });

  it("square pyramid apex converges at t=1", () => {
    const base = square("base", 400, 400);
    const tn = placeOnEdge(eqTri("tn", 0, 0), 0, base, 2);
    const ts = placeOnEdge(eqTri("ts", 0, 0), 0, base, 0);
    const te = placeOnEdge(eqTri("te", 0, 0), 0, base, 3);
    const tw = placeOnEdge(eqTri("tw", 0, 0), 0, base, 1);
    const tiles = [base, tn, ts, te, tw];
    const joins: Join[] = [
      {
        id: "j0",
        a: { tileId: "base", edgeIndex: 2 },
        b: { tileId: "tn", edgeIndex: 0 },
      },
      {
        id: "j1",
        a: { tileId: "base", edgeIndex: 0 },
        b: { tileId: "ts", edgeIndex: 0 },
      },
      {
        id: "j2",
        a: { tileId: "base", edgeIndex: 3 },
        b: { tileId: "te", edgeIndex: 0 },
      },
      {
        id: "j3",
        a: { tileId: "base", edgeIndex: 1 },
        b: { tileId: "tw", edgeIndex: 0 },
      },
    ];
    const ids = tiles.map((t) => t.id);
    assert.ok(canFoldNet(tiles, joins, ids));
    const root = pickFoldRoot(tiles, ids, joins)!;
    const closure = solveClosureAngles(tiles, joins, ids);
    const tree = buildFoldRenderTree(
      tiles,
      joins,
      root,
      1,
      closure.angles,
      ids,
    );
    assert.ok(tree);
    const byTile = evaluateRenderTreeVertices(tree!);
    const verts = [...byTile.values()].flat();
    assert.equal(
      countVertexClusters(verts),
      5,
      "folded pyramid should have 5 vertices (base corners + apex)",
    );
    const maxZ = Math.max(...verts.map((v) => Math.abs(v.z)));
    assert.ok(maxZ > 20, "pyramid should fold off the plane at t=1");
  });

  it("frustum top face closes flat at t=1", () => {
    const base: FoldTile = {
      ...square("base", 400, 400),
      edgeScale: [1.6, 1.6, 1.6, 1.6],
    };
    const tn = placeOnEdge(
      {
        id: "tn",
        kind: "isoscelesTrapezoid",
        x: 0,
        y: 0,
        scale: DEFAULT_TILE_SCALE,
        rotation: 0,
      },
      0,
      base,
      2,
    );
    const ts = placeOnEdge(
      {
        id: "ts",
        kind: "isoscelesTrapezoid",
        x: 0,
        y: 0,
        scale: DEFAULT_TILE_SCALE,
        rotation: 0,
      },
      0,
      base,
      0,
    );
    const te = placeOnEdge(
      {
        id: "te",
        kind: "isoscelesTrapezoid",
        x: 0,
        y: 0,
        scale: DEFAULT_TILE_SCALE,
        rotation: 0,
      },
      0,
      base,
      3,
    );
    const tw = placeOnEdge(
      {
        id: "tw",
        kind: "isoscelesTrapezoid",
        x: 0,
        y: 0,
        scale: DEFAULT_TILE_SCALE,
        rotation: 0,
      },
      0,
      base,
      1,
    );
    const top = placeOnEdge(square("top", 0, 0), 0, tn, 2);
    const tiles = [base, tn, ts, te, tw, top];
    const joins: Join[] = [
      {
        id: "j0",
        a: { tileId: "base", edgeIndex: 2 },
        b: { tileId: "tn", edgeIndex: 0 },
      },
      {
        id: "j1",
        a: { tileId: "base", edgeIndex: 0 },
        b: { tileId: "ts", edgeIndex: 0 },
      },
      {
        id: "j2",
        a: { tileId: "base", edgeIndex: 3 },
        b: { tileId: "te", edgeIndex: 0 },
      },
      {
        id: "j3",
        a: { tileId: "base", edgeIndex: 1 },
        b: { tileId: "tw", edgeIndex: 0 },
      },
      {
        id: "j4",
        a: { tileId: "tn", edgeIndex: 2 },
        b: { tileId: "top", edgeIndex: 0 },
      },
    ];
    const ids = tiles.map((t) => t.id);
    const root = pickFoldRoot(tiles, ids, joins)!;
    const closure = solveClosureAngles(tiles, joins, ids);
    const tree = buildFoldRenderTree(
      tiles,
      joins,
      root,
      1,
      closure.angles,
      ids,
    );
    assert.ok(tree);
    const byTile = evaluateRenderTreeVertices(tree!);
    const topVerts = byTile.get("top") ?? [];
    const topZs = topVerts.map((v) => v.z);
    const topSpread = Math.max(...topZs) - Math.min(...topZs);
    assert.ok(topSpread < 1, "top cap should be nearly flat at t=1");
    const allVerts = [...byTile.values()].flat();
    const maxZ = Math.max(...allVerts.map((v) => Math.abs(v.z)));
    assert.ok(maxZ > 15, "frustum should fold off the plane at t=1");
  });
});

describe("multi-net fold state", () => {
  it("tracks unfoldT per connected component independently", () => {
    const tiles = [
      square("a1", 100, 100),
      square("a2", 156, 100),
      square("b1", 400, 200),
      square("b2", 456, 200),
    ];
    const joins: Join[] = [
      {
        id: "j-a",
        a: { tileId: "a1", edgeIndex: 1 },
        b: { tileId: "a2", edgeIndex: 3 },
      },
      {
        id: "j-b",
        a: { tileId: "b1", edgeIndex: 1 },
        b: { tileId: "b2", edgeIndex: 3 },
      },
    ];
    const compA = ["a1", "a2"];
    const compB = ["b1", "b2"];
    const netFolds = syncNetFolds(tiles, joins, [
      {
        key: componentKey(compA),
        tileIds: compA,
        unfoldT: 0.8,
        foldRootId: "a1",
      },
      {
        key: componentKey(compB),
        tileIds: compB,
        unfoldT: 0.4,
        foldRootId: "b1",
      },
    ]);
    assert.equal(netFolds.length, 2);
    assert.equal(unfoldTForTile(tiles, joins, netFolds, "a1"), 0.8);
    assert.equal(unfoldTForTile(tiles, joins, netFolds, "b2"), 0.4);
    assert.equal(unfoldTForTile(tiles, joins, netFolds, "a1"), 0.8);
    assert.equal(unfoldTForTile(tiles, joins, [], "a1"), 0);
  });
});
