import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPrimaryDrawPointer } from "./board-pointer";

describe("isPrimaryDrawPointer", () => {
  it("accepts a left mouse button", () => {
    assert.equal(
      isPrimaryDrawPointer({ button: 0, pointerType: "mouse", isPrimary: true }),
      true,
    );
  });

  it("rejects other mouse buttons", () => {
    assert.equal(
      isPrimaryDrawPointer({ button: 2, pointerType: "mouse", isPrimary: true }),
      false,
    );
  });

  it("accepts iOS Safari touch (button -1)", () => {
    assert.equal(
      isPrimaryDrawPointer({ button: -1, pointerType: "touch", isPrimary: true }),
      true,
    );
  });

  it("accepts a spec-compliant touch (button 0)", () => {
    assert.equal(
      isPrimaryDrawPointer({ button: 0, pointerType: "touch", isPrimary: true }),
      true,
    );
  });

  it("rejects a non-primary extra finger", () => {
    assert.equal(
      isPrimaryDrawPointer({ button: 0, pointerType: "touch", isPrimary: false }),
      false,
    );
  });
});
