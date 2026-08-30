import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatQuadraticEquation,
  findGraphTranslation,
  isMinimum,
  QUADRATIC_FUNCTION_PRESETS,
  parseQuadraticEquation,
  quadraticEquationText,
  makeQuadratic,
  toggleGraphTranslation,
  translationValuesForCount,
  vertexOf,
  yOnParabola,
} from "./model";
import { buildQuadraticFunctionScene, sampleParabola } from "./scene";
import { getPlaneLayout } from "../coordinate-plane/scene";
import { toPlaneBackdrop } from "./model";

describe("quadratic equation text", () => {
  it("formats vertex form", () => {
    assert.equal(formatQuadraticEquation(1, 0, 0), "y=x^2");
    assert.equal(formatQuadraticEquation(-1, 0, 0), "y=-x^2");
    assert.equal(formatQuadraticEquation(1, 2, 0), "y=(x-2)^2");
    assert.equal(
      formatQuadraticEquation(-1 / 3, -2, 3),
      "y=-\\frac{1}{3}(x+2)^2+3",
    );
    assert.equal(formatQuadraticEquation(-0.33, 0, 0), "y=-0.33x^2");
  });

  it("parses common forms", () => {
    const simple = parseQuadraticEquation("y=x^2");
    assert.ok(simple);
    assert.equal(simple.a, 1);
    assert.equal(simple.p, 0);
    assert.equal(simple.q, 0);

    const vertex = parseQuadraticEquation("y=(x+2)^2+1");
    assert.ok(vertex);
    assert.ok(Math.abs(vertex.p + 2) < 1e-9);
    assert.equal(vertex.q, 1);

    const frac = parseQuadraticEquation("y=-(1/3)(x+2)^2+3");
    assert.ok(frac);
    assert.ok(Math.abs(frac.a + 1 / 3) < 1e-9);
    assert.ok(Math.abs(frac.p + 2) < 1e-9);
    assert.equal(frac.q, 3);

    const standard = parseQuadraticEquation("y=x^2+4x+5");
    assert.ok(standard);
    assert.ok(Math.abs(standard.p + 2) < 1e-9);
    assert.equal(standard.q, 1);

    const horizontal = parseQuadraticEquation("y=4");
    assert.ok(horizontal);
    assert.equal(horizontal.kind, "horizontal");
    assert.equal(horizontal.q, 4);
  });

  it("uses letter labels", () => {
    const graph = makeQuadratic({
      a: 2,
      labelMode: "letter",
      letterA: "a",
    });
    assert.equal(quadraticEquationText(graph), "y=ax^2");
  });
});

describe("vertex and extrema", () => {
  it("finds vertex coordinates", () => {
    const graph = makeQuadratic({ a: 1, p: -2, q: 1 });
    const v = vertexOf(graph);
    assert.equal(v.x, -2);
    assert.equal(v.y, 1);
    assert.equal(yOnParabola(graph, -2), 1);
    assert.ok(isMinimum(graph));
    const down = makeQuadratic({ a: -1, p: 1, q: 2 });
    assert.ok(!isMinimum(down));
  });
});

describe("parallel translation toggles", () => {
  it("adds and removes vertex translation for the selected graph", () => {
    const base = QUADRATIC_FUNCTION_PRESETS.find((p) => p.id === "several-a")!
      .state;
    const graph = base.graphs[0]!;
    assert.equal(findGraphTranslation(base, graph.id, "vertex"), undefined);

    const withTrans = toggleGraphTranslation(base, graph.id, "vertex");
    const trans = findGraphTranslation(withTrans, graph.id, "vertex");
    assert.ok(trans);
    assert.equal(trans.kind, "vertex");

    const removed = toggleGraphTranslation(withTrans, graph.id, "vertex");
    assert.equal(findGraphTranslation(removed, graph.id, "vertex"), undefined);
  });

  it("resizes vertical and horizontal arrow counts", () => {
    const base = QUADRATIC_FUNCTION_PRESETS.find((p) => p.id === "translate-x")!
      .state;
    const three = translationValuesForCount(base, "vertical", 3);
    assert.equal(three.length, 3);
    const twoY = translationValuesForCount(base, "horizontal", 2);
    assert.equal(twoY.length, 2);
  });
});

describe("scene", () => {
  it("samples parabola branches inside plot", () => {
    const state = QUADRATIC_FUNCTION_PRESETS.find((p) => p.id === "several-a")!
      .state;
    const layout = getPlaneLayout(toPlaneBackdrop(state));
    const graph = state.graphs[0]!;
    const branches = sampleParabola(graph, layout);
    assert.ok(branches.length >= 1);
    assert.ok(branches[0]!.length >= 2);
  });

  it("builds a finite scene for every preset", () => {
    for (const preset of QUADRATIC_FUNCTION_PRESETS) {
      const scene = buildQuadraticFunctionScene(preset.state);
      assert.ok(scene.cmds.length > 0);
      for (const text of scene.texts) {
        assert.ok(text.x > 4 && text.x < scene.width - 4);
        assert.ok(text.y > 4 && text.y < scene.height - 4);
      }
    }
  });

  it("draws translation arrows for presets", () => {
    const translate = buildQuadraticFunctionScene(
      QUADRATIC_FUNCTION_PRESETS.find((p) => p.id === "translate-x")!.state,
    );
    assert.ok(translate.cmds.some((c) => c.t === "arrowhead"));

    const vertexMove = buildQuadraticFunctionScene(
      QUADRATIC_FUNCTION_PRESETS.find((p) => p.id === "translate-pq")!.state,
    );
    assert.ok(vertexMove.cmds.filter((c) => c.t === "arrowhead").length >= 2);
  });

  it("draws axis of symmetry in the graph color", () => {
    const graph = makeQuadratic({
      a: 1,
      p: 2,
      color: "#ff00aa",
      showAxisOfSymmetry: true,
    });
    const state = {
      ...QUADRATIC_FUNCTION_PRESETS[0]!.state,
      graphs: [graph],
    };
    const scene = buildQuadraticFunctionScene(state);
    const axis = scene.cmds.find(
      (c) => c.t === "line" && c.dashed && c.x1 === c.x2,
    );
    assert.ok(axis && axis.t === "line");
    assert.equal(axis.stroke, graph.color);
  });

  it("draws dashed drops from the vertex to both axes", () => {
    const graph = makeQuadratic({
      a: 1,
      p: -2,
      q: 1,
      color: "#3366cc",
      showVertexDrop: true,
    });
    const state = {
      ...QUADRATIC_FUNCTION_PRESETS[0]!.state,
      graphs: [graph],
    };
    const scene = buildQuadraticFunctionScene(state);
    const drops = scene.cmds.filter(
      (c) => c.t === "line" && c.dashed && c.stroke === graph.color,
    );
    const vertical = drops.find((c) => c.t === "line" && c.x1 === c.x2);
    const horizontal = drops.find((c) => c.t === "line" && c.y1 === c.y2);
    assert.ok(vertical);
    assert.ok(horizontal);
  });
});
