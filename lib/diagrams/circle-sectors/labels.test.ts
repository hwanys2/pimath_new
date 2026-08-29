import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyEditedLabel, parseMeasureInput } from "./geometry";
import {
  CIRCLE_SECTOR_PRESETS,
  arcPiCoeff,
  areaPiCoeff,
  cloneState,
  formatArcAuto,
  formatAreaAuto,
  resolveAngleText,
  resolveLabelText,
} from "./model";

describe("circle sector measures", () => {
  it("formats arc length as a π multiple when it is nice", () => {
    assert.equal(formatArcAuto(60, 9, "cm"), "3π cm");
    assert.equal(arcPiCoeff(60, 9), 3);
    assert.equal(formatArcAuto(288, 5, "cm"), "8π cm");
  });

  it("formats sector area as a π multiple when it is nice", () => {
    assert.equal(formatAreaAuto(90, 4, "cm"), "4π cm²");
    assert.equal(areaPiCoeff(90, 4), 4);
  });

  it("resolves unknown angle and area labels", () => {
    const x = { mode: "x" as const, custom: "", dx: 0, dy: 0 };
    assert.equal(resolveAngleText(x, 45, "x"), "$x$°");
    assert.equal(resolveLabelText(x, "6 cm²", "cm²", "x"), "$x$ cm²");
  });

  it("parses π arc input and updates the central angle", () => {
    assert.deepEqual(parseMeasureInput("3π cm").kind, "pi");
    assert.equal(parseMeasureInput("3π cm").value, 3);
    let state = cloneState(CIRCLE_SECTOR_PRESETS[4]!.state);
    const id = state.sectors[0]!.id;
    state = applyEditedLabel(state, `${id}:arcLabel`, "3π");
    assert.equal(state.sectors[0]!.centralAngleDeg, 60);
    assert.equal(state.sectors[0]!.arcLabel.mode, "auto");
  });

  it("keeps a major sector when the arc is 8π", () => {
    let state = cloneState(CIRCLE_SECTOR_PRESETS[5]!.state);
    const id = state.sectors[0]!.id;
    state = applyEditedLabel(state, `${id}:arcLabel`, "8π cm");
    assert.ok(state.sectors[0]!.centralAngleDeg > 180);
    assert.equal(Math.round(state.sectors[0]!.centralAngleDeg), 288);
  });

  it("edits a number on arc length with radius fixed", () => {
    let state = cloneState(CIRCLE_SECTOR_PRESETS[0]!.state);
    const id = state.sectors[1]!.id;
    const r = state.radius;
    state = applyEditedLabel(state, `${id}:arcLabel`, "15");
    assert.equal(state.radius, r);
    assert.equal(state.sectors[1]!.arcLabel.mode, "auto");
    assert.ok(state.sectors[1]!.centralAngleDeg > 1);
  });
});
