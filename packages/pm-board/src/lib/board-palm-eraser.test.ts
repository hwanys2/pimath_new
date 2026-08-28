import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPalmPointer } from "./board-palm-eraser";

describe("isPalmPointer", () => {
  it("never treats mouse or pencil as a palm", () => {
    assert.equal(isPalmPointer({ pointerType: "mouse", width: 200, height: 200 }), false);
    assert.equal(isPalmPointer({ pointerType: "pen", width: 200, height: 200 }), false);
  });

  it("does not treat a typical iPhone finger or thumb as a palm", () => {
    assert.equal(isPalmPointer({ pointerType: "touch", width: 1, height: 1 }), false);
    assert.equal(isPalmPointer({ pointerType: "touch", width: 28, height: 32 }), false);
    assert.equal(isPalmPointer({ pointerType: "touch", width: 40, height: 48 }), false);
    assert.equal(isPalmPointer({ pointerType: "touch", width: 55, height: 55 }), false);
  });

  it("treats a whole-hand rest as a palm", () => {
    assert.equal(isPalmPointer({ pointerType: "touch", width: 80, height: 80 }), true);
    assert.equal(isPalmPointer({ pointerType: "touch", width: 100, height: 60 }), true);
  });
});
