import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMathRuns, parseNameRuns, runsToPlain } from "../math-label";
import {
  appendPolylineVertex,
  COORD_PLANE_PRESETS,
  graphEquationText,
  insertPolylineVertexAfter,
  makeInverse,
  removePolylineVertex,
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
      for (const text of scene.texts) {
        assert.ok(text.x > 4 && text.x < scene.width - 4);
        assert.ok(text.y > 4 && text.y < scene.height - 4);
      }
    }
  });
});

describe("polyline vertices", () => {
  it("appends and refuses to drop below two points", () => {
    const base = COORD_PLANE_PRESETS.find((p) => p.id === "situation")!.state;
    const graph = base.graphs.find((g) => g.t === "polyline")!;
    assert.equal(graph.t, "polyline");
    const added = appendPolylineVertex(base, graph.id);
    const g2 = added.graphs.find((g) => g.id === graph.id);
    assert.ok(g2 && g2.t === "polyline");
    assert.equal(g2.vertices.length, graph.vertices.length + 1);
    let next = added;
    while (true) {
      const g = next.graphs.find((x) => x.id === graph.id);
      assert.ok(g && g.t === "polyline");
      if (g.vertices.length <= 2) break;
      next = removePolylineVertex(next, graph.id, g.vertices.length - 1);
    }
    const last = next.graphs.find((x) => x.id === graph.id);
    assert.ok(last && last.t === "polyline");
    assert.equal(last.vertices.length, 2);
    const stuck = removePolylineVertex(next, graph.id, 0);
    const still = stuck.graphs.find((x) => x.id === graph.id);
    assert.ok(still && still.t === "polyline");
    assert.equal(still.vertices.length, 2);
  });

  it("inserts a midpoint between two vertices", () => {
    const base = COORD_PLANE_PRESETS.find((p) => p.id === "situation")!.state;
    const graph = base.graphs.find((g) => g.t === "polyline")!;
    assert.equal(graph.t, "polyline");
    const a = graph.vertices[0]!;
    const b = graph.vertices[1]!;
    const next = insertPolylineVertexAfter(base, graph.id, 0);
    const g2 = next.graphs.find((g) => g.id === graph.id);
    assert.ok(g2 && g2.t === "polyline");
    assert.equal(g2.vertices.length, graph.vertices.length + 1);
    assert.ok(Math.abs(g2.vertices[1]!.x - (a.x + b.x) / 2) < 1e-9);
    assert.ok(Math.abs(g2.vertices[1]!.y - (a.y + b.y) / 2) < 1e-9);
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

  it("keeps point names upright roman", () => {
    const name = parseNameRuns("A");
    assert.equal(name.length, 1);
    assert.equal(name[0]!.italic, false);
    const origin = parseNameRuns("O");
    assert.equal(origin[0]!.italic, false);
    const variable = parseMathRuns("$x$");
    assert.equal(variable[0]!.italic, true);
  });

  it("draws ordered-pair names upright and axis names italic", () => {
    const state = COORD_PLANE_PRESETS.find((p) => p.id === "ordered-pairs")!.state;
    const scene = buildCoordPlaneScene(state);
    const names = scene.texts.filter(
      (t) => t.id === "origin" || t.id.endsWith(":name"),
    );
    assert.ok(names.length > 0);
    for (const text of names) {
      assert.ok(text.runs.every((r) => !r.italic));
    }
    const axisX = scene.texts.find((t) => t.id === "axis-x");
    assert.ok(axisX?.runs.some((r) => r.italic));
  });

  it("keeps axis names inside the figure at the inner corners", () => {
    const state = COORD_PLANE_PRESETS.find((p) => p.id === "ordered-pairs")!.state;
    const scene = buildCoordPlaneScene({
      ...state,
      xAxisLabel: "$x$이름",
      yAxisLabel: "$y$이름",
    });
    const layout = scene.layout;
    const axisX = scene.texts.find((t) => t.id === "axis-x");
    const axisY = scene.texts.find((t) => t.id === "axis-y");
    assert.ok(axisX);
    assert.ok(axisY);
    assert.equal(axisX.anchor, "end");
    assert.equal(axisY.anchor, "end");
    assert.ok(axisX.x <= layout.plotRight + 1e-6);
    assert.ok(axisX.y > layout.originY);
    assert.ok(axisY.x < layout.originX);
    assert.ok(axisY.y >= layout.plotTop - 1e-6);
    assert.ok(axisX.x < scene.width - 4);
    assert.ok(axisY.y > 4);
  });
});
