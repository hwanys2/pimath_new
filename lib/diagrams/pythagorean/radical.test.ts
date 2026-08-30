import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSqrtLabel, parseMathRuns } from "@/lib/diagrams/math-label";
import { resolveSegText } from "./geometry";
import {
  formatHypotenuseLabel,
  formatRadicalLength,
  simplifySqrtInt,
} from "./radical";
import {
  PYTHAGOREAN_PRESETS,
  cloneState,
  normalizeState,
} from "./model";
import { rebuildTriangleFromLegs } from "./geometry";

describe("pythagorean radical", () => {
  it("simplifies square roots", () => {
    assert.deepEqual(simplifySqrtInt(50), { coeff: 5, radicand: 2 });
    assert.deepEqual(simplifySqrtInt(25), { coeff: 5, radicand: 1 });
    assert.deepEqual(simplifySqrtInt(12), { coeff: 2, radicand: 3 });
  });

  it("formats hypotenuse as simplified radical", () => {
    assert.equal(formatHypotenuseLabel(5, 5, "cm", 7.07), "$5\\sqrt{2}$ cm");
    assert.equal(formatHypotenuseLabel(3, 4, "cm", 5), "5 cm");
    assert.equal(formatHypotenuseLabel(9, 12, "cm", 15), "15 cm");
  });

  it("normalizes unicode sqrt for parsing", () => {
    const runs = parseMathRuns("5√2 cm");
    assert.ok(runs.some((r) => r.sqrtBody));
    assert.equal(normalizeSqrtLabel("5√2 cm"), "$5\\sqrt{2}$ cm");
  });

  it("auto hypotenuse updates when legs change", () => {
    let state = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-iso")!.state));
    const hyp = state.segs.find((s) => s.id === "AB")!;
    assert.equal(resolveSegText(state, hyp), "$5\\sqrt{2}$ cm");
    state = rebuildTriangleFromLegs({ ...state, isoscelesRight: false }, 3, 4);
    const hypSeg = state.segs.find((s) => s.id === "AB")!;
    assert.equal(resolveSegText(state, hypSeg), "5 cm");
  });

  it("custom sqrt labels normalize for rendering", () => {
    const state = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-iso")!.state));
    const seg = state.segs.find((s) => s.id === "BC")!;
    const text = resolveSegText(state, { ...seg, label: { mode: "custom", custom: "5√2 cm" } });
    assert.equal(text, "$5\\sqrt{2}$ cm");
    assert.ok(parseMathRuns(text!).some((r) => r.sqrtBody));
  });
});

describe("formatRadicalLength", () => {
  it("omits radical when perfect square", () => {
    assert.equal(formatRadicalLength(5, 1, "cm"), "5 cm");
  });
});
