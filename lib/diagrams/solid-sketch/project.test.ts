import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_AZIMUTH,
  DEFAULT_ELEVATION,
  DEFAULT_SOLID_SKETCH_STATE,
  cloneState,
  defaultVertexNames,
  normalizeState,
} from "./model";
import { cameraFromView, hiddenEdgeKeys, project3 } from "./project";
import { buildSolidSketchScene } from "./scene";
import { buildSolidMesh, convexHullFaces } from "./solids";

describe("solid sketch vertices and names", () => {
  it("names a square prism A–D on top then E–H on the bottom", () => {
    const mesh = buildSolidMesh(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "prism",
        sides: 4,
        vertexNames: [],
      }),
    );
    assert.equal(mesh.vertices.length, 8);
    assert.deepEqual(mesh.names, defaultVertexNames(8));
    assert.equal(mesh.names[0], "A");
    assert.equal(mesh.names[4], "E");
    const topY = mesh.vertices[0]!.y;
    const botY = mesh.vertices[4]!.y;
    assert.ok(topY > botY);
  });

  it("uses sequential letters for a pentagonal prism", () => {
    const mesh = buildSolidMesh(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "prism",
        sides: 5,
        vertexNames: [],
      }),
    );
    assert.equal(mesh.vertices.length, 10);
    assert.deepEqual(mesh.names.slice(0, 5), ["A", "B", "C", "D", "E"]);
    assert.deepEqual(mesh.names.slice(5), ["F", "G", "H", "I", "J"]);
  });
});

describe("convex hidden lines", () => {
  it("marks three hidden edges on a cube in the default 3/4 view", () => {
    const state = normalizeState({
      ...DEFAULT_SOLID_SKETCH_STATE,
      family: "platonic",
      platonic: "cube",
      azimuthDeg: DEFAULT_AZIMUTH,
      elevationDeg: DEFAULT_ELEVATION,
    });
    const mesh = buildSolidMesh(state);
    assert.equal(mesh.vertices.length, 8);
    assert.equal(mesh.faces.length, 6);
    assert.equal(mesh.edges.length, 12);
    const cam = cameraFromView(state.azimuthDeg, state.elevationDeg);
    const hidden = hiddenEdgeKeys(mesh, cam);
    assert.equal(hidden.size, 3);
  });

  it("gives a tetrahedron four triangular faces", () => {
    const mesh = buildSolidMesh(
      normalizeState({
        ...DEFAULT_SOLID_SKETCH_STATE,
        family: "platonic",
        platonic: "tetrahedron",
      }),
    );
    assert.equal(mesh.vertices.length, 4);
    assert.equal(mesh.faces.length, 4);
    for (const face of mesh.faces) assert.equal(face.length, 3);
  });
});

describe("projection and scene", () => {
  it("projects a horizontal circle to a non-circular ellipse when viewed from the side", () => {
    const cam = cameraFromView(0, 28);
    const p = project3({ x: 1, y: 0, z: 0 }, cam);
    const q = project3({ x: 0, y: 0, z: 1 }, cam);
    const rx = Math.hypot(p.x, p.y);
    const ry = Math.hypot(q.x, q.y);
    assert.ok(Math.abs(rx - ry) > 0.15);
  });

  it("builds a scene with hidden dashed lines for the default cuboid", () => {
    const scene = buildSolidSketchScene(cloneState(DEFAULT_SOLID_SKETCH_STATE));
    const dashed = scene.cmds.filter((c) => c.t === "line" && c.dashed);
    assert.ok(dashed.length >= 3);
    const labels = scene.texts.filter((t) => t.id.startsWith("vertex:"));
    assert.equal(labels.length, 8);
  });

  it("omits fills when showFill is off", () => {
    const scene = buildSolidSketchScene(
      normalizeState({ ...DEFAULT_SOLID_SKETCH_STATE, showFill: false }),
    );
    assert.equal(
      scene.cmds.filter((c) => c.t === "polygon").length,
      0,
    );
  });
});

describe("convex hull", () => {
  it("finds six square faces on a cube", () => {
    const verts = [
      { x: -1, y: 1, z: -1 },
      { x: -1, y: 1, z: 1 },
      { x: 1, y: 1, z: 1 },
      { x: 1, y: 1, z: -1 },
      { x: -1, y: -1, z: -1 },
      { x: -1, y: -1, z: 1 },
      { x: 1, y: -1, z: 1 },
      { x: 1, y: -1, z: -1 },
    ];
    const faces = convexHullFaces(verts);
    assert.equal(faces.length, 6);
    assert.ok(faces.every((f) => f.length === 4));
  });
});
