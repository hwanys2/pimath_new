import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runsToPlain } from "../math-label";
import { applyEditedLabel } from "../solid-sketch/geometry";
import { buildSolidMesh } from "../solid-sketch/solids";
import { applyPairEditedLabel, togglePairEdge } from "./geometry";
import {
  continuedVertexNames,
  DEFAULT_SIMILAR_SOLIDS_STATE,
  normalizeSimilarState,
  pairSolidStates,
  patchSideMarks,
  scaleSolidState,
  similarityScale,
  SIMILAR_SOLIDS_PRESETS,
  cloneSimilarState,
} from "./model";
import { buildSimilarSolidsScene, SCENE_HEIGHT, SCENE_WIDTH } from "./scene";

describe("similar solids scale and names", () => {
  it("scales height 3 cm by 3:5 to 5 on the right", () => {
    const state = cloneSimilarState(DEFAULT_SIMILAR_SOLIDS_STATE);
    assert.equal(state.source.height, 3);
    assert.equal(state.ratioLeft, 3);
    assert.equal(state.ratioRight, 5);
    assert.equal(similarityScale(state), 5 / 3);
    const { right } = pairSolidStates(state);
    assert.ok(Math.abs(right.height - 5) < 1e-6);
  });

  it("continues vertex names after the left solid", () => {
    const names = continuedVertexNames(["A", "B", "C", "D", "E", "F"], 6);
    assert.deepEqual(names, ["G", "H", "I", "J", "K", "L"]);
    const cuboid = continuedVertexNames(["A", "B", "C", "D", "E", "F", "G", "H"], 8);
    assert.equal(cuboid[0], "I");
    assert.equal(cuboid[7], "P");
  });

  it("gives the right triangular prism names G–L", () => {
    const { left, right } = pairSolidStates(DEFAULT_SIMILAR_SOLIDS_STATE);
    const leftMesh = buildSolidMesh(left);
    const rightMesh = buildSolidMesh(right);
    assert.equal(leftMesh.names.length, 6);
    assert.deepEqual(leftMesh.names, ["A", "B", "C", "D", "E", "F"]);
    assert.deepEqual(rightMesh.names, ["G", "H", "I", "J", "K", "L"]);
  });
});

describe("similar solids scene", () => {
  it("draws two solids on a wide canvas with a shared fit scale", () => {
    const scene = buildSimilarSolidsScene(DEFAULT_SIMILAR_SOLIDS_STATE);
    assert.equal(scene.width, SCENE_WIDTH);
    assert.equal(scene.height, SCENE_HEIGHT);
    assert.equal(scene.left.fit.scale, scene.right.fit.scale);
    assert.ok(scene.left.mesh.vertices.length >= 6);
    assert.ok(scene.right.mesh.vertices.length >= 6);
    const leftXs = scene.left.vertices.map((p) => p.x);
    const rightXs = scene.right.vertices.map((p) => p.x);
    assert.ok(Math.max(...leftXs) < Math.min(...rightXs));
    const leftSpan = Math.max(...leftXs) - Math.min(...leftXs);
    const rightSpan = Math.max(...rightXs) - Math.min(...rightXs);
    assert.ok(rightSpan > leftSpan * 1.2);
    assert.ok(scene.texts.some((t) => t.id.startsWith("L:")));
    assert.ok(scene.texts.some((t) => t.id.startsWith("R:")));
  });

  it("shows scaled auto labels on the right", () => {
    const scene = buildSimilarSolidsScene(DEFAULT_SIMILAR_SOLIDS_STATE);
    const leftH = scene.texts.find((t) => t.id === "L:height");
    const rightH = scene.texts.find((t) => t.id === "R:height");
    assert.ok(leftH);
    assert.ok(rightH);
    assert.match(runsToPlain(leftH.runs), /3/);
    assert.match(runsToPlain(rightH.runs), /5/);
  });

  it("places figure labels A and B on the pyramid preset", () => {
    const preset = SIMILAR_SOLIDS_PRESETS.find((p) => p.id === "tri-pyramid");
    assert.ok(preset);
    const scene = buildSimilarSolidsScene(preset.state);
    const left = scene.texts.find((t) => t.id === "figure:left");
    const right = scene.texts.find((t) => t.id === "figure:right");
    assert.ok(left);
    assert.ok(right);
    assert.equal(runsToPlain(left.runs), "A");
    assert.equal(runsToPlain(right.runs), "B");
  });

  it("keeps the left number and updates the right when the ratio changes", () => {
    const next = normalizeSimilarState({
      ...DEFAULT_SIMILAR_SOLIDS_STATE,
      ratioLeft: 2,
      ratioRight: 3,
    });
    assert.equal(next.source.height, 3);
    const { right } = pairSolidStates(next);
    assert.ok(Math.abs(right.height - 4.5) < 1e-6);
  });

  it("edits a right-side number back through the ratio", () => {
    const next = applyPairEditedLabel(
      DEFAULT_SIMILAR_SOLIDS_STATE,
      "R:height",
      "10 cm",
    );
    assert.ok(Math.abs(next.source.height - 6) < 1e-6);
    const { right } = pairSolidStates(next);
    assert.ok(Math.abs(right.height - 10) < 1e-6);
  });

  it("edits a left-side number and scales the right", () => {
    const next = applyPairEditedLabel(
      DEFAULT_SIMILAR_SOLIDS_STATE,
      "L:height",
      "6",
    );
    assert.equal(next.source.height, 6);
    const { right } = pairSolidStates(next);
    assert.ok(Math.abs(right.height - 10) < 1e-6);
  });

  it("turns off left height without hiding the right height", () => {
    const next = patchSideMarks(DEFAULT_SIMILAR_SOLIDS_STATE, "left", {
      showHeight: false,
    });
    assert.equal(next.source.showHeight, false);
    assert.equal(next.rightMarks.showHeight, true);
    const scene = buildSimilarSolidsScene(next);
    assert.equal(scene.texts.some((t) => t.id === "L:height"), false);
    assert.ok(scene.texts.some((t) => t.id === "R:height"));
  });

  it("toggles an edge on the left without adding it on the right", () => {
    const next = togglePairEdge(DEFAULT_SIMILAR_SOLIDS_STATE, "0-1", "left");
    assert.ok(next.source.edgeLabels["0-1"]);
    assert.equal(next.rightMarks.edgeLabels["0-1"], undefined);
    const scene = buildSimilarSolidsScene(next);
    assert.ok(scene.texts.some((t) => t.id === "L:edge:0-1"));
    assert.equal(
      scene.texts.some((t) => t.id === "R:edge:0-1"),
      false,
    );
  });

  it("builds every preset", () => {
    for (const preset of SIMILAR_SOLIDS_PRESETS) {
      const scene = buildSimilarSolidsScene(cloneSimilarState(preset.state));
      assert.ok(scene.cmds.length > 4, preset.id);
      assert.ok(scene.left.fit.scale === scene.right.fit.scale, preset.id);
    }
  });
});

describe("scaleSolidState", () => {
  it("multiplies linear dimensions", () => {
    const scaled = scaleSolidState(DEFAULT_SIMILAR_SOLIDS_STATE.source, 2);
    assert.equal(scaled.height, 6);
    assert.equal(scaled.baseSize, DEFAULT_SIMILAR_SOLIDS_STATE.source.baseSize * 2);
  });
});

describe("left label edit still uses the solid-sketch helper", () => {
  it("applyEditedLabel changes height", () => {
    const source = applyEditedLabel(
      DEFAULT_SIMILAR_SOLIDS_STATE.source,
      "height",
      "9 cm",
    );
    assert.equal(source.height, 9);
  });
});
