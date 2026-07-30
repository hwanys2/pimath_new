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
  getPedagogicalScaleOperations,
  isBalancedWs,
  isSolved,
  multiplyBothSides,
  panValue,
  problemAt,
  workspaceFromBalance,
  workspaceToBalance,
} from "@/lib/linear-equation-balance-math";

describe("linear-equation-balance-math", () => {
  it("has 15 problems", () => {
    assert.equal(PROBLEM_COUNT, 15);
    assert.equal(PROBLEMS.length, 15);
  });

  it("all problems start balanced", () => {
    assert.doesNotThrow(() => assertAllProblemsBalanced());
  });

  it("hides scale buttons on constant-only problems", () => {
    const p = problemAt(2);
    const ws = emptyTileWorkspace(p);
    const ops = getPedagogicalScaleOperations(ws, p);
    assert.equal(ops.flip, false);
    assert.equal(ops.multiply.length, 0);
    assert.equal(ops.divide.length, 0);
  });

  it("shows divide only when x coefficient is 2+ on one side", () => {
    const p = problemAt(7);
    const ws = emptyTileWorkspace(p);
    const ops = getPedagogicalScaleOperations(ws, p);
    assert.deepEqual(ops.divide, [2]);
    assert.equal(ops.flip, false);
  });

  it("hides divide on step 9 until x is on one side only", () => {
    const p = problemAt(8);
    const start = emptyTileWorkspace(p);
    assert.deepEqual(
      getPedagogicalScaleOperations(start, p).divide,
      [],
    );

    const afterMoveX = workspaceFromBalance({
      left: { x: 2, unit: -1 },
      right: { x: 0, unit: 3 },
    });
    assert.deepEqual(
      getPedagogicalScaleOperations(afterMoveX, p).divide,
      [],
    );

    const readyToDivide = workspaceFromBalance({
      left: { x: 2, unit: 0 },
      right: { x: 0, unit: 4 },
    });
    assert.deepEqual(
      getPedagogicalScaleOperations(readyToDivide, p).divide,
      [2],
    );
  });

  it("flipBothSides preserves balance on -2x = 6", () => {
    const p = problemAt(12);
    let ws = emptyTileWorkspace(p);
    ws = divideBothSides(ws, 2);
    const flipped = flipBothSides(ws);
    assert.ok(isBalancedWs(flipped, p.xValue));
  });

  it("multiplyBothSides doubles pan values while balanced", () => {
    const p = problemAt(10);
    const ws = emptyTileWorkspace(p);
    const doubled = multiplyBothSides(ws, 2);
    assert.equal(
      panValue(doubled.left, p.xValue),
      panValue(ws.left, p.xValue) * 2,
    );
    assert.equal(
      panValue(doubled.right, p.xValue),
      panValue(ws.right, p.xValue) * 2,
    );
    assert.ok(isBalancedWs(doubled, p.xValue));
  });

  it("solves 1/2 x = 3 via multiply by 2", () => {
    const p = problemAt(11);
    let ws = emptyTileWorkspace(p);
    const ops = getPedagogicalScaleOperations(ws, p);
    assert.deepEqual(ops.multiply, [2]);

    ws = multiplyBothSides(ws, 2);
    assert.ok(isSolved(ws, p.xValue));
    assert.equal(checkAnswer(p, ws).ok, true);
    assert.equal(workspaceToBalance(ws).left.x, 1);
    assert.equal(workspaceToBalance(ws).right.unit, 6);
  });

  it("solves -2x = 6 via divide then flip", () => {
    const p = problemAt(12);
    let ws = emptyTileWorkspace(p);
    ws = divideBothSides(ws, 2);
    ws = flipBothSides(ws);
    assert.ok(isSolved(ws, p.xValue));
    assert.equal(checkAnswer(p, ws).ok, true);
  });

  it("problem 5 starts with x on both sides", () => {
    const p = problemAt(5);
    const ws = emptyTileWorkspace(p);
    const expr = workspaceToBalance(ws);
    assert.ok(expr.left.x > 0 && expr.right.x > 0);
    const ops = getPedagogicalScaleOperations(ws, p);
    assert.equal(ops.flip, false);
    assert.equal(ops.divide.length, 0);
  });

  it("solves -2x + 4 = -2 via subtract, divide, flip", () => {
    const p = problemAt(13);
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
