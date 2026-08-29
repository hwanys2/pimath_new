import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_HISTOGRAM_STATE,
  HISTOGRAM_PRESETS,
  applyClassRange,
  applyClassWidth,
  classEnd,
  classMid,
  classWidthOptions,
  cloneState,
  makeSeries,
  normalizeState,
  polygonVertices,
  sameClassWidth,
  setFrequency,
} from "./model";
import { nudgeMovableLabel } from "./geometry";
import {
  buildHistogramScene,
  canvasXFromValue,
  canvasYFromValue,
  classIndexAtX,
  getHistLayout,
  valueFromCanvasX,
  valueFromCanvasY,
} from "./scene";

describe("histogram classes", () => {
  it("places polygon points at class midpoints and closes at frequency 0", () => {
    const state = DEFAULT_HISTOGRAM_STATE;
    const verts = polygonVertices(state, state.series[0]!.frequencies);
    assert.equal(verts.length, state.classCount + 2);
    assert.equal(verts[0]!.y, 0);
    assert.equal(verts[verts.length - 1]!.y, 0);
    assert.ok(Math.abs(verts[1]!.x - classMid(state, 0)) < 1e-9);
    assert.ok(
      Math.abs(verts[1]!.y - (state.series[0]!.frequencies[0] ?? 0)) < 1e-9,
    );
  });

  it("pads frequencies when class count grows and trims when it shrinks", () => {
    const grown = normalizeState({
      ...DEFAULT_HISTOGRAM_STATE,
      classCount: 8,
    });
    assert.equal(grown.classCount, 8);
    assert.equal(grown.series[0]!.frequencies.length, 8);
    assert.equal(grown.series[0]!.frequencies[7], 0);

    const shrunk = normalizeState({
      ...DEFAULT_HISTOGRAM_STATE,
      classCount: 3,
    });
    assert.equal(shrunk.classCount, 3);
    assert.equal(shrunk.series[0]!.frequencies.length, 3);
  });

  it("maps class index from an x value inside a class", () => {
    const state = DEFAULT_HISTOGRAM_STATE;
    assert.equal(classIndexAtX(77, state), 0);
    assert.equal(classIndexAtX(82.5, state), 1);
    assert.equal(classIndexAtX(70, state), null);
  });

  it("snaps frequency to yTick and grows yMax when needed", () => {
    const next = setFrequency(DEFAULT_HISTOGRAM_STATE, "s-a", 0, 13);
    assert.equal(next.series[0]!.frequencies[0], 14);
    assert.ok(next.yMax >= 14);
  });

  it("allows yMax of 1 and 0.5 for relative frequency", () => {
    const freqs = [0.2, 0.5, 0.3, 0.1, 0.05];
    const one = normalizeState({
      ...DEFAULT_HISTOGRAM_STATE,
      yMax: 1,
      yTick: 2,
      series: [makeSeries({ id: "s-a", frequencies: freqs })],
    });
    assert.equal(one.yMax, 1);
    assert.ok(one.yTick <= 1);
    assert.ok(one.yTick > 0);

    const half = normalizeState({
      ...DEFAULT_HISTOGRAM_STATE,
      yMax: 0.5,
      yTick: 2,
      series: [makeSeries({ id: "s-a", frequencies: freqs })],
    });
    assert.equal(half.yMax, 0.5);
    assert.ok(half.yTick <= 0.5);

    const keep = normalizeState({
      ...DEFAULT_HISTOGRAM_STATE,
      yMax: 1,
      yTick: 0.1,
      series: [makeSeries({ id: "s-a", frequencies: freqs })],
    });
    assert.equal(keep.yMax, 1);
    assert.equal(keep.yTick, 0.1);

    const fromCounts = normalizeState({
      ...DEFAULT_HISTOGRAM_STATE,
      yMax: 1,
      yTick: 2,
    });
    assert.equal(fromCounts.yMax, 1);
    assert.ok(fromCounts.yTick <= 1);
  });

  it("keeps relative frequencies that sit between y ticks", () => {
    const start = HISTOGRAM_PRESETS.find((p) => p.id === "two-schools")!.state;
    const next = setFrequency(start, "s-a", 0, 0.05);
    assert.ok(Math.abs(next.series[0]!.frequencies[0]! - 0.05) < 1e-9);
    const mid = setFrequency(start, "s-a", 3, 0.22);
    assert.ok(Math.abs(mid.series[0]!.frequencies[3]! - 0.22) < 1e-9);
  });

  it("lists range divisors as class widths with a usable bar count", () => {
    const for100 = classWidthOptions(100);
    assert.deepEqual(for100, [5, 10, 20, 25, 50]);
    const for25 = classWidthOptions(25);
    assert.deepEqual(for25, [5]);
    const for35 = classWidthOptions(3.5);
    assert.ok(for35.some((w) => Math.abs(w - 0.5) < 1e-9));
    assert.equal(for35.includes(3.5), false);
  });

  it("keeps the class range when picking a width divisor", () => {
    const start = HISTOGRAM_PRESETS.find((p) => p.id === "two-schools")!.state;
    const next = applyClassWidth(start, 10);
    assert.equal(next.classWidth, 10);
    assert.equal(next.classCount, 10);
    assert.equal(classEnd(next), classEnd(start));
    assert.equal(next.classStart, start.classStart);
  });

  it("snaps to a divisor when the class range changes", () => {
    const start = DEFAULT_HISTOGRAM_STATE;
    const next = applyClassRange(start, 0, 100);
    assert.equal(classEnd(next), 100);
    assert.ok(classWidthOptions(100).some((w) => sameClassWidth(w, next.classWidth)));
    assert.equal(next.classCount * next.classWidth, 100);
  });
});

describe("histogram scene", () => {
  it("keeps the histogram x-axis when switching to a frequency polygon", () => {
    const hist = {
      ...HISTOGRAM_PRESETS.find((p) => p.id === "two-schools")!.state,
      kind: "histogram" as const,
    };
    const polygon = { ...hist, kind: "polygon" as const };
    const histLayout = getHistLayout(hist);
    const polyLayout = getHistLayout(polygon);
    assert.equal(histLayout.xMin, 0);
    assert.equal(histLayout.xMax, 100);
    assert.equal(polyLayout.xMin, histLayout.xMin);
    assert.equal(polyLayout.xMax, histLayout.xMax);

    const verts = polygonVertices(polygon, polygon.series[0]!.frequencies);
    assert.ok(Math.abs(verts[0]!.x - -10) < 1e-9);
    assert.equal(verts[0]!.y, 0);
    const dummyX = canvasXFromValue(verts[0]!.x, polyLayout);
    const zeroX = canvasXFromValue(0, polyLayout);
    assert.ok(dummyX < zeroX);

    const scene = buildHistogramScene(polygon);
    assert.equal(
      scene.texts.some((t) => t.id === "tick-x:-20"),
      false,
    );
    assert.ok(scene.texts.some((t) => t.id === "tick-x:0"));
  });

  it("round-trips canvas and data coordinates without a break", () => {
    const state = HISTOGRAM_PRESETS.find((p) => p.id === "two-schools")!.state;
    const layout = getHistLayout(state);
    const x = valueFromCanvasX(canvasXFromValue(40, layout), layout);
    const y = valueFromCanvasY(canvasYFromValue(0.2, layout), layout);
    assert.ok(Math.abs(x - 40) < 1e-6);
    assert.ok(Math.abs(y - 0.2) < 1e-6);
  });

  it("maps an x-break so 0 sits left of the first class", () => {
    const state = cloneState(DEFAULT_HISTOGRAM_STATE);
    const layout = getHistLayout(state);
    assert.equal(layout.xBreak, true);
    const x0 = layout.originX;
    const x75 = canvasXFromValue(75, layout);
    const x100 = canvasXFromValue(100, layout);
    assert.ok(x0 < x75);
    assert.ok(x75 < x100);
    assert.ok(x75 > layout.dataLeft - 1e-6);
  });

  it("builds a finite scene for every preset", () => {
    for (const preset of HISTOGRAM_PRESETS) {
      const scene = buildHistogramScene(preset.state);
      assert.ok(scene.cmds.length > 0);
      for (const cmd of scene.cmds) {
        if (cmd.t === "line") {
          assert.ok(Number.isFinite(cmd.x1) && Number.isFinite(cmd.y2));
        }
        if (cmd.t === "polyline") {
          assert.ok(cmd.pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
        }
        if (cmd.t === "polygon") {
          assert.ok(cmd.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
        }
      }
      for (const text of scene.texts) {
        assert.ok(text.x > 2 && text.x < scene.width + 20);
        assert.ok(text.y > 2 && text.y < scene.height - 2);
      }
    }
  });

  it("closes the frequency polygon on the axis in the scene", () => {
    const state = HISTOGRAM_PRESETS.find((p) => p.id === "score-polygon")!.state;
    const verts = polygonVertices(state, state.series[0]!.frequencies);
    assert.equal(verts[0]!.y, 0);
    assert.equal(verts[verts.length - 1]!.y, 0);
    const scene = buildHistogramScene(state);
    const poly = scene.cmds.find((c) => c.t === "polyline" && c.pts.length === verts.length);
    assert.ok(poly && poly.t === "polyline");
    const layout = scene.layout;
    assert.ok(Math.abs(poly.pts[0]!.y - canvasYFromValue(0, layout)) < 1e-6);
    assert.ok(
      Math.abs(poly.pts[poly.pts.length - 1]!.y - canvasYFromValue(0, layout)) < 1e-6,
    );
  });

  it("draws an optional title above the plot without adding x ticks", () => {
    const off = HISTOGRAM_PRESETS.find((p) => p.id === "two-schools")!.state;
    const on = normalizeState({
      ...off,
      showTitle: true,
      title: "상대도수분포다각형",
    });
    const sceneOff = buildHistogramScene(off);
    const sceneOn = buildHistogramScene(on);
    assert.equal(
      sceneOff.texts.some((t) => t.id === "title"),
      false,
    );
    const title = sceneOn.texts.find((t) => t.id === "title");
    assert.ok(title);
    assert.ok(title.y < sceneOn.layout.plotTop);
    assert.ok(title.y + title.size * 0.5 < sceneOn.layout.plotTopInner);
    assert.ok(sceneOn.layout.plotTop > sceneOff.layout.plotTop);
    assert.equal(sceneOn.layout.xMin, sceneOff.layout.xMin);
    assert.ok(sceneOn.texts.some((t) => t.id === "tick-x:0"));
  });

  it("keeps axis names inside the figure at the inner corners", () => {
    const state = DEFAULT_HISTOGRAM_STATE;
    const scene = buildHistogramScene(state);
    const layout = scene.layout;
    const axisX = scene.texts.find((t) => t.id === "axis-x");
    const axisY = scene.texts.find((t) => t.id === "axis-y");
    assert.ok(axisX);
    assert.ok(axisY);
    assert.equal(axisX.anchor, "end");
    assert.equal(axisY.anchor, "end");
    assert.ok(axisX.x <= layout.plotRight + 1e-6);
    assert.ok(axisX.y > layout.originY);
    assert.ok(axisX.x < scene.width - 4);
    assert.ok(axisX.y < scene.height - 2);
    assert.ok(axisY.x < layout.originX);
    assert.ok(axisY.y >= layout.plotTop - 1e-6);
    assert.ok(axisY.y > 4);
  });

  it("nudges title and axis names and keeps their sizes independent", () => {
    const base = normalizeState({
      ...DEFAULT_HISTOGRAM_STATE,
      showTitle: true,
      title: "하하호호",
    });
    const movedX = nudgeMovableLabel(base, "axis-x", 12, -5);
    const beforeX = buildHistogramScene(base).texts.find((t) => t.id === "axis-x")!;
    const afterX = buildHistogramScene(movedX).texts.find((t) => t.id === "axis-x")!;
    assert.equal(afterX.x, beforeX.x + 12);
    assert.equal(afterX.y, beforeX.y - 5);

    const movedTitle = nudgeMovableLabel(base, "title", -8, 6);
    const beforeTitle = buildHistogramScene(base).texts.find((t) => t.id === "title")!;
    const afterTitle = buildHistogramScene(movedTitle).texts.find((t) => t.id === "title")!;
    assert.equal(afterTitle.x, beforeTitle.x - 8);
    assert.equal(afterTitle.y, beforeTitle.y + 6);

    const bigger = buildHistogramScene({
      ...base,
      style: { ...base.style, axisNameSize: 28, titleSize: 32, pointLabelSize: 16 },
    });
    assert.equal(bigger.texts.find((t) => t.id === "axis-x")!.size, 28);
    assert.equal(bigger.texts.find((t) => t.id === "title")!.size, 32);
    const seriesName = bigger.texts.find((t) => t.id.endsWith(":name"));
    if (seriesName) assert.equal(seriesName.size, 16);
  });

  it("draws horizontal grid only at labeled y ticks", () => {
    const state = {
      ...DEFAULT_HISTOGRAM_STATE,
      showGrid: true,
      kind: "histogram" as const,
    };
    const scene = buildHistogramScene(state);
    const yLabels = scene.texts.filter((t) => t.id.startsWith("tick-y:"));
    const horiz = scene.cmds.filter(
      (c) => c.t === "line" && c.id === "grid" && Math.abs(c.y1 - c.y2) < 1e-9,
    );
    assert.equal(horiz.length, yLabels.length);
  });

  it("keeps the same vertical grid when switching to a frequency polygon", () => {
    const hist = {
      ...HISTOGRAM_PRESETS.find((p) => p.id === "two-schools")!.state,
      kind: "histogram" as const,
      showGrid: true,
    };
    const polygon = { ...hist, kind: "polygon" as const };
    const histScene = buildHistogramScene(hist);
    const polyScene = buildHistogramScene(polygon);
    const vertical = (scene: ReturnType<typeof buildHistogramScene>) =>
      scene.cmds.filter(
        (c) => c.t === "line" && c.id === "grid" && Math.abs(c.x1 - c.x2) < 1e-9,
      ).length;
    assert.equal(vertical(histScene), vertical(polyScene));
    assert.equal(vertical(histScene), hist.classCount + 1);
  });
});
