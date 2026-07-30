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
  parseRational,
  rat,
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

describe("parseRational", () => {
  it("parses integers and fractions with optional sign on coeff", () => {
    assert.deepEqual(parseRational("3", { allowNegative: true }), rat(3));
    assert.deepEqual(parseRational("-2", { allowNegative: true }), rat(-2));
    assert.deepEqual(parseRational("1/2", { allowNegative: true }), rat(1, 2));
    assert.deepEqual(
      parseRational("-3/4", { allowNegative: true }),
      rat(-3, 4),
    );
    assert.deepEqual(parseRational("2/4", { allowNegative: false }), rat(1, 2));
  });

  it("rejects negatives for radicand and zero", () => {
    assert.equal(parseRational("-2", { allowNegative: false }), null);
    assert.equal(parseRational("-1/2", { allowNegative: false }), null);
    assert.equal(parseRational("0", { allowNegative: true }), null);
    assert.equal(parseRational("3/", { allowNegative: true }), null);
  });
});

describe("rational / negative terms", () => {
  it("accepts negative coefficient", () => {
    // −2√8 + √50 + √18 = −4√2 + 5√2 + 3√2 = 4√2 — wait need 5√2
    // −1√8 + √50 + √18 = −2√2 + 5√2 + 3√2 = 6√2 — for p6 ops + - +
    // p4: □√□ + √□ − □√□ = 5√2
    // −1√32 + √8 − (−3)√2 → but second has no coeff, third has coeff
    // −2√18 + √50 − (−3)√8 = −6√2 + 5√2 − (−6√2) = −6+5+6 = 5√2
    // numbers: -2, 18, 50, -3, 8 — wait third coeff -3 and... -2 and -3 distinct, 18,50,8 distinct
    // TermFill: coeff -2 rad 18; null rad 50; coeff -3 rad 8
    // Expression: -2√18 + √50 - (-3)√8 = -6√2 + 5√2 - (-6√2) = -6+5+6 = 5√2 ✓
    // But ops are + - so it's a + b - c where c = (-3)√8
    // a + b - c = -2√18 + √50 - (-3√8) = -6√2 + 5√2 - (-3*2√2) = -6+5+6 = 5√2 ✓
    const fills: TermFill[] = [
      { coeff: rat(-2), radicand: rat(18) },
      { coeff: null, radicand: rat(50) },
      { coeff: rat(-3), radicand: rat(8) },
    ];
    const result = checkAnswer(PROBLEMS[3]!, fills);
    assert.equal(result.ok, true, result.reason);
  });

  it("accepts positive fraction under radical", () => {
    // √(1/2) = √2/2, so 10 * √(1/2) = 5√2 — need problem structure
    // Use termToMap directly
    const m = termToMap(rat(10), rat(1, 2));
    assert.ok(mapsEqual(m, mapFromFixed([{ coeff: 5, radicand: 2 }])));
  });

  it("rejects negative radicand via parse", () => {
    assert.equal(parseRational("-8", { allowNegative: false }), null);
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

  it("rejects duplicate numbers including equivalent fractions", () => {
    const fills: TermFill[] = [
      { coeff: null, radicand: rat(32) },
      { coeff: null, radicand: rat(64, 2) }, // = 32
      { coeff: null, radicand: rat(8) },
    ];
    const result = checkAnswer(PROBLEMS[0]!, fills);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "duplicate");
  });

  it("rejects incomplete fills", () => {
    const fills: TermFill[] = [
      { coeff: null, radicand: rat(32) },
      { coeff: null, radicand: null },
      { coeff: null, radicand: rat(8) },
    ];
    const result = checkAnswer(PROBLEMS[0]!, fills);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "incomplete");
  });

  it("rejects wrong but distinct values", () => {
    const fills: TermFill[] = [
      { coeff: null, radicand: rat(2) },
      { coeff: null, radicand: rat(8) },
      { coeff: null, radicand: rat(18) },
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
