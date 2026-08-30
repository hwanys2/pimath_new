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

  it("includes spinner radial dividers from center", () => {
    const scene = buildCountingScene({
      ...DEFAULT_COUNTING_STATE,
      kind: "spinner",
    });
    const cx = 280;
    const cy = 210;
    const n = DEFAULT_COUNTING_STATE.spinner.slices.length;
    const dividers = scene.cmds.filter(
      (c) =>
        c.t === "line" &&
        c.x1 === cx &&
        c.y1 === cy &&
        Math.hypot(c.x2 - cx, c.y2 - cy) > 120,
    );
    assert.equal(dividers.length, n);
  });

  it("renders card labels in paint cmds", () => {
    const scene = buildCountingScene({
      ...DEFAULT_COUNTING_STATE,
      kind: "cards",
    });
    assert.ok(
      scene.cmds.some(
        (c) => c.t === "text" && c.text.id.startsWith("card:"),
      ),
    );
  });

  it("uses emoji icons on paths", () => {
    const scene = buildCountingScene({
      ...DEFAULT_COUNTING_STATE,
      kind: "paths",
    });
    assert.ok(scene.cmds.some((c) => c.t === "emoji"));
    assert.equal(
      scene.cmds.filter((c) => c.t === "emoji").length,
      DEFAULT_COUNTING_STATE.paths.places.length,
    );
  });
});
