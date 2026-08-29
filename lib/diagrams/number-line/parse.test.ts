import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPointLabel,
  formatPointValue,
  formatTickLabel,
  nHintFromRational,
  nHintFromValue,
  parseNumberLineValue,
} from "./parse";
import {
  DEFAULT_NUMBER_LINE_STATE,
  NUMBER_LINE_PRESETS,
  addPointAtValue,
  cloneState,
  makePoint,
  resolveBands,
} from "./model";
import { parseMathRuns } from "@/lib/diagrams/math-label";
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
    assert.equal(formatTickLabel(0.5, true), "+\\frac{1}{2}");
  });

  it("formats point values as stacked fractions for the figure", () => {
    assert.equal(formatPointValue(0.5, "math"), "\\frac{1}{2}");
    assert.equal(formatPointValue(-1.5, "math"), "-1\\frac{1}{2}");
    assert.equal(formatPointValue(-4.25, "math"), "-4\\frac{1}{4}");
    assert.equal(formatPointValue(0.5, "plain"), "1/2");
    assert.equal(formatPointValue(-4.25, "plain"), "-4 1/4");
  });

  it("keeps decimals as decimals and slash input as fractions", () => {
    assert.equal(formatPointLabel("-0.2", -0.2, "math"), "-0.2");
    assert.equal(formatPointLabel("-0.2", -0.2, "plain"), "-0.2");
    assert.equal(formatPointLabel("+1.5", 1.5, "math"), "+1.5");
    assert.equal(formatPointLabel("3/4", 0.75, "math"), "\\frac{3}{4}");
    assert.equal(formatPointLabel("-17/4", -4.25, "math"), "-\\frac{17}{4}");
    assert.equal(formatPointLabel("-4 1/4", -4.25, "math"), "-4\\frac{1}{4}");
    assert.equal(formatPointLabel("2/4", 0.5, "math"), "\\frac{2}{4}");
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

  it("draws stacked fractions for shown values", () => {
    const preset = NUMBER_LINE_PRESETS.find((p) => p.id === "unit-interval")!;
    const state = {
      ...preset.state,
      points: preset.state.points.map((p) => ({ ...p, showValue: true })),
    };
    const scene = buildNumberLineScene(state);
    const value = scene.texts.find((t) => t.id.endsWith(":value"));
    const frac = value?.runs.find((r) => r.fracNum && r.fracDen);
    assert.ok(frac);
    assert.equal(frac?.fracNum?.map((r) => r.text).join(""), "3");
    assert.equal(frac?.fracDen?.map((r) => r.text).join(""), "4");
    assert.ok(
      parseMathRuns("\\frac{1}{2}").some((r) => r.fracNum && r.fracDen),
    );
  });

  it("draws a typed decimal instead of converting it to a fraction", () => {
    const state = {
      ...NUMBER_LINE_PRESETS[0]!.state,
      points: [
        makePoint({
          name: "A",
          value: -0.2,
          inputRaw: "-0.2",
          showValue: true,
          showName: true,
        }),
      ],
    };
    const scene = buildNumberLineScene(state);
    const value = scene.texts.find((t) => t.id.endsWith(":value"));
    assert.ok(value);
    assert.equal(value?.runs.map((r) => r.text).join(""), "-0.2");
    assert.ok(!value?.runs.some((r) => r.fracNum && r.fracDen));
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

  it("does not turn on n-division when adding a point by value", () => {
    const state = addPointAtValue(NUMBER_LINE_PRESETS[0]!.state, 0.5);
    assert.equal(state.points[0]?.showDivision, false);
    assert.equal(resolveBands(state).length, 0);
  });

  it("drops n-division when every point and extra band is gone", () => {
    const state = cloneState(DEFAULT_NUMBER_LINE_STATE);
    assert.ok(resolveBands(state).length > 0);
    const cleared = { ...state, points: [], bands: [] };
    assert.equal(resolveBands(cleared).length, 0);
  });
});
