import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROBLEMS,
  SAMPLE_FILLS,
  checkAnswer,
  extractSquareFactors,
  scoreForAttempts,
  MIN_CORRECT_SCORE,
  MAX_CORRECT_SCORE,
  WRONG_PENALTY,
  mapsEqual,
  mapFromFixed,
  termToMap,
  evalExpression,
  type TermFill,
} from "@/lib/radical-fill-math";

describe("extractSquareFactors", () => {
  it("pulls perfect-square factors", () => {
    assert.deepEqual(extractSquareFactors(32), {
      multiplier: 4,
      squareFree: 2,
    });
    assert.deepEqual(extractSquareFactors(18), {
      multiplier: 3,
      squareFree: 2,
    });
    assert.deepEqual(extractSquareFactors(8), {
      multiplier: 2,
      squareFree: 2,
    });
    assert.deepEqual(extractSquareFactors(12), {
      multiplier: 2,
      squareFree: 3,
    });
  });
});

describe("evalExpression sample √32+√18-√8", () => {
  it("equals 5√2", () => {
    const lhs = evalExpression(
      [termToMap(1, 32), termToMap(1, 18), termToMap(1, 8)],
      ["+", "-"],
    );
    assert.ok(lhs);
    assert.ok(mapsEqual(lhs, mapFromFixed([{ coeff: 5, radicand: 2 }])));
  });
});

describe("checkAnswer", () => {
  it("accepts all SAMPLE_FILLS", () => {
    assert.equal(PROBLEMS.length, 10);
    assert.equal(SAMPLE_FILLS.length, 10);
    for (let i = 0; i < PROBLEMS.length; i++) {
      const result = checkAnswer(PROBLEMS[i]!, SAMPLE_FILLS[i]!);
      assert.equal(
        result.ok,
        true,
        `problem ${i + 1} (${PROBLEMS[i]!.id}): ${result.reason}`,
      );
    }
  });

  it("rejects duplicate numbers", () => {
    const fills: TermFill[] = [
      { coeff: null, radicand: 32 },
      { coeff: null, radicand: 32 },
      { coeff: null, radicand: 8 },
    ];
    const result = checkAnswer(PROBLEMS[0]!, fills);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "duplicate");
  });

  it("rejects incomplete fills", () => {
    const fills: TermFill[] = [
      { coeff: null, radicand: 32 },
      { coeff: null, radicand: null },
      { coeff: null, radicand: 8 },
    ];
    const result = checkAnswer(PROBLEMS[0]!, fills);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "incomplete");
  });

  it("rejects wrong but distinct values", () => {
    const fills: TermFill[] = [
      { coeff: null, radicand: 2 },
      { coeff: null, radicand: 8 },
      { coeff: null, radicand: 18 },
    ];
    const result = checkAnswer(PROBLEMS[0]!, fills);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "wrong");
  });
});

describe("scoreForAttempts", () => {
  it("gives max score with zero wrongs", () => {
    assert.equal(scoreForAttempts(0), MAX_CORRECT_SCORE);
  });

  it("deducts per wrong attempt down to the floor", () => {
    assert.equal(scoreForAttempts(1), MAX_CORRECT_SCORE - WRONG_PENALTY);
    assert.equal(scoreForAttempts(2), MAX_CORRECT_SCORE - 2 * WRONG_PENALTY);
    assert.equal(scoreForAttempts(10), MIN_CORRECT_SCORE);
  });
});
