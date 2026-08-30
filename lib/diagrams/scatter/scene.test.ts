import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addPoint,
  cloudTrend,
  DEFAULT_SCATTER_STATE,
  fitAxisToData,
  generateCloud,
  importPoints,
  normalizeState,
  parsePointTable,
  removePoint,
  replaceCloud,
  SCATTER_PRESETS,
  setCloudCount,
  setKind,
} from "./model";
import { nudgeMovableLabel, parsePointLabelId } from "./geometry";
import {
  buildScatterScene,
  canvasXFromValue,
  canvasYFromValue,
  getScatterLayout,
  valueFromCanvasX,
  valueFromCanvasY,
} from "./scene";

describe("scatter cloud", () => {
  it("is deterministic for the same seed", () => {
    const a = generateCloud(
      "positive",
      40,
      7,
      { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
      0.3,
    );
    const b = generateCloud(
      "positive",
      40,
      7,
      { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
      0.3,
    );
    assert.equal(a.length, 40);
    assert.deepEqual(a, b);
  });

  it("makes a positive cloud trend upward and a negative cloud trend down", () => {
    const bounds = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
    const pos = generateCloud("positive", 80, 3, bounds, 0.2);
    const neg = generateCloud("negative", 80, 3, bounds, 0.2);
    assert.ok(cloudTrend(pos) > 0.6);
    assert.ok(cloudTrend(neg) < -0.6);
  });

  it("keeps named points when the cloud is regenerated", () => {
    const withMark = addPoint(DEFAULT_SCATTER_STATE, {
      x: 10,
      y: 5,
      label: "A",
      role: "mark",
    });
    const next = replaceCloud(withMark, withMark.cloudSeed + 1);
    assert.ok(next.points.some((p) => p.role === "mark" && p.label === "A"));
    assert.ok(next.points.some((p) => p.role === "cloud"));
    assert.equal(
      next.points.filter((p) => p.role === "cloud").length,
      next.cloudCount,
    );
  });

  it("can drop the cloud to zero points", () => {
    const next = setCloudCount(DEFAULT_SCATTER_STATE, 0);
    assert.equal(next.cloudCount, 0);
    assert.equal(
      next.points.filter((p) => p.role === "cloud").length,
      0,
    );
  });
});

describe("scatter table paste", () => {
  it("reads name-x-y lines and comma rows", () => {
    const rows = parsePointTable("소고기뭇국 80 2.2\n돈가스, 280, 18\n150 9");
    assert.equal(rows.length, 3);
    assert.equal(rows[0]!.label, "소고기뭇국");
    assert.equal(rows[0]!.x, 80);
    assert.equal(rows[1]!.label, "돈가스");
    assert.equal(rows[2]!.label, "");
    assert.equal(rows[2]!.x, 150);
  });

  it("imports pasted rows as named points", () => {
    const next = importPoints(setCloudCount(DEFAULT_SCATTER_STATE, 0), [
      { label: "김치찌개", x: 130, y: 8 },
    ]);
    assert.ok(next.points.some((p) => p.label === "김치찌개" && p.role === "named"));
  });
});

describe("scatter axis and scene", () => {
  it("maps y-break so the first labeled y sits on the data bottom", () => {
    const state = SCATTER_PRESETS.find((p) => p.id === "depth-oxygen")!.state;
    assert.equal(state.yBreak, true);
    const layout = getScatterLayout(state);
    const frame = layout.frames[0]!;
    assert.equal(frame.yBreak, true);
    const y4 = canvasYFromValue(4, frame);
    assert.ok(Math.abs(y4 - frame.dataBottom) < 1e-6);
    const back = valueFromCanvasY(y4, frame);
    assert.ok(Math.abs(back - 4) < 1e-6);
    const x0 = canvasXFromValue(0, frame);
    assert.ok(Math.abs(x0 - frame.dataLeft) < 1e-6);
    const xBack = valueFromCanvasX(x0, frame);
    assert.ok(Math.abs(xBack) < 1e-6);
  });

  it("builds a scene for every preset", () => {
    for (const preset of SCATTER_PRESETS) {
      const scene = buildScatterScene(preset.state);
      assert.ok(scene.cmds.length > 8);
      assert.ok(scene.layout.frames.length >= 1);
    }
  });

  it("uses four frames for the correlation comparison", () => {
    const state = SCATTER_PRESETS.find((p) => p.id === "correlation-four")!.state;
    assert.equal(state.kind, "quad");
    const scene = buildScatterScene(state);
    assert.equal(scene.layout.frames.length, 4);
    assert.equal(
      state.points.filter((p) => p.role === "cloud" && p.panel === 0).length,
      state.cloudCount,
    );
    assert.equal(
      state.points.filter((p) => p.role === "cloud").length,
      state.cloudCount * 4,
    );
  });

  it("fits the axis around labeled points", () => {
    const empty = setCloudCount(DEFAULT_SCATTER_STATE, 0);
    const withPts = importPoints(empty, [
      { label: "A", x: 12, y: 3 },
      { label: "B", x: 40, y: 18 },
    ]);
    const fit = fitAxisToData(withPts);
    assert.ok(fit.xMax >= 40);
    assert.ok(fit.yMax >= 18);
  });

  it("nudges a point label and can remove the point", () => {
    const added = addPoint(DEFAULT_SCATTER_STATE, {
      x: 8,
      y: 5,
      label: "A",
      role: "mark",
    });
    const id = added.points.find((p) => p.role === "mark")!.id;
    const nudged = nudgeMovableLabel(added, `point:${id}:label`, 4, -3);
    const pt = nudged.points.find((p) => p.id === id)!;
    assert.equal(pt.labelDx, added.points.find((p) => p.id === id)!.labelDx + 4);
    const gone = removePoint(nudged, id);
    assert.ok(!gone.points.some((p) => p.id === id));
    assert.equal(parsePointLabelId(`point:${id}:label`), id);
  });

  it("keeps a valid state when switching to the 2x2 view", () => {
    const next = setKind(DEFAULT_SCATTER_STATE, "quad");
    assert.equal(next.kind, "quad");
    assert.equal(getScatterLayout(next).frames.length, 4);
    const scene = buildScatterScene(next);
    assert.ok(scene.height >= 500);
  });

  it("normalizes a broken axis range", () => {
    const next = normalizeState({
      ...DEFAULT_SCATTER_STATE,
      xMax: 0,
      xMin: 0,
      yMax: 2,
      yMin: 5,
    });
    assert.ok(next.xMax > next.xMin);
    assert.ok(next.yMax > next.yMin);
  });

  it("draws y-axis break waves and pink dots for the oxygen preset", () => {
    const state = SCATTER_PRESETS.find((p) => p.id === "depth-oxygen")!.state;
    const scene = buildScatterScene(state);
    assert.ok(scene.cmds.some((c) => c.t === "polyline" && c.id === "break"));
    const dots = scene.cmds.filter((c) => c.t === "dot");
    assert.ok(dots.length >= 20);
    assert.ok(dots.every((c) => c.t === "dot" && c.stroke === "#e84a8c"));
    assert.ok(scene.texts.some((t) => t.id.startsWith("origin:")));
  });

  it("keeps gutters around the plot so axis names can be moved", () => {
    const state = SCATTER_PRESETS.find((p) => p.id === "calories-fat")!.state;
    const layout = getScatterLayout(state);
    const frame = layout.frames[0]!;
    assert.ok(frame.plotLeft >= 56);
    assert.ok(layout.width - frame.plotRight >= 40);
    assert.ok(frame.plotTop >= 48);
    assert.ok(layout.height - frame.plotBottom >= 52);
  });
});
