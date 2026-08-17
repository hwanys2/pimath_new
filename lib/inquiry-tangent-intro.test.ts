import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HEIGHT_SCENES,
  PROBLEM_COUNT,
  TABLE_ANGLES,
  TABLE_STEP_INDEX,
  aggregateTangentScore,
  clampDistance,
  elevationAngleDeg,
  emptyTangentWorkspace,
  gradeTangentStep,
  heightIsCorrect,
  heightSceneAt,
  isTableStep,
  parseStudentNumber,
  ratioIsCorrect,
  scoreForAttempts,
  tanDeg,
  validateTangentSubmit,
} from "@/lib/inquiry-tangent-intro";
import {
  GRID_H,
  GRID_W,
  perpendicularThrough,
  projectOnSeg,
  snapPoint,
} from "@/lib/inquiry-tangent-sketch";

describe("tangent intro scenes", () => {
  it("has 3 height scenes and a table step", () => {
    assert.equal(HEIGHT_SCENES.length, 3);
    assert.equal(PROBLEM_COUNT, 4);
    assert.equal(TABLE_STEP_INDEX, 3);
    assert.equal(isTableStep(2), false);
    assert.equal(isTableStep(3), true);
    assert.equal(heightSceneAt(0)?.id, "building");
    assert.equal(heightSceneAt(3), null);
  });

  it("rounds elevation angle to 1 degree", () => {
    const building = HEIGHT_SCENES[0]!;
    assert.equal(
      elevationAngleDeg(building.heightM, 32),
      Math.round((Math.atan(24 / 32) * 180) / Math.PI),
    );
    assert.equal(elevationAngleDeg(12, 12), 45);
  });

  it("clamps observer distance to the scene range", () => {
    const tree = HEIGHT_SCENES[1]!;
    assert.equal(clampDistance(tree, 3), tree.minDistanceM);
    assert.equal(clampDistance(tree, 99), tree.maxDistanceM);
    assert.equal(clampDistance(tree, 20.4), 20);
  });
});

describe("parseStudentNumber", () => {
  it("accepts decimals, commas, fractions, and m suffix", () => {
    assert.equal(parseStudentNumber("24"), 24);
    assert.equal(parseStudentNumber("24m"), 24);
    assert.equal(parseStudentNumber("1,73"), 1.73);
    assert.equal(parseStudentNumber("3/5"), 0.6);
    assert.equal(parseStudentNumber(""), null);
    assert.equal(parseStudentNumber("abc"), null);
  });
});

describe("heightIsCorrect", () => {
  const building = HEIGHT_SCENES[0]!;

  it("accepts the true height", () => {
    assert.equal(heightIsCorrect(building, 32, 24), true);
  });

  it("accepts height from displayed angle within 12%", () => {
    const d = 32;
    const ang = elevationAngleDeg(building.heightM, d);
    const fromAngle = d * tanDeg(ang);
    assert.equal(heightIsCorrect(building, d, fromAngle), true);
  });

  it("rejects a far-off guess", () => {
    assert.equal(heightIsCorrect(building, 32, 8), false);
    assert.equal(heightIsCorrect(building, 32, 80), false);
  });

  it("uses a 1 m floor for the short tree", () => {
    const tree = HEIGHT_SCENES[1]!;
    assert.equal(heightIsCorrect(tree, 20, 12), true);
    assert.equal(heightIsCorrect(tree, 20, 11.2), true);
    assert.equal(heightIsCorrect(tree, 20, 6), false);
  });
});

describe("ratioIsCorrect", () => {
  it("accepts tan 45° = 1", () => {
    assert.equal(ratioIsCorrect(45, 1), true);
    assert.equal(ratioIsCorrect(45, 1.05), true);
    assert.equal(ratioIsCorrect(45, 2), false);
  });

  it("accepts approximate tan 30° and tan 60°", () => {
    assert.equal(ratioIsCorrect(30, 1 / Math.sqrt(3)), true);
    assert.equal(ratioIsCorrect(60, Math.sqrt(3)), true);
  });

  it("uses an absolute floor for small angles", () => {
    assert.equal(ratioIsCorrect(10, 0.18), true);
    assert.equal(ratioIsCorrect(10, 1), false);
  });
});

describe("validate and grade", () => {
  it("flags empty height as incomplete", () => {
    const ws = emptyTangentWorkspace(0);
    const notice = validateTangentSubmit(0, ws);
    assert.equal(notice?.reason, "incomplete");
  });

  it("grades a correct building height", () => {
    const ws = emptyTangentWorkspace(0);
    ws.heightText = "24";
    assert.equal(validateTangentSubmit(0, ws), null);
    const graded = gradeTangentStep(0, ws, 1);
    assert.equal(graded.result, "correct");
    if (graded.response.kind !== "height") throw new Error("expected height");
    assert.equal(graded.response.sceneId, "building");
    assert.equal(graded.response.wrongs, 1);
  });

  it("requires all eight table cells", () => {
    const ws = emptyTangentWorkspace(TABLE_STEP_INDEX);
    ws.ratios["10"] = "0.18";
    const notice = validateTangentSubmit(TABLE_STEP_INDEX, ws);
    assert.equal(notice?.reason, "incomplete");
  });

  it("grades a full tangent table", () => {
    const ws = emptyTangentWorkspace(TABLE_STEP_INDEX);
    for (const a of TABLE_ANGLES) {
      ws.ratios[String(a)] = String(tanDeg(a));
    }
    assert.equal(validateTangentSubmit(TABLE_STEP_INDEX, ws), null);
    const graded = gradeTangentStep(TABLE_STEP_INDEX, ws, 0);
    assert.equal(graded.result, "correct");
  });

  it("lists wrong table rows", () => {
    const ws = emptyTangentWorkspace(TABLE_STEP_INDEX);
    for (const a of TABLE_ANGLES) {
      ws.ratios[String(a)] = "1";
    }
    const notice = validateTangentSubmit(TABLE_STEP_INDEX, ws);
    assert.equal(notice?.reason, "wrong");
    assert.ok(notice?.wrongAngles?.includes(10));
    assert.ok(!notice?.wrongAngles?.includes(45));
  });
});

describe("score", () => {
  it("penalizes wrong attempts with a floor of 40", () => {
    assert.equal(scoreForAttempts(0), 100);
    assert.equal(scoreForAttempts(1), 85);
    assert.equal(scoreForAttempts(10), 40);
  });

  it("aggregates session score", () => {
    const ws0 = emptyTangentWorkspace(0);
    ws0.heightText = "24";
    const g0 = gradeTangentStep(0, ws0, 0);
    const agg = aggregateTangentScore(
      [{ stepIndex: 0, result: g0.result, response: g0.response }],
      PROBLEM_COUNT,
    );
    assert.equal(agg.correctCount, 1);
    assert.equal(agg.score, 100);
  });
});

describe("sketch geometry", () => {
  it("drops a vertical perpendicular on a horizontal base", () => {
    const seg = { id: "s", a: { x: 2, y: 0 }, b: { x: 10, y: 0 } };
    const perp = perpendicularThrough({ x: 10, y: 0 }, seg);
    assert.ok(perp);
    assert.equal(perp!.a.x, 10);
    assert.equal(perp!.b.x, 10);
    assert.equal(Math.min(perp!.a.y, perp!.b.y), 0);
    assert.equal(Math.max(perp!.a.y, perp!.b.y), GRID_H);
  });

  it("projects onto a segment and snaps to vertices", () => {
    const segs = [{ id: "s", a: { x: 0, y: 0 }, b: { x: 8, y: 0 } }];
    const proj = projectOnSeg({ x: 3, y: 0.2 }, segs[0]!.a, segs[0]!.b);
    assert.ok(proj.d < 0.3);
    const snapped = snapPoint({ x: -0.15, y: 0.12 }, segs);
    assert.equal(snapped.x, 0);
    assert.equal(snapped.y, 0);
    assert.equal(GRID_W, 16);
  });
});
