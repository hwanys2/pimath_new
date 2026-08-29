import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatTickLabel,
  nHintFromRational,
  nHintFromValue,
  parseNumberLineValue,
} from "./parse";
import {
  DEFAULT_NUMBER_LINE_STATE,
  NUMBER_LINE_PRESETS,
  resolveBands,
} from "./model";
import { buildNumberLineScene, canvasXFromValue } from "./scene";

describe("number line value parsing", () => {
  it("parses integers, decimals, fractions, and mixed numbers", () => {
    assert.equal(parseNumberLineValue("3")?.value, 3);
    assert.equal(parseNumberLineValue("+3")?.value, 3);
    assert.equal(parseNumberLineValue("-1.5")?.value, -1.5);
    assert.equal(parseNumberLineValue("3/4")?.value, 0.75);
    assert.equal(parseNumberLineValue("-17/4")?.value, -4.25);
    assert.equal(parseNumberLineValue("-4 1/4")?.value, -4.25);
    assert.equal(parseNumberLineValue("−3/2")?.value, -1.5);
  });

  it("guesses n from the unit-interval denominator", () => {
    assert.equal(parseNumberLineValue("-17/4")?.nHint, 4);
    assert.equal(parseNumberLineValue("-3/2")?.nHint, 2);
    assert.equal(parseNumberLineValue("15/4")?.nHint, 4);
    assert.equal(parseNumberLineValue("-4 1/4")?.nHint, 4);
    assert.equal(parseNumberLineValue("5")?.nHint, null);
    assert.equal(nHintFromRational(-17, 4), 4);
    assert.equal(nHintFromValue(-1.5), 2);
  });

  it("formats tick labels with an optional plus sign", () => {
    assert.equal(formatTickLabel(0, true), "0");
    assert.equal(formatTickLabel(1, true), "+1");
    assert.equal(formatTickLabel(-5, true), "-5");
    assert.equal(formatTickLabel(2, false), "2");
  });
});

describe("number line scene", () => {
  it("places the rational-reading preset points in order on the axis", () => {
    const preset = NUMBER_LINE_PRESETS.find((p) => p.id === "rationals")!;
    const scene = buildNumberLineScene(preset.state);
    const xs = preset.state.points.map((p) =>
      canvasXFromValue(p.value, scene.layout),
    );
    assert.equal(xs.length, 4);
    assert.ok(xs[0]! < xs[1]! && xs[1]! < xs[2]! && xs[2]! < xs[3]!);
    const a = preset.state.points[0]!;
    const left = canvasXFromValue(-5, scene.layout);
    const neg4 = canvasXFromValue(-4, scene.layout);
    assert.ok(xs[0]! > left && xs[0]! < neg4);
    assert.equal(a.name, "A");
  });

  it("builds n-division bands for the default exam figure", () => {
    const bands = resolveBands(DEFAULT_NUMBER_LINE_STATE);
    const starts = bands.map((b) => b.start);
    assert.ok(starts.includes(-5));
    assert.ok(starts.includes(-2));
    assert.ok(starts.includes(3));
    assert.equal(bands.find((b) => b.start === -2)?.n, 2);
    assert.equal(bands.find((b) => b.start === -5)?.n, 4);
    assert.equal(bands.find((b) => b.start === 3)?.n, 4);
  });
});
