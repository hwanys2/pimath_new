import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatParamValue,
  paramSliderStep,
  snapParamValue,
  snapParamValues,
} from "./graph-param-slider";

describe("paramSliderStep", () => {
  it("uses tenths by default and 1 in integer mode", () => {
    assert.equal(paramSliderStep(false), 0.1);
    assert.equal(paramSliderStep(true), 1);
  });
});

describe("snapParamValue", () => {
  it("leaves non-integer mode values unchanged", () => {
    assert.equal(snapParamValue(1.7, false), 1.7);
  });

  it("rounds to integers and clamps to the slider range", () => {
    assert.equal(snapParamValue(1.4, true), 1);
    assert.equal(snapParamValue(1.5, true), 2);
    assert.equal(snapParamValue(12, true), 10);
    assert.equal(snapParamValue(-12.2, true), -10);
  });

  it("treats non-finite as 0", () => {
    assert.equal(snapParamValue(Number.NaN, true), 0);
  });
});

describe("snapParamValues", () => {
  it("returns the same object when integer mode is off", () => {
    const values = { a: 1.2 };
    assert.equal(snapParamValues(values, false), values);
  });

  it("rounds every parameter when integer mode is on", () => {
    assert.deepEqual(snapParamValues({ a: 1.2, b: -0.6 }, true), {
      a: 1,
      b: -1,
    });
  });
});

describe("formatParamValue", () => {
  it("prints one decimal in continuous mode", () => {
    assert.equal(formatParamValue(1.2, false), "1.2");
    assert.equal(formatParamValue(2, false), "2");
  });

  it("prints integers in integer mode", () => {
    assert.equal(formatParamValue(1.8, true), "2");
  });
});
