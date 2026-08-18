import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INITIAL_CALC,
  applyOp,
  calcBack,
  calcClear,
  calcDigit,
  calcDot,
  calcEq,
  calcOp,
  formatCalc,
} from "@/lib/inquiry-calculator";

describe("inquiry calculator", () => {
  it("adds, subtracts, multiplies, and divides", () => {
    assert.equal(applyOp(12, "+", 5), 17);
    assert.equal(applyOp(12, "-", 5), 7);
    assert.equal(applyOp(12, "*", 5), 60);
    assert.equal(applyOp(12, "/", 5), 2.4);
  });

  it("rejects division by zero", () => {
    assert.equal(applyOp(8, "/", 0), null);
    let s = calcDigit(INITIAL_CALC, "8");
    s = calcOp(s, "/");
    s = calcDigit(s, "0");
    s = calcEq(s);
    assert.equal(s.error, true);
    assert.equal(s.display, "오류");
  });

  it("chains 3 + 5 × 2 as (3+5)×2", () => {
    let s = calcDigit(INITIAL_CALC, "3");
    s = calcOp(s, "+");
    s = calcDigit(s, "5");
    s = calcOp(s, "*");
    s = calcDigit(s, "2");
    s = calcEq(s);
    assert.equal(s.display, "16");
  });

  it("handles decimals and backspace", () => {
    let s = calcDigit(INITIAL_CALC, "1");
    s = calcDot(s);
    s = calcDigit(s, "5");
    s = calcOp(s, "*");
    s = calcDigit(s, "2");
    s = calcEq(s);
    assert.equal(s.display, "3");
    s = calcDigit(INITIAL_CALC, "1");
    s = calcDigit(s, "2");
    s = calcBack(s);
    assert.equal(s.display, "1");
    s = calcClear();
    assert.equal(s.display, "0");
  });

  it("formats tiny floats without exponential noise", () => {
    assert.equal(formatCalc(0.1 + 0.2), "0.3");
  });
});
