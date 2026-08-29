import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SOLID_SKETCH_STATE,
  SOLID_SKETCH_PRESETS,
  cloneState,
  cycleVertexDisplay,
  familyHasSlant,
  familyIsSmooth,
  normalizeState,
  toggleVertexNameHidden,
  type SolidFamily,
} from "./model";
import { applyEditedLabel } from "./geometry";
import { buildSolidSketchScene } from "./scene";
import {
  buildSolidMesh,
  faceHeightLength,
  isLateralEdge,
  slantLength,
  withFaceHeight,
  withSlantLength,
} from "./solids";

const FAMILIES: SolidFamily[] = [
  "prism",
  "pyramid",
  "frustum",
  "cylinder",
  "cone",
  "coneFrustum",
  "sphere",
  "hemisphere",
  "coneHemisphere",
  "cylinderHemisphere",
  "cylinderCone",
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
        vertexDisplay: !familyIsSmooth(family) ? "names" : "hidden",
        showHeight: family !== "sphere" && family !== "hemisphere",
        showRadius: familyIsSmooth(family),
        showSlant: familyHasSlant(family),
        showBaseEdge: !familyIsSmooth(family),
        showCenter: familyIsSmooth(family),
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

describe("face altitude of pyramid and frustum", () => {
  it("pyramid: 옆면 높이 is the altitude to a base edge and drives the solid height", () => {
    const start = normalizeState({
      ...DEFAULT_SOLID_SKETCH_STATE,
      family: "pyramid",
      sides: 4,
      baseSize: 6,
      height: 5,
    });
    const mesh = buildSolidMesh(start);
    const a = mesh.vertices[0]!;
    const b = mesh.vertices[1]!;
    const apex = mesh.vertices[mesh.apexIndex!]!;
    const mid = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
    };
    const edge = Math.hypot(apex.x - mid.x, apex.y - mid.y, apex.z - mid.z);
    assert.ok(Math.abs(faceHeightLength(start) - edge) < 1e-6);
    assert.ok(faceHeightLength(start) > start.height);

    const next = withFaceHeight(start, 8);
    assert.ok(Math.abs(faceHeightLength(next) - 8) < 1e-6);
    assert.ok(next.height !== start.height);
    assert.equal(next.baseSize, start.baseSize);
  });

  it("frustum: 옆면 높이 4 with bases 5 and 3 sets the trapezoid altitude", () => {
    const start = normalizeState({
      ...DEFAULT_SOLID_SKETCH_STATE,
      family: "frustum",
      sides: 4,
      baseSize: 5,
      topSize: 3,
      height: 5,
    });
    const next = applyEditedLabel(start, "faceHeight", "4");
    assert.ok(Math.abs(faceHeightLength(next) - 4) < 1e-6);
    assert.ok(Math.abs(next.height - Math.sqrt(15)) < 1e-3);
    assert.equal(next.baseSize, 5);
    assert.equal(next.topSize, 3);
  });

  it("draws the face altitude with right-angle marks and a label", () => {
    const pyramid = buildSolidSketchScene(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "pyramid",
        sides: 3,
        showFaceHeight: true,
        vertexDisplay: "hidden",
      }),
    );
    assert.ok(pyramid.texts.some((t) => t.id === "faceHeight"));
    assert.ok(pyramid.cmds.some((c) => c.t === "rightAngle"));
    assert.ok(
      pyramid.cmds.some((c) => c.t === "line" && "id" in c && c.id === "faceHeight:line" && !c.dashed),
    );

    const frustum = buildSolidSketchScene(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "frustum",
        sides: 4,
        baseSize: 5,
        topSize: 3,
        showFaceHeight: true,
        vertexDisplay: "hidden",
      }),
    );
    const rights = frustum.cmds.filter((c) => c.t === "rightAngle");
    assert.ok(rights.length >= 2, "trapezoid altitude is perpendicular at both bases");
    assert.ok(frustum.texts.some((t) => t.id === "faceHeight"));
  });
});

describe("round fills and sphere", () => {
  it("fills the whole base disk of a standing cylinder, not only the facing top", () => {
    const scene = buildSolidSketchScene(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "cylinder",
        showFill: true,
        vertexDisplay: "hidden",
      }),
    );
    const fills = scene.cmds.filter((c) => c.t === "polygon");
    assert.ok(fills.length >= 3, "base disk, lateral, and top disk");
  });

  it("fills the base disk of a cone frustum", () => {
    const scene = buildSolidSketchScene(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "coneFrustum",
        showFill: true,
        vertexDisplay: "hidden",
      }),
    );
    const fills = scene.cmds.filter((c) => c.t === "polygon");
    assert.ok(fills.length >= 3, "base disk, lateral, and top disk");
  });

  it("draws a sphere with center, radius, equator, and outline", () => {
    const scene = buildSolidSketchScene(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "sphere",
        radius: 5,
        showFill: true,
        showCenter: true,
        showRadius: true,
        showHidden: true,
        vertexDisplay: "hidden",
      }),
    );
    assert.ok(scene.texts.some((t) => t.id === "center-name"));
    assert.ok(scene.texts.some((t) => t.id === "radius"));
    const arcs = scene.cmds.filter((c) => c.t === "ellipseArc");
    assert.ok(arcs.length >= 3, "equator front, equator back, silhouette");
    assert.ok(arcs.some((c) => "dashed" in c && c.dashed));
  });

  it("draws a hemisphere with center, radius, equator, and dome outline", () => {
    const scene = buildSolidSketchScene(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "hemisphere",
        radius: 5,
        showFill: true,
        showCenter: true,
        showRadius: true,
        showHidden: true,
        vertexDisplay: "hidden",
      }),
    );
    assert.ok(scene.texts.some((t) => t.id === "center-name"));
    assert.ok(scene.texts.some((t) => t.id === "radius"));
    const arcs = scene.cmds.filter((c) => c.t === "ellipseArc");
    assert.ok(arcs.length >= 3, "equator front, equator back, dome silhouette");
    assert.ok(arcs.some((c) => "dashed" in c && c.dashed));
  });

  it("draws a flipped hemisphere with the cut face on top", () => {
    const scene = buildSolidSketchScene(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "hemisphere",
        radius: 5,
        hemisphereFlip: true,
        showFill: true,
        showCenter: true,
        showRadius: true,
        showHidden: true,
        vertexDisplay: "hidden",
      }),
    );
    const mesh = buildSolidMesh(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "hemisphere",
        radius: 5,
        hemisphereFlip: true,
      }),
    );
    assert.equal(mesh.hemispheres?.[0]?.axis.y, -1);
    assert.equal(mesh.circles[0]!.normal.y, 1);
    assert.ok(scene.cmds.some((c) => c.t === "ellipseArc"));
  });
});

describe("same-radius stacked solids", () => {
  it("cone + hemisphere share one radius and draw generators plus a dome", () => {
    const state = normalizeState({
      ...DEFAULT_SOLID_SKETCH_STATE,
      family: "coneHemisphere",
      radius: 4,
      height: 6,
      showFill: true,
      showHidden: true,
      showCenter: true,
      showRadius: true,
      showSlant: true,
      vertexDisplay: "hidden",
    });
    const mesh = buildSolidMesh(state);
    assert.equal(mesh.circles.length, 1);
    assert.equal(mesh.circles[0]!.radius, 4);
    assert.equal(mesh.hemispheres?.[0]?.radius, 4);
    const scene = buildSolidSketchScene(state);
    assert.ok(scene.cmds.some((c) => c.t === "line"));
    assert.ok(scene.cmds.some((c) => c.t === "ellipseArc"));
    assert.ok(scene.texts.some((t) => t.id === "slant"));
  });

  it("cylinder + hemisphere share one radius", () => {
    const mesh = buildSolidMesh(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "cylinderHemisphere",
        radius: 3,
        height: 5,
      }),
    );
    assert.equal(mesh.circles.length, 2);
    assert.ok(mesh.circles.every((c) => c.radius === 3));
    assert.equal(mesh.hemispheres?.[0]?.radius, 3);
    const scene = buildSolidSketchScene(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "cylinderHemisphere",
        showFill: true,
        showHidden: true,
      }),
    );
    assert.ok(scene.cmds.filter((c) => c.t === "line").length >= 2);
    assert.ok(scene.cmds.some((c) => c.t === "ellipseArc"));
  });

  it("cylinder + cone share one radius; 모선 edits the cone height only", () => {
    const start = normalizeState({
      ...DEFAULT_SOLID_SKETCH_STATE,
      family: "cylinderCone",
      radius: 3,
      height: 5,
      capHeight: 4,
    });
    const mesh = buildSolidMesh(start);
    assert.ok(mesh.circles.every((c) => c.radius === 3));
    const next = withSlantLength(start, 8);
    assert.equal(next.height, start.height);
    assert.ok(Math.abs(slantLength(next) - 8) < 1e-6);
    assert.ok(Math.abs(next.capHeight - Math.sqrt(8 * 8 - 3 * 3)) < 1e-6);
    const scene = buildSolidSketchScene(
      normalizeState({
        ...start,
        showFill: true,
        showSlant: true,
        vertexDisplay: "hidden",
      }),
    );
    assert.ok(scene.cmds.filter((c) => c.t === "line").length >= 2);
  });
});

describe("per-vertex names", () => {
  it("hides only the chosen vertex label", () => {
    const start = normalizeState({
      ...DEFAULT_SOLID_SKETCH_STATE,
      family: "prism",
      sides: 4,
      vertexDisplay: "names",
    });
    const hidden = toggleVertexNameHidden(start, 0);
    const scene = buildSolidSketchScene(hidden);
    const labels = scene.texts.filter((t) => t.id.startsWith("vertex:"));
    const dots = scene.cmds.filter((c) => c.t === "dot");
    assert.equal(labels.length, 7);
    assert.equal(dots.length, 8, "hiding a name must not hide the vertex dot");
    assert.ok(!labels.some((t) => t.id === "vertex:0"));
    assert.ok(labels.some((t) => t.id === "vertex:1"));
  });

  it("shows all dots without labels in dots mode even when some names were hidden", () => {
    const start = normalizeState({
      ...DEFAULT_SOLID_SKETCH_STATE,
      family: "frustum",
      sides: 3,
      vertexDisplay: "names",
    });
    const withHidden = toggleVertexNameHidden(start, 0);
    const scene = buildSolidSketchScene({ ...withHidden, vertexDisplay: "dots" });
    const labels = scene.texts.filter((t) => t.id.startsWith("vertex:"));
    const dots = scene.cmds.filter((c) => c.t === "dot");
    assert.equal(labels.length, 0);
    assert.equal(dots.length, 6);
  });

  it("shows dots without labels in dots mode", () => {
    const scene = buildSolidSketchScene(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "prism",
        sides: 4,
        vertexDisplay: "dots",
      }),
    );
    const labels = scene.texts.filter((t) => t.id.startsWith("vertex:"));
    const dots = scene.cmds.filter((c) => c.t === "dot");
    assert.equal(labels.length, 0);
    assert.equal(dots.length, 8);
  });

  it("hides all vertex dots and labels in hidden mode", () => {
    const scene = buildSolidSketchScene(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "frustum",
        sides: 3,
        vertexDisplay: "hidden",
      }),
    );
    const labels = scene.texts.filter((t) => t.id.startsWith("vertex:"));
    const dots = scene.cmds.filter((c) => c.t === "dot");
    assert.equal(labels.length, 0);
    assert.equal(dots.length, 0);
  });

  it("cycles names -> dots -> hidden -> names", () => {
    assert.equal(cycleVertexDisplay("names"), "dots");
    assert.equal(cycleVertexDisplay("dots"), "hidden");
    assert.equal(cycleVertexDisplay("hidden"), "names");
  });

  it("migrates legacy showVertexNames=false to hidden", () => {
    const legacy = { ...DEFAULT_SOLID_SKETCH_STATE } as Record<string, unknown>;
    delete legacy.vertexDisplay;
    legacy.showVertexNames = false;
    const state = normalizeState(legacy as typeof DEFAULT_SOLID_SKETCH_STATE);
    assert.equal(state.vertexDisplay, "hidden");
  });
});
