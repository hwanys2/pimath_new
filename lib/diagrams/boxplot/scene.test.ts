import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addSeries,
  BOXPLOT_PRESETS,
  clampStat,
  DEFAULT_BOXPLOT_STATE,
  fitAxisToData,
  formatTick,
  iqr,
  makeFive,
  makeSeries,
  NO_PILL_FILL,
  normalizeState,
  orderFive,
  removeSeries,
  setStat,
  sortFive,
} from "./model";
import { nudgeMovableLabel } from "./geometry";
import {
  buildBoxPlotScene,
  canvasFromValue,
  getBoxLayout,
  valueFromCanvas,
} from "./scene";

describe("boxplot five-number", () => {
  it("sorts an unordered five-number summary", () => {
    const v = sortFive({ min: 22, q1: 6, median: 8, q3: 14, max: 2 });
    assert.equal(v.min, 2);
    assert.equal(v.q1, 6);
    assert.equal(v.median, 8);
    assert.equal(v.q3, 14);
    assert.equal(v.max, 22);
  });

  it("cascades neighbors when a middle value moves past them", () => {
    const next = orderFive(
      { min: 2, q1: 6, median: 8, q3: 14, max: 22 },
      "median",
    );
    assert.deepEqual(next, { min: 2, q1: 6, median: 8, q3: 14, max: 22 });
    const pushed = orderFive(
      { min: 2, q1: 6, median: 16, q3: 14, max: 22 },
      "median",
    );
    assert.equal(pushed.median, 16);
    assert.equal(pushed.q3, 16);
    assert.equal(pushed.max, 22);
  });

  it("clamps a dragged fence between neighbors and the axis", () => {
    const values = { min: 2, q1: 6, median: 8, q3: 14, max: 22 };
    assert.equal(clampStat(0, "min", values, 2, 22), 2);
    assert.equal(clampStat(10, "median", values, 2, 22), 10);
    assert.equal(clampStat(20, "median", values, 2, 22), 14);
  });

  it("reports IQR", () => {
    assert.equal(iqr(makeFive({ min: 2, q1: 6, median: 8, q3: 14, max: 22 })), 8);
  });
});

describe("boxplot series and axis", () => {
  it("adds a second series and can remove it", () => {
    const added = addSeries(DEFAULT_BOXPLOT_STATE);
    assert.equal(added.series.length, 2);
    const removed = removeSeries(added, added.series[1]!.id);
    assert.equal(removed.series.length, 1);
    const stuck = removeSeries(DEFAULT_BOXPLOT_STATE, "b-a");
    assert.equal(stuck.series.length, 1);
  });

  it("expands the axis when a typed max goes past the current end", () => {
    const next = setStat(DEFAULT_BOXPLOT_STATE, "b-a", "max", 30, "cascade");
    assert.ok(next.axisMax >= 30);
    assert.equal(next.series[0]!.values.max, 30);
  });

  it("keeps neighbors fixed when dragging with clamp", () => {
    const next = setStat(DEFAULT_BOXPLOT_STATE, "b-a", "median", 20, "clamp");
    assert.equal(next.series[0]!.values.median, 14);
    assert.equal(next.series[0]!.values.q3, 14);
  });

  it("fits the axis around the data", () => {
    const next = fitAxisToData(DEFAULT_BOXPLOT_STATE);
    assert.ok(next.axisMin <= 2);
    assert.ok(next.axisMax >= 22);
    assert.ok(next.majorTick > 0);
  });
});

describe("boxplot scene", () => {
  for (const preset of BOXPLOT_PRESETS) {
    it(`builds a non-empty scene for ${preset.id}`, () => {
      const scene = buildBoxPlotScene(preset.state);
      assert.ok(scene.cmds.length > 10);
      assert.ok(scene.layout.bands.length === preset.state.series.length);
      assert.equal(scene.width, scene.layout.width);
      assert.ok(scene.height >= 120);
      assert.equal(scene.height, scene.layout.height);
    });
  }

  it("maps a horizontal value to canvas and back", () => {
    const layout = getBoxLayout(DEFAULT_BOXPLOT_STATE);
    const x = canvasFromValue(8, layout);
    const back = valueFromCanvas(x, layout);
    assert.ok(Math.abs(back - 8) < 1e-6);
  });

  it("maps a vertical value with inverted y", () => {
    const state = normalizeState({
      ...DEFAULT_BOXPLOT_STATE,
      orientation: "vertical",
    });
    const layout = getBoxLayout(state);
    const yLow = canvasFromValue(layout.axisMin, layout);
    const yHigh = canvasFromValue(layout.axisMax, layout);
    assert.ok(yLow > yHigh);
  });

  it("makes the horizontal plot taller when inner padding grows", () => {
    const tight = getBoxLayout(
      normalizeState({ ...DEFAULT_BOXPLOT_STATE, crossPad: 8 }),
    );
    const loose = getBoxLayout(
      normalizeState({ ...DEFAULT_BOXPLOT_STATE, crossPad: 48 }),
    );
    assert.ok(loose.plotBottom - loose.plotTop > tight.plotBottom - tight.plotTop);
    assert.ok(loose.height > tight.height);
  });

  it("includes comparison pills for named series", () => {
    const preset = BOXPLOT_PRESETS.find((p) => p.id === "two-factories")!;
    const scene = buildBoxPlotScene(preset.state);
    assert.ok(scene.texts.some((t) => t.id === "series:b-a:name"));
    assert.ok(scene.texts.some((t) => t.id === "series:b-b:name"));
    assert.ok(scene.cmds.some((c) => c.t === "roundRect"));
  });

  it("defaults the name fill to the box fill", () => {
    const series = makeSeries({ fill: "rgba(154, 201, 154, 0.78)" });
    assert.equal(series.pillFill, series.fill);
    const added = addSeries(DEFAULT_BOXPLOT_STATE);
    assert.equal(added.series[1]!.pillFill, added.series[1]!.fill);
  });

  it("omits the name pill when fill is none", () => {
    const preset = BOXPLOT_PRESETS.find((p) => p.id === "two-factories")!;
    const none = normalizeState({
      ...preset.state,
      series: preset.state.series.map((s) => ({ ...s, pillFill: NO_PILL_FILL })),
    });
    const scene = buildBoxPlotScene(none);
    assert.ok(scene.texts.some((t) => t.id === "series:b-a:name"));
    assert.equal(
      scene.cmds.filter((c) => c.t === "roundRect").length,
      0,
    );
  });

  it("nudges title and series labels", () => {
    const moved = nudgeMovableLabel(DEFAULT_BOXPLOT_STATE, "title", 4, -3);
    assert.equal(moved.titleDx, 4);
    assert.equal(moved.titleDy, -3);
    const named = {
      ...DEFAULT_BOXPLOT_STATE,
      series: [
        { ...DEFAULT_BOXPLOT_STATE.series[0]!, name: "A", labelDx: 0, labelDy: 0 },
      ],
    };
    const seriesMoved = nudgeMovableLabel(named, "series:b-a:name", 2, 5);
    assert.equal(seriesMoved.series[0]!.labelDx, 2);
    assert.equal(seriesMoved.series[0]!.labelDy, 5);
  });

  it("formats integer ticks without decimals", () => {
    assert.equal(formatTick(10), "10");
    assert.equal(formatTick(0), "0");
    assert.equal(formatTick(0.5), "0.5");
  });
});
