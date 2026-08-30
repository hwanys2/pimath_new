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

  it("length text stays put when only the dim line is offset", () => {
    const base = normalizeState(cloneState(SIMILAR_PRESETS[0]!.state));
    const movedLine = normalizeState({
      ...base,
      segs: base.segs.map((s) =>
        s.id === "AD" ? { ...s, label: { ...s.label, lineDy: 36 } } : s,
      ),
    });
    const movedText = normalizeState({
      ...base,
      segs: base.segs.map((s) =>
        s.id === "AD" ? { ...s, label: { ...s.label, dy: 36 } } : s,
      ),
    });
    const t0 = buildSimilarTrianglesScene(base).texts.find((t) => t.id === "s:AD");
    const tLine = buildSimilarTrianglesScene(movedLine).texts.find((t) => t.id === "s:AD");
    const tText = buildSimilarTrianglesScene(movedText).texts.find((t) => t.id === "s:AD");
    assert.ok(t0 && tLine && tText);
    assert.ok(Math.abs(t0.y - tLine.y) < 1.5);
    assert.ok(Math.hypot(t0.x - tText.x, t0.y - tText.y) > 8);

    const arcId = "s:AD:line";
    const arc0 = buildSimilarTrianglesScene(base).cmds.find((c) => c.t === "arc" && c.id === arcId);
    const arcLine = buildSimilarTrianglesScene(movedLine).cmds.find((c) => c.t === "arc" && c.id === arcId);
    const arcText = buildSimilarTrianglesScene(movedText).cmds.find((c) => c.t === "arc" && c.id === arcId);
    assert.ok(arc0 && arc0.t === "arc");
    assert.ok(arcLine && arcLine.t === "arc");
    assert.ok(arcText && arcText.t === "arc");
    assert.ok(Math.abs(arc0.r - arcLine.r) > 4, "dim arc should move with lineDy");
    assert.ok(Math.abs(arc0.r - arcText.r) < 1.5, "dim arc should stay when only the text moves");
  });
});
