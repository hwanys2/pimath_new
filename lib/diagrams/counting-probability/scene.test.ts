import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_COUNTING_STATE } from "./model";
import { buildCountingScene } from "./scene";

describe("counting-probability scene", () => {
  for (const kind of ["dice", "cards", "pouches", "spinner", "paths"] as const) {
    it(`builds non-empty ${kind} scene`, () => {
      const scene = buildCountingScene({ ...DEFAULT_COUNTING_STATE, kind });
      assert.ok(scene.cmds.length > 0 || scene.texts.length > 0);
      assert.equal(scene.width, 560);
      assert.equal(scene.height, 400);
    });
  }

  it("includes dice round rects", () => {
    const scene = buildCountingScene({
      ...DEFAULT_COUNTING_STATE,
      kind: "dice",
    });
    assert.ok(scene.cmds.some((c) => c.t === "roundRect"));
  });

  it("includes spinner sectors", () => {
    const scene = buildCountingScene({
      ...DEFAULT_COUNTING_STATE,
      kind: "spinner",
    });
    assert.ok(scene.cmds.some((c) => c.t === "sector"));
  });
});
