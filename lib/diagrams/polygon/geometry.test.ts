import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allDiagonalPairs,
  diagonalCount,
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
  normalizeState,
  toRegular,
  withSideCount,
} from "./model";
import { buildPolygonScene } from "./scene";

function almost(a: number, b: number, eps = 1e-6): void {
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
}

describe("regular polygon angles", () => {
  for (const n of [3, 4, 5, 6, 8]) {
    it(`n=${n} interior ${(n - 2) * 180 / n}° and exterior ${360 / n}°`, () => {
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
