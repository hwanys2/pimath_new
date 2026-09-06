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

  it("draws inscribed and central angles towards the interior (minor arc < 180°)", () => {
    const scene = buildInscribedScene(cloneState(INSCRIBED_PRESETS[0]!.state));
    const twoPi = Math.PI * 2;
    const norm = (a: number) => ((a % twoPi) + twoPi) % twoPi;
    const calcSweepDeg = (arc: { a0: number; a1: number; ccw: boolean }) => {
      const s = arc.ccw
        ? (norm(arc.a0) - norm(arc.a1) + twoPi) % twoPi
        : (norm(arc.a1) - norm(arc.a0) + twoPi) % twoPi;
      return (s * 180) / Math.PI;
    };

    const pArc = scene.cmds.find(
      (c): c is Extract<typeof c, { t: "arc" }> => c.t === "arc" && c.id === "ang:P:A:B:line",
    );
    assert.ok(pArc, "ang:P:A:B arc should exist");
    const pSweep = calcSweepDeg(pArc);
    assert.ok(
      Math.abs(pSweep - 35) < 0.5,
      `Inscribed angle ∠APB sweep should be ~35°, got ${pSweep}°`,
    );

    const oArc = scene.cmds.find(
      (c): c is Extract<typeof c, { t: "arc" }> => c.t === "arc" && c.id === "ang:O:A:B:line",
    );
    assert.ok(oArc, "ang:O:A:B arc should exist");
    const oSweep = calcSweepDeg(oArc);
    assert.ok(
      Math.abs(oSweep - 70) < 0.5,
      `Central angle ∠AOB sweep should be ~70°, got ${oSweep}°`,
    );

    // Label for inscribed angle ∠APB should be inside the circle, not outside
    const pText = scene.texts.find((t) => t.id === "ang:P:A:B");
    assert.ok(pText, "ang:P:A:B text should exist");
    const distFromCenter = Math.hypot(pText.x - scene.layout.origin.x, pText.y - scene.layout.origin.y);
    assert.ok(
      distFromCenter < scene.layout.visualR,
      `Inscribed angle label should be inside circle (< ${scene.layout.visualR}), was ${distFromCenter}`,
    );
  });

  it("handles reflex angle in quad-ac correctly", () => {
    const quadPreset = INSCRIBED_PRESETS.find((p) => p.id === "quad-ac")!;
    const scene = buildInscribedScene(cloneState(quadPreset.state));
    const twoPi = Math.PI * 2;
    const norm = (a: number) => ((a % twoPi) + twoPi) % twoPi;
    const calcSweepDeg = (arc: { a0: number; a1: number; ccw: boolean }) => {
      const s = arc.ccw
        ? (norm(arc.a0) - norm(arc.a1) + twoPi) % twoPi
        : (norm(arc.a1) - norm(arc.a0) + twoPi) % twoPi;
      return (s * 180) / Math.PI;
    };

    const minorArc = scene.cmds.find(
      (c): c is Extract<typeof c, { t: "arc" }> => c.t === "arc" && c.id === "ang:O:B:D:line",
    );
    assert.ok(minorArc);
    assert.ok(Math.abs(calcSweepDeg(minorArc) - 140) < 0.5);

    const reflexArc = scene.cmds.find(
      (c): c is Extract<typeof c, { t: "arc" }> =>
        c.t === "arc" && c.id === "ang:O:B:D:reflex:line",
    );
    assert.ok(reflexArc);
    assert.ok(Math.abs(calcSweepDeg(reflexArc) - 220) < 0.5);
  });
});
