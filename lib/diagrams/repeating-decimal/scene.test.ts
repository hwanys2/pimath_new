import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_REPEATING_DECIMAL_STATE } from "./model";
import { buildRepeatingDecimalScene } from "./scene";
import { buildLongDivision } from "./division";

describe("repeating decimal scene", () => {
  it("draws the 1÷7 figure with period highlight and same-mark", () => {
    const scene = buildRepeatingDecimalScene(DEFAULT_REPEATING_DECIMAL_STATE);
    assert.ok(scene.width > 200);
    assert.ok(scene.height > 300);
    assert.ok(scene.cmds.some((c) => c.t === "polygon"));
    assert.ok(scene.cmds.some((c) => c.t === "arrowhead"));
    assert.ok(scene.texts.some((t) => t.runs[0]?.text === "같다."));
    assert.ok(scene.quotientHit.w > 40);
  });

  it("hides the quotient and same-mark when toggled off", () => {
    const scene = buildRepeatingDecimalScene({
      ...DEFAULT_REPEATING_DECIMAL_STATE,
      showQuotient: false,
      showRemainderMarks: false,
      showSameMark: false,
    });
    assert.equal(
      scene.texts.filter((t) => t.id.startsWith("q-")).length,
      0,
    );
    assert.equal(
      scene.texts.some((t) => t.runs[0]?.text === "같다."),
      false,
    );
    assert.equal(
      scene.cmds.some((c) => c.t === "arrowhead"),
      false,
    );
    const layout = buildLongDivision(BigInt(1), BigInt(7));
    assert.equal(layout.period, "142857");
  });

  it("keeps the 같다 arrow when remainder colors are off", () => {
    const scene = buildRepeatingDecimalScene({
      ...DEFAULT_REPEATING_DECIMAL_STATE,
      showRemainderMarks: false,
      showSameMark: true,
    });
    assert.equal(
      scene.texts.some((t) => t.runs[0]?.text === "같다."),
      true,
    );
    assert.ok(scene.cmds.some((c) => c.t === "arrowhead"));
    const remainderCircles = scene.cmds.filter(
      (c) => c.t === "dot" && c.r > 6,
    );
    assert.equal(remainderCircles.length, 0);
  });
});
