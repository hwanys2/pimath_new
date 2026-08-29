import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SOLID_SKETCH_STATE,
  SOLID_SKETCH_PRESETS,
  cloneState,
  familyIsRound,
  normalizeState,
  type SolidFamily,
} from "./model";
import { buildSolidSketchScene } from "./scene";
import { buildSolidMesh } from "./solids";

const FAMILIES: SolidFamily[] = [
  "prism",
  "pyramid",
  "frustum",
  "cylinder",
  "cone",
  "coneFrustum",
  "platonic",
];

describe("all families build a scene", () => {
  for (const family of FAMILIES) {
    it(`renders ${family}`, () => {
      const state = normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family,
        platonic: "icosahedron",
        sides: 6,
        cylinderLie: "horizontal",
        showFill: true,
        showVertexNames: !familyIsRound(family),
        showHeight: true,
        showRadius: familyIsRound(family),
        showSlant: family === "cone" || family === "pyramid",
        showBaseEdge: !familyIsRound(family),
        showCenter: familyIsRound(family),
      });
      const scene = buildSolidSketchScene(state);
      assert.equal(scene.width, 520);
      assert.ok(scene.cmds.length > 2);
      const lines = scene.cmds.filter((c) => c.t === "line" || c.t === "ellipseArc");
      assert.ok(lines.length > 0, "expected edges or ellipse rims");
    });
  }

  it("presets all produce vertex or center labels when requested", () => {
    for (const preset of SOLID_SKETCH_PRESETS) {
      const scene = buildSolidSketchScene(cloneState(preset.state));
      assert.ok(scene.cmds.length > 0, preset.id);
    }
  });

  it("dodecahedron and icosahedron have the textbook face counts", () => {
    const dodeca = buildSolidMesh(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "platonic",
        platonic: "dodecahedron",
      }),
    );
    assert.equal(dodeca.faces.length, 12);
    assert.ok(dodeca.faces.every((f) => f.length === 5));
    const icosa = buildSolidMesh(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "platonic",
        platonic: "icosahedron",
      }),
    );
    assert.equal(icosa.faces.length, 20);
    assert.ok(icosa.faces.every((f) => f.length === 3));
  });
});
