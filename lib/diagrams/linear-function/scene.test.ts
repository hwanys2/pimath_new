import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMathRuns, runsToPlain } from "../math-label";
import {
  addGraphFromEquation,
  formatLinearEquation,
  LINEAR_FUNCTION_PRESETS,
  linearEquationText,
  makeLinear,
  parseLinearEquation,
  toPlaneBackdrop,
  xIntercept,
  yOnLine,
} from "./model";
import { moveIntercept } from "./geometry";
import { buildLinearFunctionScene, clipGraph, clipLinear } from "./scene";
import { getPlaneLayout } from "../coordinate-plane/scene";

describe("linear equation text", () => {
  it("formats y = ax + b with fractions", () => {
    assert.equal(formatLinearEquation(1, 0), "y=x");
    assert.equal(formatLinearEquation(-1, 0), "y=-x");
    assert.equal(formatLinearEquation(0, 3), "y=3");
    assert.equal(formatLinearEquation(3 / 4, -2), "y=\\frac{3}{4}x-2");
    assert.equal(formatLinearEquation(2, 1), "y=2x+1");
  });

  it("keeps plotted constants separate from letter labels", () => {
    const graph = makeLinear({
      a: 3 / 4,
      b: -2,
      labelMode: "letter",
      letterA: "a",
      letterB: "b",
    });
    assert.equal(linearEquationText(graph), "y=ax+b");
    const numeric = makeLinear({ a: 3 / 4, b: -2, labelMode: "auto" });
    assert.equal(linearEquationText(numeric), "y=\\frac{3}{4}x-2");
  });

  it("formats x = a and y = b", () => {
    const vertical = makeLinear({
      a: 0,
      kind: "vertical",
      c: 2,
      labelMode: "auto",
    });
    assert.equal(linearEquationText(vertical), "x=2");
    const horizontal = makeLinear({ a: 0, b: -3, labelMode: "auto" });
    assert.equal(linearEquationText(horizontal), "y=-3");
    const letterX = makeLinear({
      a: 0,
      kind: "vertical",
      c: 2,
      labelMode: "letter",
      letterA: "a",
    });
    assert.equal(linearEquationText(letterX), "x=a");
  });

  it("parses typed linear equations", () => {
    const line = parseLinearEquation("y=2x+1");
    assert.ok(line);
    assert.equal(line.kind, "linear");
    assert.equal(line.a, 2);
    assert.equal(line.b, 1);
    const frac = parseLinearEquation("y=(3/4)x-2");
    assert.ok(frac);
    assert.ok(Math.abs(frac.a - 3 / 4) < 1e-9);
    assert.equal(frac.b, -2);
    const latex = parseLinearEquation("y=\\frac{3}{4}x-2");
    assert.ok(latex);
    assert.ok(Math.abs(latex.a - 3 / 4) < 1e-9);
    const vertical = parseLinearEquation("x=2");
    assert.ok(vertical);
    assert.equal(vertical.kind, "vertical");
    assert.equal(vertical.c, 2);
    const horizontal = parseLinearEquation("y=-3");
    assert.ok(horizontal);
    assert.equal(horizontal.a, 0);
    assert.equal(horizontal.b, -3);
    const slopeOnly = parseLinearEquation("y=-x");
    assert.ok(slopeOnly);
    assert.equal(slopeOnly.a, -1);
    assert.equal(slopeOnly.b, 0);
    const added = addGraphFromEquation(
      LINEAR_FUNCTION_PRESETS[0]!.state,
      "y=x+2",
    );
    assert.ok(added);
    const g = added.graphs[added.graphs.length - 1]!;
    assert.equal(g.a, 1);
    assert.equal(g.b, 2);
  });
});

describe("intercepts and slope", () => {
  it("finds intercepts for y = (7/4)x + 7", () => {
    const graph = makeLinear({ a: 7 / 4, b: 7 });
    const xi = xIntercept(graph);
    assert.ok(xi != null);
    assert.ok(Math.abs(xi + 4) < 1e-9);
    assert.equal(yOnLine(graph, 0), 7);
    assert.ok(Math.abs(yOnLine(graph, -4)) < 1e-9);
  });

  it("keeps the other intercept when dragging one", () => {
    const preset = LINEAR_FUNCTION_PRESETS.find((p) => p.id === "intercepts")!;
    const graph = preset.state.graphs[0]!;
    const movedY = moveIntercept(preset.state, graph.id, "y", 4);
    const next = movedY.graphs[0]!;
    const xi = xIntercept(next);
    assert.ok(xi != null);
    assert.ok(Math.abs(xi + 4) < 1e-6);
    assert.ok(Math.abs(next.b - 4) < 1e-6);
  });
});

describe("scene", () => {
  it("clips y = ax + b to the plot", () => {
    const state = LINEAR_FUNCTION_PRESETS.find((p) => p.id === "several")!.state;
    const layout = getPlaneLayout(toPlaneBackdrop(state));
    const seg = clipLinear(2, -1, layout);
    assert.ok(seg);
    assert.equal(seg.length, 2);
  });

  it("builds a finite scene for every preset", () => {
    for (const preset of LINEAR_FUNCTION_PRESETS) {
      const scene = buildLinearFunctionScene(preset.state);
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

  it("labels intercepts as numbers, not ordered pairs", () => {
    const state = LINEAR_FUNCTION_PRESETS.find((p) => p.id === "intercepts")!.state;
    const scene = buildLinearFunctionScene(state);
    const xi = scene.texts.find((t) => t.id.endsWith(":xi"));
    const yi = scene.texts.find((t) => t.id.endsWith(":yi"));
    assert.ok(xi);
    assert.ok(yi);
    assert.equal(runsToPlain(xi.runs), "-4");
    assert.equal(runsToPlain(yi.runs), "7");
  });

  it("draws dashed drops and axis marks for a point", () => {
    const state = LINEAR_FUNCTION_PRESETS.find((p) => p.id === "point-drop")!.state;
    const scene = buildLinearFunctionScene(state);
    const dashed = scene.cmds.filter((c) => c.t === "line" && c.dashed);
    assert.ok(dashed.length >= 2);
    const axisX = scene.texts.find((t) => t.id.endsWith(":axisX"));
    const axisY = scene.texts.find((t) => t.id.endsWith(":axisY"));
    assert.ok(axisX);
    assert.ok(axisY);
    assert.equal(runsToPlain(axisX.runs), "4");
    assert.equal(runsToPlain(axisY.runs), "4");
  });

  it("annotates slope with Δx and Δy", () => {
    const state = LINEAR_FUNCTION_PRESETS.find((p) => p.id === "slope")!.state;
    const scene = buildLinearFunctionScene(state);
    const dx = scene.texts.find((t) => t.id.endsWith(":dx"));
    const dy = scene.texts.find((t) => t.id.endsWith(":dy"));
    assert.ok(dx);
    assert.ok(dy);
    assert.equal(runsToPlain(dx.runs), "4");
    assert.equal(runsToPlain(dy.runs), "-1");
    const arrows = scene.cmds.filter((c) => c.t === "arrowhead" && c.stroke);
    assert.ok(arrows.length >= 2);
  });

  it("draws vertical translation arrows between parallel lines", () => {
    const state = LINEAR_FUNCTION_PRESETS.find((p) => p.id === "translate")!.state;
    const scene = buildLinearFunctionScene(state);
    const redArrows = scene.cmds.filter(
      (c) => c.t === "arrowhead" && c.stroke === "#e24a4a",
    );
    assert.equal(redArrows.length, 4);
    const eqs = scene.texts.filter((t) => t.id.endsWith(":eq"));
    assert.equal(eqs.length, 2);
    assert.ok(eqs.some((t) => runsToPlain(t.runs).includes("3/4")));
  });

  it("parses stacked fractions in equation labels", () => {
    const runs = parseMathRuns("y=\\frac{3}{4}x-2");
    assert.equal(runsToPlain(runs), "y=3/4x-2");
  });

  it("draws x = a and y = b as axis-parallel lines", () => {
    const state = LINEAR_FUNCTION_PRESETS.find((p) => p.id === "axes-const")!
      .state;
    const scene = buildLinearFunctionScene(state);
    const eqs = scene.texts.filter((t) => t.id.endsWith(":eq"));
    assert.ok(eqs.some((t) => runsToPlain(t.runs) === "x=2"));
    assert.ok(eqs.some((t) => runsToPlain(t.runs) === "y=-3"));
    const layout = getPlaneLayout(toPlaneBackdrop(state));
    const vertical = makeLinear({ a: 0, kind: "vertical", c: 2 });
    const clip = clipGraph(vertical, layout);
    assert.ok(clip);
    assert.equal(clip.length, 2);
    assert.ok(Math.abs(clip[0]!.x - clip[1]!.x) < 1e-6);
  });

  it("keeps one x-unit the same length as one y-unit", () => {
    const state = LINEAR_FUNCTION_PRESETS.find((p) => p.id === "intercepts")!
      .state;
    const layout = getPlaneLayout(toPlaneBackdrop(state));
    const unitX =
      (layout.plotRight - layout.plotLeft) / (layout.xMax - layout.xMin);
    const unitY =
      (layout.plotBottom - layout.plotTop) / (layout.yMax - layout.yMin);
    assert.ok(Math.abs(unitX - unitY) < 1e-6);
    assert.equal(state.xTick, state.yTick);
  });
});
