import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  expectKeyframeClosedBox,
  expectKeyframeCoplanar,
} from "./box-fold-tree.ts";

describe("box fold keyframes", () => {
  it("unfolds coplanar for cube", () => {
    assert.equal(expectKeyframeCoplanar(2, 2, 2), true);
  });

  it("closes cube", () => {
    assert.equal(expectKeyframeClosedBox(2, 2, 2), true);
  });

  it("closes cuboid", () => {
    assert.equal(expectKeyframeClosedBox(3, 2, 4), true);
  });
});
