import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROBLEMS,
  PROBLEM_COUNT,
  assertAllProblemsBalanced,
  checkAnswer,
  divideBothSides,
  emptyTileWorkspace,
  flipBothSides,
  isBalancedWs,
  isSolved,
  multiplyBothSides,
  panValue,
  problemAt,
  workspaceFromBalance,
} from "@/lib/linear-equation-balance-math";

describe("linear-equation-balance-math", () => {
  it("has 15 problems", () => {
    assert.equal(PROBLEM_COUNT, 15);
    assert.equal(PROBLEMS.length, 15);
  });

  it("all problems start balanced", () => {
    assert.doesNotThrow(() => assertAllProblemsBalanced());
  });

  it("flipBothSides preserves balance", () => {
    const p = problemAt(11);
    const ws = emptyTileWorkspace(p);
    const flipped = flipBothSides(ws);
    assert.ok(isBalancedWs(flipped, p.xValue));
    assert.equal(
      panValue(flipped.left, p.xValue),
      panValue(flipped.right, p.xValue),
    );
  });

  it("multiplyBothSides doubles pan values while balanced", () => {
    const p = problemAt(10);
    const ws = emptyTileWorkspace(p);
    const doubled = multiplyBothSides(ws, 2);
    assert.equal(panValue(doubled.left, p.xValue), panValue(ws.left, p.xValue) * 2);
    assert.equal(
      panValue(doubled.right, p.xValue),
      panValue(ws.right, p.xValue) * 2,
    );
    assert.ok(isBalancedWs(doubled, p.xValue));
  });

  it("solves -x = 5 via flip", () => {
    const p = problemAt(11);
    let ws = emptyTileWorkspace(p);
    ws = flipBothSides(ws);
    assert.ok(isSolved(ws, p.xValue));
    assert.equal(checkAnswer(p, ws).ok, true);
  });

  it("solves -2x = 6 via divide then flip", () => {
    const p = problemAt(13);
    let ws = emptyTileWorkspace(p);
    ws = divideBothSides(ws, 2);
    ws = flipBothSides(ws);
    assert.ok(isSolved(ws, p.xValue));
    assert.equal(checkAnswer(p, ws).ok, true);
  });

  it("solves -2x + 4 = -2 via subtract, divide, flip", () => {
    const p = problemAt(14);
    let ws = workspaceFromBalance({
      left: { x: -2, unit: 0 },
      right: { x: 0, unit: -6 },
    });
    ws = divideBothSides(ws, 2);
    ws = flipBothSides(ws);
    assert.ok(isSolved(ws, p.xValue));
    assert.equal(checkAnswer(p, ws).ok, true);
  });
});
