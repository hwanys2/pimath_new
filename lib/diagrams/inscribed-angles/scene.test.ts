import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyEditedLabel,
  globalPointDisplayMode,
  movePoint,
  pointDisplayMode,
  setAllPointsDisplayMode,
  setPointDisplayMode,
  toggleRadius,
} from "./geometry";
import {
  INSCRIBED_PRESETS,
  cloneState,
  resolveAngleText,
} from "./model";
import { buildInscribedScene, sceneTextPlain } from "./scene";

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

  it("dynamically updates angle and renders natural numbers without decimals when a point moves", () => {
    const preset = INSCRIBED_PRESETS.find((p) => p.id === "central-70")!;
    let state = cloneState(preset.state);

    // Initial central angle label is 70° (natural number)
    const initialScene = buildInscribedScene(state);
    const initialText = initialScene.texts.find((t) => t.id === "ang:O:A:B");
    assert.ok(initialText);
    assert.equal(sceneTextPlain(initialText), "70°");

    // Move B to a new angle position (e.g. angle around 338° instead of 318°)
    // (B at 338°, A at 248° -> 338 - 248 = 90°)
    state = movePoint(state, "B", { x: Math.cos((338 * Math.PI) / 180), y: Math.sin((338 * Math.PI) / 180) });
    const movedScene = buildInscribedScene(state);
    const movedText = movedScene.texts.find((t) => t.id === "ang:O:A:B");
    assert.ok(movedText);
    assert.equal(sceneTextPlain(movedText), "90°");
    assert.ok(!sceneTextPlain(movedText).includes("."), "Angle must be a natural integer without decimal");
  });

  it("updates geometry when angle degree is edited, modifying minimum points", () => {
    const preset = INSCRIBED_PRESETS.find((p) => p.id === "central-70")!;
    let state = cloneState(preset.state);
    const initialA = state.points.find((p) => p.id === "A")!.angleDeg;
    const initialP = state.points.find((p) => p.id === "P")!.angleDeg;

    // Apply target angle 80° to central angle ang:O:A:B
    state = applyEditedLabel(state, "ang:O:A:B", "80");
    const updatedScene = buildInscribedScene(state);
    const angleText = updatedScene.texts.find((t) => t.id === "ang:O:A:B");
    assert.ok(angleText);
    assert.equal(sceneTextPlain(angleText), "80°");

    // Exactly one point should have moved (either A or B, but not both, and not P)
    const newP = state.points.find((p) => p.id === "P")!.angleDeg;
    assert.equal(newP, initialP, "Uninvolved vertex P should remain unchanged");

    const newA = state.points.find((p) => p.id === "A")!.angleDeg;
    const newB = state.points.find((p) => p.id === "B")!.angleDeg;
    const changedCount = (newA !== initialA ? 1 : 0) + (newB !== 318 ? 1 : 0);
    assert.equal(changedCount, 1, "Only 1 point should move to achieve the target angle");
  });

  it("preserves previously modified point when adjusting an angle with multiple candidates", () => {
    const preset = INSCRIBED_PRESETS.find((p) => p.id === "central-70")!;
    let state = cloneState(preset.state);

    // User modifies point A first
    state = movePoint(state, "A", { x: Math.cos((240 * Math.PI) / 180), y: Math.sin((240 * Math.PI) / 180) });
    assert.equal(state.points.find((p) => p.id === "A")!.angleDeg, 240);

    // Now user sets central angle ang:O:A:B to 80°
    state = applyEditedLabel(state, "ang:O:A:B", "80");

    // Point A was modified first, so Point A should be preserved! Point B should move instead.
    assert.equal(
      state.points.find((p) => p.id === "A")!.angleDeg,
      240,
      "Previously modified point A must be preserved",
    );
    assert.equal(
      state.points.find((p) => p.id === "B")!.angleDeg,
      320,
      "Point B should be adjusted to achieve 80° (240 + 80 = 320)",
    );
  });

  it("supports 4 point display modes: both, dot, name, none (global and per-point)", () => {
    const preset = INSCRIBED_PRESETS.find((p) => p.id === "central-70")!;
    let state = cloneState(preset.state);

    // Default is "both" (점과이름)
    assert.equal(globalPointDisplayMode(state), "both");
    let scene = buildInscribedScene(state);
    let dotCmds = scene.cmds.filter((c) => c.t === "dot");
    let nameTexts = scene.texts.filter((t) => t.id.startsWith("pt:") && t.id.endsWith(":name"));
    assert.equal(dotCmds.length, 4); // 3 circumference points + 1 center
    assert.equal(nameTexts.length, 3);

    // 1. 점만 (dot only)
    state = setAllPointsDisplayMode(state, "dot");
    assert.equal(globalPointDisplayMode(state), "dot");
    scene = buildInscribedScene(state);
    dotCmds = scene.cmds.filter((c) => c.t === "dot");
    nameTexts = scene.texts.filter((t) => t.id.startsWith("pt:") && t.id.endsWith(":name"));
    assert.equal(dotCmds.length, 4);
    assert.equal(nameTexts.length, 0);

    // 2. 이름만 (name only)
    state = setAllPointsDisplayMode(state, "name");
    assert.equal(globalPointDisplayMode(state), "name");
    scene = buildInscribedScene(state);
    dotCmds = scene.cmds.filter((c) => c.t === "dot");
    nameTexts = scene.texts.filter((t) => t.id.startsWith("pt:") && t.id.endsWith(":name"));
    assert.equal(dotCmds.length, 1); // only center dot
    assert.equal(nameTexts.length, 3);

    // 3. 안보임 (none)
    state = setAllPointsDisplayMode(state, "none");
    assert.equal(globalPointDisplayMode(state), "none");
    scene = buildInscribedScene(state);
    dotCmds = scene.cmds.filter((c) => c.t === "dot");
    nameTexts = scene.texts.filter((t) => t.id.startsWith("pt:") && t.id.endsWith(":name"));
    assert.equal(dotCmds.length, 1); // only center dot
    assert.equal(nameTexts.length, 0);

    // 4. Per-point display mode override
    // While global is "none", set Point A to "both" and Point B to "name"
    state = setPointDisplayMode(state, "A", "both");
    state = setPointDisplayMode(state, "B", "name");
    assert.equal(pointDisplayMode(state.points.find((p) => p.id === "A")!), "both");
    assert.equal(pointDisplayMode(state.points.find((p) => p.id === "B")!), "name");
    assert.equal(pointDisplayMode(state.points.find((p) => p.id === "P")!), "none");

    scene = buildInscribedScene(state);
    const aDot = scene.cmds.find((c) => c.t === "dot"); // center and A
    const aText = scene.texts.find((t) => t.id === "pt:A:name");
    const bText = scene.texts.find((t) => t.id === "pt:B:name");
    const pText = scene.texts.find((t) => t.id === "pt:P:name");
    assert.ok(aDot);
    assert.ok(aText, "Point A name should be visible");
    assert.ok(bText, "Point B name should be visible");
    assert.ok(!pText, "Point P name should be hidden");
  });
});
