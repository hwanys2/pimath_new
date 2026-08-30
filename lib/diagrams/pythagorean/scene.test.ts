import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { angleAt } from "./geometry";
import {
  PYTHAGOREAN_PRESETS,
  cloneState,
  normalizeState,
  triangleFromLegs,
} from "./model";
import { buildPythagoreanScene } from "./scene";

describe("pythagorean scene", () => {
  it("builds a scene for every preset", () => {
    for (const preset of PYTHAGOREAN_PRESETS) {
      const scene = buildPythagoreanScene(normalizeState(cloneState(preset.state)));
      assert.equal(scene.width, 520, preset.id);
      assert.equal(scene.height, 520, preset.id);
      assert.ok(scene.cmds.length >= 3, `${preset.id} cmds`);
    }
  });

  it("draws right angles on triangle presets with labels", () => {
    const preset = PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-912x")!;
    const scene = buildPythagoreanScene(normalizeState(cloneState(preset.state)));
    assert.ok(scene.cmds.some((c) => c.t === "rightAngle"));
    const shown = preset.state.segs.filter((s) => s.show);
    const ids = new Set(scene.texts.map((t) => t.id));
    for (const seg of shown) {
      assert.ok(ids.has(`s:${seg.id}`), `missing label for ${seg.id}`);
    }
  });

  it("draws colored squares and grid for squares preset", () => {
    const preset = PYTHAGOREAN_PRESETS.find((p) => p.id === "sq-32")!;
    const scene = buildPythagoreanScene(normalizeState(cloneState(preset.state)));
    assert.ok(scene.cmds.some((c) => c.t === "polygon"));
    assert.ok(scene.cmds.some((c) => c.t === "line" && c.id === "grid"));
  });

  it("draws proof arrangement", () => {
    const preset = PYTHAGOREAN_PRESETS.find((p) => p.id === "proof-both")!;
    const scene = buildPythagoreanScene(normalizeState(cloneState(preset.state)));
    assert.ok(scene.cmds.filter((c) => c.t === "polyline").length >= 2);
  });
});

describe("pythagorean geometry", () => {
  it("triangleFromLegs yields a right angle at C", () => {
    const { A, B, C } = triangleFromLegs(3, 4);
    const ang = angleAt(B, C, A);
    assert.ok(Math.abs(ang - 90) < 0.01);
    assert.ok(Math.abs(Math.hypot(A.x - B.x, A.y - B.y) - 5) < 0.01);
  });
});
