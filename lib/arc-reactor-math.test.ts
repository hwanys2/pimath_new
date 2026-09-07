import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcCentralAngle,
  calcInscribedAngle,
  degToRad,
  getCirclePoint,
  isDiameter,
  snapToDiameter,
  isPointInSector,
  lineIntersectsCircle,
  createWaveEntities,
} from "./arc-reactor-math";
import { applyScoreGain } from "./xp";

describe("Arc Reactor Geometry & Theorem verification", () => {
  it("verifies angle invariance: P moving along major arc preserves angle exactly", () => {
    // Chord AB subtends central angle 80 degrees
    const posA = getCirclePoint(degToRad(30));
    const posB = getCirclePoint(degToRad(110));

    const centralAngle = calcCentralAngle(posA, posB);
    assert.ok(Math.abs(centralAngle - 80) < 0.1, `Central angle should be ~80, got ${centralAngle}`);

    // Test multiple P positions along the major arc (outside arc AB)
    const testAngles = [180, 220, 270, 320, 350];
    for (const angle of testAngles) {
      const posP = getCirclePoint(degToRad(angle));
      const inscribedAngle = calcInscribedAngle(posP, posA, posB);
      assert.ok(
        Math.abs(inscribedAngle - 40) < 0.1,
        `Inscribed angle at P=${angle}° should be exactly 40°, got ${inscribedAngle}`,
      );
    }
  });

  it("verifies Thales theorem: any inscribed angle on a diameter is exactly 90 degrees", () => {
    // Diameter AB passing through center
    const angleA = degToRad(20);
    const angleB = degToRad(200); // 20 + 180 = 200

    const posA = getCirclePoint(angleA);
    const posB = getCirclePoint(angleB);

    assert.ok(isDiameter(angleA, angleB).isDiameter, "AB should be recognized as diameter");

    // Any point P on semicircle
    const pAngles = [50, 90, 140, 230, 270, 330];
    for (const pa of pAngles) {
      const posP = getCirclePoint(degToRad(pa));
      const angle = calcInscribedAngle(posP, posA, posB);
      assert.ok(
        Math.abs(angle - 90) < 0.2,
        `Thales angle at P=${pa}° should be 90°, got ${angle}`,
      );
    }
  });

  it("verifies diameter snapping helper", () => {
    const angleA = degToRad(45);
    // B is slightly off diameter (220 deg instead of 225 deg, diff is 5 deg <= 12 deg tolerance)
    const angleB = degToRad(220);
    const snappedB = snapToDiameter(angleA, angleB, 12);
    assert.ok(
      Math.abs(snappedB - degToRad(225)) < 1e-4,
      `Snapped B should be 225°, got ${(snappedB * 180) / Math.PI}`,
    );
  });

  it("verifies central angle is exactly twice the inscribed angle", () => {
    const posA = getCirclePoint(degToRad(0));
    const posB = getCirclePoint(degToRad(120));
    const posP = getCirclePoint(degToRad(240));

    const central = calcCentralAngle(posA, posB);
    const inscribed = calcInscribedAngle(posP, posA, posB);

    assert.ok(Math.abs(central - 120) < 0.1);
    assert.ok(Math.abs(inscribed - 60) < 0.1);
    assert.ok(Math.abs(central - 2 * inscribed) < 0.1);
  });

  it("verifies inscribed quadrilateral opposite angles sum to 180 degrees", () => {
    // 4 points on circle in order: A, B, C, D
    const posA = getCirclePoint(degToRad(30));
    const posB = getCirclePoint(degToRad(100));
    const posC = getCirclePoint(degToRad(210));
    const posD = getCirclePoint(degToRad(310));

    const angleB = calcInscribedAngle(posB, posA, posC);
    const angleD = calcInscribedAngle(posD, posA, posC);
    const sumBD = angleB + angleD;

    assert.ok(
      Math.abs(sumBD - 180) < 0.2,
      `Opposite angles B + D should be 180°, got ${sumBD}`,
    );

    const angleA = calcInscribedAngle(posA, posB, posD);
    const angleC = calcInscribedAngle(posC, posB, posD);
    const sumAC = angleA + angleC;

    assert.ok(
      Math.abs(sumAC - 180) < 0.2,
      `Opposite angles A + C should be 180°, got ${sumAC}`,
    );
  });

  it("verifies sector and line collision detection", () => {
    const inside = isPointInSector(350, 310, 320, 310, 100, degToRad(-30), degToRad(30));
    assert.equal(inside, true);

    const outside = isPointInSector(200, 310, 320, 310, 100, degToRad(-30), degToRad(30));
    assert.equal(outside, false);

    const hit = lineIntersectsCircle({ x: 100, y: 310 }, { x: 500, y: 310 }, { x: 320, y: 310 }, 20);
    assert.equal(hit, true);
  });

  it("verifies wave generation produces correct entities for waves 1 to 5", () => {
    for (let w = 1; w <= 5; w++) {
      const { targets, barriers } = createWaveEntities(w);
      assert.ok(targets.length > 0, `Wave ${w} should have targets`);
      if (w === 1 || w === 5) {
        assert.ok(barriers.length > 0, `Wave ${w} should have barriers`);
      }
    }
  });

  it("verifies Pimath soft cap progression: adds normal score below 1000, and +1 above 1000", () => {
    let score = 0;
    score = applyScoreGain(score, 200);
    assert.equal(score, 200);

    score = applyScoreGain(score, 750);
    assert.equal(score, 950);

    // Reaching 1000+
    score = applyScoreGain(score, 60);
    assert.equal(score, 1010);

    // Once >= 1000, any gain gives +1
    score = applyScoreGain(score, 50);
    assert.equal(score, 1011);

    score = applyScoreGain(score, 100);
    assert.equal(score, 1012);
  });
});
