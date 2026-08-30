import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SIMILAR_PRESETS, cloneState, normalizeState } from "./model";
import { buildSimilarTrianglesScene } from "./scene";

describe("similar triangles scene", () => {
  it("builds a scene for every preset with lines and labels", () => {
    for (const preset of SIMILAR_PRESETS) {
      const scene = buildSimilarTrianglesScene(normalizeState(cloneState(preset.state)));
      assert.equal(scene.width, 520, preset.id);
      assert.equal(scene.height, 520, preset.id);
      const lines = scene.cmds.filter((c) => c.t === "line" || c.t === "polyline");
      assert.ok(lines.length >= 3, `${preset.id} lines`);
      const shown = preset.state.segs.filter((s) => s.show);
      if (shown.length > 0) {
        const ids = new Set(scene.texts.map((t) => t.id));
        for (const seg of shown) {
          assert.ok(ids.has(`s:${seg.id}`), `${preset.id} missing s:${seg.id}`);
        }
      }
    }
  });

  it("draws right-angle squares on the altitude preset", () => {
    const preset = SIMILAR_PRESETS.find((p) => p.id === "alt-hyp")!;
    const scene = buildSimilarTrianglesScene(normalizeState(cloneState(preset.state)));
    const rights = scene.cmds.filter((c) => c.t === "rightAngle");
    assert.ok(rights.length >= 2, "expected right angles at A and D");
  });

  it("fills the three-median centroid preset", () => {
    const preset = SIMILAR_PRESETS.find((p) => p.id === "cent-all")!;
    const scene = buildSimilarTrianglesScene(normalizeState(cloneState(preset.state)));
    assert.ok(scene.cmds.some((c) => c.t === "polygon"));
  });
});
