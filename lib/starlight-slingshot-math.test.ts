import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcCentralAngle,
  calcInscribedAngle,
  calcArcLength,
  degToRad,
  getLakeShorePoint,
  isDiameter,
  snapToDiameter,
  rayHitsCircle,
  createChapterEntities,
} from "./starlight-slingshot-math";
import { applyScoreGain } from "./xp";

describe("Starlight Lake Inscribed Slingshot - Math & Theorems", () => {
  it("verifies angle invariance: sliding P along circular shore preserves inscribed angle", () => {
    // Chord AB subtends an arc of 70 degrees
    const posA = getLakeShorePoint(degToRad(20));
    const posB = getLakeShorePoint(degToRad(90));

    const central = calcCentralAngle(posA, posB);
    assert.ok(Math.abs(central - 70) < 0.2, `Central angle should be 70°, got ${central}`);

    // Slide P to various positions on the major arc
    const testPositions = [160, 200, 250, 300, 340];
    for (const deg of testPositions) {
      const posP = getLakeShorePoint(degToRad(deg));
      const inscribed = calcInscribedAngle(posP, posA, posB);
      assert.ok(
        Math.abs(inscribed - 35) < 0.2,
        `Inscribed angle at P=${deg}° should be exactly 35°, got ${inscribed}`,
      );
    }
  });

  it("verifies Thales theorem: diameter produces absolute 90° right angle", () => {
    // Diameter AB passing through center
    const angleA = degToRad(30);
    const angleB = degToRad(210); // 30 + 180 = 210

    const posA = getLakeShorePoint(angleA);
    const posB = getLakeShorePoint(angleB);

    assert.ok(isDiameter(angleA, angleB).isDiameter, "AB should be recognized as diameter");

    const pAngles = [70, 110, 150, 250, 290, 340];
    for (const deg of pAngles) {
      const posP = getLakeShorePoint(degToRad(deg));
      const angle = calcInscribedAngle(posP, posA, posB);
      assert.ok(
        Math.abs(angle - 90) < 0.2,
        `Angle at P=${deg}° must be 90°, got ${angle}`,
      );
    }
  });

  it("verifies diameter snap helper", () => {
    const angleA = degToRad(40);
    const angleB = degToRad(215); // off by 5 deg from 220
    const snapped = snapToDiameter(angleA, angleB, 14);
    assert.ok(
      Math.abs(snapped - degToRad(220)) < 1e-4,
      `Snapped B should be 220°, got ${(snapped * 180) / Math.PI}`,
    );
  });

  it("verifies 2:1 relationship between central angle and inscribed angle", () => {
    const posA = getLakeShorePoint(degToRad(10));
    const posB = getLakeShorePoint(degToRad(110));
    const posP = getLakeShorePoint(degToRad(250));

    const central = calcCentralAngle(posA, posB);
    const inscribed = calcInscribedAngle(posP, posA, posB);

    assert.ok(Math.abs(central - 100) < 0.2);
    assert.ok(Math.abs(inscribed - 50) < 0.2);
    assert.ok(Math.abs(central - 2 * inscribed) < 0.2);
  });

  it("verifies arc length is proportional to the subtended angle", () => {
    const arc1 = calcArcLength(degToRad(0), degToRad(30));
    const arc2 = calcArcLength(degToRad(0), degToRad(60));

    assert.ok(Math.abs(arc2 - 2 * arc1) < 1e-4, "Double angle should produce double arc length");
  });

  it("verifies ray-circle collision detection for slingshot trajectory", () => {
    const p1 = { x: 100, y: 280 };
    const p2 = { x: 500, y: 280 };
    const slimeCenter = { x: 300, y: 280 };
    const hit = rayHitsCircle(p1, p2, slimeCenter, 20);
    assert.equal(hit, true);

    const miss = rayHitsCircle(p1, p2, { x: 300, y: 100 }, 20);
    assert.equal(miss, false);
  });

  it("verifies chapter entity creation for chapters 1 to 5", () => {
    for (let c = 1; c <= 5; c++) {
      const { slimes, obstacles } = createChapterEntities(c);
      assert.ok(slimes.length > 0, `Chapter ${c} should have slimes`);
      if (c === 1) {
        assert.ok(obstacles.length > 0, "Chapter 1 should have lily pad obstacles");
      }
    }
  });

  it("verifies soft-cap score progression conforms to Pimath 1000-pt rule", () => {
    let score = 0;
    score = applyScoreGain(score, 300);
    assert.equal(score, 300);

    score = applyScoreGain(score, 680);
    assert.equal(score, 980);

    score = applyScoreGain(score, 40);
    assert.equal(score, 1020);

    // Above 1000 soft-cap: each correct action adds only +1
    score = applyScoreGain(score, 50);
    assert.equal(score, 1021);
    score = applyScoreGain(score, 100);
    assert.equal(score, 1022);
  });
});
