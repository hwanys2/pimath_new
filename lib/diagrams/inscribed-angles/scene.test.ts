import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyEditedLabel, movePoint, toggleRadius } from "./geometry";
import {
  INSCRIBED_PRESETS,
  cloneState,
  resolveAngleText,
} from "./model";
import { buildInscribedScene } from "./scene";

describe("inscribed angle scenes", () => {
  it("builds every preset without empty geometry", () => {
    for (const preset of INSCRIBED_PRESETS) {
      const scene = buildInscribedScene(cloneState(preset.state));
      assert.ok(scene.cmds.length > 2, preset.id);
      assert.equal(scene.width, 480);
      assert.equal(scene.height, 520);
      assert.ok(
        scene.cmds.some((c) => c.t === "circle" || c.t === "arc"),
        preset.id,
      );
    }
  });

  it("shades the unknown inscribed angle on the 70° preset", () => {
    const scene = buildInscribedScene(cloneState(INSCRIBED_PRESETS[0]!.state));
    const fills = scene.cmds.filter((c) => c.t === "polygon");
    assert.ok(fills.length >= 1);
    assert.ok(scene.texts.some((t) => t.id === "center-name"));
  });

  it("keeps diameter endpoints opposite when one is dragged", () => {
    const preset = INSCRIBED_PRESETS.find((p) => p.id === "diameter-90");
    assert.ok(preset);
    let state = cloneState(preset.state);
    state = movePoint(state, "A", { x: 0, y: 10 });
    const a = state.points.find((p) => p.id === "A")!.angleDeg;
    const b = state.points.find((p) => p.id === "B")!.angleDeg;
    const diff = Math.abs(((a - b + 360) % 360) - 180);
    assert.ok(diff < 1e-6 || Math.abs(diff - 360) < 1e-6, `${a} ${b}`);
  });

  it("toggles a radius and stores a typed unknown letter on an angle", () => {
    let state = cloneState(INSCRIBED_PRESETS[0]!.state);
    const p = state.points.find((x) => x.id === "P")!;
    state = toggleRadius(state, p.id);
    assert.ok(
      state.edges.some(
        (e) => e.show && ((e.a === "O" && e.b === "P") || (e.a === "P" && e.b === "O")),
      ),
    );
    state = toggleRadius(state, p.id);
    assert.equal(
      state.edges.some(
        (e) => e.show && ((e.a === "O" && e.b === "P") || (e.a === "P" && e.b === "O")),
      ),
      false,
    );

    const ang = state.angles.find((a) => a.fill === "pink")!;
    state = applyEditedLabel(state, ang.id, "y");
    assert.equal(
      resolveAngleText(state.angles.find((a) => a.id === ang.id)!.label, 35, "x"),
      "$y$",
    );
  });
});
