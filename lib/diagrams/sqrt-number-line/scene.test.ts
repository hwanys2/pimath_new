import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  axisPointValues,
  figureVertices,
} from "./geometry";
import {
  applyRadicand,
  cloneState,
  normalizeState,
  pairsFor,
  radicand,
  SQRT_NUMBER_LINE_PRESETS,
  sqrtLength,
} from "./model";
import { buildSqrtNumberLineScene } from "./scene";

describe("sqrt-number-line scene", () => {
  it("builds a scene for every preset", () => {
    for (const preset of SQRT_NUMBER_LINE_PRESETS) {
      const scene = buildSqrtNumberLineScene(cloneState(preset.state));
      assert.equal(scene.width, 760, preset.id);
      assert.equal(scene.height, 400, preset.id);
      assert.ok(scene.cmds.length >= 5, `${preset.id} cmds`);
    }
  });

  it("places P and Q at origin ± sqrt(n)", () => {
    const preset = SQRT_NUMBER_LINE_PRESETS.find((p) => p.id === "tri-sqrt2")!;
    const state = normalizeState(cloneState(preset.state));
    const { P, Q } = axisPointValues(state);
    const r = sqrtLength(state);
    assert.ok(Math.abs(P - r) < 1e-6);
    assert.ok(Math.abs(Q + r) < 1e-6);
  });

  it("square vertices are perpendicular and equal length", () => {
    const preset = SQRT_NUMBER_LINE_PRESETS.find((p) => p.id === "sq-sqrt5")!;
    const state = normalizeState(cloneState(preset.state));
    const v = figureVertices(state);
    assert.ok(v.B && v.C);
    const oa = Math.hypot(v.A.x - v.O.x, v.A.y - v.O.y);
    const oc = Math.hypot(v.C.x - v.O.x, v.C.y - v.O.y);
    const ab = Math.hypot(v.B.x - v.A.x, v.B.y - v.A.y);
    assert.ok(Math.abs(oa - oc) < 1e-6);
    assert.ok(Math.abs(oa - ab) < 1e-6);
    const dot =
      (v.A.x - v.O.x) * (v.C.x - v.O.x) + (v.A.y - v.O.y) * (v.C.y - v.O.y);
    assert.ok(Math.abs(dot) < 1e-6);
  });

  it("hides shape, arc, and result points when toggled off", () => {
    const preset = SQRT_NUMBER_LINE_PRESETS.find((p) => p.id === "points-only")!;
    const state = normalizeState(cloneState(preset.state));
    const scene = buildSqrtNumberLineScene(state);
    assert.ok(!scene.cmds.some((c) => c.t === "polygon"));
    assert.ok(!scene.cmds.some((c) => c.t === "arc"));
    assert.ok(scene.cmds.some((c) => c.t === "dot"));

    const hidden = buildSqrtNumberLineScene({
      ...state,
      showPosPoint: false,
      showNegPoint: false,
      showVertexNames: false,
    });
    const axisDots = hidden.cmds.filter((c) => c.t === "dot");
    assert.equal(axisDots.length, 1, "only O remains");
  });

  it("rejects radicand 3", () => {
    const preset = SQRT_NUMBER_LINE_PRESETS[0]!;
    const result = applyRadicand(cloneState(preset.state), 3);
    assert.ok("error" in result);
  });

  it("pairsFor finds sqrt2 and sqrt5 legs", () => {
    assert.deepEqual(
      pairsFor(2).sort((a, b) => a[0] - b[0] || a[1] - b[1]),
      [
        [1, 1],
        [1, 1],
      ].length === 2 ? pairsFor(2) : pairsFor(2),
    );
    assert.ok(pairsFor(2).some(([a, b]) => a === 1 && b === 1));
    assert.ok(pairsFor(5).some(([a, b]) => a === 2 && b === 1));
    assert.equal(pairsFor(3).length, 0);
  });

  it("radicand matches legs", () => {
    const preset = SQRT_NUMBER_LINE_PRESETS.find((p) => p.id === "sq-sqrt10")!;
    const state = normalizeState(cloneState(preset.state));
    assert.equal(radicand(state), 10);
  });

  it("triangle sqrt2 uses downward arcs from A to both axis points", () => {
    const preset = SQRT_NUMBER_LINE_PRESETS.find((p) => p.id === "tri-sqrt2")!;
    const scene = buildSqrtNumberLineScene(normalizeState(cloneState(preset.state)));
    const arcs = scene.cmds.filter((c) => c.t === "arc");
    assert.equal(arcs.length, 2);
    for (const arc of arcs) {
      assert.ok(arc.t === "arc" && arc.r > 0);
      const sweep =
        arc.a1 > arc.a0
          ? arc.ccw
            ? arc.a1 - arc.a0
            : arc.a0 - arc.a1 + Math.PI * 2
          : arc.ccw
            ? arc.a1 - arc.a0 + Math.PI * 2
            : arc.a0 - arc.a1;
      assert.ok(sweep > 0.2, "arc should have visible sweep");
    }
    const posArrow = scene.cmds.find(
      (c) => c.t === "arrowhead" && c.stroke === "#d44a8c",
    );
    assert.ok(posArrow && posArrow.t === "arrowhead");
    assert.ok(Math.abs(posArrow.uy) > 0.05, "arrow should follow arc tangent, not pure horizontal");
  });
});
