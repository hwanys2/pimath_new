import test from "node:test";
import assert from "node:assert/strict";
import {
  degToRad,
  radToDeg,
  getCirclePoint,
  calcInscribedAngle,
  calcCentralAngle,
  isDiameter,
  snapToDiameter,
  launchTwinBalls,
  stepBallPosition,
  bounceOffCircleWall,
  checkAndResolvePegHit,
  isRoundCleared,
  createRoundPegs,
  ROUNDS,
  CIRCLE_CENTER_X,
  CIRCLE_CENTER_Y,
  CIRCLE_RADIUS,
  SlimePeg,
} from "./inscribed-pop-math";

test("Inscribed Angle Invariance: angle remains constant as vertex P moves on same major arc", () => {
  const angleA = degToRad(30);
  const angleB = degToRad(150);
  const ptA = getCirclePoint(angleA);
  const ptB = getCirclePoint(angleB);

  // Central angle for chord AB
  const centralAngle = calcCentralAngle(ptA, ptB);
  assert.ok(
    Math.abs(centralAngle - 120) < 0.1,
    `Expected central angle ~120, got ${centralAngle}`,
  );

  // For any point P on the opposite arc (e.g. 210°, 240°, 270°, 300°),
  // inscribed angle must be exactly half of central angle = 60°
  const testAnglesP = [210, 240, 270, 300].map(degToRad);
  for (const angP of testAnglesP) {
    const ptP = getCirclePoint(angP);
    const inscribed = calcInscribedAngle(ptP, ptA, ptB);
    assert.ok(
      Math.abs(inscribed - 60) < 0.1,
      `Angle at vertex ${radToDeg(angP)}° should be 60°, got ${inscribed}`,
    );
  }
});

test("Central Angle Theorem: central angle is exactly twice the inscribed angle", () => {
  const angleA = degToRad(40);
  const angleB = degToRad(120);
  const ptA = getCirclePoint(angleA);
  const ptB = getCirclePoint(angleB);
  const ptP = getCirclePoint(degToRad(260));

  const central = calcCentralAngle(ptA, ptB);
  const inscribed = calcInscribedAngle(ptP, ptA, ptB);

  assert.ok(
    Math.abs(central - 2 * inscribed) < 0.1,
    `Central angle (${central}) must be 2 * inscribed (${inscribed})`,
  );
});

test("Thales' Theorem: Inscribed angle subtended by a diameter is always 90°", () => {
  const angleA = degToRad(45);
  const angleB = degToRad(225); // exactly diameter opposite (180° difference)
  const ptA = getCirclePoint(angleA);
  const ptB = getCirclePoint(angleB);

  const { isDiameter: diameterOk } = isDiameter(angleA, angleB, 1);
  assert.equal(diameterOk, true);

  // Any point P on semicircle
  const testAngles = [100, 135, 170, 280, 315].map(degToRad);
  for (const angP of testAngles) {
    const ptP = getCirclePoint(angP);
    const inscribed = calcInscribedAngle(ptP, ptA, ptB);
    assert.ok(
      Math.abs(inscribed - 90) < 0.1,
      `Angle on diameter should be 90°, got ${inscribed}`,
    );
  }
});

test("Diameter snap: snaps nearly opposite angles to exact diameter", () => {
  const angleA = degToRad(30);
  const nearDiameterB = degToRad(205); // 175° diff, within 14° tolerance
  const snapped = snapToDiameter(angleA, nearDiameterB, 14);

  const snappedDeg = radToDeg(snapped);
  assert.ok(
    Math.abs(snappedDeg - 210) < 0.001,
    `Should snap to 210°, got ${snappedDeg}`,
  );
});

test("Twin Ball Launch: generates two balls pointing toward pins A and B", () => {
  const p = { x: 300, y: 510 };
  const a = { x: 100, y: 280 };
  const b = { x: 500, y: 280 };

  const balls = launchTwinBalls(p, a, b, false, 400, 42);
  assert.equal(balls.length, 2);

  // Ball A travels towards (-200, -230) -> vx < 0, vy < 0
  assert.ok(balls[0].vx < 0);
  assert.ok(balls[0].vy < 0);

  // Ball B travels towards (+200, -230) -> vx > 0, vy < 0
  assert.ok(balls[1].vx > 0);
  assert.ok(balls[1].vy < 0);
});

test("stepBallPosition: updates ball coordinates and applies gravity to vy", () => {
  const ball = {
    id: "step-test",
    x: 100,
    y: 100,
    vx: 50,
    vy: -20,
    radius: 7,
    bouncesLeft: 5,
    isThales90: false,
    isCenterOvercharge: false,
    alive: true,
  };

  stepBallPosition(ball, 0.1, 200);
  assert.equal(ball.x, 105);
  assert.equal(ball.y, 98);
  assert.equal(ball.vy, 0); // -20 + 200 * 0.1 = 0
});

test("Circle Wall Bounce: reflects ball back inward and reduces bounce count", () => {
  const ball = {
    id: "test-ball",
    x: CIRCLE_CENTER_X + CIRCLE_RADIUS - 1,
    y: CIRCLE_CENTER_Y,
    vx: 300, // moving outward to the right
    vy: 0,
    radius: 7,
    bouncesLeft: 5,
    isThales90: false,
    isCenterOvercharge: false,
    alive: true,
  };

  const bounced = bounceOffCircleWall(ball);
  assert.equal(bounced, true);
  assert.ok(ball.vx < 0, "Ball should have reflected horizontally inward");
  assert.equal(ball.bouncesLeft, 4);
});

test("Peg Hit: Armored peg requires Thales 90° to pop", () => {
  const normalBall = {
    id: "normal",
    x: 200,
    y: 200,
    vx: 100,
    vy: 0,
    radius: 7,
    bouncesLeft: 5,
    isThales90: false,
    isCenterOvercharge: false,
    alive: true,
  };

  const armoredPeg: SlimePeg = {
    id: "armored-1",
    type: "armored",
    x: 215,
    y: 200,
    radius: 15,
    hp: 1,
    maxHp: 1,
    bobPhase: 0,
    scoreValue: 80,
    popped: false,
  };

  // Normal shot should be shielded
  const res1 = checkAndResolvePegHit(normalBall, armoredPeg);
  assert.equal(res1, "shielded");
  assert.equal(armoredPeg.popped, false);

  // Thales 90 shot should pop the armor
  const thalesBall = {
    ...normalBall,
    x: 200,
    y: 200,
    vx: 100,
    vy: 0,
    isThales90: true,
  };
  const res2 = checkAndResolvePegHit(thalesBall, armoredPeg);
  assert.equal(res2, "popped");
  assert.equal(armoredPeg.popped, true);
});

test("Peg Hit: Center Sun peg triggers center overcharge without popping", () => {
  const ball = {
    id: "center-seeker",
    x: CIRCLE_CENTER_X - 10,
    y: CIRCLE_CENTER_Y,
    vx: 100,
    vy: 0,
    radius: 7,
    bouncesLeft: 5,
    isThales90: false,
    isCenterOvercharge: false,
    alive: true,
  };

  const sunPeg: SlimePeg = {
    id: "sun-1",
    type: "center",
    x: CIRCLE_CENTER_X,
    y: CIRCLE_CENTER_Y,
    radius: 20,
    hp: 999,
    maxHp: 999,
    bobPhase: 0,
    scoreValue: 50,
    popped: false,
  };

  const res = checkAndResolvePegHit(ball, sunPeg);
  assert.equal(res, "center_overcharge");
  assert.equal(ball.isCenterOvercharge, true);
  assert.equal(sunPeg.popped, false);
});

test("Round clearance logic: round is cleared only when all targets and armored slimes pop", () => {
  const pegs = createRoundPegs(1);
  assert.equal(isRoundCleared(pegs), false);

  // Pop all targets
  for (const peg of pegs) {
    if (peg.type === "target") {
      peg.popped = true;
    }
  }
  assert.equal(isRoundCleared(pegs), true);
  assert.ok(ROUNDS.length >= 5);
});
