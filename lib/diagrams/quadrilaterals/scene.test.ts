import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloneState, normalizeState, QUAD_PRESETS } from "./model";
import { buildQuadScene } from "./scene";

describe("presets", () => {
  it("every preset builds a finite scene", () => {
    for (const preset of QUAD_PRESETS) {
      const state = normalizeState(cloneState(preset.state));
      const scene = buildQuadScene(state);
      assert.ok(scene.cmds.length > 2, preset.id);
      assert.equal(scene.layout.canvas.length, 4);
      for (const p of scene.layout.canvas) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), preset.id);
      }
      for (const text of scene.texts) {
        assert.ok(Number.isFinite(text.x) && Number.isFinite(text.y), `${preset.id} ${text.id}`);
      }
    }
  });

  it("opp-sides draws four length labels", () => {
    const scene = buildQuadScene(QUAD_PRESETS[0]!.state);
    for (const i of [0, 1, 2, 3]) {
      assert.ok(scene.texts.some((t) => t.id === `e:${i}:length`), `e:${i}:length`);
    }
  });

  it("opp-angles fills two interiors and labels 100°", () => {
    const scene = buildQuadScene(QUAD_PRESETS[1]!.state);
    assert.ok(scene.cmds.some((c) => c.t === "polygon"));
    assert.ok(scene.texts.some((t) => t.id === "v:3:interior"));
    assert.ok(scene.texts.some((t) => t.id === "v:1:interior"));
  });

  it("diag-meet places O and half-diagonal labels", () => {
    const scene = buildQuadScene(QUAD_PRESETS[2]!.state);
    assert.ok(scene.layout.o);
    assert.ok(scene.texts.some((t) => t.id === "o:name"));
    assert.ok(scene.texts.some((t) => t.id === "d:AO"));
    assert.ok(scene.texts.some((t) => t.id === "d:OD"));
  });

  it("equal-marks extends a side to E", () => {
    const scene = buildQuadScene(QUAD_PRESETS[4]!.state);
    assert.ok(scene.layout.exts.length >= 1);
    assert.ok(scene.texts.some((t) => t.id === "e:0:name"));
  });

  it("rhombus-right draws a right angle at O", () => {
    const scene = buildQuadScene(QUAD_PRESETS.find((p) => p.id === "rhombus-right")!.state);
    assert.ok(scene.cmds.some((c) => c.t === "rightAngle"));
  });

  it("parallel-area shades triangle DBC and names the lines", () => {
    const scene = buildQuadScene(QUAD_PRESETS.find((p) => p.id === "parallel-area")!.state);
    assert.ok(scene.cmds.some((c) => c.t === "polygon"));
    assert.ok(scene.texts.some((t) => t.id === "guide:top"));
    assert.ok(scene.texts.some((t) => t.id === "guide:bottom"));
  });

  it("length text stays put when only the dim line is offset", () => {
    const base = normalizeState(cloneState(QUAD_PRESETS[0]!.state));
    const movedLine = normalizeState({
      ...base,
      edges: base.edges.map((e, i) =>
        i === 0 ? { ...e, length: { ...e.length, lineDy: 36 } } : e,
      ),
    });
    const movedText = normalizeState({
      ...base,
      edges: base.edges.map((e, i) =>
        i === 0 ? { ...e, length: { ...e.length, dy: 36 } } : e,
      ),
    });
    const t0 = buildQuadScene(base).texts.find((t) => t.id === "e:0:length");
    const tLine = buildQuadScene(movedLine).texts.find((t) => t.id === "e:0:length");
    const tText = buildQuadScene(movedText).texts.find((t) => t.id === "e:0:length");
    assert.ok(t0 && tLine && tText);
    assert.ok(Math.abs(t0.y - tLine.y) < 1.5);
    assert.ok(Math.abs(t0.y - tText.y) > 8);
  });

  it("diagonal faces include triangle OAD", () => {
    const state = normalizeState({
      ...QUAD_PRESETS[0]!.state,
      showDiagAC: true,
      showDiagBD: true,
      showO: true,
      faces: {
        DBC: "none",
        ODC: "none",
        ABC: "none",
        AOB: "none",
        BOC: "none",
        OAD: "green",
      },
    });
    const scene = buildQuadScene(state);
    assert.ok(scene.cmds.some((c) => c.t === "polygon"));
  });
});

describe("rotation", () => {
  it("turning 90° moves the canvas vertices off the untilted pose", () => {
    const base = normalizeState(cloneState(QUAD_PRESETS[0]!.state));
    const untilted = buildQuadScene(base);
    const tilted = buildQuadScene(normalizeState({ ...base, rotateDeg: 90 }));
    const d = Math.hypot(
      tilted.layout.canvas[0]!.x - untilted.layout.canvas[0]!.x,
      tilted.layout.canvas[0]!.y - untilted.layout.canvas[0]!.y,
    );
    assert.ok(d > 8, `vertex A should move, got ${d}`);
  });
});
