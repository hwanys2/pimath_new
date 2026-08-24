import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGraphPoint,
  applyGraphStroke,
  clientToNormalized,
  EMPTY_GRAPH_ANNOTATIONS,
  formatGraphCoord,
  GRAPH_POINT_SNAP_HOLD_MS,
  mathToNormalized,
  normalizedToMath,
  placeGraphPoint,
  scaleNormalizedPoints,
  snapNormalizedToGrid,
} from "./graph-annotate";
import { DEFAULT_PLOT_VIEW, effectiveMafsView } from "./graph-plot";

describe("clientToNormalized", () => {
  it("maps the pane origin and far corner", () => {
    const rect = { left: 10, top: 20, width: 100, height: 50 };
    assert.deepEqual(clientToNormalized(10, 20, rect), { nx: 0, ny: 0 });
    assert.deepEqual(clientToNormalized(110, 70, rect), { nx: 1, ny: 1 });
    assert.deepEqual(clientToNormalized(60, 45, rect), { nx: 0.5, ny: 0.5 });
  });

  it("clamps outside the pane", () => {
    const rect = { left: 0, top: 0, width: 10, height: 10 };
    assert.equal(clientToNormalized(-4, 20, rect).nx, 0);
    assert.equal(clientToNormalized(-4, 20, rect).ny, 1);
  });
});

describe("scaleNormalizedPoints", () => {
  it("scales pairs into pixel space", () => {
    assert.deepEqual(scaleNormalizedPoints([0, 0, 0.5, 1], 200, 100), [
      0, 0, 100, 100,
    ]);
  });
});

describe("math <-> normalized", () => {
  it("round-trips the origin and a lattice point", () => {
    const view = DEFAULT_PLOT_VIEW;
    const origin = mathToNormalized(0, 0, view);
    const back = normalizedToMath(origin.nx, origin.ny, view);
    assert.ok(Math.abs(back.x) < 1e-9);
    assert.ok(Math.abs(back.y) < 1e-9);

    const p = mathToNormalized(2, -3, view);
    const q = normalizedToMath(p.nx, p.ny, view);
    assert.ok(Math.abs(q.x - 2) < 1e-9);
    assert.ok(Math.abs(q.y + 3) < 1e-9);
  });
});

describe("snapNormalizedToGrid", () => {
  it("snaps to the nearest integer lattice by default", () => {
    const view = { xMin: -8, xMax: 8, yMin: -6, yMax: 6 };
    const near = mathToNormalized(1.4, 2.6, view);
    const snapped = snapNormalizedToGrid(near.nx, near.ny, view);
    assert.equal(snapped.mathX, 1);
    assert.equal(snapped.mathY, 3);
  });

  it("aligns snapped points with the mafs pane mapping", () => {
    const view = { xMin: -8, xMax: 8, yMin: -6, yMax: 6 };
    const w = 400;
    const h = 200;
    const pane = effectiveMafsView(view, w, h, true);
    const target = { x: -3, y: 1 };
    const exact = mathToNormalized(target.x, target.y, pane);
    const near = { nx: exact.nx + 0.008, ny: exact.ny + 0.008 };
    const snapped = snapNormalizedToGrid(
      near.nx,
      near.ny,
      view,
      1,
      1,
      w,
      h,
      true,
    );
    assert.equal(snapped.mathX, target.x);
    assert.equal(snapped.mathY, target.y);
  });

  it("honors a non-unit scale", () => {
    const view = { xMin: -8, xMax: 8, yMin: -6, yMax: 6 };
    const near = mathToNormalized(2.4, 1.1, view);
    const snapped = snapNormalizedToGrid(near.nx, near.ny, view, 2, 1);
    assert.equal(snapped.mathX, 2);
    assert.equal(snapped.mathY, 1);
  });
});

describe("placeGraphPoint", () => {
  it("keeps a short tap free, and snaps a long press to the lattice", () => {
    const view = { xMin: -8, xMax: 8, yMin: -6, yMax: 6 };
    const near = mathToNormalized(1.4, 2.6, view);
    const free = placeGraphPoint(near.nx, near.ny, view, 1, 1, 80);
    assert.equal(free.snap, false);
    assert.ok(Math.abs(free.nx - near.nx) < 1e-12);
    const magnet = placeGraphPoint(
      near.nx,
      near.ny,
      view,
      1,
      1,
      GRAPH_POINT_SNAP_HOLD_MS,
    );
    assert.equal(magnet.snap, true);
    const math = normalizedToMath(magnet.nx, magnet.ny, view);
    assert.equal(math.x, 1);
    assert.equal(math.y, 3);
  });
});

describe("formatGraphCoord", () => {
  it("prints integers without decimals", () => {
    assert.equal(formatGraphCoord(2), "2");
    assert.equal(formatGraphCoord(0), "0");
    assert.equal(formatGraphCoord(1.25), "1.25");
  });
});

describe("applyGraphStroke / applyGraphPoint", () => {
  it("appends a stroke and can remove hit points", () => {
    const base = {
      strokes: [],
      points: [
        { id: "p1", x: 0.2, y: 0.2 },
        { id: "p2", x: 0.8, y: 0.8 },
      ],
    };
    const withStroke = applyGraphStroke(
      base,
      { tool: "pen", color: "#ef4444", size: 3, points: [0, 0, 1, 1] },
      ["p1"],
    );
    assert.equal(withStroke.strokes.length, 1);
    assert.deepEqual(
      withStroke.points.map((p) => p.id),
      ["p2"],
    );
  });

  it("appends a point", () => {
    const next = applyGraphPoint(EMPTY_GRAPH_ANNOTATIONS, {
      id: "a",
      x: 0.5,
      y: 0.5,
    });
    assert.equal(next.points.length, 1);
    assert.equal(next.points[0]?.id, "a");
  });
});
