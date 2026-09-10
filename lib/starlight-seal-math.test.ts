import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TRIPLES,
  SEAL_PLAN,
  TOTAL_SEALS,
  START_ENERGY,
  sealPlanTotalPoints,
  isTripleValid,
  generateSeal,
  generateAllSeals,
  checkAnswer,
  pointsFor,
  buildIncircleFromTangents,
  buildCircumQuad,
  SPEED_BONUS_POINTS,
} from "@/lib/starlight-seal-math";

function fixedRng(seq: number[]): () => number {
  let i = 0;
  return () => {
    const v = seq[i % seq.length] ?? 0.5;
    i += 1;
    return v;
  };
}

describe("starlight-seal-math", () => {
  it("all triples satisfy a²+b²=c²", () => {
    for (const t of TRIPLES) {
      assert.equal(isTripleValid(t), true, `${t} should be Pythagorean`);
    }
  });

  it("has exactly 12 seals totaling 1000 points", () => {
    assert.equal(SEAL_PLAN.length, TOTAL_SEALS);
    assert.equal(SEAL_PLAN.length, 12);
    assert.equal(sealPlanTotalPoints(), 1000);
    assert.equal(START_ENERGY, 3);
  });

  it("generateAllSeals produces 12 valid seals", () => {
    const seals = generateAllSeals(fixedRng([0.1, 0.3, 0.5, 0.7, 0.9, 0.2]));
    assert.equal(seals.length, 12);
    for (const seal of seals) {
      assert.ok(seal.prompt.length > 0);
      assert.ok(seal.solution.length > 0);
      assert.ok(seal.scene);
      assert.ok(seal.points > 0);
      if (seal.kind === "judge") {
        assert.ok(seal.options && seal.options.length >= 2);
        assert.ok(
          seal.options.some((o) => o.id === String(seal.answer)),
          `judge answer ${seal.answer} must be in options`,
        );
      } else {
        assert.equal(typeof seal.answer, "number");
        assert.ok(Number.isFinite(seal.answer as number));
        assert.ok((seal.answer as number) > 0 || seal.answer === 0);
      }
    }
  });

  it("checkAnswer works for numbers and strings", () => {
    const calc = generateSeal(1, fixedRng([0.2, 0.4, 0.6]));
    assert.equal(checkAnswer(calc, calc.answer), true);
    assert.equal(checkAnswer(calc, Number(calc.answer)), true);
    assert.equal(checkAnswer(calc, -999), false);

    const judge = generateSeal(0, fixedRng([0.1, 0.2, 0.3, 0.4]));
    assert.equal(checkAnswer(judge, judge.answer), true);
    assert.equal(checkAnswer(judge, "___wrong___"), false);
  });

  it("pointsFor halves on second calc attempt and adds speed bonus", () => {
    const calc = generateSeal(1, () => 0.3);
    const full = pointsFor(calc, 1, 20);
    assert.equal(full, calc.points);
    const half = pointsFor(calc, 2, 5);
    assert.equal(half, Math.floor(calc.points / 2));
    const fast = pointsFor(calc, 1, 10);
    assert.equal(fast, calc.points + SPEED_BONUS_POINTS);

    const judge = generateSeal(0, () => 0.4);
    assert.equal(pointsFor(judge, 1, 1), judge.points);
  });

  it("buildIncircleFromTangents yields valid triangle", () => {
    const built = buildIncircleFromTangents(3, 4, 5);
    assert.ok(built);
    const [a, b, c] = built!.sides;
    assert.equal(a, 9);
    assert.equal(b, 8);
    assert.equal(c, 7);
    assert.ok(a + b > c && b + c > a && c + a > b);
    assert.equal(buildIncircleFromTangents(0, 1, 1), null);
  });

  it("buildCircumQuad checks AB+CD=AD+BC", () => {
    assert.equal(buildCircumQuad(6, 5, 4, 5), true);
    assert.equal(buildCircumQuad(6, 5, 4, 4), false);
  });

  it("right-incircle boss has integer r=(a+b-c)/2", () => {
    for (let seed = 0; seed < 8; seed++) {
      const seal = generateSeal(11, () => (seed + 1) / 10);
      assert.equal(seal.slotId, "right-incircle-r");
      assert.equal(typeof seal.answer, "number");
      const r = seal.answer as number;
      assert.ok(Number.isInteger(r) && r > 0);
      if (seal.scene.kind === "right-incircle") {
        assert.equal((seal.scene.a + seal.scene.b - seal.scene.c) / 2, r);
      }
    }
  });

  it("every slot generates without throw across rng values", () => {
    for (let i = 0; i < TOTAL_SEALS; i++) {
      for (const v of [0.01, 0.25, 0.5, 0.75, 0.99]) {
        assert.doesNotThrow(() => generateSeal(i, () => v));
      }
    }
  });
});
