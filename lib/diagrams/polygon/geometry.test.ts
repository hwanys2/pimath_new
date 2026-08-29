import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allDiagonalPairs,
  applyEdgeLengthChange,
  applyInteriorAngleChange,
  collectLockedConstraints,
  diagonalCount,
  edgeLength,
  interiorAngleSumTarget,
  interiorAngleDeg,
  isConvex,
  isDiagonalPair,
  moveVertex,
  nextIndex,
  prevIndex,
  regularPolygon,
  vertexAngles,
} from "./geometry";
import {
  DEFAULT_POLYGON_STATE,
  POLYGON_PRESETS,
  emptyLabel,
  normalizeState,
  setAllInteriors,
  toRegular,
  withSideCount,
} from "./model";
import { buildPolygonScene } from "./scene";

function almost(a: number, b: number, eps = 1e-6): void {
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
}

function lockedInterior(state: ReturnType<typeof normalizeState>, i: number, deg: number) {
  return {
    ...state.vertices[i]!,
    showInterior: true,
    interior: { ...emptyLabel("custom"), custom: `${deg}°` },
  };
}

function lockedLength(state: ReturnType<typeof normalizeState>, i: number, len: number) {
  return {
    ...state.edges[i]!,
    showLength: true,
    length: { ...emptyLabel("custom"), custom: String(len) },
  };
}

describe("regular polygon angles", () => {
  for (const n of [3, 4, 5, 6, 8]) {
    it(`n=${n} interior ${((n - 2) * 180) / n}° and exterior ${360 / n}°`, () => {
      const pts = regularPolygon(n);
      assert.equal(pts.length, n);
      assert.ok(isConvex(pts));
      const expectedIn = ((n - 2) * 180) / n;
      const expectedEx = 360 / n;
      for (let i = 0; i < n; i += 1) {
        const { interior, exterior } = vertexAngles(pts, i);
        almost(interior, expectedIn, 1e-4);
        almost(exterior, expectedEx, 1e-4);
        const prev = pts[prevIndex(i, n)]!;
        const next = pts[nextIndex(i, n)]!;
        almost(interiorAngleDeg(prev, pts[i]!, next), expectedIn, 1e-4);
      }
    });
  }
});

describe("diagonals", () => {
  it("counts n(n-3)/2", () => {
    for (const n of [3, 4, 5, 6, 8]) {
      assert.equal(diagonalCount(n), (n * (n - 3)) / 2);
      assert.equal(allDiagonalPairs(n).length, diagonalCount(n));
    }
  });

  it("rejects adjacent and wrap-around pairs", () => {
    assert.equal(isDiagonalPair(5, 0, 1), false);
    assert.equal(isDiagonalPair(5, 0, 4), false);
    assert.equal(isDiagonalPair(5, 0, 2), true);
  });
});

describe("convex drag", () => {
  it("keeps a square convex and refuses a concave move", () => {
    const square = normalizeState(withSideCount(DEFAULT_POLYGON_STATE, 4));
    const moved = moveVertex(square, 0, { x: 0, y: 8 });
    assert.ok(isConvex(moved.points));
    const collapsed = moveVertex(square, 0, square.points[2]!);
    assert.deepEqual(collapsed.points, square.points);
  });
});

describe("local angle and length edits", () => {
  it("changing one angle keeps adjacent side lengths at the hinge", () => {
    const base = normalizeState(withSideCount(DEFAULT_POLYGON_STATE, 4));
    const beforePrev = edgeLength(base.points, prevIndex(0, 4));
    const beforeNext = edgeLength(base.points, 0);
    const next = applyInteriorAngleChange(base, 0, 60);
    assert.notDeepEqual(next.points, base.points);
    assert.ok(isConvex(next.points));
    almost(vertexAngles(next.points, 0).interior, 60, 0.25);
    almost(edgeLength(next.points, prevIndex(0, 4)), beforePrev, 0.05);
    almost(edgeLength(next.points, 0), beforeNext, 0.05);
  });

  it("changing one length is not a uniform similarity scale", () => {
    const base = normalizeState(withSideCount(DEFAULT_POLYGON_STATE, 4));
    const before = Array.from({ length: 4 }, (_, i) => edgeLength(base.points, i));
    const target = before[0]! * 1.6;
    const next = applyEdgeLengthChange(base, 0, target);
    assert.ok(isConvex(next.points));
    almost(edgeLength(next.points, 0), target, 0.15);
    const ratios = before.map((len, i) => edgeLength(next.points, i) / len);
    const spread = Math.max(...ratios) - Math.min(...ratios);
    assert.ok(spread > 0.05, "other edges should not all scale equally");
  });

  it("returns unchanged shape when locked constraints conflict", () => {
    const base = normalizeState(withSideCount(DEFAULT_POLYGON_STATE, 3));
    const angles = [0, 1, 2].map((i) => vertexAngles(base.points, i).interior);
    const rigid = {
      ...base,
      vertices: base.vertices.map((v, i) => lockedInterior(base, i, angles[i]!)),
      edges: base.edges.map((e, i) =>
        lockedLength(base, i, edgeLength(base.points, i)),
      ),
    };
    const failed = applyInteriorAngleChange(rigid, 0, angles[0]! + 40);
    assert.deepEqual(failed.points, rigid.points);
  });

  it("preserves previously locked interior angles when adding another", () => {
    const base = normalizeState(withSideCount(DEFAULT_POLYGON_STATE, 4));
    const lockedDeg = vertexAngles(base.points, 1).interior;
    const withLock = {
      ...base,
      vertices: base.vertices.map((v, i) =>
        i === 1 ? lockedInterior(base, 1, lockedDeg) : v,
      ),
    };
    const next = applyInteriorAngleChange(withLock, 0, 55);
    assert.ok(isConvex(next.points));
    almost(vertexAngles(next.points, 0).interior, 55, 0.25);
    almost(vertexAngles(next.points, 1).interior, lockedDeg, 0.25);
  });

  it("preserves previously locked edge lengths when changing another", () => {
    const base = normalizeState(withSideCount(DEFAULT_POLYGON_STATE, 4));
    const lockedLen = edgeLength(base.points, 2);
    const withLock = {
      ...base,
      edges: base.edges.map((e, i) => (i === 2 ? lockedLength(base, 2, lockedLen) : e)),
    };
    const target = edgeLength(base.points, 0) * 1.4;
    const next = applyEdgeLengthChange(withLock, 0, target);
    assert.ok(isConvex(next.points));
    almost(edgeLength(next.points, 0), target, 0.2);
    almost(edgeLength(next.points, 2), lockedLen, 0.2);
  });

  it("collectLockedConstraints reads numeric custom labels", () => {
    const base = normalizeState(withSideCount(DEFAULT_POLYGON_STATE, 4));
    const state = {
      ...base,
      vertices: base.vertices.map((v, i) =>
        i === 1 ? lockedInterior(base, 1, 72) : v,
      ),
      edges: base.edges.map((e, i) => (i === 0 ? lockedLength(base, 0, 5.5) : e)),
    };
    const c = collectLockedConstraints(state);
    assert.equal(c.interiorAngles.get(1), 72);
    assert.equal(c.edgeLengths.get(0), 5.5);
  });
});

describe("presets", () => {
  it("every preset is convex and builds a finite scene", () => {
    for (const preset of POLYGON_PRESETS) {
      const state = normalizeState(preset.state);
      assert.ok(isConvex(state.points), preset.id);
      const scene = buildPolygonScene(state);
      assert.ok(scene.cmds.length > 0);
      assert.equal(scene.layout.canvas.length, state.points.length);
      for (const p of scene.layout.canvas) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      }
      for (const text of scene.texts) {
        assert.ok(Number.isFinite(text.x) && Number.isFinite(text.y));
      }
    }
  });

  it("toRegular keeps side count", () => {
    const five = withSideCount(DEFAULT_POLYGON_STATE, 5);
    const regular = toRegular(five);
    assert.equal(regular.points.length, 5);
    assert.ok(isConvex(regular.points));
  });
});

describe("right-angle marks", () => {
  it("draws a square mark on 90° interiors instead of 90° text", () => {
    const square = setAllInteriors(
      normalizeState(withSideCount(DEFAULT_POLYGON_STATE, 4)),
      true,
    );
    const scene = buildPolygonScene(square);
    const rights = scene.cmds.filter((c) => c.t === "rightAngle");
    assert.equal(rights.length, 4);
    assert.equal(
      scene.texts.filter((t) => t.id.endsWith(":interior")).length,
      0,
    );
  });

  it("does not mark a 90° angle when the label is unknown x", () => {
    const square = normalizeState(withSideCount(DEFAULT_POLYGON_STATE, 4));
    const vertices = square.vertices.map((v, i) => ({
      ...v,
      showInterior: true,
      interior: i === 0 ? emptyLabel("x") : emptyLabel("auto"),
    }));
    const scene = buildPolygonScene({ ...square, vertices });
    assert.equal(scene.cmds.filter((c) => c.t === "rightAngle").length, 3);
    assert.ok(scene.texts.some((t) => t.id === "v:0:interior"));
  });
});
