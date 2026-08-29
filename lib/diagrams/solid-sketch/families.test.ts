import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SOLID_SKETCH_STATE,
  SOLID_SKETCH_PRESETS,
  cloneState,
  familyIsRound,
  familyHasSlant,
  normalizeState,
  type SolidFamily,
} from "./model";
import { applyEditedLabel } from "./geometry";
import { buildSolidSketchScene } from "./scene";
import {
  buildSolidMesh,
  isLateralEdge,
  slantLength,
  withSlantLength,
} from "./solids";

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
        showSlant: familyHasSlant(family),
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

describe("slant length drives height", () => {
  it("pyramid: editing 모선 updates height and matches the lateral edge", () => {
    const start = normalizeState({
      ...DEFAULT_SOLID_SKETCH_STATE,
      family: "pyramid",
      sides: 4,
      baseSize: 6,
      height: 5,
    });
    const next = applyEditedLabel(start, "slant", "10");
    assert.ok(Math.abs(slantLength(next) - 10) < 1e-6);
    assert.ok(next.height > start.height);
    const mesh = buildSolidMesh(next);
    const apex = mesh.vertices[mesh.apexIndex!]!;
    const base = mesh.vertices[0]!;
    const edge = Math.hypot(apex.x - base.x, apex.y - base.y, apex.z - base.z);
    assert.ok(Math.abs(edge - 10) < 1e-6);
  });

  it("frustum: 모선 is the lateral edge, not the height", () => {
    const start = normalizeState({
      ...DEFAULT_SOLID_SKETCH_STATE,
      family: "frustum",
      sides: 4,
      baseSize: 8,
      topSize: 4,
      height: 5,
    });
    assert.ok(slantLength(start) > start.height);
    const next = withSlantLength(start, 9);
    assert.ok(Math.abs(slantLength(next) - 9) < 1e-6);
    const mesh = buildSolidMesh(next);
    assert.equal(isLateralEdge(next, 0, next.sides), true);
    const a = mesh.vertices[0]!;
    const b = mesh.vertices[next.sides]!;
    const edge = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    assert.ok(Math.abs(edge - 9) < 1e-6);
  });

  it("cone frustum: editing 모선 updates height", () => {
    const start = normalizeState({
      ...DEFAULT_SOLID_SKETCH_STATE,
      family: "coneFrustum",
      radius: 6,
      topRadius: 3,
      height: 4,
    });
    const next = applyEditedLabel(start, "slant", "8");
    assert.ok(Math.abs(slantLength(next) - 8) < 1e-6);
  });

  it("pyramid lateral edge label number updates height", () => {
    const start = normalizeState({
      ...DEFAULT_SOLID_SKETCH_STATE,
      family: "pyramid",
      sides: 4,
      baseSize: 6,
      height: 4,
    });
    const next = applyEditedLabel(start, "edge:0-4", "9");
    assert.ok(Math.abs(slantLength(next) - 9) < 1e-6);
  });
});
