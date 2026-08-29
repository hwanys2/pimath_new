import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_HISTOGRAM_STATE,
  HISTOGRAM_PRESETS,
  classMid,
  cloneState,
  normalizeState,
  polygonVertices,
  setFrequency,
} from "./model";
import {
  buildHistogramScene,
  canvasXFromValue,
  canvasYFromValue,
  classIndexAtX,
  getHistLayout,
  valueFromCanvasX,
  valueFromCanvasY,
} from "./scene";

describe("histogram classes", () => {
  it("places polygon points at class midpoints and closes at frequency 0", () => {
    const state = DEFAULT_HISTOGRAM_STATE;
    const verts = polygonVertices(state, state.series[0]!.frequencies);
    assert.equal(verts.length, state.classCount + 2);
    assert.equal(verts[0]!.y, 0);
    assert.equal(verts[verts.length - 1]!.y, 0);
    assert.ok(Math.abs(verts[1]!.x - classMid(state, 0)) < 1e-9);
    assert.ok(
      Math.abs(verts[1]!.y - (state.series[0]!.frequencies[0] ?? 0)) < 1e-9,
    );
  });

  it("pads frequencies when class count grows and trims when it shrinks", () => {
    const grown = normalizeState({
      ...DEFAULT_HISTOGRAM_STATE,
      classCount: 8,
    });
    assert.equal(grown.classCount, 8);
    assert.equal(grown.series[0]!.frequencies.length, 8);
    assert.equal(grown.series[0]!.frequencies[7], 0);

    const shrunk = normalizeState({
      ...DEFAULT_HISTOGRAM_STATE,
      classCount: 3,
    });
    assert.equal(shrunk.classCount, 3);
    assert.equal(shrunk.series[0]!.frequencies.length, 3);
  });

  it("maps class index from an x value inside a class", () => {
    const state = DEFAULT_HISTOGRAM_STATE;
    assert.equal(classIndexAtX(77, state), 0);
    assert.equal(classIndexAtX(82.5, state), 1);
    assert.equal(classIndexAtX(70, state), null);
  });

  it("snaps frequency to yTick and grows yMax when needed", () => {
    const next = setFrequency(DEFAULT_HISTOGRAM_STATE, "s-a", 0, 13);
    assert.equal(next.series[0]!.frequencies[0], 14);
    assert.ok(next.yMax >= 14);
  });
});

describe("histogram scene", () => {
  it("round-trips canvas and data coordinates without a break", () => {
    const state = HISTOGRAM_PRESETS.find((p) => p.id === "two-schools")!.state;
    const layout = getHistLayout(state);
    const x = valueFromCanvasX(canvasXFromValue(40, layout), layout);
    const y = valueFromCanvasY(canvasYFromValue(0.2, layout), layout);
    assert.ok(Math.abs(x - 40) < 1e-6);
    assert.ok(Math.abs(y - 0.2) < 1e-6);
  });

  it("maps an x-break so 0 sits left of the first class", () => {
    const state = cloneState(DEFAULT_HISTOGRAM_STATE);
    const layout = getHistLayout(state);
    assert.equal(layout.xBreak, true);
    const x0 = layout.originX;
    const x75 = canvasXFromValue(75, layout);
    const x100 = canvasXFromValue(100, layout);
    assert.ok(x0 < x75);
    assert.ok(x75 < x100);
    assert.ok(x75 > layout.dataLeft - 1e-6);
  });

  it("builds a finite scene for every preset", () => {
    for (const preset of HISTOGRAM_PRESETS) {
      const scene = buildHistogramScene(preset.state);
      assert.ok(scene.cmds.length > 0);
      for (const cmd of scene.cmds) {
        if (cmd.t === "line") {
          assert.ok(Number.isFinite(cmd.x1) && Number.isFinite(cmd.y2));
        }
        if (cmd.t === "polyline") {
          assert.ok(cmd.pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
        }
        if (cmd.t === "polygon") {
          assert.ok(cmd.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
        }
      }
      for (const text of scene.texts) {
        assert.ok(text.x > 2 && text.x < scene.width + 20);
        assert.ok(text.y > 2 && text.y < scene.height - 2);
      }
    }
  });

  it("closes the frequency polygon on the axis in the scene", () => {
    const state = HISTOGRAM_PRESETS.find((p) => p.id === "score-polygon")!.state;
    const verts = polygonVertices(state, state.series[0]!.frequencies);
    assert.equal(verts[0]!.y, 0);
    assert.equal(verts[verts.length - 1]!.y, 0);
    const scene = buildHistogramScene(state);
    const poly = scene.cmds.find((c) => c.t === "polyline" && c.pts.length === verts.length);
    assert.ok(poly && poly.t === "polyline");
    const layout = scene.layout;
    assert.ok(Math.abs(poly.pts[0]!.y - canvasYFromValue(0, layout)) < 1e-6);
    assert.ok(
      Math.abs(poly.pts[poly.pts.length - 1]!.y - canvasYFromValue(0, layout)) < 1e-6,
    );
  });
});
