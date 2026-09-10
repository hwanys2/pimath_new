import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TRIPLES,
  ROUND_PLAN,
  TOTAL_ROUNDS,
  planTotalPoints,
  isTripleValid,
  generateAllRounds,
  generateRound,
  chordLength,
  tangentLength,
  isInLockZone,
  liveMetric,
  targetMetric,
  checkTap,
  checkEqual,
  pointsForLock,
  SPEED_BONUS_POINTS,
} from "@/lib/starlight-seal-math";

describe("starlight-seal-math (drag challenge)", () => {
  it("triples are Pythagorean and plan totals 1000 over 12 rounds", () => {
    for (const t of TRIPLES) assert.equal(isTripleValid(t), true);
    assert.equal(ROUND_PLAN.length, TOTAL_ROUNDS);
    assert.equal(planTotalPoints(), 1000);
  });

  it("chordLength / tangentLength match triples", () => {
    assert.ok(Math.abs(chordLength(13, 5) - 24) < 1e-9);
    assert.ok(Math.abs(tangentLength(13, 5) - 12) < 1e-9);
  });

  it("generates 12 playable rounds", () => {
    const rounds = generateAllRounds(() => 0.3);
    assert.equal(rounds.length, 12);
    for (const r of rounds) {
      assert.ok(r.prompt.length > 0);
      assert.ok(r.r > 0);
      if (r.kind === "tap-longest") {
        assert.ok(r.tapChords && r.tapChords.length >= 3);
        assert.ok(checkTap(r, r.tapAnswerId!));
      }
      if (r.kind === "tangent-equal") {
        assert.ok(r.equalOptions && r.equalOptions.length >= 2);
        assert.ok(checkEqual(r, r.equalAnswerId!));
      }
      if (
        r.kind === "chord-length" ||
        r.kind === "chord-dist" ||
        r.kind === "chord-equal" ||
        r.kind === "tangent-length"
      ) {
        assert.ok(r.dragMax > r.dragMin);
        assert.equal(isInLockZone(r, r.kind.includes("tangent") ? r.targetPo : r.targetDist), true);
        assert.ok(
          Math.abs(liveMetric(r, r.kind.includes("chord-dist") ? r.targetDist : r.kind.includes("tangent") ? r.targetPo : r.targetDist) - targetMetric(r)) < 0.01 ||
            r.kind === "chord-dist",
        );
      }
    }
  });

  it("lock zone rejects far values", () => {
    const r = generateRound(0, () => 0.2);
    assert.equal(isInLockZone(r, r.targetDist), true);
    assert.equal(isInLockZone(r, r.dragMax), false);
  });

  it("pointsForLock adds speed bonus", () => {
    const r = generateRound(0, () => 0.4);
    assert.equal(pointsForLock(r, 20, false), r.points);
    assert.equal(pointsForLock(r, 3, false), r.points + SPEED_BONUS_POINTS);
    assert.equal(pointsForLock(r, 3, true), r.points + SPEED_BONUS_POINTS + 5);
  });

  it("all slots generate across rng", () => {
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      for (const v of [0.05, 0.4, 0.7, 0.95]) {
        assert.doesNotThrow(() => generateRound(i, () => v));
      }
    }
  });
});
