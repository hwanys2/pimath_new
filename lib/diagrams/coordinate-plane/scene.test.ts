import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMathRuns, runsToPlain } from "../math-label";
import {
  COORD_PLANE_PRESETS,
  graphEquationText,
  makeInverse,
} from "./model";
import {
  buildCoordPlaneScene,
  canvasXFromValue,
  canvasYFromValue,
  getPlaneLayout,
  sampleInverse,
  valueFromCanvasX,
  valueFromCanvasY,
} from "./scene";

describe("coordinate plane mapping", () => {
  it("round-trips canvas and data coordinates without a break", () => {
    const state = COORD_PLANE_PRESETS.find((p) => p.id === "ordered-pairs")!.state;
    const layout = getPlaneLayout(state);
    const x = valueFromCanvasX(canvasXFromValue(3, layout), layout);
    const y = valueFromCanvasY(canvasYFromValue(6, layout), layout);
    assert.ok(Math.abs(x - 3) < 1e-6);
    assert.ok(Math.abs(y - 6) < 1e-6);
  });

  it("maps y-break so 30 sits above the origin stub", () => {
    const state = COORD_PLANE_PRESETS.find((p) => p.id === "axis-break")!.state;
    const layout = getPlaneLayout(state);
    assert.equal(layout.yBreak, true);
    const y0 = canvasYFromValue(0, layout);
    const y30 = canvasYFromValue(30, layout);
    const y70 = canvasYFromValue(70, layout);
    assert.ok(y70 < y30);
    assert.ok(y30 < y0);
    assert.ok(Math.abs(valueFromCanvasY(y30, layout) - 30) < 1e-6);
  });

  it("samples inverse proportion without crossing x = 0", () => {
    const state = COORD_PLANE_PRESETS.find((p) => p.id === "inverse")!.state;
    const layout = getPlaneLayout(state);
    const graph = makeInverse({ a: 4, bothBranches: true });
    const branches = sampleInverse(graph, layout);
    assert.ok(branches.length >= 2);
    for (const branch of branches) {
      for (const pt of branch) {
        const x = valueFromCanvasX(pt.x, layout);
        assert.ok(Math.abs(x) > 0.05);
        assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.y));
      }
    }
  });

  it("builds a finite scene for every preset", () => {
    for (const preset of COORD_PLANE_PRESETS) {
      const scene = buildCoordPlaneScene(preset.state);
      assert.ok(scene.cmds.length > 0);
      for (const cmd of scene.cmds) {
        if (cmd.t === "line") {
          assert.ok(Number.isFinite(cmd.x1) && Number.isFinite(cmd.y2));
        }
        if (cmd.t === "polyline") {
          assert.ok(cmd.pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
        }
      }
    }
  });
});

describe("equation labels", () => {
  it("keeps the plotted constant separate from the displayed letter", () => {
    const graph = makeInverse({ a: 1, labelMode: "letter", letter: "a" });
    assert.equal(graphEquationText(graph), "y=\\frac{a}{x}");
    const numeric = makeInverse({ a: 24, labelMode: "auto" });
    assert.equal(graphEquationText(numeric), "y=\\frac{24}{x}");
  });

  it("parses stacked fractions", () => {
    const runs = parseMathRuns("y=\\frac{24}{x}");
    assert.equal(runsToPlain(runs), "y=24/x");
    const frac = runs.find((r) => r.fracNum && r.fracDen);
    assert.ok(frac);
    assert.equal(runsToPlain(frac!.fracNum!), "24");
    assert.equal(runsToPlain(frac!.fracDen!), "x");
  });
});
