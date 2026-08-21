import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  axisLabelStride,
  axisTicks,
  autoAxisScale,
  formatAxisLabel,
  niceCeilStep,
  resolveAxisScale,
} from "./graph-plot";
import { mergeGraphSettings } from "../board/graph-types";

describe("axisTicks", () => {
  it("uses unit steps for the classroom window even when the pane is wide", () => {
    const ticks = axisTicks(-20, 20, 1);
    assert.ok(ticks.includes(-4));
    assert.ok(ticks.includes(-1));
    assert.ok(ticks.includes(1));
    assert.ok(ticks.includes(2));
    assert.ok(ticks.includes(5));
    assert.equal(ticks[1]! - ticks[0]!, 1);
  });

  it("honors Xscl = 2", () => {
    const ticks = axisTicks(-8, 8, 2);
    assert.deepEqual(
      ticks.filter((n) => Math.abs(n) <= 6),
      [-6, -4, -2, 0, 2, 4, 6],
    );
  });

  it("caps a huge tick count", () => {
    const ticks = axisTicks(-1000, 1000, 0.01, 80);
    assert.ok(ticks.length <= 90);
  });
});

describe("axisLabelStride", () => {
  it("keeps every integer when there is room", () => {
    assert.equal(axisLabelStride(1, 28, 16), 1);
  });

  it("skips labels only when they would collide", () => {
    assert.equal(axisLabelStride(1, 8, 16), 2);
  });
});

describe("resolveAxisScale", () => {
  it("prefers the explicit scale", () => {
    assert.equal(resolveAxisScale(-40, 40, 1, 400), 1);
  });

  it("auto scale stays 1 on a typical card width", () => {
    assert.equal(autoAxisScale(-8, 8, 480, 22), 1);
  });

  it("nice-ceils dense auto scales", () => {
    assert.equal(niceCeilStep(2.4), 5);
    assert.equal(niceCeilStep(1), 1);
  });
});

describe("formatAxisLabel", () => {
  it("prints integers without decimals", () => {
    assert.equal(formatAxisLabel(5), "5");
    assert.equal(formatAxisLabel(-3), "-3");
    assert.equal(formatAxisLabel(0), "0");
  });
});

describe("mergeGraphSettings", () => {
  it("fills calculator defaults including unit scales and axis names", () => {
    const s = mergeGraphSettings(undefined);
    assert.equal(s.xScale, 1);
    assert.equal(s.yScale, 1);
    assert.equal(s.showAxisNames, true);
    assert.equal(s.xAxisName, "x");
    assert.equal(s.yAxisName, "y");
    assert.equal(s.equalAxes, true);
  });

  it("maps legacy showAxes onto both axes", () => {
    const off = mergeGraphSettings({ showAxes: false });
    assert.equal(off.showXAxis, false);
    assert.equal(off.showYAxis, false);
    const on = mergeGraphSettings({ showAxes: true });
    assert.equal(on.showXAxis, true);
    assert.equal(on.showYAxis, true);
  });
});
