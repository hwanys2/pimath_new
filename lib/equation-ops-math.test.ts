import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROBLEM_COUNT,
  applyOp,
  assertAllProblemsBalanced,
  balanceToLatex,
  initialState,
  isStateSolved,
  problemAt,
  projectedScore,
  scoreForTime,
  validateOp,
  workspaceFromState,
} from "@/lib/equation-ops-math";

describe("equation-ops-math", () => {
  it("has 10 problems", () => {
    assert.equal(PROBLEM_COUNT, 10);
  });

  it("all problems start balanced", () => {
    assert.doesNotThrow(() => assertAllProblemsBalanced());
  });

  it("scoreForTime boundaries", () => {
    assert.equal(scoreForTime(0), 100);
    assert.equal(scoreForTime(90_000), 40);
    assert.equal(scoreForTime(200_000), 40);
    assert.equal(projectedScore(45_000), 70);
  });

  it("solves x + 3 = 8 via subtract 3", () => {
    const p = problemAt(0);
    let state = initialState(0);
    const check = validateOp(state, {
      kind: "subtract",
      target: "constant",
      value: 3,
    });
    assert.equal(check.ok, true);
    state = applyOp(state, { kind: "subtract", target: "constant", value: 3 });
    assert.equal(balanceToLatex(state.balance), "x = 5");
    assert.equal(isStateSolved(state, p.xValue), true);
  });

  it("solves 2x = 6 via divide 2", () => {
    const p = problemAt(2);
    let state = initialState(2);
    state = applyOp(state, { kind: "divide", target: "constant", value: 2 });
    assert.equal(isStateSolved(state, p.xValue), true);
  });

  it("solves 3x = x + 8 via subtract x then divide", () => {
    const p = problemAt(3);
    let state = initialState(3);
    state = applyOp(state, { kind: "subtract", target: "x", value: 1 });
    state = applyOp(state, { kind: "divide", target: "constant", value: 2 });
    assert.equal(isStateSolved(state, p.xValue), true);
  });

  it("rejects divide by non-divisor", () => {
    const state = initialState(2);
    const check = validateOp(state, {
      kind: "divide",
      target: "constant",
      value: 3,
    });
    assert.equal(check.ok, false);
  });

  it("workspace renders from state", () => {
    const state = initialState(2);
    const ws = workspaceFromState(state);
    assert.ok(ws.left.length > 0);
    assert.ok(ws.right.length > 0);
  });
});
