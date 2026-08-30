import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unitCirclePoints, isObtuseAtA } from "./geometry";
import {
  TRIG_PRESETS,
  cloneState,
  normalizeState,
} from "./model";
import { buildTrigScene } from "./scene";

describe("trig-ratios scene", () => {
  it("builds a scene for every preset", () => {
    for (const preset of TRIG_PRESETS) {
      const scene = buildTrigScene(normalizeState(cloneState(preset.state)));
      assert.equal(scene.width, 520, preset.id);
      assert.equal(scene.height, 520, preset.id);
      assert.ok(scene.cmds.length >= 3, `${preset.id} cmds`);
    }
  });

  it("draws right angles on right triangle presets", () => {
    const preset = TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!;
    const scene = buildTrigScene(normalizeState(cloneState(preset.state)));
    assert.ok(scene.cmds.some((c) => c.t === "rightAngle" || c.t === "polyline"));
  });

  it("unit circle B and D follow theta", () => {
    const state = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "unit-48")!.state));
    const pts = unitCirclePoints(state);
    assert.ok(Math.abs(pts.B!.x - pts.A!.x) < 1e-9);
    assert.ok(Math.abs(pts.B!.y - Math.sin((48 * Math.PI) / 180)) < 1e-9);
    assert.ok(Math.abs(pts.D!.y - Math.tan((48 * Math.PI) / 180)) < 1e-9);
  });

  it("obtuse triangle preset marks extension angle", () => {
    const preset = TRIG_PRESETS.find((p) => p.id === "tri-obtuse")!;
    const state = normalizeState(cloneState(preset.state));
    assert.ok(isObtuseAtA(state));
    const scene = buildTrigScene(state);
    assert.ok(scene.cmds.some((c) => c.t === "line" && c.dashed));
  });

  it("quad diagonal preset draws pink diagonal", () => {
    const preset = TRIG_PRESETS.find((p) => p.id === "quad-diag")!;
    const scene = buildTrigScene(normalizeState(cloneState(preset.state)));
    assert.ok(
      scene.cmds.some(
        (c) => c.t === "line" && c.stroke === "#e879a8",
      ),
    );
  });
});
