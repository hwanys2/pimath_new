import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cloneState,
  DEFAULT_INEQUALITY_STATE,
  describeInequality,
  INEQUALITY_PRESETS,
  makeBound,
  normalizeState,
  snapInequalityValue,
} from "./model";
import { buildInequalityScene } from "./scene";

describe("linear inequality scenes", () => {
  it("builds every preset without empty geometry", () => {
    for (const preset of INEQUALITY_PRESETS) {
      const scene = buildInequalityScene(cloneState(preset.state));
      assert.ok(scene.cmds.length > 2, preset.id);
      assert.equal(scene.width, 760);
      assert.equal(scene.height, 240);
    }
  });

  it("draws a blank number line with no endpoints or fill", () => {
    const blank = INEQUALITY_PRESETS.find((p) => p.id === "blank")!.state;
    const scene = buildInequalityScene(cloneState(blank));
    assert.equal(
      scene.cmds.filter((c) => c.t === "polygon").length,
      0,
    );
    assert.equal(scene.cmds.filter((c) => c.t === "circle").length, 0);
    assert.equal(scene.cmds.filter((c) => c.t === "dot").length, 0);
    assert.ok(scene.cmds.some((c) => c.t === "arrowhead"));
  });

  it("uses a hollow circle for a strict inequality and fills the shelf", () => {
    const scene = buildInequalityScene(cloneState(DEFAULT_INEQUALITY_STATE));
    const fills = scene.cmds.filter((c) => c.t === "polygon");
    assert.equal(fills.length, 1);
    assert.ok(fills[0]!.fill.includes("232, 74, 140"));
    assert.equal(scene.cmds.filter((c) => c.t === "circle").length, 1);
    const white = scene.cmds.filter(
      (c) => c.t === "dot" && c.stroke === "#ffffff",
    );
    assert.equal(white.length, 1);
    const shelfArrows = scene.cmds.filter(
      (c) => c.t === "arrowhead" && c.y < scene.layout.axisY - 4,
    );
    assert.equal(shelfArrows.length, 1);
    const rightArrow = shelfArrows[0];
    assert.ok(rightArrow && rightArrow.t === "arrowhead" && rightArrow.ux > 0);
  });

  it("fills the endpoint when the inequality includes equals", () => {
    const filled = normalizeState({
      ...DEFAULT_INEQUALITY_STATE,
      start: makeBound({ value: 2, inputRaw: "2", inclusive: true }),
    });
    const scene = buildInequalityScene(filled);
    assert.equal(scene.cmds.filter((c) => c.t === "circle").length, 0);
    const dots = scene.cmds.filter((c) => c.t === "dot");
    assert.equal(dots.length, 1);
    assert.equal(dots[0]!.stroke, undefined);
  });

  it("points the shelf left for less-than", () => {
    const less = INEQUALITY_PRESETS.find((p) => p.id === "less-eq")!.state;
    const scene = buildInequalityScene(cloneState(less));
    const shelfArrows = scene.cmds.filter(
      (c) => c.t === "arrowhead" && c.y < scene.layout.axisY - 4,
    );
    assert.equal(shelfArrows.length, 1);
    const leftArrow = shelfArrows[0];
    assert.ok(leftArrow && leftArrow.t === "arrowhead" && leftArrow.ux < 0);
    assert.equal(scene.cmds.filter((c) => c.t === "circle").length, 0);
  });

  it("draws a closed shelf between two bounds without extra arrows", () => {
    const between = INEQUALITY_PRESETS.find((p) => p.id === "between")!.state;
    const scene = buildInequalityScene(cloneState(between));
    const shelfArrows = scene.cmds.filter(
      (c) => c.t === "arrowhead" && c.y < scene.layout.axisY - 4,
    );
    assert.equal(shelfArrows.length, 0);
    assert.equal(scene.cmds.filter((c) => c.t === "polygon").length, 1);
    assert.equal(scene.cmds.filter((c) => c.t === "circle").length, 1);
    assert.equal(
      scene.cmds.filter((c) => c.t === "dot" && c.stroke !== "#ffffff").length,
      1,
    );
  });

  it("omits the pink shelf when fill is off", () => {
    const plain = normalizeState({
      ...DEFAULT_INEQUALITY_STATE,
      showFill: false,
    });
    const scene = buildInequalityScene(plain);
    assert.equal(scene.cmds.filter((c) => c.t === "polygon").length, 0);
    assert.equal(scene.cmds.filter((c) => c.t === "circle").length, 1);
  });

  it("swaps reversed segment bounds and describes the inequality", () => {
    const swapped = normalizeState({
      ...DEFAULT_INEQUALITY_STATE,
      kind: "segment",
      start: makeBound({ value: 4, inputRaw: "4", inclusive: false }),
      end: makeBound({ value: 1, inputRaw: "1", inclusive: true }),
    });
    assert.equal(swapped.start.value, 1);
    assert.equal(swapped.start.inclusive, true);
    assert.equal(swapped.end.value, 4);
    assert.equal(describeInequality(DEFAULT_INEQUALITY_STATE), "x > 2");
    assert.equal(describeInequality(swapped), "1 ≤ x < 4");
  });

  it("snaps dragged values onto nearby ticks", () => {
    const snapped = snapInequalityValue(2.04, DEFAULT_INEQUALITY_STATE);
    assert.equal(snapped, 2);
    const mid = snapInequalityValue(2.5, DEFAULT_INEQUALITY_STATE);
    assert.equal(mid, 2.5);
  });

  it("places the bound value slightly below tick numbers", () => {
    const shown = normalizeState({
      ...DEFAULT_INEQUALITY_STATE,
      start: makeBound({
        value: 2,
        inputRaw: "2",
        showValue: true,
      }),
    });
    const scene = buildInequalityScene(shown);
    const tick = scene.texts.find((t) => t.id === "tick:2");
    const bound = scene.texts.find((t) => t.id === "bound:start:value");
    assert.ok(tick);
    assert.ok(bound);
    assert.ok(bound!.y > tick!.y + 8, `bound ${bound!.y} tick ${tick!.y}`);
  });
});
